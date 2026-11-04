import { useTranslation } from 'react-i18next';
import { useLocale } from '../i18n/useLocale';
import DossierFinanceSection from '../features/finance/DossierFinanceSection';

export default function RequestAmounts({ request, transactionsTo }) {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();
  const amount = (value) => value != null && value !== '' && Number.isFinite(Number(value)) ? `${formatNumber(Number(value))} ${request.currency || 'XOF'}` : null;
  const payments = request.paymentState;
  const agreed = amount(payments?.agreedAmount), remaining = amount(payments?.remainingAmount);
  const reference = transactionsTo?.match(/^\/services\/([1-9][0-9]*)\/transactions$/)?.[1];
  const Section = reference ? DossierFinanceSection : 'details';
  return <Section {...(reference ? { kind: 'service', reference, title: t('requestAmounts.title') } : { className: 'rounded-2xl border border-border bg-surface-card p-4' })}>
    {!reference && <summary className="cursor-pointer font-semibold">{t('requestAmounts.title')}</summary>}<dl className="mt-3 space-y-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><dt>{t('requestAmounts.estimate')}</dt><dd>{amount(request.budget) || t('requestAmounts.toConfirm')}</dd></div>
      {agreed && <div className="flex flex-wrap justify-between gap-2"><dt>{t('requestAmounts.agreed')}</dt><dd>{agreed}</dd></div>}
      <div className="flex flex-wrap justify-between gap-2"><dt>{t('requestAmounts.paid')}</dt><dd>{amount(payments?.recordedPayments) || t('requestAmounts.unavailable')}</dd></div>
      {request.collectedAmount != null && <div className="flex flex-wrap justify-between gap-2"><dt>{t('transportWorkspace.collectedRecorded')}</dt><dd>{amount(request.collectedAmount)}</dd></div>}
      {remaining && <div className="flex flex-wrap justify-between gap-2"><dt>{t('requestAmounts.remaining')}</dt><dd>{remaining}</dd></div>}
    </dl><p className="mt-3 text-xs text-text-secondary">{t('requestAmounts.note')}</p>
  </Section>;
}
