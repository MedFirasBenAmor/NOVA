import { ShieldCheck } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type PrivacyBadgeProps = BadgeProps & {
  label?: string;
};

export function PrivacyBadge({ label = 'Vos données sont protégées', className, ...props }: PrivacyBadgeProps) {
  return (
    <Badge tone="success" className={cn('gap-1.5', className)} {...props}>
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}
