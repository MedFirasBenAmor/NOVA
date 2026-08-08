import type { OcrResult } from './ocr/ocr.provider';

export type DocumentCandidate = {
  key: string;
  value: unknown;
  confidence: number;
  page: number;
};
export class DriverLicenseExtractor {
  extract(result: OcrResult): DocumentCandidate[] {
    const candidates: DocumentCandidate[] = [];
    for (const block of result.textBlocks) {
      const surname = block.text.match(
        /(?:SURNAME|NOM)\s*:\s*([A-ZÀ-Ÿ'-]+)/i,
      )?.[1];
      const given = block.text.match(
        /(?:GIVEN NAME|PRENOM|PRÉNOM)\s*:\s*([A-ZÀ-Ÿ'-]+)/i,
      )?.[1];
      const dob = block.text.match(
        /(?:DOB|DATE DE NAISSANCE)\s*:\s*(\d{4}-\d{2}-\d{2})/i,
      )?.[1];
      if (surname)
        candidates.push({
          key: 'driver.last_name',
          value: surname,
          confidence: block.confidence,
          page: block.page,
        });
      if (given)
        candidates.push({
          key: 'driver.first_name',
          value: given,
          confidence: block.confidence,
          page: block.page,
        });
      if (dob)
        candidates.push({
          key: 'driver.date_of_birth',
          value: dob,
          confidence: block.confidence,
          page: block.page,
        });
    }
    return candidates;
  }
}
