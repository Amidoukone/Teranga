// ============================================================================
// TaskEvidencesPage.jsx - VERSION PREMIUM 2025 (MASTER SAFE - PARTIE 1 / 2)
// ============================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  uploadEvidences,
  getEvidences,
  deleteEvidence,
} from '../services/evidences';
import { me } from '../services/auth';
import { useLocale } from '../i18n/useLocale';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';
import { getFeedbackIcon } from '../utils/feedback';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import { fixMojibakeText } from '../utils/mojibake';

// ============================================================================
// Contexte: preuves de tache.
// ============================================================================
const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' &&
  window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000');

function toAbsUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${FILE_BASE}${clean}`.replace(/([^:]\/)\/+/g, '$1');
}

const MAX_EVIDENCES = 15;
const MAX_FILES = 20;
const DELETE_WINDOW_MS = 60 * 60 * 1000;
const UPLOAD_BATCH_SIZE =
  Number(process.env.REACT_APP_UPLOAD_BATCH_SIZE) || 3;
const DEFAULT_FILTERS = {
  q: '',
  kind: '',
  withNotes: false,
  dateFrom: '',
  dateTo: '',
  sort: '-createdAt',
};

// ============================================================================
// Contexte: preuves de tache.
// ============================================================================
function inferKind(name = '', mime = '') {
  const lower = name.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower)) {
    return 'image';
  }
  if (mime === 'application/pdf' || /\.pdf$/i.test(lower)) return 'pdf';
  return 'other';
}

function isImageEvidence(ev) {
  if (!ev) return false;
  if (ev.kind === 'photo') return true;
  if (ev.kind && ev.kind !== 'image') return false;
  const k = inferKind(ev.originalName || '', ev.mimeType || '');
  return k === 'image';
}

function extractFileName(path = '') {
  if (!path) return '';
  try {
    const url = new URL(path);
    const last = url.pathname.split('/').pop() || '';
    return decodeURIComponent(last);
  } catch {
    const last = String(path).split('/').pop() || '';
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
}

function getEvidenceDisplayName(ev, fallbackLabel = 'Fichier') {
  const original = fixMojibakeText(ev?.originalName || '');
  if (original) return original;
  const fallback = extractFileName(ev?.filePath || '');
  return fixMojibakeText(fallback) || fallbackLabel;
}

function getEvidenceKindForUI(ev) {
  if (!ev) return 'other';
  if (isImageEvidence(ev)) return 'image';
  const inferred = inferKind(ev.originalName || '', ev.mimeType || '');
  if (ev.kind === 'document') return inferred === 'pdf' ? 'pdf' : 'other';
  return inferred;
}

function getFileExtLabel(name = '', fallback = 'FILE') {
  const base = String(name || '').trim();
  if (!base) return fallback;
  const parts = base.split('.');
  if (parts.length < 2) return fallback;
  const ext = parts[parts.length - 1].slice(0, 6).toUpperCase();
  return ext || fallback;
}

function getEvidenceLevelInfo(totalImages, maxImages, t) {
  const count = Math.max(0, Number(totalImages) || 0);
  const max = Math.max(0, Number(maxImages) || 0);

  if (max && count > max) {
    return {
      level: 'overflow',
      label: t('taskEvidencesPage.evidenceLevel.overflow.label'),
      message: t('taskEvidencesPage.evidenceLevel.overflow.message', {
        max,
      }),
      toneClass: 'text-red-600',
    };
  }

  if (count <= 3) {
    return {
      level: 'low',
      label: t('taskEvidencesPage.evidenceLevel.low.label'),
      message: t('taskEvidencesPage.evidenceLevel.low.message'),
      toneClass: 'text-red-600',
    };
  }
  if (count <= 5) {
    return {
      level: 'acceptable',
      label: t('taskEvidencesPage.evidenceLevel.acceptable.label'),
      message: t('taskEvidencesPage.evidenceLevel.acceptable.message'),
      toneClass: 'text-amber-600',
    };
  }
  if (count <= 9) {
    return {
      level: 'good',
      label: t('taskEvidencesPage.evidenceLevel.good.label'),
      message: t('taskEvidencesPage.evidenceLevel.good.message'),
      toneClass: 'text-blue-600',
    };
  }
  if (count <= 13) {
    return {
      level: 'excellent',
      label: t('taskEvidencesPage.evidenceLevel.excellent.label'),
      message: t('taskEvidencesPage.evidenceLevel.excellent.message'),
      toneClass: 'text-emerald-600',
    };
  }
  return {
    level: 'excellent',
    label: t('taskEvidencesPage.evidenceLevel.excellentFull.label'),
    message: t('taskEvidencesPage.evidenceLevel.excellentFull.message'),
    toneClass: 'text-green-700',
  };
}

function getDeleteEligibility(user, ev) {
  if (!user || !ev) return { allowed: false, reason: 'no-user' };
  if (user.role === 'admin') return { allowed: true, reason: 'admin' };

  if (!ev.uploaderId || String(ev.uploaderId) !== String(user.id)) {
    return { allowed: false, reason: 'not-owner' };
  }

  const createdAtMs = ev.createdAt ? new Date(ev.createdAt).getTime() : NaN;
  if (!Number.isFinite(createdAtMs)) {
    return { allowed: false, reason: 'invalid-date' };
  }

  const remainingMs = DELETE_WINDOW_MS - (Date.now() - createdAtMs);
  if (remainingMs <= 0) {
    return { allowed: false, reason: 'expired', remainingMs: 0 };
  }

  return { allowed: true, reason: 'within-window', remainingMs };
}

function formatRemainingMs(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function TaskEvidencesPage() {
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  const { formatDateTime } = useLocale();
  const { id } = useParams(); // taskId
  const navigate = useNavigate();
  const location = useLocation();

  const [evidences, setEvidences] = useState([]);
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [user, setUser] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_evidences_showForm');
    return saved === null ? true : saved === '1';
  });

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const backTarget = useMemo(() => {
    const from = location.state?.from;
    if (
      typeof from === 'string' &&
      from.startsWith('/') &&
      from !== location.pathname
    ) {
      return from;
    }
    const serviceId = location.state?.serviceId;
    if (
      serviceId !== undefined &&
      serviceId !== null &&
      String(serviceId).trim()
    ) {
      return `/services/${serviceId}/tasks`;
    }
    return '/tasks';
  }, [location.pathname, location.state?.from, location.state?.serviceId]);

  const handleBack = useCallback(() => {
    navigate(backTarget);
  }, [backTarget, navigate]);
  const contextualServiceId = useMemo(() => {
    const stateServiceId = location.state?.serviceId;
    if (
      stateServiceId !== undefined &&
      stateServiceId !== null &&
      String(stateServiceId).trim()
    ) {
      return String(stateServiceId);
    }
    const m = String(backTarget || '').match(/^\/services\/([^/]+)\/tasks$/);
    return m?.[1] || null;
  }, [backTarget, location.state?.serviceId]);
  const handleGoToServiceTasks = useCallback(() => {
    if (!contextualServiceId) {
      navigate('/tasks');
      return;
    }
    navigate(`/services/${contextualServiceId}/tasks`, {
      state: { from: location.pathname },
    });
  }, [contextualServiceId, location.pathname, navigate]);
  const handleGoToTransactions = useCallback(() => {
    if (!contextualServiceId) {
      navigate('/transactions');
      return;
    }
    navigate(`/services/${contextualServiceId}/transactions?taskId=${id}`, {
      state: { from: location.pathname },
    });
  }, [contextualServiceId, id, location.pathname, navigate]);

  // ========================================================================
 // Contexte: preuves de tache.
  // ========================================================================
  const isAdmin = user?.role === 'admin';
  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const existingEvidenceCount = useMemo(() => {
    return (evidences || []).length;
  }, [evidences]);

  const selectedEvidenceCount = useMemo(
    () => (files || []).length,
    [files]
  );

  const totalEvidenceCount = existingEvidenceCount + selectedEvidenceCount;

  const evidenceLevel = useMemo(
    () => getEvidenceLevelInfo(totalEvidenceCount, MAX_EVIDENCES, t),
    [totalEvidenceCount, t]
  );

  const uploadValidationError = useMemo(() => {
    if (!files || files.length === 0) return '';
    if (files.length > MAX_FILES) {
      return t('taskEvidencesPage.validation.maxFiles', { max: MAX_FILES });
    }
    if (selectedEvidenceCount > 0 && totalEvidenceCount > MAX_EVIDENCES) {
      return t('taskEvidencesPage.validation.maxEvidences', {
        max: MAX_EVIDENCES,
      });
    }
    return '';
  }, [files, selectedEvidenceCount, totalEvidenceCount, t]);

  const disableUpload = uploading || !files.length || Boolean(uploadValidationError);

  // ========================================================================
  // FETCH EVIDENCES
  // ========================================================================
  const fetchEvidences = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const ev = await getEvidences(id);
      setEvidences(ev || []);
    } catch (err) {
      console.error('TaskEvidencesPage load evidences error:', err);
      setEvidences([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ========================================================================
  // INIT
  // ========================================================================
  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const u = await me();
        if (!active) return;
        const current = u?.user;
        if (!current) {
          window.location.href = '/login';
          return;
        }
        setUser(current);
        await fetchEvidences();
      } catch (err) {
        console.error('TaskEvidencesPage init evidence error:', err);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [fetchEvidences]);

  useEffect(() => {
    localStorage.setItem('teranga_evidences_showForm', showForm ? '1' : '0');
  }, [showForm]);

  // ========================================================================
  // File handling
  // ========================================================================
  function handleFileChange(e) {
    const fl = Array.from(e.target.files || []);
    setFiles(fl);

    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setPreviewUrls(fl.map((f) => URL.createObjectURL(f)));
  }

  function buildUploadBatches(selected, batchSize) {
    const safeBatch = Math.max(1, Number(batchSize) || 1);
    const batches = [];
    for (let i = 0; i < selected.length; i += safeBatch) {
      batches.push(selected.slice(i, i + safeBatch));
    }
    return batches;
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!files.length) {
      notify(t('taskEvidencesPage.validation.noFiles'));
      return;
    }
    if (uploadValidationError) {
      notify(uploadValidationError);
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length, batch: 0, batches: 0 });
    try {
      const batches = buildUploadBatches(files, UPLOAD_BATCH_SIZE);
      let uploadedCount = 0;
      for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];
        setUploadProgress({
          current: uploadedCount,
          total: files.length,
          batch: i + 1,
          batches: batches.length,
        });
        await uploadEvidences(id, batch, notes);
        uploadedCount += batch.length;
        setUploadProgress({
          current: uploadedCount,
          total: files.length,
          batch: i + 1,
          batches: batches.length,
        });
      }
      setUploadProgress({
        current: uploadedCount,
        total: files.length,
        batch: batches.length,
        batches: batches.length,
      });

      setFiles([]);
      setNotes('');
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
      setPreviewUrls([]);

      await fetchEvidences();
    } catch (err) {
      console.error('TaskEvidencesPage upload evidence error:', err);
      const msg =
        err?.response?.data?.error ||
        t('taskEvidencesPage.errors.upload');
      notify(msg);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleDelete(evidenceId) {
    const ok = await confirmDelete("evidence");
    if (!ok) return;
    try {
      await deleteEvidence(evidenceId);
      await fetchEvidences();
    } catch (err) {
      console.error('TaskEvidencesPage delete evidence error:', err);
      const msg =
        err?.response?.data?.error || t('taskEvidencesPage.errors.delete');
      notify(msg);
    }
  }

  // ========================================================================
  // Filter + sort
  // ========================================================================
  const filtered = useMemo(() => {
    let arr = [...evidences];

    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((ev) =>
        [
          getEvidenceDisplayName(ev, t('taskEvidencesPage.fileFallback')),
          ev.filePath,
          ev.notes,
          ev.kind,
          ev?.uploader?.firstName,
          ev?.uploader?.lastName,
          ev?.uploader?.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.kind) {
      arr = arr.filter((ev) => {
        const k = getEvidenceKindForUI(ev);
        return k === filters.kind;
      });
    }

    if (filters.withNotes) {
      arr = arr.filter((ev) => ev.notes && ev.notes.trim());
    }

    if (filters.dateFrom) {
      const ts = new Date(filters.dateFrom).setHours(0, 0, 0, 0);
      arr = arr.filter((ev) => new Date(ev.createdAt).getTime() >= ts);
    }
    if (filters.dateTo) {
      const ts = new Date(filters.dateTo).setHours(23, 59, 59, 999);
      arr = arr.filter((ev) => new Date(ev.createdAt).getTime() <= ts);
    }

    const by = filters.sort || '-createdAt';
    const key = by.replace(/^-/, '');
    const sign = by.startsWith('-') ? -1 : 1;

    arr.sort((a, b) => {
      let va, vb;
      if (key === 'createdAt') {
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
      } else {
        va = (a[key] || '').toString().toLowerCase();
        vb = (b[key] || '').toString().toLowerCase();
      }
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    return arr;
  }, [evidences, filters, t]);
  const hasAnyEvidences = (evidences || []).length > 0;
  const emptyTitle = hasAnyEvidences
    ? t('taskEvidencesPage.list.emptyFilteredTitle')
    : t('taskEvidencesPage.list.empty');
  const emptySubtitle = hasAnyEvidences
    ? t('taskEvidencesPage.list.emptyFilteredSubtitle')
    : t('taskEvidencesPage.list.emptySubtitle');
  // ========================================================================
  // LIGHTBOX
  // ========================================================================
  function openLightbox(url) {
    setLightbox(url);
  }

  function closeLightbox() {
    setLightbox(null);
  }

  // ========================================================================
  // UI
  // ========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-5xl mx-auto bg-surface-card/95 shadow-2xl rounded-3xl p-5 sm:p-8 border border-border/70">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-4 border-b border-border/70">
          <div className="space-y-1">
            <p className="text-[0.7rem] uppercase tracking-wide text-blue-600 font-semibold">
              {t('taskEvidencesPage.header.kicker')}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary">
              {t('taskEvidencesPage.header.title', { id })}
            </h1>
            <p className="text-sm sm:text-base text-text-secondary">
              {t('taskEvidencesPage.header.subtitle')}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-xs sm:text-sm text-text-muted bg-surface-main px-3 py-1.5 rounded-full border border-border">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              {t('taskEvidencesPage.header.count', { count: filtered.length })}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm app-btn-neutral transition"
            >
              {showForm
                ? t('taskEvidencesPage.buttons.hideForm')
                : t('taskEvidencesPage.buttons.showForm')}
            </button>
            <button
              onClick={handleGoToServiceTasks}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm app-btn-neutral transition"
            >
              <span>{t('services.buttons.viewTasks')}</span>
            </button>
            <button
              onClick={handleGoToTransactions}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm app-btn-primary transition"
            >
              <span>{t('nav.transactions')}</span>
            </button>
            <button
              onClick={handleBack}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm app-btn-neutral transition"
            >
              <span aria-hidden="true">&lt;-</span>
              <span>{t('common.back')}</span>
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-text-muted animate-pulse text-center mb-4 text-sm sm:text-base">
            {t('taskEvidencesPage.loading')}
          </p>
        )}

        {/* ==========================================================
           BARRE DE FILTRES
        ========================================================== */}
        <div className="mb-8 bg-surface-main border border-border rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            {/* Recherche */}
            <input
              placeholder={t('taskEvidencesPage.filters.searchPlaceholder')}
              value={filters.q}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, q: e.target.value }))
              }
              className="
                border border-border rounded-lg px-3 py-2.5 text-sm sm:text-base bg-surface-card text-text-primary
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                col-span-1 sm:col-span-2 lg:col-span-4 break-words
              "
            />

            {/* Type */}
            <select
              value={filters.kind}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, kind: e.target.value }))
              }
              className="border border-border rounded-lg px-3 py-2 text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('taskEvidencesPage.filters.typeAll')}</option>
              <option value="image">{t('taskEvidencesPage.filters.typeImage')}</option>
              <option value="pdf">{t('taskEvidencesPage.filters.typePdf')}</option>
              <option value="other">{t('taskEvidencesPage.filters.typeOther')}</option>
            </select>

            {/* Avec notes */}
            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({ ...prev, withNotes: !prev.withNotes }))
              }
              className={`
                text-xs sm:text-sm px-3 py-2 rounded-lg border
                flex items-center justify-center
                ${
                  filters.withNotes
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-surface-card text-text-secondary border-border"
                }
              `}
            >
              {filters.withNotes
                ? t('taskEvidencesPage.filters.withNotesOn')
                : t('taskEvidencesPage.filters.withNotesOff')}
            </button>

 {/* Contexte: preuves de tache. */}
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
              }
              className="border border-border rounded-lg px-3 py-2 text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
            />

            {/* Date de fin */}
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
              }
              className="border border-border rounded-lg px-3 py-2 text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
            />

            {/* Tri */}
            <select
              value={filters.sort}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sort: e.target.value }))
              }
              className="border border-border rounded-lg px-3 py-2 text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
            >
              <option value="-createdAt">{t('taskEvidencesPage.filters.sortNewest')}</option>
              <option value="createdAt">{t('taskEvidencesPage.filters.sortOldest')}</option>
              <option value="originalName">{t('taskEvidencesPage.filters.sortNameAsc')}</option>
              <option value="-originalName">{t('taskEvidencesPage.filters.sortNameDesc')}</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs sm:text-sm text-text-muted">
              {t('taskEvidencesPage.filters.foundCount', { count: filtered.length })}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="
                text-xs sm:text-sm px-3 py-1.5 bg-surface-main/80 text-text-secondary border border-border/70 rounded-md
                hover:bg-surface-main w-full sm:w-auto text-center
              "
            >
              {t('taskEvidencesPage.filters.reset')}
            </button>
          </div>
        </div>

        {/* ==========================================================
           FORM UPLOAD
        ========================================================== */}
        {showForm && (
          <form
            onSubmit={handleUpload}
            className="bg-surface-main p-5 rounded-2xl border border-border mb-8"
          >
            <h2 className="text-base sm:text-lg font-semibold text-text-primary mb-3">
              {t('taskEvidencesPage.form.title')}
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mb-4">
              {t('taskEvidencesPage.form.subtitle')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                  {t('taskEvidencesPage.form.filesLabel')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                  className="
                    w-full border border-border rounded-lg px-3 py-2
                    text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500
                  "
                />

                {files.length > 0 && (
                  <p className="mt-2 text-xs sm:text-sm text-text-muted">
                    {t('taskEvidencesPage.form.filesSelected', { count: files.length })}
                  </p>
                )}

                <p className="mt-2 text-xs sm:text-sm text-text-muted">
                  {t('taskEvidencesPage.form.existingSummary', {
                    existing: existingEvidenceCount,
                    max: MAX_EVIDENCES,
                    selected: selectedEvidenceCount,
                    total: totalEvidenceCount,
                  })}
                </p>
                <p className={`mt-1 text-xs sm:text-sm ${evidenceLevel.toneClass}`}>
                  {t('taskEvidencesPage.form.evidenceLevelLabel')}{' '}
                  <span className="font-semibold">{evidenceLevel.label}</span>,{' '}
                  {evidenceLevel.message}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {t('taskEvidencesPage.form.batchInfo', {
                    count: UPLOAD_BATCH_SIZE,
                  })}
                </p>

                {uploadValidationError && (
                  <p className="mt-2 text-xs sm:text-sm text-red-600">
                    {uploadValidationError}
                  </p>
                )}

                {previewUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {previewUrls.map((url, i) => {
                      const f = files[i];
                      const kind = inferKind(f?.name, f?.type);
                      return (
                        <div
                          key={i}
                          className="
                            w-24 h-24 sm:w-28 sm:h-28 border border-border rounded-lg
                            overflow-hidden bg-surface-card flex items-center justify-center
                          "
                        >
                          {kind === "image" ? (
                            <img
                              src={url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[0.7rem] text-text-secondary px-2 break-words text-center">
                              {f?.name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                  {t('taskEvidencesPage.form.notesLabel')}
                </label>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="
                    w-full border border-border rounded-lg px-3 py-2
                    text-sm sm:text-base bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500
                  "
                  placeholder={t('taskEvidencesPage.form.notesPlaceholder')}
                />
              </div>
            </div>

            <div className="text-right mt-5">
              <button
                disabled={disableUpload}
                className={`
                  px-5 py-2.5 rounded-lg text-sm sm:text-base font-semibold text-white
                  ${
                    disableUpload
                      ? "bg-blue-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }
                `}
              >
                {uploading
                  ? t('taskEvidencesPage.form.submitting')
                  : t('taskEvidencesPage.form.submit')}
              </button>
              {uploadProgress && (
                <p className="mt-2 text-xs text-text-muted">
                  {uploadProgress.batches > 0
                    ? t('taskEvidencesPage.form.uploadProgressBatch', {
                        current: uploadProgress.current,
                        total: uploadProgress.total,
                        batch: uploadProgress.batch,
                        batches: uploadProgress.batches,
                      })
                    : t('taskEvidencesPage.form.uploadProgress', {
                        current: uploadProgress.current,
                        total: uploadProgress.total,
                      })}
                </p>
              )}
            </div>
          </form>
        )}

        {/* ==========================================================
           AVERTISSEMENT (client/agent uniquement)
           - Admin + MASTER: pas d'avertissement
        ========================================================== */}
        {!isAdmin && (
          <div className="mb-4 rounded-2xl bg-surface-main border border-border px-4 py-3 text-xs sm:text-sm text-text-secondary flex gap-2 items-start">
            <span className="mt-[1px]">{getFeedbackIcon('warning')}</span>
            <p className="break-words">
              {t('taskEvidencesPage.warnings.deleteWindow')}
            </p>
          </div>
        )}

        {/* ==========================================================
           LISTE DES PREUVES
        ========================================================== */}
        {filtered.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center mb-3">
              <span className="text-xl">i</span>
            </div>
            <p className="text-sm font-semibold text-text-primary mb-1">
              {emptyTitle}
            </p>
            <p className="text-xs text-text-muted max-w-sm">
              {emptySubtitle}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {hasAnyEvidences && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-surface-main/80 hover:bg-surface-main"
                >
                  {t('taskEvidencesPage.filters.reset')}
                </button>
              )}
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  {t('taskEvidencesPage.buttons.showForm')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((ev) => {
              const kindRaw = getEvidenceKindForUI(ev);
              const fileUrl = toAbsUrl(ev.filePath);
              const isImage = kindRaw === "image";
              const kind = kindRaw;
              const displayName = getEvidenceDisplayName(
                ev,
                t('taskEvidencesPage.fileFallback')
              );
              const deleteInfo = getDeleteEligibility(user, ev);
              const extFallback =
                kind === 'pdf'
                  ? t('taskEvidencesPage.fileKinds.pdf')
                  : t('taskEvidencesPage.fileKinds.file');
              const extLabel = getFileExtLabel(displayName, extFallback);
              const kindLabel =
                kind === 'image'
                  ? t('taskEvidencesPage.fileKinds.image')
                  : kind === 'pdf'
                  ? t('taskEvidencesPage.fileKinds.pdf')
                  : t('taskEvidencesPage.fileKinds.file');
              const uploaderLabel = ev.uploader
                ? (
                    `${ev.uploader.firstName || ''} ${
                      ev.uploader.lastName || ''
                    }`.trim() || ev.uploader.email
                  )
                : t('common.dash');
              const addedOnLabel = t('taskEvidencesPage.meta.addedOnBy', {
                date: formatDateTime(ev.createdAt),
                name: uploaderLabel,
              });

              return (
                <div
                  key={ev.id}
                  className="group bg-surface-card border border-border rounded-2xl shadow-sm hover:shadow-lg transition overflow-hidden"
                >
                  {/* PREVIEW */}
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-surface-main via-surface-card to-surface-main border-b border-border">
                    {isImage ? (
                      <button
                        type="button"
                        onClick={() => openLightbox(fileUrl)}
                        className="w-full h-full"
                        title={t('taskEvidencesPage.actions.preview')}
                      >
                        <img
                          src={fileUrl}
                          alt={displayName || t('taskEvidencesPage.fileAlt')}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </button>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-xs font-semibold text-text-secondary bg-surface-card/80 border border-border px-2 py-1 rounded-full inline-flex">
                            {extLabel}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="absolute top-3 left-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.7rem] font-semibold border ${
                          kind === "image"
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                            : kind === "pdf"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                            : "bg-surface-main text-text-secondary border-border"
                        }`}
                      >
                        {kindLabel}
                      </span>
                    </div>

                  </div>

                  {/* META */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={displayName}
                        className="
                          text-blue-600 dark:text-blue-400 hover:underline text-sm sm:text-base
                          font-semibold break-words whitespace-normal
                          block w-full max-w-full
                        "
                      >
                        {displayName}
                      </a>
                    </div>

                    <div className="mt-2 text-xs sm:text-sm text-text-muted break-words whitespace-normal w-full max-w-full">
                      {addedOnLabel}
                    </div>

                    {ev.notes && (
                      <div
                        className="
                          mt-3 text-xs sm:text-sm text-text-primary
                          bg-surface-main border border-border
                          rounded-lg px-3 py-2
                          break-words whitespace-normal
                          w-full max-w-full
                        "
                      >
                        <strong className="text-text-secondary">
                          {t('taskEvidencesPage.meta.notesLabel')}:
                        </strong>{' '}
                        {ev.notes}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {isImage && (
                        <button
                          type="button"
                          onClick={() => openLightbox(fileUrl)}
                          className="px-3 py-1.5 text-[0.7rem] sm:text-xs font-semibold bg-surface-card border border-border rounded-lg hover:bg-surface-main"
                        >
                          {t('taskEvidencesPage.actions.preview')}
                        </button>
                      )}
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-[0.7rem] sm:text-xs font-semibold app-btn-neutral rounded-lg"
                      >
                        {t('taskEvidencesPage.actions.open')}
                      </a>
                      <a
                        href={fileUrl}
                        download={displayName}
                        className="px-3 py-1.5 text-[0.7rem] sm:text-xs font-semibold bg-surface-card border border-border rounded-lg hover:bg-surface-main"
                      >
                        {t('taskEvidencesPage.actions.download')}
                      </a>
                    </div>

                    {deleteInfo.allowed && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="px-3.5 py-2 bg-red-600 text-white text-xs sm:text-sm rounded-lg font-medium hover:bg-red-700 transition"
                        >
                        {t('taskEvidencesPage.actions.delete')}
                        </button>
                      </div>
                    )}
                    {!isAdmin && deleteInfo.allowed && deleteInfo.reason === 'within-window' && (
                      <p className="mt-2 text-[0.7rem] text-text-muted">
                        {t('taskEvidencesPage.delete.possible', {
                          time: formatRemainingMs(deleteInfo.remainingMs),
                        })}
                      </p>
                    )}
                    {!isAdmin && !deleteInfo.allowed && deleteInfo.reason === 'expired' && (
                      <p className="mt-2 text-[0.7rem] text-text-muted">
                        {t('taskEvidencesPage.delete.expired')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==========================================================
         LIGHTBOX
      ========================================================== */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center px-4"
          onClick={closeLightbox}
        >
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-xl shadow-2xl border border-white/20"
          />
        </div>
      )}
    </div>
  );
}
