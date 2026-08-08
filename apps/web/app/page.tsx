import Link from 'next/link';
import { ArrowRight, FolderCheck, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
      <div className="max-w-3xl">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
          <ShieldCheck className="size-4" />
          Digital insurance orchestration
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">
          NOVA
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
          A clearer path from customer inputs to a qualified dossier and
          eligibility result.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/chat"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-5 font-medium text-white"
          >
            Open NOVA Chat <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/broker"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-5 font-medium"
          >
            <FolderCheck className="size-4" />
            Broker dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
