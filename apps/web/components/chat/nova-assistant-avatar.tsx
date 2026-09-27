import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NovaAssistantAvatarProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZES = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-14',
};

const ICON = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-7',
};

export function NovaAssistantAvatar({ size = 'md', className }: NovaAssistantAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-nova-navy to-nova-blue text-white shadow-token-sm',
        SIZES[size],
        className,
      )}
    >
      <Sparkles className={ICON[size]} />
    </span>
  );
}
