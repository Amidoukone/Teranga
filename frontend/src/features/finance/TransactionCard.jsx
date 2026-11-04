import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../i18n/useLocale';
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm';
import { deleteTransaction } from '../../services/transactions';
import { isGlobalAdminUser } from '../../utils/role';
import { casePath, REFERENCE_KINDS, transactionProofHref } from './transactionPresentation';
import TransactionForm from './TransactionForm';

export default function TransactionCard({ entry, user, context, from, onSaved, compact = false }) {
  const { t } = useTranslation();
  const { formatNumber, formatDate } = useLocale();
  const { confirmDelete } = useDeleteConfirm();
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), deleting = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const proof = transactionProofHref(entry.proofFile);
  const typeLabel = t(compact && entry.type === 'revenue' ? 'financialWorkspace.payment' : `transactions.type.${entry.type}`);
  async function remove() {
    if (deleting.current) return;
    deleting.current = true;
    try {
      if (!await confirmDelete('transaction') || !alive.current) return;
      setBusy(true); setError('');
      await deleteTransaction(entry.id);
      if (alive.current) onSaved();
    } catch (failure) { if (alive.current) setError(failure?.response?.data?.error || t('financialWorkspace.deleteFailed')); }
    finally { deleting.current = false; if (alive.current) setBusy(false); }
  }
  return <article aria-label={`${typeLabel} #${entry.id}`} className="min-w-0 space-y-3 rounded-2xl border border-border bg-surface-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{typeLabel} #{entry.id}</h2><p className="text-sm text-text-secondary">{t(`transactions.status.${entry.status}`, { defaultValue: entry.status || '—' })}</p></div><p className="text-lg font-semibold">{formatNumber(entry.amount)} {entry.currency || 'XOF'}</p></div>
    {entry.description && <p className="break-words text-sm">{entry.description}</p>}
    <p className="text-xs text-text-secondary">{[entry.createdAt && formatDate(entry.createdAt), entry.paymentMethod].filter(Boolean).join(' · ')}</p>
    {entry.user && <p className="text-xs text-text-secondary">{t('financialWorkspace.recordedBy')} : {[entry.user.firstName, entry.user.lastName].filter(Boolean).join(' ') || entry.user.email}</p>}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{REFERENCE_KINDS.map((kind) => {
      if (compact && kind === context?.kind) return null;
      if (context?.kind === 'task' && kind !== 'task') return null;
      const reference = entry[`${kind}Id`] || entry[kind]?.id;
      return reference ? <Link key={kind} to={casePath(kind, reference)} state={{ from }} className="inline-flex min-h-11 items-center underline">{t(`financialWorkspace.${kind}`)} #{reference}</Link> : null;
    })}{proof && <a href={proof} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">{t('financialWorkspace.viewProof')}</a>}</div>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => setEditing((value) => !value)} className="min-h-11 text-sm underline">{t(user.role === 'admin' ? 'financialWorkspace.edit' : 'financialWorkspace.attach')}</button>
      {isGlobalAdminUser(user) && <details><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('operationsCenter.more')}</summary><button type="button" disabled={busy || editing} onClick={remove} className="min-h-11 text-sm text-red-700 underline dark:text-red-300">{t('financialWorkspace.delete')}</button></details>}
    </div>
    {error && <p role="alert">{error}</p>}
    {editing && <TransactionForm user={user} context={context} compact={compact} entry={entry} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved(); }} />}
  </article>;
}
