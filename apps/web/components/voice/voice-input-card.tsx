'use client';

import { Mic, MicOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type VoiceInputCardProps = {
  supported: boolean;
  listening: boolean;
  partial?: string;
  onToggle: () => void;
  className?: string;
};

export function VoiceInputCard({
  supported,
  listening,
  partial,
  onToggle,
  className,
}: VoiceInputCardProps) {
  return (
    <Card
      padding="lg"
      className={cn(
        'flex flex-col items-center gap-5 text-center',
        listening && 'border-nova-blue/40 ring-1 ring-nova-blue/15',
        className,
      )}
    >
      <p className="text-lg font-semibold text-nova-navy">
        Parlez librement, je vous écoute.
      </p>
      <p className="max-w-sm text-sm leading-6 text-nova-muted">
        Vous pouvez parler de votre situation, de vos besoins ou poser vos
        questions.
      </p>

      <button
        type="button"
        onClick={onToggle}
        disabled={!supported}
        aria-pressed={listening}
        aria-label={listening ? 'Arrêter la saisie vocale' : 'Démarrer la saisie vocale'}
        className={cn(
          'grid size-20 shrink-0 place-items-center rounded-full text-white shadow-token transition-transform',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-blue focus-visible:ring-offset-2',
          listening
            ? 'bg-nova-success scale-105'
            : 'bg-nova-blue hover:scale-105',
          !supported && 'cursor-not-allowed bg-nova-border',
        )}
      >
        {listening ? (
          <MicOff className="size-8" aria-hidden="true" />
        ) : (
          <Mic className="size-8" aria-hidden="true" />
        )}
      </button>

      {supported ? (
        <div
          className="flex h-10 items-center gap-1"
          aria-hidden="true"
        >
          {Array.from({ length: 9 }, (_, index) => (
            <span
              key={index}
              className={cn(
                'w-1.5 rounded-full bg-nova-blue',
                listening ? 'nova-bar h-full' : 'h-2 bg-nova-border',
              )}
              style={listening ? { animationDelay: `${index * 0.09}s` } : undefined}
            />
          ))}
        </div>
      ) : (
        <p role="status" className="text-sm text-nova-muted">
          La saisie vocale n’est pas disponible sur ce navigateur. Vous pouvez
          écrire votre situation ci-dessous.
        </p>
      )}

      <p
        className="min-h-6 max-w-sm text-sm font-medium text-nova-navy"
        aria-live="polite"
      >
        {listening
          ? partial || 'Je vous écoute…'
          : supported
            ? 'Appuyez sur le micro pour commencer.'
            : ''}
      </p>
    </Card>
  );
}
