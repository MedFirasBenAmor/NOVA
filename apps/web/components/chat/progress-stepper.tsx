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

export function ProgressStepper({ activeStep, className }: ProgressStepperProps) {
  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {NOVA_STEPS.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3;
        const state =
          step < activeStep ? 'done' : step === activeStep ? 'active' : 'todo';
        return (
          <li
            key={label}
            className="flex min-w-0 flex-1 flex-col gap-1.5"
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors',
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
                'truncate text-[11px] font-medium',
                state === 'active' ? 'text-nova-navy' : 'text-nova-muted',
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
