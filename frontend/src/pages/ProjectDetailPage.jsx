
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { me } from '../services/auth';
import {
  getProjectById,
  getProjectPhases,
  saveProjectPhase,
  deleteProjectPhase,
  getProjectDocuments,
  uploadProjectDocuments,
  deleteProjectDocument,
} from '../services/projects';
import { getFileUrl } from '../services/api';
import { applyLabels } from '../utils/labels';

/* ============================================================
   🎨 UI Components — Modernisés
============================================================ */
function Badge({ color = 'gray', children }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-800 ring-blue-300',
    green: 'bg-green-100 text-green-800 ring-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 ring-yellow-300',
    red: 'bg-red-100 text-red-800 ring-red-300',
    gray: 'bg-gray-100 text-gray-800 ring-gray-300',
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ring-1 shadow-sm ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function Btn({ variant = 'primary', children, className = '', ...props }) {
  const styles = {
    primary:
      'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 focus:ring-blue-400',
    secondary:
      'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-300',
    danger:
      'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 focus:ring-red-400',
    warning:
      'bg-gradient-to-r from-yellow-500 to-yellow-400 text-white hover:from-yellow-600 hover:to-yellow-500 focus:ring-yellow-400',
    ghost:
      'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-400',
  };
  return (
    <button
      {...props}
      className={`px-4 py-2 text-sm font-semibold rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ============================================================
   🧠 Composant principal
============================================================ */
export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMounted = useRef(true);

  const [user, setUser] = useState(null);
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [phaseForm, setPhaseForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [editPhaseId, setEditPhaseId] = useState(null);

  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docKind, setDocKind] = useState('other');

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const getToken = useCallback(
    () => localStorage.getItem('teranga_token') || localStorage.getItem('token'),
    []
  );

  // Détermination des rôles
  const isAdmin = user?.role === 'admin';
  const isAgent = user?.role === 'agent';
  const isClient = user?.role === 'client';
  const isAssignedAgent = isAgent && project?.agent?.id === user?.id;

  // Fenêtre 1h
  const createdAtMs = useMemo(() => {
    if (!project?.createdAt) return null;
    const t = new Date(project.createdAt).getTime();
    return Number.isFinite(t) ? t : null;
  }, [project?.createdAt]);

  const withinOneHour = useMemo(() => {
    if (!createdAtMs) return false;
    return now - createdAtMs <= 3600000;
  }, [createdAtMs, now]);

  const clientCanModifyOrDelete = isClient && withinOneHour;
  const clientCanAdd = isClient;
  const agentCanAddDocs = isAssignedAgent;
  const adminAll = isAdmin;

  const timeLeftText = useMemo(() => {
    if (!clientCanModifyOrDelete || !createdAtMs) return '';
    const msLeft = 3600000 - (now - createdAtMs);
    const mins = Math.max(0, Math.floor(msLeft / 60000));
    const secs = Math.max(0, Math.floor((msLeft % 60000) / 1000));
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }, [clientCanModifyOrDelete, createdAtMs, now]);

  /* ============================================================
     🔹 Chargement complet projet + phases + documents
  ============================================================ */
  const loadProject = useCallback(async (pid) => {
    if (!pid) return;
    try {
      const data = await getProjectById(pid);
      if (!isMounted.current) return;
      setProject(applyLabels(data));

      const phs = await getProjectPhases(pid);
      if (isMounted.current) setPhases(phs.map(applyLabels));

      const docs = await getProjectDocuments(pid);
      if (isMounted.current) setDocuments(docs);
    } catch (e) {
      console.error('❌ Erreur chargement projet complet:', e);
      if (isMounted.current) {
        setErrorMsg('Erreur lors du chargement du projet.');
        setProject(null);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    const init = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        setUser(null);
        setErrorMsg('Vous devez être connecté pour consulter ce projet.');
        return;
      }

      try {
        const { user: u } = await me();
        if (!isMounted.current) return;
        setUser(u);
        await loadProject(id);
      } catch (e) {
        console.error('❌ Erreur chargement utilisateur ou projet:', e);
        if (isMounted.current) {
          setUser(null);
          setErrorMsg('Erreur lors de la récupération du projet ou de l’utilisateur.');
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };
    init();
    return () => {
      isMounted.current = false;
    };
  }, [id, loadProject, getToken]);

  /* ============================================================
     🔹 PHASES
  ============================================================ */
  async function handlePhaseSubmit(e) {
    e.preventDefault();
    try {
      if (!project?.id) throw new Error('Projet non défini.');
      const payload = { ...phaseForm, projectId: project.id };
      if (editPhaseId) payload.id = editPhaseId;
      await saveProjectPhase(payload);
      alert('✅ Phase enregistrée avec succès');
      resetPhaseForm();
      await loadProject(project.id);
    } catch (err) {
      console.error('❌ Erreur enregistrement phase:', err);
      alert(
        err?.response?.status === 403
          ? err?.response?.data?.error ||
              "Action non autorisée (fenêtre d'édition expirée)."
          : 'Erreur lors de la sauvegarde de la phase.'
      );
    }
  }

  async function handleDeletePhase(phaseId) {
    if (!window.confirm('Supprimer cette phase ?')) return;
    try {
      await deleteProjectPhase(phaseId);
      await loadProject(project.id);
    } catch (err) {
      console.error('❌ Erreur suppression phase:', err);
      alert(
        err?.response?.status === 403
          ? err?.response?.data?.error ||
              "Action non autorisée (fenêtre d'édition expirée)."
          : 'Erreur lors de la suppression de la phase.'
      );
    }
  }

  function resetPhaseForm() {
    setPhaseForm({ title: '', description: '', startDate: '', endDate: '' });
    setEditPhaseId(null);
  }

  /* ============================================================
     🔹 DOCUMENTS
  ============================================================ */
  function handleFileChange(e) {
    setFiles(Array.from(e.target.files));
  }

  async function handleUploadDocuments(e) {
    e.preventDefault();
    try {
      if (!project?.id) throw new Error('Projet non défini.');
      if (files.length === 0) {
        alert('Veuillez sélectionner au moins un fichier.');
        return;
      }

      await uploadProjectDocuments(
        project.id,
        files,
        notes,
        selectedPhaseId || undefined,
        { title: docTitle || undefined, kind: docKind || 'other' }
      );

      alert('✅ Document(s) ajouté(s)');
      setFiles([]);
      setNotes('');
      setSelectedPhaseId('');
      setDocTitle('');
      setDocKind('other');
      await loadProject(project.id);
    } catch (err) {
      console.error('❌ Erreur upload documents:', err);
      alert(
        err?.response?.status === 403
          ? err?.response?.data?.error ||
              "Action non autorisée (fenêtre d'édition expirée)."
          : 'Erreur lors du téléversement.'
      );
    }
  }

  async function handleDeleteDocument(docId) {
    if (!window.confirm('Supprimer ce document ?')) return;
    try {
      await deleteProjectDocument(docId);
      await loadProject(project.id);
    } catch (err) {
      console.error('❌ Erreur suppression document:', err);
      alert(
        err?.response?.status === 403
          ? err?.response?.data?.error ||
              "Action non autorisée (fenêtre d'édition expirée)."
          : 'Erreur lors de la suppression du document.'
      );
    }
  }

  /* ============================================================
     🔹 Rendu
  ============================================================ */
  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
        <p className="text-blue-700 text-lg animate-pulse font-medium">
          ⏳ Chargement du projet...
        </p>
      </div>
    );

  if (errorMsg && !project)
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 p-6">
        <p className="text-red-600 text-lg font-medium mb-4">{errorMsg}</p>
        <Btn onClick={() => navigate('/projects')} variant="primary">
          ← Retour aux projets
        </Btn>
      </div>
    );

  if (!project)
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg">Projet introuvable.</p>
        <Btn onClick={() => navigate('/projects')} variant="primary" className="mt-3">
          ← Retour
        </Btn>
      </div>
    );

  /* ============================================================
     🎨 UI principale — design modernisé
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 px-6 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-3xl p-8 border border-gray-100 space-y-10 transition-all">
        {/* ---------- HEADER ---------- */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <button
              onClick={() => navigate('/projects')}
              className="text-sm text-blue-600 hover:underline mb-3"
            >
              ← Retour aux projets
            </button>
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
              📁 {project.title}
            </h1>
            <p className="text-gray-600 mt-1">{project.description || 'Aucune description'}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Badge color="blue">{project.statusLabel || project.status}</Badge>
              <Badge color="green">
                💰 Budget : {project.budget?.toLocaleString() || 0} XOF
              </Badge>
              {isAdmin && <Badge color="gray">Admin</Badge>}
              {isAgent && <Badge color="yellow">Agent</Badge>}
              {isClient && <Badge color="blue">Client</Badge>}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Créé le {new Date(project.createdAt).toLocaleString()}
            </p>
          </div>

          {isClient && (
            <div
              className={`rounded-lg px-5 py-3 text-sm font-medium shadow-sm ${
                withinOneHour
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
              }`}
            >
              {withinOneHour ? (
                <>
                  ⏱️ Vous pouvez encore <strong>modifier ou supprimer</strong> des éléments
                  pendant <strong>{timeLeftText}</strong>.
                </>
              ) : (
                <>
                  ⏳ La fenêtre d’édition est expirée. Vous pouvez encore <strong>ajouter</strong>{' '}
                  des phases et documents.
                </>
              )}
            </div>
          )}
        </div>

        {/* ---------- PHASES ---------- */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">📋 Phases du projet</h2>
          {!isAgent && (adminAll || clientCanAdd) && (
            <form
              onSubmit={handlePhaseSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition"
            >
              <input
                placeholder="Titre *"
                value={phaseForm.title}
                onChange={(e) => setPhaseForm({ ...phaseForm, title: e.target.value })}
                required
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1">
                  Date de début (optionnelle)
                </label>
                <input
                  type="date"
                  value={phaseForm.startDate}
                  onChange={(e) => setPhaseForm({ ...phaseForm, startDate: e.target.value })}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1">
                  Date de fin (optionnelle)
                </label>
                <input
                  type="date"
                  value={phaseForm.endDate}
                  onChange={(e) => setPhaseForm({ ...phaseForm, endDate: e.target.value })}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <textarea
                placeholder="Description (facultative)"
                value={phaseForm.description}
                onChange={(e) => setPhaseForm({ ...phaseForm, description: e.target.value })}
                className="md:col-span-2 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <div className="md:col-span-2 text-right">
                {editPhaseId && (
                  <Btn onClick={resetPhaseForm} variant="secondary" className="mr-2">
                    Annuler
                  </Btn>
                )}
                <Btn type="submit" variant="primary">
                  {editPhaseId ? '💾 Enregistrer' : '➕ Ajouter une phase'}
                </Btn>
              </div>
            </form>
          )}

          {phases.length === 0 ? (
            <p className="text-gray-500 italic mt-4">Aucune phase définie.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              {phases.map((ph) => (
                <div
                  key={ph.id}
                  className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{ph.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {ph.startDate ? `📅 Du ${ph.startDate}` : ''}{' '}
                      {ph.endDate ? `au ${ph.endDate}` : ''}
                    </p>
                    <p className="text-gray-700 mt-2">
                      {ph.description || 'Aucune description fournie.'}
                    </p>
                  </div>
                  {!isAgent && (adminAll || clientCanModifyOrDelete) && (
                    <div className="mt-4 flex gap-2 justify-end">
                      <Btn
                        variant="warning"
                        onClick={() => {
                          setEditPhaseId(ph.id);
                          setPhaseForm({
                            title: ph.title,
                            description: ph.description || '',
                            startDate: ph.startDate || '',
                            endDate: ph.endDate || '',
                          });
                        }}
                      >
                        ✏️ Modifier
                      </Btn>
                      <Btn variant="danger" onClick={() => handleDeletePhase(ph.id)}>
                        🗑️ Supprimer
                      </Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---------- DOCUMENTS ---------- */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">📎 Documents du projet</h2>
          {(adminAll || clientCanAdd || agentCanAddDocs) && (
            <form
              onSubmit={handleUploadDocuments}
              className="bg-gray-50 border border-gray-200 p-6 rounded-2xl mb-6 grid gap-4 md:grid-cols-2 shadow-sm hover:shadow-md transition"
            >
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm cursor-pointer focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={selectedPhaseId}
                onChange={(e) => setSelectedPhaseId(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Associer à une phase (optionnel) —</option>
                {phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.title}
                  </option>
                ))}
              </select>
              <input
                placeholder="Titre du document (optionnel)"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={docKind}
                onChange={(e) => setDocKind(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="other">Autre</option>
                <option value="contract">Contrat</option>
                <option value="plan">Plan</option>
                <option value="report">Rapport</option>
                <option value="photo">Photo</option>
              </select>
              <input
                placeholder="Notes (optionnel)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="md:col-span-2 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <div className="md:col-span-2 text-right">
                <Btn type="submit" variant="primary">
                  📤 Upload
                </Btn>
              </div>
            </form>
          )}

          {documents.length === 0 ? (
            <p className="text-gray-500 italic">Aucun document joint.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-lg transition flex flex-col justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900 text-base">
                      {doc.title || doc.originalName || 'Document'}
                    </p>
                    {(doc.phase?.title || doc.phaseTitle) && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        🔗 Phase : {doc.phase?.title || doc.phaseTitle}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {doc.mimeType} •{' '}
                      {typeof doc.fileSize === 'number'
                        ? (doc.fileSize / 1024).toFixed(1)
                        : '?'}{' '}
                      Ko
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Ajouté le {new Date(doc.createdAt).toLocaleString()}
                    </p>
                    {doc.notes && (
                      <p className="text-sm text-gray-700 mt-2">{doc.notes}</p>
                    )}
                  </div>

                  <div className="mt-3 flex justify-between items-center">
                    <a
                      href={getFileUrl(doc.filePath)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      📄 Ouvrir
                    </a>
                    {(adminAll || clientCanModifyOrDelete) && (
                      <Btn
                        onClick={() => handleDeleteDocument(doc.id)}
                        variant="danger"
                      >
                        🗑️ Supprimer
                      </Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
