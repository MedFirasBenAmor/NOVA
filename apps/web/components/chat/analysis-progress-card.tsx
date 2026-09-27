import { BrainCircuit } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type AnalysisProgressCardProps = {
  className?: string;
};

const ROWS = [
  'Compréhension de votre situation',
  'Extraction des informations clés',
  'Recherche des meilleures options',
];

// Shown only while a real intelligence request is in flight. The rows are a
// visual affordance of that wait — they never add artificial delay.
export function AnalysisProgressCard({ className }: AnalysisProgressCardProps) {
  return (
    <Card
      role="status"
      aria-busy="true"
      aria-live="polite"
      radius="lg"
      padding="lg"
      className={cn('animate-in fade-in', className)}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-nova-blue-light text-nova-blue">
          <BrainCircuit className="size-5" aria-hidden="true" />
        </span>
        <p className="font-semibold text-nova-navy">
          Parfait 👍 je commence à analyser votre situation…
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {ROWS.map((row, index) => (
          <li
            key={row}
            className="flex items-center gap-3 text-sm text-nova-muted"
          >
            <span
              className={cn(
                'size-2.5 shrink-0 rounded-full bg-nova-blue',
                index === 0 && 'nova-row-active',
              )}
              aria-hidden="true"
            />
            {row}
          </li>
        ))}
      </ul>
    </Card>
  );
}
