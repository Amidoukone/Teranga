import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';
import { getTransactions } from '../services/transactions';
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from 'recharts';

export default function FinanceWidget({ role }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const txs = await getTransactions();
        const totals = { revenue: 0, expense: 0, commission: 0, adjustment: 0 };
        txs.forEach((t) => {
          if (totals[t.type] !== undefined) totals[t.type] += Number(t.amount);
        });
        setSummary(totals);
      } catch {
        setSummary({ revenue: 0, expense: 0, commission: 0, adjustment: 0 });
      }
    }
    init();
  }, []);

  if (!summary) return <p>{t('financeWidget.loading')}</p>;

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
    <div className="bg-white/90 border border-slate-200/80 rounded-2xl shadow-[0_12px_30px_-22px_rgba(15,23,42,0.45)] p-5 mb-8">
      <h2 className="text-lg sm:text-xl font-semibold mb-4 text-slate-900 tracking-tight flex items-center gap-2">
        <Landmark size={18} className="text-slate-500" />
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
