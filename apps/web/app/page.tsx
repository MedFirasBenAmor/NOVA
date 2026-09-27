import {
  Building2,
  FileUp,
  Heart,
  Mic,
  PenLine,
  Zap,
} from 'lucide-react';
import { NovaLogo } from '@/components/layout/nova-logo';
import { PrivacyBadge } from '@/components/layout/privacy-badge';
import { SecurityBanner } from '@/components/layout/security-banner';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { StartOptionCard } from '@/components/landing/start-option-card';
import { LandingResume } from '@/components/landing/landing-resume';

const WHY_NOVA = [
  {
    icon: Zap,
    title: 'Rapide',
    description: 'Votre dossier se remplit tout seul à partir de vos mots et documents.',
  },
  {
    icon: Heart,
    title: 'Humain',
    description: 'Un accompagnement clair, sans jargon, à chaque étape.',
  },
  {
    icon: PenLine,
    title: 'Simple',
    description: 'Une seule conversation, votre dossier, vos options.',
  },
];

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-nova-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <NovaLogo />
            <span className="hidden text-sm text-nova-muted sm:inline">
              Votre assistant intelligent de confiance
            </span>
          </div>
          <PrivacyBadge />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pt-14 lg:pb-20">
        {/* Hero */}
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div className="max-w-2xl">
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-nova-navy sm:text-5xl lg:text-6xl">
              Parlez-moi de votre situation,{' '}
              <span className="text-nova-blue">je m’occupe du reste.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-nova-muted">
              Assurance{' '}
              <span className="rounded-md bg-nova-blue/15 px-1 py-0.5 text-nova-navy">
                auto
              </span>
              ,{' '}
              <span className="rounded-md bg-nova-blue/15 px-1 py-0.5 text-nova-navy">
                habitation
              </span>{' '}
              ou les deux — simple, rapide et humain.
            </p>
          </div>

          <div className="lg:pl-8">
            <div className="relative mx-auto w-fit sm:mx-0">
              <img
                src="/nova-avatar.png"
                alt="Assistant NOVA"
                className="h-auto w-64 rounded-[24px] border border-nova-border bg-white shadow-token sm:w-72 lg:w-80"
              />
              <div className="absolute -left-2 top-10 w-[13rem] max-w-[calc(100%-0.5rem)] rounded-[20px] rounded-tl-md border border-nova-border bg-white p-5 shadow-token sm:-left-8">
                <p className="whitespace-pre-line text-sm leading-7 text-nova-navy">
                  {'Salut ! 👋\n\nDécrivez-moi votre situation en quelques mots ou utilisez une des options ci-dessous.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Start options */}
        <section className="mt-12 sm:mt-16">
          <h2 className="text-xl font-bold tracking-tight text-nova-navy sm:text-2xl">
            Comment voulez-vous commencer ?
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <StartOptionCard
              icon={Mic}
              title="Parler à NOVA"
              description="Expliquez-moi votre situation à voix haute."
              href="/voice"
              tone="blue"
            />
            <StartOptionCard
              icon={PenLine}
              title="Écrire à NOVA"
              description="Décrivez votre situation en texte."
              href="/chat"
              tone="green"
            />
            <StartOptionCard
              icon={FileUp}
              title="Importer mon contrat"
              description="Déposez votre contrat actuel (auto, habitation ou les deux) et j’extrais les informations."
              href="/chat"
              tone="purple"
            />
            <StartOptionCard
              icon={Building2}
              title="Je viens d’un partenaire"
              description="Continuez votre demande transmise par votre concessionnaire ou courtier."
              href="/broker"
              tone="orange"
            />
          </div>
        </section>

        <section className="mt-6 sm:mt-8">
          <SecurityBanner />
        </section>

        {/* Why NOVA */}
        <section className="mt-12 sm:mt-16">
          <h2 className="text-xl font-bold tracking-tight text-nova-navy sm:text-2xl">
            Pourquoi utiliser NOVA ?
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {WHY_NOVA.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[20px] border border-nova-border bg-white p-5 shadow-token-sm"
                >
                  <span className="grid size-10 place-items-center rounded-2xl bg-nova-blue-light text-nova-blue">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 font-semibold text-nova-navy">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-nova-muted">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Resume */}
        <section className="mt-12 border-t border-nova-border pt-10 sm:mt-16">
          <LandingResume />
        </section>
      </main>

      <footer className="border-t border-nova-border bg-nova-surface-secondary py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 text-sm text-nova-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <NovaLogo />
          <p>NOVA — Digital insurance orchestration</p>
        </div>
      </footer>

      <BottomNavigation />
    </>
  );
}
