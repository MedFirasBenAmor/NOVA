'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hasExistingSession } from '@/lib/session';

export function LandingResume() {
  const [resumable, setResumable] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setResumable(hasExistingSession());
  }, []);

  // Anonymous session state is only known in the browser; render a stable
  // placeholder on the server to avoid hydration mismatch.
  if (!mounted)
    return (
      <div className="h-14 w-full max-w-xs rounded-2xl border border-nova-border bg-nova-surface-secondary" aria-hidden="true" />
    );

  if (!resumable)
    return (
      <div className="max-w-md text-sm text-nova-muted">
        <p className="font-medium text-nova-navy">Déjà commencé ?</p>
        <p className="mt-1">Aucune demande en cours sur cet appareil.</p>
      </div>
    );

  return (
    <div className="max-w-md">
      <p className="font-medium text-nova-navy">Déjà commencé ?</p>
      <p className="mt-1 text-sm text-nova-muted">
        Reprenez votre dossier là où vous l’avez laissé.
      </p>
      <Button asChild variant="navy" size="lg" className="mt-4 w-full sm:w-auto">
        <Link href="/chat">
          <RotateCcw className="size-4" aria-hidden="true" />
          Reprendre ma demande
        </Link>
      </Button>
    </div>
  );
}
