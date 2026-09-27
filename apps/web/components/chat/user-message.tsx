import { cn } from '@/lib/utils';

export type UserMessageProps = {
  children: React.ReactNode;
  className?: string;
};

export function UserMessage({ children, className }: UserMessageProps) {
  return (
    <div className={cn('flex justify-end', className)}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-br-md bg-nova-blue px-4 py-3',
          'text-sm leading-6 text-white shadow-token-sm',
        )}
      >
        {children}
      </div>
    </div>
  );
}
