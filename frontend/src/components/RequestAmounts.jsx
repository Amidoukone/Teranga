import { useTranslation } from 'react-i18next';
import { useLocale } from '../i18n/useLocale';

export default function RequestAmounts({ request }) {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();
  const amount = (value) => value != null && value !== '' && Number.isFinite(Number(value)) ? `${formatNumber(Number(value))} ${request.currency || ''}` : null;
  const payments = request.paymentState;
  return <details className="rounded-2xl border border-border bg-surface-card p-4">
    <summary className="cursor-pointer font-semibold">{t('requestAmounts.title')}</summary><dl className="mt-3 space-y-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><dt>{t('requestAmounts.estimate')}</dt><dd>{amount(request.budget) || t('requestAmounts.toConfirm')}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt>{t('requestAmounts.agreed')}</dt><dd>{amount(payments?.agreedAmount) || t('requestAmounts.toConfirm')}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt>{t('requestAmounts.paid')}</dt><dd>{amount(payments?.recordedPayments) || t('requestAmounts.unavailable')}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt>{t('requestAmounts.remaining')}</dt><dd>{amount(payments?.remainingAmount) || t('requestAmounts.unknown')}</dd></div>
    </dl><p className="mt-3 text-xs text-text-secondary">{t('requestAmounts.note')}</p>
  </details>;
}
