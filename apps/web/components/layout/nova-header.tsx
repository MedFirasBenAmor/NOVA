'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NovaLogo } from './nova-logo';
import { PrivacyBadge } from './privacy-badge';
import { cn } from '@/lib/utils';

export type NovaHeaderProps = {
  backHref?: string;
  showBadge?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function NovaHeader({ backHref, showBadge = true, className, children }: NovaHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-nova-border bg-white/90 backdrop-blur-md',
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:px-4 md:h-16 md:gap-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Retour"
              className="grid size-9 shrink-0 place-items-center rounded-xl text-nova-navy transition-colors hover:bg-nova-surface-secondary md:size-10"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
          )}
          <NovaLogo />
        </div>
        <div className="flex items-center gap-3">
          {children}
          {showBadge && <PrivacyBadge className="hidden sm:inline-flex" />}
        </div>
      </div>
    </header>
  );
}
