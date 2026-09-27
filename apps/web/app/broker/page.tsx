import Link from 'next/link';
import { Building2, FolderOpen } from 'lucide-react';
import { NovaHeader } from '@/components/layout/nova-header';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { Button } from '@/components/ui/button';

export default function BrokerPage() {
  return (
    <>
      <NovaHeader backHref="/" />
      <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-nova-orange-bg text-nova-orange">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-nova-navy">
              Espace courtier & partenaire
            </h1>
            <p className="text-sm text-nova-muted">
              Vos dossiers transmis et leurs demandes.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 rounded-[20px] border border-dashed border-nova-border bg-nova-surface-secondary px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-white text-nova-muted shadow-token-sm">
            <FolderOpen className="size-7" aria-hidden="true" />
          </span>
          <p className="max-w-sm text-sm leading-6 text-nova-muted">
            Aucun dossier n’a encore été transmis par un partenaire sur cet
            appareil. Les demandes reçues apparaîtront ici.
          </p>
          <Button asChild variant="secondary" size="md">
            <Link href="/chat">Commencer une demande</Link>
          </Button>
        </div>
      </main>
      <BottomNavigation />
    </>
  );
}
