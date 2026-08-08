import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, ShieldCheck } from 'lucide-react';
import './globals.css';

export const metadata: Metadata = {
  title: 'NOVA',
  description: 'Digital insurance orchestration',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-[var(--border)] bg-white">
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold"
              aria-label="NOVA home"
            >
              <ShieldCheck className="size-6 text-[var(--accent)]" />
              NOVA
            </Link>
            <div className="flex items-center gap-5 text-sm font-medium">
              <Link href="/chat" className="flex items-center gap-2">
                <MessageCircle className="size-4" />
                Chat
              </Link>
              <Link href="/broker">Broker</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
