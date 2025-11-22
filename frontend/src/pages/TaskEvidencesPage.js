// ============================================================================
// TaskEvidencesPage.jsx — VERSION PRODUCTION READY (Option B, 100% stable)
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
// 🌍 BASE URL dynamique (PRODUCTION SAFE) — alignée avec api.js & autres pages
// ============================================================================
const FILE_BASE =
  (typeof window !== 'undefined' && window.__TERANGA_FILE_BASE_URL) ||
  (typeof window !== 'undefined' &&
  window.__TERANGA_API_BASE_URL
    ? window.__TERANGA_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000');

/** Construit une URL absolue propre pour un chemin backend (ex: /uploads/xxx.jpg) */
function toAbsUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${FILE_BASE}${clean}`.replace(/([^:]\/)\/+/g, '$1');
}

// ============================================================================
// 🧩 PAGE PRINCIPALE
// ============================================================================
export default function TaskEvidencesPage() {
  const { id } = useParams(); // taskId

  const [evidences, setEvidences] = useState([]);
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // toggle form visibility (persisté)
  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_evidences_showForm');
    return saved === null ? true : saved === '1';
  });

  // Filtres UI
  const [filters, setFilters] = useState({
    q: '',
    kind: '',
    withNotes: false,
    dateFrom: '',
    dateTo: '',
    sort: '-createdAt',
  });

  // ========================================================================
  // Helpers mime/kind
  // ========================================================================
  function inferKindFromName(name = '', mime = '') {
    const lower = name.toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower)) {
      return 'image';
    }
    if (mime === 'application/pdf' || /\.pdf$/i.test(lower)) return 'pdf';
    return 'other';
  }

  // ========================================================================
  // Chargement des preuves (memoized)
  // ========================================================================
  const fetchEvidences = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const evs = await getEvidences(id); // renvoie un tableau
      setEvidences(evs || []);
    } catch (err) {
      console.error('❌ Erreur chargement evidences:', err);
      setEvidences([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ========================================================================
  // Initialisation : user + preuves
  // ========================================================================
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const userData = await me();
        if (!active) return;
        setUser(userData.user || null);
        await fetchEvidences();
      } catch (err) {
        console.error('❌ Erreur init evidences:', err);
      }
    }

    if (id) init();

    return () => {
      active = false;
    };
  }, [id, fetchEvidences]);

  // Persist showForm
  useEffect(() => {
    localStorage.setItem('teranga_evidences_showForm', showForm ? '1' : '0');
  }, [showForm]);

  // Cleanup des URLs de preview
  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewUrls]);

  // ========================================================================
  // Sélection de fichiers
  // ========================================================================
  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);

    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    const previews = selected.map((f) => URL.createObjectURL(f));
    setPreviewUrls(previews);
  }

  // ========================================================================
  // Upload des preuves
  // ========================================================================
  async function handleUpload(e) {
    e.preventDefault();
    try {
      if (files.length === 0) {
        alert('Ajoutez au moins un fichier.');
        return;
      }

      await uploadEvidences(id, files, notes);

      setFiles([]);
      setNotes('');
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
      setPreviewUrls([]);

      await fetchEvidences();
    } catch (err) {
      console.error('❌ Upload error', err);
      alert("Erreur lors de l'upload");
    }
  }

  // ========================================================================
  // Suppression d'une preuve (admin uniquement)
  // ========================================================================
  async function handleDelete(evidenceId) {
    if (!window.confirm('Supprimer cette preuve ?')) return;

    try {
      await deleteEvidence(evidenceId);
      await fetchEvidences();
    } catch (err) {
      console.error('❌ Delete error', err);
      alert('Erreur lors de la suppression');
    }
  }

  // ========================================================================
  // Filtrage + tri
  // ========================================================================
  const filtered = useMemo(() => {
    let arr = [...(evidences || [])];

    // Recherche texte
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

    // Type (image/pdf/autre)
    if (filters.kind) {
      arr = arr.filter((ev) => {
        const k = ev.kind || inferKindFromName(ev.originalName, ev.mimeType);
        return k === filters.kind;
      });
    }

    // Avec notes
    if (filters.withNotes) {
      arr = arr.filter((ev) => !!(ev.notes && String(ev.notes).trim()));
    }

    // Plage de dates
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
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');

      let va;
      let vb;

      if (key === 'createdAt') {
        va = new Date(a.createdAt || 0).getTime();
        vb = new Date(b.createdAt || 0).getTime();
      } else if (key === 'originalName' || key === 'kind') {
        va = (a[key] || '').toLowerCase();
        vb = (b[key] || '').toLowerCase();
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

  // ========================================================================
  // UI
  // ========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            📎 Preuves de la tâche #{id}
          </h1>

          <button
            onClick={() => setShowForm((s) => !s)}
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

        {/* Filtres */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="text-xs text-gray-600">Recherche</label>
              <input
                value={filters.q}
                onChange={(e) =>
                  setFilters({ ...filters, q: e.target.value })
                }
                placeholder="Nom du fichier, notes…"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Type</label>
              <select
                value={filters.kind}
                onChange={(e) =>
                  setFilters({ ...filters, kind: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Tous —</option>
                <option value="image">Image</option>
                <option value="pdf">PDF</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filters.withNotes}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    withNotes: e.target.checked,
                  })
                }
              />
              Avec notes
            </label>

            <div>
              <label className="text-xs text-gray-600">Du</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters({ ...filters, dateFrom: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Au</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters({ ...filters, dateTo: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Tri</label>
              <select
                value={filters.sort}
                onChange={(e) =>
                  setFilters({ ...filters, sort: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="-createdAt">Plus récents</option>
                <option value="createdAt">Plus anciens</option>
                <option value="originalName">Nom A→Z</option>
                <option value="-originalName">Nom Z→A</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between mt-3 text-xs text-gray-600">
            <span>{filtered.length} preuve(s)</span>
            <button
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
              className="px-3 py-1.5 bg-gray-200 rounded-md text-xs"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Formulaire d’upload */}
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
                  accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />

                {previewUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {previewUrls.map((url, i) => {
                      const f = files[i];
                      const kind = inferKindFromName(f?.name, f?.type);
                      return (
                        <div
                          key={i}
                          className="w-28 h-28 border rounded-lg flex items-center justify-center bg-white"
                        >
                          {kind === 'image' ? (
                            <img
                              src={url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-gray-600 text-center break-words px-2">
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="text-right mt-4">
              <button className="px-5 py-2.5 bg-blue-600 text-white rounded-lg">
                Uploader
              </button>
            </div>
          </form>
        )}

        {user?.role !== 'admin' && (
          <p className="text-gray-500 italic mb-4">
            🔒 Seul un administrateur peut supprimer une preuve.
          </p>
        )}

        {/* Liste des preuves */}
        {filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center">
            Aucune preuve trouvée.
          </p>
        ) : (
          <div className="grid gap-4">
            {filtered.map((ev) => {
              const kind =
                ev.kind || inferKindFromName(ev.originalName, ev.mimeType);
              const fileUrl = toAbsUrl(ev.filePath);
              const isImage = kind === 'image';

              return (
                <div
                  key={ev.id}
                  className="bg-white border rounded-xl p-4 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                        {isImage ? (
                          <img
                            src={fileUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">📄</span>
                        )}
                      </div>

                      <div>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-sm font-semibold"
                        >
                          {ev.originalName || ev.filePath}
                        </a>

                        <div className="text-xs text-gray-500">
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
                          <div className="text-sm text-gray-700 mt-1">
                            <strong>Notes :</strong> {ev.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg"
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
    </div>
  );
}
