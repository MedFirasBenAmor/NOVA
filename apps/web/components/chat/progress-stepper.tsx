import { cn } from '@/lib/utils';

export type ProgressStepperProps = {
  activeStep: 1 | 2 | 3;
  className?: string;
};

export const NOVA_STEPS = [
  'Décrivez votre situation',
  'Analyse & options',
  'Recommandation',
] as const;

const NOVA_MOBILE_STEPS = ['Situation', 'Analyse', 'Recommandation'] as const;

export function ProgressStepper({ activeStep, className }: ProgressStepperProps) {
  return (
    <ol className={cn('flex items-start gap-1.5 md:items-center md:gap-2', className)}>
      {NOVA_STEPS.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3;
        const mobileLabel = NOVA_MOBILE_STEPS[index];
        const state =
          step < activeStep ? 'done' : step === activeStep ? 'active' : 'todo';
        return (
          <li
            key={label}
            className="flex min-w-0 flex-1 flex-col gap-1"
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <div className="flex items-center gap-1.5 md:gap-2">
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors md:size-6 md:text-[11px]',
                  state === 'done' && 'bg-nova-success text-white',
                  state === 'active' && 'bg-nova-blue text-white',
                  state === 'todo' && 'bg-nova-surface-secondary text-nova-muted',
                )}
              >
                {step}
              </span>
              <span
                className={cn(
                  'h-1 flex-1 rounded-full',
                  state === 'todo' ? 'bg-nova-border' : 'bg-nova-blue',
                )}
              />
            </div>
            <span
              className={cn(
                'text-center text-[10px] font-medium leading-4 md:text-left md:text-[11px]',
                state === 'active' ? 'text-nova-navy' : 'text-nova-muted',
              )}
            >
              <span className="md:hidden">{mobileLabel}</span>
              <span className="hidden md:inline">{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
