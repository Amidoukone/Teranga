// frontend/src/pages/TaskEvidencesPage.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { uploadEvidences, getEvidences, deleteEvidence } from '../services/evidences';
import { me } from '../services/auth';

export default function TaskEvidencesPage() {
  const { id } = useParams(); // taskId
  const [evidences, setEvidences] = useState([]);
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]); // 🆕 aperçus
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // 🆕 mémorisation affichage formulaire
  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_evidences_showForm');
    return saved === null ? true : saved === '1';
  });

  // 🆕 filtres UI
  const [filters, setFilters] = useState({
    q: '',
    kind: '',          // '', 'image', 'pdf', 'other' (et toute valeur exacte venant du backend si ev.kind est renseigné)
    withNotes: false,
    dateFrom: '',
    dateTo: '',
    sort: '-createdAt', // -createdAt (récent -> ancien) | createdAt | originalName | kind
  });

  // ✅ Mémoïse la fonction pour éviter l’avertissement et les recréations inutiles
  const fetchEvidences = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const evs = await getEvidences(id);
      setEvidences(evs || []);
    } catch (err) {
      console.error('❌ Erreur chargement evidences:', err);
      setEvidences([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Init user + evidences
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const userData = await me();
        if (!mounted) return;
        setUser(userData.user);
        await fetchEvidences();
      } catch (err) {
        console.error('❌ Erreur init evidences:', err);
      }
    }
    if (id) init();
    return () => {
      mounted = false;
    };
  }, [id, fetchEvidences]);

  // Mémoriser l’état d’affichage du formulaire
  useEffect(() => {
    localStorage.setItem('teranga_evidences_showForm', showForm ? '1' : '0');
  }, [showForm]);

  // Libérer les prévisualisations
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  function inferKindFromName(name = '', mime = '') {
    const lower = name.toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(lower)) return 'image';
    if (mime === 'application/pdf' || /\.pdf$/i.test(lower)) return 'pdf';
    return 'other';
  }

  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);

    // replace previews
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    const previews = selected.map((f) => URL.createObjectURL(f));
    setPreviewUrls(previews);
  }

  async function handleUpload(e) {
    e.preventDefault();
    try {
      if (files.length === 0) {
        alert('Sélectionnez au moins un fichier.');
        return;
      }
      await uploadEvidences(id, files, notes);
      // reset
      setFiles([]);
      setNotes('');
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
      setPreviewUrls([]);
      await fetchEvidences();
    } catch (err) {
      console.error('❌ Erreur upload evidences:', err);
      alert('Erreur lors de l’upload des fichiers ❌');
    }
  }

  async function handleDelete(evidenceId) {
    if (!window.confirm('Supprimer cette preuve ?')) return;
    try {
      await deleteEvidence(evidenceId);
      await fetchEvidences();
    } catch (err) {
      console.error('❌ Erreur suppression evidence:', err);
      alert('Erreur lors de la suppression ❌');
    }
  }

  // 🧮 Application des filtres/tri côté client
  const filtered = useMemo(() => {
    let arr = [...(evidences || [])];

    // Texte
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

    // Kind
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

    // Période
    if (filters.dateFrom) {
      const tsFrom = new Date(filters.dateFrom).setHours(0, 0, 0, 0);
      arr = arr.filter((ev) => new Date(ev.createdAt).getTime() >= tsFrom);
    }
    if (filters.dateTo) {
      const tsTo = new Date(filters.dateTo).setHours(23, 59, 59, 999);
      arr = arr.filter((ev) => new Date(ev.createdAt).getTime() <= tsTo);
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
        va = (a[key] || '').toString().toLowerCase();
        vb = (b[key] || '').toString().toLowerCase();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">📎 Preuves de la tâche #{id}</h1>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((s) => !s)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
            >
              {showForm ? '➖ Masquer le formulaire' : '➕ Ajouter des preuves'}
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-gray-500 animate-pulse text-center mb-4">Chargement…</p>
        )}

        {/* 🎛️ Filtres */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Recherche
              </label>
              <input
                placeholder="Nom du fichier, notes, auteur…"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Type de pièce
              </label>
              <select
                value={filters.kind}
                onChange={(e) => setFilters({ ...filters, kind: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Tous —</option>
                <option value="image">Image</option>
                <option value="pdf">PDF</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.withNotes}
                  onChange={(e) => setFilters({ ...filters, withNotes: e.target.checked })}
                  className="h-4 w-4"
                />
                Avec notes
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Du
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Au
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tri
              </label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="-createdAt">Plus récents</option>
                <option value="createdAt">Plus anciens</option>
                <option value="originalName">Nom (A→Z)</option>
                <option value="-originalName">Nom (Z→A)</option>
                <option value="kind">Type (A→Z)</option>
                <option value="-kind">Type (Z→A)</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500">{filtered.length} preuve(s) affichée(s)</div>
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
              className="text-xs px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>

        {/* 🧾 Formulaire upload (toggle) */}
        {showForm && (
          <form
            onSubmit={handleUpload}
            className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fichiers *
                </label>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {/* Aperçu */}
                {previewUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {previewUrls.map((url, i) => {
                      const f = files[i];
                      const kind = inferKindFromName(f?.name, f?.type);
                      return (
                        <div
                          key={i}
                          className="w-28 h-28 border border-gray-300 rounded-lg overflow-hidden shadow-sm flex items-center justify-center bg-white"
                          title={f?.name}
                        >
                          {kind === 'image' ? (
                            <img
                              src={url}
                              alt={`preview-${i}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center text-xs px-2 text-gray-600 break-words">
                              📄 {f?.name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  placeholder="Contexte, précision…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 text-right">
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
              >
                Uploader
              </button>
            </div>
          </form>
        )}

        {user?.role !== 'admin' && (
          <p className="italic text-gray-500 mb-4">
            🔒 Seul un administrateur peut supprimer une preuve.
          </p>
        )}

        {/* 📄 Liste des evidences */}
        {filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">Aucune preuve trouvée.</p>
        ) : (
          <div className="grid gap-4">
            {filtered.map((ev) => {
              const k = ev.kind || inferKindFromName(ev.originalName, ev.mimeType);
              const fileUrl = `http://localhost:5000${ev.filePath}`;
              const isImage = k === 'image';
              return (
                <div
                  key={ev.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                        {isImage ? (
                          <img
                            src={fileUrl}
                            alt={ev.originalName || 'evidence'}
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
                          className="text-blue-600 hover:underline text-sm font-semibold break-all"
                          title={ev.originalName || ev.filePath}
                        >
                          {ev.originalName || ev.filePath}
                        </a>
                        <div className="text-xs text-gray-500">
                          Type : <span className="uppercase">{k}</span> • Ajouté le{' '}
                          {new Date(ev.createdAt).toLocaleString()} par{' '}
                          {ev.uploader
                            ? `${ev.uploader.firstName || ''} ${ev.uploader.lastName || ''}`.trim() ||
                              ev.uploader.email
                            : '—'}
                        </div>
                        {ev.notes && (
                          <div className="text-sm text-gray-700 mt-1">
                            <strong>Notes :</strong> {ev.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions admin */}
                    {user?.role === 'admin' && (
                      <div className="text-right">
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
                        >
                          ❌ Supprimer
                        </button>
                      </div>
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
