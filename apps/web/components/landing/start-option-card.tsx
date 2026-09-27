import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'blue' | 'purple' | 'orange' | 'green';

const TONE_CLASSES: Record<Tone, string> = {
  blue: 'bg-nova-blue-light text-nova-blue',
  purple: 'bg-nova-purple-bg text-nova-purple',
  orange: 'bg-nova-orange-bg text-nova-orange',
  green: 'bg-nova-success-bg text-nova-success',
};

export type StartOptionCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  tone?: Tone;
  disabled?: boolean;
  className?: string;
};

export function StartOptionCard({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  tone = 'blue',
  disabled,
  className,
}: StartOptionCardProps) {
  const body = (
    <Card
      radius="lg"
      padding="lg"
      className={cn(
        'group flex h-full items-start gap-4 text-left transition-all',
        'hover:-translate-y-0.5 hover:border-nova-blue/40 hover:shadow-token',
        disabled && 'cursor-not-allowed opacity-60 hover:translate-y-0',
        className,
      )}
    >
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-2xl',
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-nova-navy">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-nova-muted">
          {description}
        </span>
      </span>
    </Card>
  );

  if (href && !disabled)
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-blue focus-visible:ring-offset-2 rounded-[20px]">
        {body}
      </Link>
    );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-blue focus-visible:ring-offset-2 rounded-[20px]"
    >
      {body}
    </button>
  );
}
