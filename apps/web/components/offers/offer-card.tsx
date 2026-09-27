import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
import type { Offer } from '@/lib/offers';
import { cn } from '@/lib/utils';

export type OfferCardProps = {
  offer: Offer;
  onSelect?: (offer: Offer) => void;
  className?: string;
};

export function OfferCard({ offer, onSelect, className }: OfferCardProps) {
  return (
    <Card
      padding="lg"
      className={cn(
        offer.recommended && 'border-nova-blue ring-1 ring-nova-blue/20',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-nova-navy">{offer.insurer}</p>
          {offer.billingPeriod && (
            <p className="mt-0.5 text-xs text-nova-muted">{offer.billingPeriod}</p>
          )}
        </div>
        {offer.recommended && (
          <Badge tone="blue" className="shrink-0">
            Recommandé
          </Badge>
        )}
      </div>

      {typeof offer.price === 'number' && (
        <p className="mt-4 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-nova-navy">
            {offer.price.toFixed(2)}
            {offer.currency ?? '€'}
          </span>
          {offer.billingPeriod && (
            <span className="text-sm text-nova-muted">/ {offer.billingPeriod}</span>
          )}
        </p>
      )}

      {typeof offer.savingsPercent === 'number' && (
        <Badge tone="success" className="mt-3">
          −{offer.savingsPercent}% vs. votre contrat actuel
        </Badge>
      )}

      {offer.coverageItems.length > 0 && (
        <ul className="mt-4 space-y-2">
          {offer.coverageItems.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-nova-muted">
              <Check
                className="mt-0.5 size-4 shrink-0 text-nova-success"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
      )}

      {offer.cta && (
        <Button
          variant={offer.recommended ? 'primary' : 'secondary'}
          size="md"
          className="mt-5 w-full"
          onClick={() => onSelect?.(offer)}
        >
          {offer.cta}
        </Button>
      )}
    </Card>
  );
}
