import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

  const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#a855f7'];
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
    <div className="bg-white border border-gray-100 rounded-2xl shadow-md p-6 mb-8">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">
        💰 {title}
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
