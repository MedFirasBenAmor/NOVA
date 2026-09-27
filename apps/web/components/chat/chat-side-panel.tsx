'use client';

import { Sparkles } from 'lucide-react';
import type { CompletenessResponse, NextAction } from '@nova/shared-types';
import { ProgressStepper } from './progress-stepper';
import { SecurityBanner } from '@/components/layout/security-banner';
import { AdvisorCTA } from '@/components/offers/advisor-cta';
import { OfferCard } from '@/components/offers/offer-card';
import { toOffers, offerSummary, type Offer } from '@/lib/offers';
import { display } from '@/lib/chat-helpers';
import { cn } from '@/lib/utils';

export type ChatSidePanelProps = {
  completeness: number;
  completenessDetail?: CompletenessResponse;
  action?: NextAction;
  stage: 1 | 2 | 3;
  className?: string;
};

export function ChatSidePanel({
  completeness,
  completenessDetail,
  action,
  stage,
  className,
}: ChatSidePanelProps) {
  const summary = offerSummary({ completeness: completenessDetail });
  const offers: Offer[] = toOffers({ completeness: completenessDetail, nextAction: action });

  return (
    <aside
      className={cn(
        'hidden w-full flex-col gap-4 lg:flex',
        className,
      )}
      aria-label="Progression et options"
    >
      <div className="rounded-[20px] border border-nova-border bg-white p-5 shadow-token-sm">
        <ProgressStepper activeStep={stage} />
        <div className="mt-5">
          <p className="text-xs font-medium text-nova-muted">Complétude du dossier</p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-nova-surface-secondary"
            role="progressbar"
            aria-valuenow={completeness}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Complétude du dossier"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-nova-blue to-nova-success transition-all"
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>
        {summary && (
          <p className="mt-3 text-xs leading-5 text-nova-muted">
            {summary.knownCount} information(s) déjà connue(s)
            {summary.missingCount > 0
              ? ` · ${summary.missingCount} à recueillir`
              : ' · dossier complet'}
            {summary.product !== 'COMMON' && ` · ${display(summary.product)}`}
          </p>
        )}
      </div>

      <div className="rounded-[20px] border border-nova-border bg-white p-5 shadow-token-sm">
        <p className="flex items-center gap-2 font-semibold text-nova-navy">
          <Sparkles className="size-4 text-nova-blue" aria-hidden="true" />
          Vos options
        </p>
        {offers.length > 0 ? (
          <div className="mt-4 space-y-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-nova-muted">
            {action?.type === 'COMPLETE'
              ? 'Votre dossier est complet. NOVA vous présentera les options disponibles à l’étape suivante.'
              : 'Vos options personnalisées apparaîtront ici dès que NOVA aura fini d’analyser votre situation.'}
          </p>
        )}
      </div>

      <AdvisorCTA />
      <SecurityBanner />
    </aside>
  );
}
