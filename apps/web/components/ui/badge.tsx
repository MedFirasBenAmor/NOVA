import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-nova-surface-secondary text-nova-muted',
        blue: 'bg-nova-blue-light text-nova-blue',
        success: 'bg-nova-success-bg text-nova-success',
        purple: 'bg-nova-purple-bg text-nova-purple',
        orange: 'bg-nova-orange-bg text-nova-orange',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
