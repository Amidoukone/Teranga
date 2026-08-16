// frontend/src/pages/AdminDisputesPage.jsx
// File de traitement des litiges (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2) : un admin/master voit
// les litiges de son scope géographique, marque le premier contact, puis résout avec
// justification obligatoire. Miroir du modèle d'ouverture côté client dans MissionTrackingPage.js.

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, MessageCircle } from 'lucide-react';

import { listMissionDisputes, updateMissionDispute } from '../services/missions';
import { useLocale } from '../i18n/useLocale';
import { notify } from '../utils/notify';
import { AdminPageHeader } from '../components/admin/AdminFormUi';
import { Badge, Modal, FormField, Button } from '../components/ui';

const STATUS_TABS = ['active', 'resolved'];
const RESOLUTION_OPTIONS = ['refund', 'redo', 'closed'];

const STATUS_TONE = {
  open: 'warning',
  investigating: 'info',
  resolved: 'success',
};

export default function AdminDisputesPage() {
  const { t } = useTranslation();
  const { formatDate } = useLocale();

  const [tab, setTab] = useState('active');
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState(null);

  const [resolveTarget, setResolveTarget] = useState(null); // { serviceId, disputeId }
  const [resolution, setResolution] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab === 'resolved' ? { status: 'resolved' } : {};
      const list = await listMissionDisputes(params);
      setDisputes(list);
    } catch (_err) {
      notify(t('adminDisputesPage.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [tab, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkInvestigating(dispute) {
    setMarkingId(dispute.id);
    try {
      await updateMissionDispute(dispute.serviceId, dispute.id, { status: 'investigating' });
      await load();
    } catch (_err) {
      notify(t('adminDisputesPage.errors.action'));
    } finally {
      setMarkingId(null);
    }
  }

  function openResolveModal(dispute) {
    setResolveTarget({ serviceId: dispute.serviceId, disputeId: dispute.id });
    setResolution('');
    setResolutionNotes('');
    setResolveError(null);
  }

  async function handleSubmitResolve(event) {
    event.preventDefault();
    if (!resolution || resolutionNotes.trim().length < 10) return;

    setResolving(true);
    setResolveError(null);
    try {
      await updateMissionDispute(resolveTarget.serviceId, resolveTarget.disputeId, {
        resolution,
        resolutionNotes: resolutionNotes.trim(),
      });
      setResolveTarget(null);
      await load();
    } catch (_err) {
      setResolveError(t('adminDisputesPage.resolveModal.error'));
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <AdminPageHeader
        title={t('adminDisputesPage.title')}
        subtitle={t('adminDisputesPage.subtitle')}
      />

      <div className="mb-5 flex gap-2">
        {STATUS_TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              tab === key
                ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {t(`adminDisputesPage.tabs.${key}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">{t('adminDisputesPage.loading')}</p>
      ) : disputes.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card/70 py-10 text-center text-sm text-text-secondary">
          {t('adminDisputesPage.empty')}
        </div>
      ) : (
        <div className="grid gap-4">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="rounded-2xl border border-border bg-surface-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span className="text-sm font-semibold text-text-primary">
                    {dispute.service?.title || t('adminDisputesPage.missionFallback', { id: dispute.serviceId })}
                  </span>
                </div>
                <Badge tone={STATUS_TONE[dispute.status] || 'neutral'}>
                  {t(`adminDisputesPage.status.${dispute.status}`)}
                </Badge>
              </div>

              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(`missionTracking.disputeModal.reasons.${dispute.reason}`)}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{dispute.description}</p>

              <p className="mt-3 text-xs text-text-muted">
                {t('adminDisputesPage.openedAt', { date: formatDate(dispute.createdAt) })}
                {dispute.firstContactAt
                  ? ` · ${t('adminDisputesPage.firstContactDone')}`
                  : ` · ${t('adminDisputesPage.firstContactPending')}`}
              </p>

              {dispute.status !== 'resolved' ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {dispute.status === 'open' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={markingId === dispute.id}
                      onClick={() => handleMarkInvestigating(dispute)}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs"
                    >
                      <MessageCircle size={13} />
                      {t('adminDisputesPage.markInvestigatingCta')}
                    </Button>
                  ) : null}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openResolveModal(dispute)}
                    className="rounded-full px-4 py-2 text-xs"
                  >
                    {t('adminDisputesPage.resolveCta')}
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-xs text-text-secondary">
                  {t(`adminDisputesPage.resolution.${dispute.resolution}`)} — {dispute.resolutionNotes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(resolveTarget)}
        onClose={() => setResolveTarget(null)}
        title={t('adminDisputesPage.resolveModal.title')}
      >
        <form onSubmit={handleSubmitResolve} className="mt-4 flex flex-col gap-4">
          <FormField label={t('adminDisputesPage.resolveModal.resolutionLabel')} required htmlFor="dispute-resolution">
            <select
              id="dispute-resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              required
              className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
            >
              <option value="" disabled>
                {t('adminDisputesPage.resolveModal.resolutionPlaceholder')}
              </option>
              {RESOLUTION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`adminDisputesPage.resolution.${r}`)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label={t('adminDisputesPage.resolveModal.notesLabel')}
            required
            htmlFor="dispute-resolution-notes"
            hint={t('adminDisputesPage.resolveModal.notesHint')}
          >
            <textarea
              id="dispute-resolution-notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              required
              minLength={10}
              rows={4}
              placeholder={t('adminDisputesPage.resolveModal.notesPlaceholder')}
              className="w-full resize-y rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
            />
          </FormField>

          {resolveError ? <p className="text-sm text-red-600">{resolveError}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={resolving} className="rounded-full px-6 py-2.5 text-sm">
              {t('adminDisputesPage.resolveModal.submit')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResolveTarget(null)}
              disabled={resolving}
              className="rounded-full px-6 py-2.5 text-sm"
            >
              {t('adminDisputesPage.resolveModal.cancel')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
