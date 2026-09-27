import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AdvisorCTAProps = {
  className?: string;
};

export function AdvisorCTA({ className }: AdvisorCTAProps) {
  return (
    <div
      className={
        'flex items-center gap-4 rounded-[20px] border border-nova-orange/30 bg-nova-orange-bg p-5 ' +
        (className ?? '')
      }
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-nova-orange shadow-token-sm">
        <MessagesSquare className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-nova-navy">Besoin d’être accompagné ?</p>
        <p className="mt-0.5 text-sm text-nova-muted">
          Reprenez votre demande dans la conversation NOVA.
        </p>
      </div>
      <Button asChild variant="secondary" size="sm" className="shrink-0">
        <Link href="/chat">Reprendre</Link>
      </Button>
    </div>
  );
}
