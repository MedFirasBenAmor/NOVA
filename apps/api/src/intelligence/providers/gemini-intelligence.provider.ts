import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IntelligenceInput, IntelligenceResult } from '@nova/shared-types';
import type { IntelligenceProvider } from '../intelligence.provider';

@Injectable()
export class GeminiIntelligenceProvider implements IntelligenceProvider {
  constructor(private readonly config: ConfigService) {}

  async analyze(input: IntelligenceInput): Promise<IntelligenceResult> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is required when AI_PROVIDER=gemini',
      );
    }
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.0-flash');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: [
                    'Return only JSON matching the requested intelligence contract.',
                    'Never invent customer facts or datapoint keys.',
                    'Use only EXTRACTED, ENRICHED, or INFERRED methods.',
                    JSON.stringify(input),
                  ].join('\n'),
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Gemini intelligence request failed',
      );
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text)
      throw new ServiceUnavailableException(
        'Gemini returned no structured result',
      );
    return JSON.parse(text) as IntelligenceResult;
  }
}
