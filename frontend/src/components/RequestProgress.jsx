import { useTranslation } from 'react-i18next';
import { getRequestNextAction, getRequestPhase } from '../utils/requestLifecycle';

const STEPS = ['received', 'assigned', 'execution', 'review', 'finished'];

export default function RequestProgress({ request }) {
  const { t } = useTranslation();
  const phase = getRequestPhase(request);
  if (phase === null) return <p role="status" className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{t(`serviceOrders.clientNextAction.${getRequestNextAction(request, 'client')}`)}</p>;
  return <ol className="mt-4 grid grid-cols-5 gap-1 rounded-2xl border border-border bg-surface-main/50 p-3" aria-label={t('requestProgress.label')}>
    {STEPS.map((step, index) => <li key={step} aria-label={t(`requestProgress.${step}`)} aria-current={index === phase ? 'step' : undefined} className="flex min-w-0 flex-col items-center gap-2 text-center">
      <span aria-hidden="true" className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${index < phase ? 'border-emerald-600 bg-emerald-600 text-white' : index === phase ? 'border-blue-600 bg-blue-600 text-white' : 'border-border text-text-muted'}`}>{index < phase ? '✓' : index + 1}</span>
      <span className={`text-[10px] leading-tight sm:text-xs ${index === phase ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{t(`requestProgress.${step}`)}</span>
    </li>)}
  </ol>;
}
