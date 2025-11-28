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

  const [lightbox, setLightbox] = useState(null); // { url }

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_evidences_showForm');
    return saved === null ? true : saved === '1';
  });

  const [filters] = useState({
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
    return () => (active = false);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">

        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            📎 Preuves de la tâche #{id}
          </h1>

          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900"
          >
            {showForm ? '➖ Masquer le formulaire' : '➕ Ajouter des preuves'}
          </button>
        </div>

        {loading && (
          <p className="text-gray-500 animate-pulse text-center mb-4">
            Chargement…
          </p>
        )}

        {/* ==========================================================
           FORM UPLOAD
        ========================================================== */}
        {showForm && (
          <form
            onSubmit={handleUpload}
            className="bg-gray-50 p-5 rounded-xl border mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm">Fichiers *</label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />

                {/* Preview thumbnails */}
                {previewUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {previewUrls.map((url, i) => {
                      const f = files[i];
                      const kind = inferKind(f?.name, f?.type);
                      return (
                        <div
                          key={i}
                          className="w-28 h-28 border rounded-lg overflow-hidden bg-white flex items-center justify-center"
                        >
                          {kind === 'image' ? (
                            <img
                              src={url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-gray-600 px-2 break-words text-center">
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
                <label className="text-sm">Notes</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="text-right mt-4">
              <button
                disabled={uploading}
                className={`px-5 py-2.5 rounded-lg text-white ${
                  uploading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {uploading ? '⏳ Upload…' : 'Uploader'}
              </button>
            </div>
          </form>
        )}

        {/* ==========================================================
           AVERTISSEMENT client/agent
        ========================================================== */}
        {user?.role !== 'admin' && (
          <p className="text-gray-500 italic mb-4">
            🔒 Seul un administrateur peut supprimer une preuve.
          </p>
        )}

        {/* ==========================================================
           LISTE DES PREUVES
        ========================================================== */}
        {filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center">
            Aucune preuve trouvée.
          </p>
        ) : (
          <div className="grid gap-4">
            {filtered.map((ev) => {
              const kind = ev.kind || inferKind(ev.originalName, ev.mimeType);
              const fileUrl = toAbsUrl(ev.filePath);
              const isImage = kind === 'image';

              return (
                <div key={ev.id} className="bg-white border rounded-xl p-4 shadow-sm">

                  <div className="flex flex-col md:flex-row md:justify-between gap-3 w-full">

                    {/* THUMB + INFO */}
                    <div className="flex items-start gap-3 w-full min-w-0">
                      {/* Thumbnail */}
                      <div
                        className="w-16 h-16 flex-shrink-0 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer"
                        onClick={() => isImage && openLightbox(fileUrl)}
                      >
                        {isImage ? (
                          <img src={fileUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">📄</span>
                        )}
                      </div>

                      {/* Texte */}
                      <div className="flex flex-col min-w-0 w-full">
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="
                            text-blue-600 hover:underline text-sm font-semibold
                            break-words break-all whitespace-normal
                            block w-full max-w-full
                          "
                        >
                          {ev.originalName || ev.filePath}
                        </a>

                        <div className="
                            text-xs text-gray-500 mt-1
                            break-words whitespace-normal
                            w-full max-w-full
                        ">
                          Type : {kind.toUpperCase()} — Ajouté le{' '}
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
                              text-sm text-gray-700 mt-1 
                              break-words whitespace-normal
                              w-full max-w-full
                            "
                          >
                            <strong>Notes :</strong> {ev.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg self-start"
                      >
                        ❌ Supprimer
                      </button>
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
            className="max-w-full max-h-full rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
