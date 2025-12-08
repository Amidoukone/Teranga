// ============================================================================
// TaskEvidencesPage.jsx — VERSION PREMIUM 2025 (UX améliorée + Responsive + Perf)
// ============================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  uploadEvidences,
  getEvidences,
  deleteEvidence,
} from '../services/evidences';
import { me } from '../services/auth';

// ============================================================================
// 🌍 URL BASE — robuste production
// ============================================================================
const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' &&
  window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000');

/** URL absolue propre */
function toAbsUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${FILE_BASE}${clean}`.replace(/([^:]\/)\/+/g, '$1');
}

// ============================================================================
// HELPERS
// ============================================================================
function inferKind(name = '', mime = '') {
  const lower = name.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower)) {
    return 'image';
  }
  if (mime === 'application/pdf' || /\.pdf$/i.test(lower)) return 'pdf';
  return 'other';
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function TaskEvidencesPage() {
  const { id } = useParams(); // taskId

  const [evidences, setEvidences] = useState([]);
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState(null);

  const [lightbox, setLightbox] = useState(null); // string URL

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_evidences_showForm');
    return saved === null ? true : saved === '1';
  });

  const [filters, setFilters] = useState({
    q: '',
    kind: '',
    withNotes: false,
    dateFrom: '',
    dateTo: '',
    sort: '-createdAt',
  });

  // ============================================================================
  // FETCH EVIDENCES
  // ============================================================================
  const fetchEvidences = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const ev = await getEvidences(id);
      setEvidences(ev || []);
    } catch (err) {
      console.error('❌ getEvidences:', err);
      setEvidences([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ============================================================================
  // INIT: load user + evidences
  // ============================================================================
  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const u = await me();
        if (!active) return;
        setUser(u.user || null);
        await fetchEvidences();
      } catch (err) {
        console.error('❌ init evidence:', err);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [fetchEvidences]);

  // ============================================================================
  // Persist showForm
  // ============================================================================
  useEffect(() => {
    localStorage.setItem('teranga_evidences_showForm', showForm ? '1' : '0');
  }, [showForm]);

  // ============================================================================
  // File selection
  // ============================================================================
  function handleFileChange(e) {
    const fl = Array.from(e.target.files || []);
    setFiles(fl);

    // Nettoyage anciens ObjectURL
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setPreviewUrls(fl.map((f) => URL.createObjectURL(f)));
  }

  // ============================================================================
  // Upload
  // ============================================================================
  async function handleUpload(e) {
    e.preventDefault();
    if (!files.length) {
      alert('Ajoutez au moins un fichier.');
      return;
    }

    setUploading(true);
    try {
      await uploadEvidences(id, files, notes);

      setFiles([]);
      setNotes('');
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
      setPreviewUrls([]);

      await fetchEvidences();
    } catch (err) {
      console.error('❌ upload:', err);
      alert("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  // ============================================================================
  // Delete
  // ============================================================================
  async function handleDelete(evidenceId) {
    if (!window.confirm('Supprimer cette preuve ?')) return;
    try {
      await deleteEvidence(evidenceId);
      await fetchEvidences();
    } catch (err) {
      console.error('❌ delete evidence:', err);
      alert('Erreur lors de la suppression');
    }
  }

  // ============================================================================
  // Filter + sort — optimized
  // ============================================================================
  const filtered = useMemo(() => {
    let arr = [...evidences];

    // Recherche
    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((ev) =>
        [
          ev.originalName,
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

    // Type
    if (filters.kind) {
      arr = arr.filter((ev) => {
        const k = ev.kind || inferKind(ev.originalName, ev.mimeType);
        return k === filters.kind;
      });
    }

    // Notes
    if (filters.withNotes) {
      arr = arr.filter((ev) => ev.notes && ev.notes.trim());
    }

    // Date range
    if (filters.dateFrom) {
      const ts = new Date(filters.dateFrom).setHours(0, 0, 0, 0);
      arr = arr.filter((ev) => new Date(ev.createdAt).getTime() >= ts);
    }
    if (filters.dateTo) {
      const ts = new Date(filters.dateTo).setHours(23, 59, 59, 999);
      arr = arr.filter((ev) => new Date(ev.createdAt).getTime() <= ts);
    }

    // Tri
    const by = filters.sort || '-createdAt';
    const key = by.replace(/^-/, '');
    const sign = by.startsWith('-') ? -1 : 1;

    arr.sort((a, b) => {
      let va, vb;

      if (key === 'createdAt') {
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
      } else if (key === 'originalName') {
        va = (a.originalName || '').toLowerCase();
        vb = (b.originalName || '').toLowerCase();
      } else {
        va = a[key];
        vb = b[key];
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    return arr;
  }, [evidences, filters]);

  // ============================================================================
  // LIGHTBOX minimaliste & premium
  // ============================================================================
  function openLightbox(url) {
    setLightbox(url);
  }

  function closeLightbox() {
    setLightbox(null);
  }

  // ============================================================================
  // UI
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-5xl mx-auto bg-white/95 shadow-2xl rounded-3xl p-5 sm:p-8 border border-gray-100">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              📎 Preuves de la tâche #{id}
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Centralisez toutes les pièces jointes (photos, PDF, documents) liées à cette tâche.
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              {filtered.length} preuve(s) affichée(s) avec les filtres actuels.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-800 transition"
            >
              {showForm ? '➖ Masquer le formulaire' : '➕ Ajouter des preuves'}
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-gray-500 animate-pulse text-center mb-4 text-sm sm:text-base">
            Chargement des preuves…
          </p>
        )}

        {/* ==========================================================
           BARRE DE FILTRES
        ========================================================== */}
        <div className="mb-8 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">

            {/* Recherche */}
            <input
              placeholder="🔎 Rechercher (nom de fichier, notes, utilisateur...)"
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              className="
                border border-gray-300 rounded-lg px-3 py-2.5 text-sm sm:text-base
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                col-span-1 sm:col-span-2 lg:col-span-4 break-words
              "
            />

            {/* Type */}
            <select
              value={filters.kind}
              onChange={(e) => setFilters((prev) => ({ ...prev, kind: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Type (tous)</option>
              <option value="image">Images</option>
              <option value="pdf">PDF</option>
              <option value="other">Autres fichiers</option>
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
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-gray-600 border-gray-300'
                }
              `}
            >
              {filters.withNotes ? '✅ Avec notes uniquement' : 'Notes optionnelles'}
            </button>

            {/* Date de début */}
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
            />

            {/* Date de fin */}
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
            />

            {/* Tri */}
            <select
              value={filters.sort}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sort: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
            >
              <option value="-createdAt">Plus récentes d’abord</option>
              <option value="createdAt">Plus anciennes d’abord</option>
              <option value="originalName">Nom de fichier (A-Z)</option>
              <option value="-originalName">Nom de fichier (Z-A)</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs sm:text-sm text-gray-500">
              {filtered.length} preuve(s) après filtrage.
            </p>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  q: '',
                  kind: '',
                  withNotes: false,
                  dateFrom: '',
                  dateTo: '',
                  sort: '-createdAt',
                })
              }
              className="
                text-xs sm:text-sm px-3 py-1.5 bg-gray-200 rounded-md
                hover:bg-gray-300 w-full sm:w-auto text-center
              "
            >
              Réinitialiser tous les filtres
            </button>
          </div>
        </div>

        {/* ==========================================================
           FORM UPLOAD
        ========================================================== */}
        {showForm && (
          <form
            onSubmit={handleUpload}
            className="bg-gray-50 p-5 rounded-2xl border border-gray-200 mb-8"
          >
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
              ➕ Ajouter de nouvelles preuves
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mb-4">
              Sélectionnez vos fichiers (photos, PDF, documents…) et ajoutez une note si nécessaire.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Fichiers <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    text-sm sm:text-base focus:ring-2 focus:ring-blue-500
                  "
                />

                {/* Info nombre de fichiers */}
                {files.length > 0 && (
                  <p className="mt-2 text-xs sm:text-sm text-gray-500">
                    {files.length} fichier(s) sélectionné(s).
                  </p>
                )}

                {/* Preview thumbnails */}
                {previewUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {previewUrls.map((url, i) => {
                      const f = files[i];
                      const kind = inferKind(f?.name, f?.type);
                      return (
                        <div
                          key={i}
                          className="
                            w-24 h-24 sm:w-28 sm:h-28 border border-gray-200 rounded-lg
                            overflow-hidden bg-white flex items-center justify-center
                          "
                        >
                          {kind === 'image' ? (
                            <img
                              src={url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[0.7rem] text-gray-600 px-2 break-words text-center">
                              📄 {f?.name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2
                    text-sm sm:text-base focus:ring-2 focus:ring-blue-500
                  "
                  placeholder="Ajoutez un contexte (lieu, date, détail précis…) pour faciliter le suivi."
                />
              </div>
            </div>

            <div className="text-right mt-5">
              <button
                disabled={uploading}
                className={`
                  px-5 py-2.5 rounded-lg text-sm sm:text-base font-semibold text-white
                  ${
                    uploading
                      ? 'bg-blue-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }
                `}
              >
                {uploading ? '⏳ Upload en cours…' : 'Uploader les fichiers'}
              </button>
            </div>
          </form>
        )}

        {/* ==========================================================
           AVERTISSEMENT client/agent
        ========================================================== */}
        {user?.role !== 'admin' && (
          <p className="text-xs sm:text-sm text-gray-500 italic mb-4">
            🔒 Seul un administrateur peut supprimer une preuve.
          </p>
        )}

        {/* ==========================================================
           LISTE DES PREUVES
        ========================================================== */}
        {filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center py-8 text-sm sm:text-base">
            Aucune preuve trouvée pour cette tâche.
          </p>
        ) : (
          <div className="grid gap-4">
            {filtered.map((ev) => {
              const kind = ev.kind || inferKind(ev.originalName, ev.mimeType);
              const fileUrl = toAbsUrl(ev.filePath);
              const isImage = kind === 'image';

              return (
                <div
                  key={ev.id}
                  className="
                    bg-white border border-gray-200 rounded-2xl p-4 sm:p-5
                    shadow-sm hover:shadow-md transition
                  "
                >
                  <div className="flex flex-col md:flex-row md:justify-between gap-3 w-full">

                    {/* THUMB + INFO */}
                    <div className="flex items-start gap-3 w-full min-w-0">
                      {/* Thumbnail */}
                      <div
                        className="
                          w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 border
                          border-gray-200 rounded-lg overflow-hidden bg-gray-50
                          flex items-center justify-center
                          cursor-pointer
                        "
                        onClick={() => isImage && openLightbox(fileUrl)}
                      >
                        {isImage ? (
                          <img
                            src={fileUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : kind === 'pdf' ? (
                          <span className="text-2xl">📕</span>
                        ) : (
                          <span className="text-2xl">📄</span>
                        )}
                      </div>

                      {/* Texte */}
                      <div className="flex flex-col min-w-0 w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="
                              text-blue-600 hover:underline text-sm sm:text-base
                              font-semibold break-words break-all whitespace-normal
                              block w-full max-w-full
                            "
                          >
                            {ev.originalName || ev.filePath}
                          </a>

                          <span
                            className={`
                              inline-flex items-center px-2 py-0.5 rounded-full
                              text-[0.7rem] font-semibold
                              ${
                                kind === 'image'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : kind === 'pdf'
                                  ? 'bg-red-50 text-red-700 border border-red-100'
                                  : 'bg-gray-50 text-gray-700 border border-gray-200'
                              }
                            `}
                          >
                            {kind === 'image'
                              ? 'IMAGE'
                              : kind === 'pdf'
                              ? 'PDF'
                              : 'FICHIER'}
                          </span>
                        </div>

                        <div
                          className="
                            text-xs sm:text-sm text-gray-500
                            break-words whitespace-normal
                            w-full max-w-full
                          "
                        >
                          Ajouté le{' '}
                          {new Date(ev.createdAt).toLocaleString()} par{' '}
                          {ev.uploader
                            ? (
                                `${ev.uploader.firstName || ''} ${
                                  ev.uploader.lastName || ''
                                }`.trim() || ev.uploader.email
                              )
                            : '—'}
                        </div>

                        {ev.notes && (
                          <div
                            className="
                              mt-2 text-xs sm:text-sm text-gray-800
                              bg-gray-50 border border-gray-200
                              rounded-lg px-3 py-2
                              break-words whitespace-normal
                              w-full max-w-full
                            "
                          >
                            <strong className="text-gray-700">Notes :</strong>{' '}
                            {ev.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 mt-1 md:mt-0">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="
                          px-4 py-2 bg-slate-900 text-white text-xs sm:text-sm
                          rounded-lg font-medium hover:bg-slate-800 transition
                        "
                      >
                        Ouvrir le fichier ↗
                      </a>

                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="
                            px-4 py-2 bg-red-600 text-white text-xs sm:text-sm
                            rounded-lg font-medium hover:bg-red-700 transition
                          "
                        >
                          ❌ Supprimer
                        </button>
                      )}
                    </div>
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
