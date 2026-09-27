import { NovaAssistantAvatar } from './nova-assistant-avatar';
import { cn } from '@/lib/utils';

export type AssistantMessageProps = {
  children: React.ReactNode;
  className?: string;
};

export function AssistantMessage({ children, className }: AssistantMessageProps) {
  return (
    <div className={cn('flex items-start gap-2.5 sm:gap-3', className)}>
      <NovaAssistantAvatar size="sm" className="mt-0.5" />
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-tl-md border border-nova-border bg-white px-4 py-3',
          'text-sm leading-6 text-nova-navy shadow-token-sm',
        )}
      >
        {children}
      </div>
    </div>
  );
}
