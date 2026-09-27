import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IntelligenceInput, IntelligenceResult } from '@nova/shared-types';
import type { IntelligenceProvider } from '../intelligence.provider';

@Injectable()
export class GeminiIntelligenceProvider implements IntelligenceProvider {
  private readonly logger = new Logger(GeminiIntelligenceProvider.name);

  constructor(private readonly config: ConfigService) {}

  async analyze(input: IntelligenceInput): Promise<IntelligenceResult> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is required when AI_PROVIDER=gemini',
      );
    }
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-3.7-flash');
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          signal: AbortSignal.timeout(
            this.config.get<number>('GEMINI_TIMEOUT_MS', 30_000),
          ),
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: this.prompt(input),
                  },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        this.logger.warn(
          `Gemini request timed out model=${model} elapsedMs=${Date.now() - startedAt}`,
        );
        throw new ServiceUnavailableException('GEMINI_TIMEOUT');
      }
      this.logger.warn(
        `Gemini request unavailable model=${model} elapsedMs=${Date.now() - startedAt} error=${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      throw new ServiceUnavailableException('GEMINI_PROVIDER_UNAVAILABLE');
    }
    if (!response.ok) {
      this.logger.warn(
        `Gemini request failed model=${model} status=${response.status} elapsedMs=${Date.now() - startedAt}`,
      );
      throw new ServiceUnavailableException(
        'Gemini intelligence request failed',
      );
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      this.logger.warn(
        `Gemini returned no structured result model=${model} elapsedMs=${Date.now() - startedAt}`,
      );
      throw new ServiceUnavailableException(
        'Gemini returned no structured result',
      );
    }
    return JSON.parse(text) as IntelligenceResult;
  }

  private prompt(input: IntelligenceInput) {
    return [
      'You are NOVA insurance intake extraction.',
      'Return only JSON. Do not include markdown, comments, or explanatory text.',
      'The JSON must match this exact TypeScript-compatible shape:',
      JSON.stringify({
        intent: {
          type: 'INSURANCE_SHOPPING | NEW_ACQUISITION | RENEWAL | COMMERCIAL_VEHICLE_USE | CLAIM_MENTIONED | DOCUMENT_REFUSAL | GENERAL_INQUIRY',
          confidence: 'number from 0 to 1',
        },
        product: {
          type: 'COMMON | AUTO | HOME | AUTO_HOME',
          confidence: 'number from 0 to 1',
        },
        events: [
          {
            type: 'VEHICLE_PURCHASE | COMMERCIAL_USE | RENEWAL_MENTIONED | CLAIM_MENTIONED | DOCUMENT_UPLOAD_REFUSED',
            confidence: 'number from 0 to 1',
          },
        ],
        candidateDatapoints: [
          {
            key: 'one exact key from input.catalog',
            value: 'canonical typed value',
            entityType:
              'CUSTOMER | VEHICLE | DRIVER | PROPERTY | CLAIM | CO_APPLICANT | REQUEST',
            method: 'EXTRACTED | ENRICHED | INFERRED',
            confidence: 'number from 0 to 1',
            evidence: 'short source phrase when available',
          },
        ],
      }),
      'Rules:',
      '- Never invent customer facts.',
      '- Never invent datapoint keys. candidateDatapoints[].key must exist in input.catalog.',
      '- candidateDatapoints[].entityType must match that catalog item entityType.',
      '- For catalog items with allowedValues, value must be one of those canonical values.',
      '- Use allowedValues labels, when present, to map customer wording to the canonical value.',
      '- For NUMBER fields, return a JSON number, not a string.',
      '- For BOOLEAN fields, return a JSON boolean, not yes/no text.',
      '- For DATE fields, return ISO yyyy-mm-dd when the date is explicit.',
      '- Extract every customer-stated fact that confidently maps to an input.catalog item, including customer identity, contact, address, vehicle, driver, property, claim, co-applicant, request, consent, and usage facts.',
      '- Product intent examples: car, auto, vehicle insurance means product AUTO; home, house, condo, tenant insurance means product HOME; both car and home means product AUTO_HOME.',
      `- Identity examples: if the customer says "I am Firas", "I'm Firas", "my name is Firas", or equivalent, extract customer.first_name when that key exists in input.catalog.`,
      '- If entityContext.currentDatapoint is present and the message answers that visible question, include that datapoint key in candidateDatapoints.',
      '- If unsure about a datapoint, omit it.',
      '- If currentProduct is present, keep it authoritative for collection; do not switch product from the message.',
      '- Always include intent, product, events, and candidateDatapoints, even when arrays are empty.',
      'Input:',
      JSON.stringify(input),
    ].join('\n');
  }
}
