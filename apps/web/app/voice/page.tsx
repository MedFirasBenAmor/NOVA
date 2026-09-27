'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { NovaHeader } from '@/components/layout/nova-header';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { VoiceInputCard } from '@/components/voice/voice-input-card';
import { SuggestionChips } from '@/components/chat/suggestion-chips';
import { Button } from '@/components/ui/button';
import {
  createSpeechSession,
  isSpeechSupported,
  type SpeechController,
} from '@/lib/speech';

export default function VoicePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [transcript, setTranscript] = useState('');
  const [controller, setController] = useState<SpeechController | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Speech support is a browser capability; it is only known after mount.
  const supported = mounted && isSpeechSupported();

  const toggle = () => {
    if (listening) {
      controller?.stop();
      setListening(false);
      return;
    }
    const session = createSpeechSession('fr-FR', {
      onPartial: (text) => setPartial(text),
      onFinal: (text) => {
        setTranscript((current) => (current ? `${current} ${text}` : text));
        setPartial('');
      },
      onError: () => {
        setListening(false);
        setPartial('Désolé, je n’ai pas pu vous entendre. Réessayez.');
      },
      onEnd: () => setListening(false),
    });
    if (!session) return;
    setController(session);
    setPartial('');
    setListening(true);
    session.start();
  };

  const continueToChat = () => {
    const message = transcript.trim();
    if (!message) return;
    router.push(`/chat?message=${encodeURIComponent(message)}`);
  };

  return (
    <>
      <NovaHeader backHref="/" />
      <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10">
        <VoiceInputCard
          supported={supported}
          listening={listening}
          partial={partial}
          onToggle={toggle}
        />

        <section className="mt-8">
          <h2 className="text-base font-semibold text-nova-navy">
            Votre transcription
          </h2>
          <textarea
            aria-label="Transcription"
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={3}
            placeholder="Ce que vous dites apparaîtra ici…"
            className="mt-3 w-full resize-none rounded-2xl border border-nova-border p-3 text-sm leading-6 text-nova-navy outline-none focus:border-nova-blue focus:ring-2 focus:ring-nova-blue/15"
          />
          <Button
            variant="navy"
            size="lg"
            disabled={!transcript.trim()}
            onClick={continueToChat}
            className="mt-3 w-full"
          >
            Continuer vers NOVA
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-nova-navy">
            Exemples de questions
          </h2>
          <SuggestionChips
            className="mt-3"
            onPick={(text) =>
              setTranscript((current) => (current ? `${current} ${text}` : text))
            }
            disabled={listening}
          />
        </section>
      </main>
      <BottomNavigation />
    </>
  );
}
