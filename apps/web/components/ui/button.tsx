import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-semibold tracking-tight',
    'rounded-2xl transition-[background-color,border-color,color,box-shadow]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-blue focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-nova-blue text-white shadow-token-sm',
          'hover:bg-nova-blue-strong',
        ],
        navy: ['bg-nova-navy text-white shadow-token-sm', 'hover:bg-nova-navy/90'],
        secondary: [
          'border border-nova-border bg-white text-nova-navy shadow-token-sm',
          'hover:border-nova-blue hover:text-nova-blue',
        ],
        soft: [
          'bg-nova-blue-light text-nova-blue',
          'hover:bg-nova-blue-light/70',
        ],
        success: ['bg-nova-success text-white shadow-token-sm', 'hover:bg-nova-success/90'],
        ghost: ['text-nova-muted', 'hover:bg-nova-surface-secondary hover:text-nova-navy'],
        danger: [
          'border border-red-200 bg-white text-red-700',
          'hover:border-red-300',
        ],
      },
      size: {
        sm: 'min-h-9 px-3 text-xs',
        md: 'min-h-12 px-5 text-sm',
        lg: 'min-h-14 px-6 text-base',
        icon: 'size-10 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
