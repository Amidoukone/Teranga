import { useEffect, useState } from 'react';
import { getTransactions } from '../services/transactions';
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from 'recharts';

export default function FinanceWidget({ role }) {
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

  if (!summary) return <p>Chargement du graphique...</p>;

  const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#a855f7'];
  const data = [
    { name: 'Revenus', value: summary.revenue },
    { name: 'Dépenses', value: summary.expense },
    { name: 'Commissions', value: summary.commission },
    { name: 'Ajustements', value: summary.adjustment },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-md p-6 mb-8">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">
        💰 Aperçu financier ({role})
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
