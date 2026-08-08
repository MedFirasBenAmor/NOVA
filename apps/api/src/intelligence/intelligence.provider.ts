import type { IntelligenceInput, IntelligenceResult } from '@nova/shared-types';

export const INTELLIGENCE_PROVIDER = Symbol('INTELLIGENCE_PROVIDER');

export interface IntelligenceProvider {
  analyze(input: IntelligenceInput): Promise<IntelligenceResult>;
}
