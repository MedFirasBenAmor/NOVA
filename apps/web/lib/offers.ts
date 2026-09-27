import type { CompletenessResponse, NextAction } from '@nova/shared-types';

// Clean adapter interface between the NOVA backend and the results UI.
// The backend does not expose insurance offers yet, so this returns [] rather
// than fabricating insurers, prices or savings.
export type Offer = {
  id: string;
  insurer: string;
  price?: number;
  currency?: string;
  billingPeriod?: string;
  savingsPercent?: number;
  coverageItems: string[];
  recommended?: boolean;
  cta?: string;
};

export type OfferSource = {
  completeness?: CompletenessResponse;
  nextAction?: NextAction;
};

export function toOffers(source: OfferSource = {}): Offer[] {
  // Insurance offers are not yet exposed by the NOVA backend. The source is
  // kept in the signature so the results UI already speaks the adapter contract.
  void source;
  return [];
}

export function offerSummary(source: OfferSource) {
  const completeness = source.completeness;
  if (!completeness) return undefined;
  return {
    product: completeness.product,
    completeness: completeness.completeness,
    knownCount: completeness.known.length,
    missingCount: completeness.missing.length,
  };
}
