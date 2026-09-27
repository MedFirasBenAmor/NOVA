'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home, MessagesSquare, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

// Mapped to existing routes only. "Profil" has no feature yet, so it stays
// disabled rather than pointing at a dead route.
const ITEMS: NavItem[] = [
  { label: 'Accueil', href: '/', icon: Home },
  { label: 'Demandes', href: '/chat', icon: MessagesSquare },
  { label: 'Mes contrats', href: '/broker', icon: FileText },
  { label: 'Profil', href: '', icon: UserRound, disabled: true },
];

export function BottomNavigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-nova-border bg-white/95 backdrop-blur-md md:hidden safe-bottom"
    >
      <ul className="mx-auto flex max-w-6xl items-stretch justify-around px-2">
        {ITEMS.map(({ label, href, icon: Icon, disabled }) => {
          const active = !disabled && href === pathname;
          const body = (
            <span
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium',
                active ? 'text-nova-blue' : 'text-nova-muted',
                disabled && 'opacity-40',
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </span>
          );
          return (
            <li key={label} className="flex flex-1">
              {disabled ? (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Bientôt disponible"
                  className="flex w-full cursor-not-allowed justify-center"
                >
                  {body}
                </button>
              ) : (
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className="flex w-full justify-center"
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
