import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const cardVariants = cva(
  [
    'bg-nova-surface border border-nova-border',
    'shadow-token-sm',
  ],
  {
    variants: {
      radius: {
        sm: 'rounded-xl',
        md: 'rounded-2xl',
        lg: 'rounded-[20px]',
      },
      surface: {
        plain: 'bg-nova-surface',
        secondary: 'bg-nova-surface-secondary',
        tinted: 'bg-nova-blue-light',
      },
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5 sm:p-6',
      },
    },
    defaultVariants: { radius: 'lg', surface: 'plain', padding: 'lg' },
  },
);

export type CardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants>;

export function Card({ className, radius, surface, padding, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ radius, surface, padding }), className)} {...props} />
  );
}
