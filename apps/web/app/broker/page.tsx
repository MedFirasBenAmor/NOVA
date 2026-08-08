import { FolderOpen } from 'lucide-react';

export default function BrokerPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <FolderOpen className="size-7 text-[var(--accent)]" />
        <h1 className="text-2xl font-semibold">Broker Dashboard</h1>
      </div>
      <div className="mt-8 border-y border-[var(--border)] py-12 text-center text-zinc-500">
        Customer dossiers will appear here.
      </div>
    </main>
  );
}
