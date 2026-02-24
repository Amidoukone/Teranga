import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';
import { getTransactions } from '../services/transactions';
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from 'recharts';

export default function FinanceWidget({ role, summary: providedSummary = null, loading = false }) {
  const { t } = useTranslation();
  const [fetchedSummary, setFetchedSummary] = useState(null);

  useEffect(() => {
    if (providedSummary) return;

    async function init() {
      try {
        const txs = await getTransactions();
        const totals = { revenue: 0, expense: 0, commission: 0, adjustment: 0 };
        txs.forEach((trx) => {
          if (totals[trx.type] !== undefined) totals[trx.type] += Number(trx.amount);
        });
        setFetchedSummary(totals);
      } catch {
        setFetchedSummary({ revenue: 0, expense: 0, commission: 0, adjustment: 0 });
      }
    }
    init();
  }, [providedSummary]);

  const summary = providedSummary || fetchedSummary;

  if (loading || !summary) return <p>{t('financeWidget.loading')}</p>;

  const COLORS = ['#10b981', '#ef4444', '#0ea5e9', '#6366f1'];
  const data = [
    { name: t('transactions.type.revenue'), value: summary.revenue },
    { name: t('transactions.type.expense'), value: summary.expense },
    { name: t('transactions.type.commission'), value: summary.commission },
    { name: t('transactions.type.adjustment'), value: summary.adjustment },
  ];

  const title = role
    ? t('financeWidget.titleWithRole', { role })
    : t('financeWidget.title');

  return (
    <div className="bg-surface-card/90 border border-border/80 rounded-2xl shadow-[0_12px_30px_-22px_rgba(15,23,42,0.45)] p-5 mb-8">
      <h2 className="text-lg sm:text-xl font-semibold mb-4 text-text-primary tracking-tight flex items-center gap-2">
        <Landmark size={18} className="text-text-muted" />
        {title}
      </h2>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              dataKey="value"
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={COLORS[index]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


