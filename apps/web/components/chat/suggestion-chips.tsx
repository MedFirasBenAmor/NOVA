'use client';

import { cn } from '@/lib/utils';

export type SuggestionChipsProps = {
  onPick: (suggestion: string) => void;
  disabled?: boolean;
  suggestions?: string[];
  className?: string;
};

export const DEFAULT_SUGGESTIONS = [
  "J’ai une nouvelle voiture",
  'Je veux payer moins cher',
  'J’ai déjà une assurance',
];

export function SuggestionChips({
  onPick,
  disabled,
  suggestions = DEFAULT_SUGGESTIONS,
  className,
}: SuggestionChipsProps) {
  return (
    <div
      role="group"
      aria-label="Exemples de questions"
      className={cn('flex flex-wrap gap-2', className)}
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          disabled={disabled}
          onClick={() => onPick(suggestion)}
          className={cn(
            'rounded-full border border-nova-border bg-white px-3.5 py-2 text-xs font-medium text-nova-navy shadow-token-sm transition-colors',
            'hover:border-nova-blue hover:text-nova-blue',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-blue',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
