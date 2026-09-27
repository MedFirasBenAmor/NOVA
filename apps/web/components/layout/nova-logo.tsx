import { cn } from '@/lib/utils';

export type NovaLogoProps = {
  className?: string;
  withWordmark?: boolean;
  tone?: 'navy' | 'white';
};

export function NovaLogo({ className, withWordmark = true, tone = 'navy' }: NovaLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        className="size-9 shrink-0"
        fill="none"
      >
        <rect width="40" height="40" rx="12" fill="#071552" />
        <path
          d="M12 27V13.5c0-.9 1.1-1.3 1.7-.6L27 27.1c.6.7.1 1.9-.8 1.9H13.4A1.4 1.4 0 0 1 12 27.6Z"
          fill="#1677FF"
        />
        <path
          d="M28 13v13.5c0 .9-1.1 1.3-1.7.6L14 12.9c-.6-.7-.1-1.9.8-1.9h12.8A1.4 1.4 0 0 1 28 12.4Z"
          fill="#EAF3FF"
        />
        <circle cx="20" cy="20" r="3.1" fill="#22A65A" />
      </svg>
      {withWordmark && (
        <span
          className={cn(
            'text-lg font-bold tracking-tight',
            tone === 'white' ? 'text-white' : 'text-nova-navy',
          )}
        >
          NOVA
        </span>
      )}
    </span>
  );
}
