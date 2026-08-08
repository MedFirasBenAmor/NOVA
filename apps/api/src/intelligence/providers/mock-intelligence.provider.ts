import { randomUUID } from 'node:crypto';
import type {
  IntelligenceCandidateDatapoint,
  IntelligenceInput,
  IntelligenceResult,
  IntelligenceEventType,
  IntelligenceIntentType,
  IntelligenceProductType,
} from '@nova/shared-types';
import type { IntelligenceProvider } from '../intelligence.provider';

const RAV4_MAKE = 'TOYOTA';

export class MockIntelligenceProvider implements IntelligenceProvider {
  async analyze(input: IntelligenceInput): Promise<IntelligenceResult> {
    await Promise.resolve();
    const message = input.message.trim();
    const catalog = new Map(input.catalog.map((item) => [item.key, item]));
    const vehicleId =
      input.entityContext?.vehicleId ??
      input.knownDatapoints.find((item) => item.entityType === 'VEHICLE')
        ?.entityId ??
      randomUUID();
    const claimId = input.entityContext?.claimId ?? randomUUID();
    const candidates: IntelligenceCandidateDatapoint[] = [];
    const events: Array<{ type: IntelligenceEventType; confidence: number }> =
      [];
    const deniesCommercial =
      /don't use|do not use|not for|no .*\b(uber|turo|delivery)\b/i.test(
        message,
      );
    const add = (
      key: string,
      value: unknown,
      method: IntelligenceCandidateDatapoint['method'],
      confidence: number,
      evidence?: string,
      entityId?: string,
    ) => {
      const definition = catalog.get(key);
      if (!definition) return;
      const known = input.knownDatapoints.find(
        (item) =>
          item.key === key &&
          item.entityType === definition.entityType &&
          (item.entityId ?? undefined) === entityId &&
          item.value === value,
      );
      if (known) return;
      candidates.push({
        key,
        value,
        entityType: definition.entityType,
        ...(entityId ? { entityId } : {}),
        method,
        confidence,
        ...(evidence ? { evidence } : {}),
      });
    };

    const isAuto =
      input.currentProduct === 'AUTO' ||
      Boolean(input.entityContext?.vehicleId) ||
      /\b(rav4|vehicle|car|auto|drive|financ|lease|uber|turo|delivery|insurer|accident|claim)\b/i.test(
        message,
      );
    const product: IntelligenceProductType = isAuto
      ? 'AUTO'
      : (input.currentProduct ?? 'COMMON');
    let intent: IntelligenceIntentType = 'GENERAL_INQUIRY';
    let intentConfidence = 0.65;

    if (/renew|renewal|next month/i.test(message)) {
      intent = 'RENEWAL';
      intentConfidence = 0.96;
      events.push({ type: 'RENEWAL_MENTIONED', confidence: 0.96 });
    } else if (
      /don't want|do not want|refuse|won't upload|will not upload/i.test(
        message,
      ) &&
      /driver.?s license|document|photo|upload/i.test(message)
    ) {
      intent = 'DOCUMENT_REFUSAL';
      intentConfidence = 0.97;
      events.push({ type: 'DOCUMENT_UPLOAD_REFUSED', confidence: 0.98 });
    } else if (/accident|claim/i.test(message)) {
      intent = 'CLAIM_MENTIONED';
      intentConfidence = 0.95;
      events.push({ type: 'CLAIM_MENTIONED', confidence: 0.95 });
    } else if (
      !deniesCommercial &&
      /uber|turo|delivery|commercial/i.test(message)
    ) {
      intent = 'COMMERCIAL_VEHICLE_USE';
      intentConfidence = 0.95;
      events.push({ type: 'COMMERCIAL_USE', confidence: 0.96 });
    } else if (/buy|bought|purchase|acqui|leased|lease|financ/i.test(message)) {
      intent = 'NEW_ACQUISITION';
      intentConfidence = 0.96;
      events.push({ type: 'VEHICLE_PURCHASE', confidence: 0.96 });
    } else if (/quote|insurance|insurer|coverage/i.test(message)) {
      intent = 'INSURANCE_SHOPPING';
      intentConfidence = 0.9;
    }

    const model = message.match(/\b(rav4)\b/i)?.[1]?.toUpperCase();
    if (model) {
      add('vehicle.model', model, 'EXTRACTED', 0.99, model, vehicleId);
      if (catalog.has('vehicle.make'))
        add('vehicle.make', RAV4_MAKE, 'ENRICHED', 0.98, model, vehicleId);
    }

    const year = message.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
    if (
      year &&
      /rav4|vehicle|car|buy|bought|purchase|financ|lease/i.test(message)
    ) {
      add('vehicle.year', Number(year), 'EXTRACTED', 0.99, year, vehicleId);
    }

    if (/\b(financed|financing|finance)\b/i.test(message))
      add(
        'vehicle.financing_status',
        'FINANCED',
        'EXTRACTED',
        0.99,
        'financed',
        vehicleId,
      );
    if (/\b(leased|lease)\b/i.test(message))
      add(
        'vehicle.financing_status',
        'LEASED',
        'EXTRACTED',
        0.99,
        'leased',
        vehicleId,
      );

    const mileage = message.match(
      /([\d\s,.]+)\s*(?:km|kilomet(?:er|re)s?)\s*(?:per|a|each)?\s*year/i,
    )?.[1];
    if (mileage)
      add(
        'vehicle.annual_mileage',
        Number(mileage.replace(/[\s,.]/g, '')),
        'EXTRACTED',
        0.98,
        mileage.trim(),
        vehicleId,
      );

    if (deniesCommercial) {
      add(
        'vehicle.commercial_use',
        false,
        'EXTRACTED',
        0.96,
        'commercial use denied',
        vehicleId,
      );
    } else if (/uber|turo|delivery|commercial/i.test(message)) {
      const commercialType = /uber/i.test(message)
        ? 'UBER'
        : /turo/i.test(message)
          ? 'TURO'
          : /delivery/i.test(message)
            ? 'DELIVERY'
            : 'OTHER';
      add(
        'vehicle.commercial_use',
        true,
        'INFERRED',
        0.96,
        commercialType,
        vehicleId,
      );
      add(
        'vehicle.commercial_use_type',
        commercialType,
        'EXTRACTED',
        0.95,
        commercialType,
        vehicleId,
      );
    }

    if (/go to work|commut|mainly use .*work|for work/i.test(message))
      add('vehicle.primary_use', 'WORK', 'EXTRACTED', 0.95, 'work', vehicleId);
    if (/school|university/i.test(message))
      add(
        'vehicle.primary_use',
        'SCHOOL',
        'EXTRACTED',
        0.95,
        'school',
        vehicleId,
      );
    if (/pleasure|weekend trips|personal use/i.test(message))
      add(
        'vehicle.primary_use',
        'PLEASURE',
        'EXTRACTED',
        0.9,
        'pleasure',
        vehicleId,
      );
    if (/business use/i.test(message))
      add(
        'vehicle.primary_use',
        'BUSINESS',
        'EXTRACTED',
        0.9,
        'business',
        vehicleId,
      );

    const insurer = message.match(
      /(?:my )?(?:current )?insurer\s+is\s+([A-Z][\w-]*)/i,
    )?.[1];
    if (insurer)
      add('auto.current_insurer', insurer, 'EXTRACTED', 0.96, insurer);

    if (/accident|claim/i.test(message)) {
      add(
        'auto.has_claims_last_6_years',
        true,
        'INFERRED',
        0.94,
        /accident/i.test(message) ? 'accident' : 'claim',
      );
      if (year)
        add('claim.year', Number(year), 'EXTRACTED', 0.96, year, claimId);
    }

    if (intent === 'NEW_ACQUISITION')
      add(
        'request.type',
        'NEW_ACQUISITION',
        'INFERRED',
        0.93,
        'new acquisition',
      );

    return {
      intent: { type: intent, confidence: intentConfidence },
      product: { type: product, confidence: isAuto ? 0.99 : 0.7 },
      events,
      candidateDatapoints: candidates,
    };
  }
}
