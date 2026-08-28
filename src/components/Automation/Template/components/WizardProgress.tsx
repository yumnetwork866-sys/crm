import { Check } from 'lucide-react';
import { memo } from 'react';
import type { WizardStep } from '../types';

interface WizardProgressProps {
  step: WizardStep;
}

const STEPS = ['Set up template', 'Edit template', 'Submit for Review'] as const;

export const WizardProgress = memo(function WizardProgress({ step }: WizardProgressProps) {
  return (
    <div className="px-3 py-2 sm:px-8">
      <ol className="grid grid-cols-3">
        {STEPS.map((label, index) => {
          const number = (index + 1) as WizardStep;
          const complete = number < step;
          const active = number === step;

          return (
            <li key={label} className="relative flex min-w-0 flex-col items-center text-center">
              {index > 0 ? (
                <span className={`absolute right-1/2 top-4 h-0.5 w-full ${number <= step ? 'bg-indigo-500' : 'bg-slate-200'}`} />
              ) : null}
              <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                complete
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : active
                    ? 'border-indigo-600 bg-white text-indigo-700'
                    : 'border-slate-300 bg-white text-slate-400'
              }`}>
                {complete ? <Check className="h-4 w-4 text-white" aria-hidden="true" style={{ color: '#ffffff', stroke: '#ffffff' }} /> : number}
              </span>
              <span className={`relative mt-2 text-[10px] font-bold leading-4 sm:text-xs ${active || complete ? 'text-slate-900' : 'text-slate-400'}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
});
