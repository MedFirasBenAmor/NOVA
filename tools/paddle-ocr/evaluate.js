const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { DriverLicenseExtractor } = require('../../apps/api/dist/documents/driver-license.extractor.js');

const root = __dirname;
const extractor = new DriverLicenseExtractor();
const fields = ['driver.first_name', 'driver.last_name', 'driver.date_of_birth'];

async function ocr(file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'image/png' }), path.basename(file));
  const started = performance.now();
  const response = await fetch('http://127.0.0.1:8001/ocr', { method: 'POST', body: form });
  if (!response.ok) throw new Error(`OCR_${response.status}`);
  const result = await response.json();
  return { result: { ...result, textBlocks: result.blocks }, roundTripMs: performance.now() - started };
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
}

async function dataset(directory, name) {
  const golden = JSON.parse(fs.readFileSync(path.join(directory, 'golden.json')));
  const totals = Object.fromEntries(fields.map(field => [field, { expected: 0, emitted: 0, correct: 0, incorrect: 0, missing: 0 }]));
  const categories = {};
  const modes = {};
  const latencies = [];
  let failed = 0, inventedFieldCount = 0, falsePositiveCount = 0;
  const confidence = [];
  for (const fixture of golden) {
    const category = fixture.category ?? fixture.fixture.replace(/^license_\d+_/, '').replace(/\.png$/, '');
    const categoryStats = categories[category] ??= { documents: 0, successful: 0, correctFields: 0, inventedFields: 0, latencyMs: [] };
    const modeStats = modes[fixture.collectionMode] ??= { documents: 0, successful: 0, correctFields: 0, inventedFields: 0, latencyMs: [] };
    categoryStats.documents++; modeStats.documents++;
    try {
      const { result, roundTripMs } = await ocr(path.join(directory, fixture.fixture));
      latencies.push(roundTripMs); categoryStats.latencyMs.push(roundTripMs); modeStats.latencyMs.push(roundTripMs);
      const candidates = extractor.extract(result);
      if (result.textBlocks.length) { categoryStats.successful++; modeStats.successful++; }
      const byKey = new Map(candidates.map(candidate => [candidate.key, candidate]));
      for (const field of fields) {
        const expected = fixture.expected[field];
        const candidate = byKey.get(field);
        if (expected !== undefined) totals[field].expected++;
        if (candidate) totals[field].emitted++;
        if (!candidate && expected !== undefined) totals[field].missing++;
        else if (candidate && expected === undefined) { inventedFieldCount++; falsePositiveCount++; categoryStats.inventedFields++; modeStats.inventedFields++; }
        else if (candidate && String(candidate.value).trim().toUpperCase() === String(expected).trim().toUpperCase()) {
          totals[field].correct++; categoryStats.correctFields++; modeStats.correctFields++;
          confidence.push({ field, confidence: candidate.confidence, correct: true });
        } else if (candidate) {
          totals[field].incorrect++; falsePositiveCount++;
          confidence.push({ field, confidence: candidate.confidence, correct: false });
        }
      }
    } catch { failed++; }
  }
  for (const value of Object.values(totals)) {
    value.precision = value.emitted ? value.correct / value.emitted : 0;
    value.recall = value.expected ? value.correct / value.expected : 0;
    value.exactMatchAccuracy = value.recall;
  }
  const summarize = group => Object.fromEntries(Object.entries(group).map(([key, value]) => [key, { ...value, averageCorrectFields: value.correctFields / value.documents, averageLatencyMs: value.latencyMs.reduce((a,b)=>a+b,0) / value.latencyMs.length, questionsPotentiallyAvoided: value.correctFields / value.documents, latencyMs: undefined }]));
  return { name, fixtureCount: golden.length, successfulDocuments: golden.length - failed, failedDocuments: failed, fields: totals, inventedFieldCount, falsePositiveCount, confidence, categories: summarize(categories), modes: summarize(modes), latencyMs: { mean: latencies.reduce((a,b)=>a+b,0)/latencies.length, median: percentile(latencies,.5), p95: percentile(latencies,.95) } };
}

(async () => {
  const health = await fetch('http://127.0.0.1:8001/health').then(r => r.json());
  const baseline = await dataset(path.join(root, 'fixtures'), 'original-20');
  const readable = await dataset(path.join(root, 'fixtures-readable'), 'readable-20');
  const output = { ocrExecuted: true, dataset: 'SYNTHETIC DRIVER_LICENSE DATASET', runtime: { python: '3.12', paddlepaddle: '3.3.1', paddleocr: '3.7.0' }, helper: health, fixtureCount: 40, baseline, readable, decision: readable.inventedFieldCount === 0 && Object.values(readable.fields).every(field => field.precision >= .95) ? 'READY_FOR_OCR_HARDENING_AND_NEXT_DOCUMENT' : 'NEEDS_OCR_HARDENING' };
  const target = path.join(root, '../../artifacts/ocr/driver-license-evaluation.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
