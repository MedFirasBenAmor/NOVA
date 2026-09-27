import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SecurityBannerProps = {
  className?: string;
  title?: string;
  description?: string;
};

export function SecurityBanner({
  className,
  title = '100% confidentiel et sécurisé',
  description = 'Vos informations servent uniquement à établir votre dossier. Elles ne sont jamais vendues ni partagées sans votre accord.',
}: SecurityBannerProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-[20px] border border-nova-border bg-nova-surface-secondary p-5 shadow-token-sm',
        className,
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-nova-success-bg text-nova-success">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-nova-navy">{title}</p>
        <p className="mt-1 text-sm leading-6 text-nova-muted">{description}</p>
      </div>
    </div>
  );
}
