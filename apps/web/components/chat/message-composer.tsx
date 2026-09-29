'use client';

import { FormEvent } from 'react';
import { ArrowUp, Mic, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type MessageComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  disabled?: boolean;
  busy?: boolean;
  maxLength?: number;
  placeholder?: string;
  className?: string;
};

export function MessageComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  busy,
  maxLength = 1000,
  placeholder = 'Décrivez votre situation en quelques mots…',
  className,
}: MessageComposerProps) {
  const count = value.length;
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'shrink-0 border-t border-nova-border bg-white/95 px-3 py-2 backdrop-blur sm:px-4 md:py-3',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border border-nova-border bg-nova-surface p-2 transition-colors',
          'focus-within:border-nova-blue focus-within:ring-2 focus-within:ring-nova-blue/15',
        )}
      >
        <textarea
          aria-label="Message"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={disabled}
          rows={1}
          maxLength={maxLength}
          placeholder={placeholder}
          className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-nova-navy outline-none placeholder:text-nova-muted"
        />
        <Link
          href="/voice"
          aria-label="Saisie vocale"
          className="grid size-10 shrink-0 place-items-center rounded-xl text-nova-muted transition-colors hover:bg-nova-surface-secondary hover:text-nova-blue"
        >
          <Mic className="size-5" aria-hidden="true" />
        </Link>
        <button
          type="submit"
          aria-label="Send message"
          disabled={disabled || !value.trim() || busy}
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl bg-nova-blue text-white transition-colors',
            'hover:bg-nova-blue-strong',
            'disabled:bg-nova-border disabled:text-nova-muted',
          )}
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-nova-muted">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        <span className="hidden min-[380px]:inline">
          Vous gardez le contrôle de ce que vous partagez.
        </span>
        <span className="min-[380px]:hidden">Vos données restent sous votre contrôle.</span>
        {count > 0 && (
          <span aria-live="polite" className="tabular-nums">
            {count}/{maxLength}
          </span>
        )}
      </p>
    </form>
  );
}
