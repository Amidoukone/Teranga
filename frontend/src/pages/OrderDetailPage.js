// frontend/src/pages/OrderDetailPage.jsx
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getOrderById,
  updateOrder,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
} from '../services/orders';
import { getProducts } from '../services/products';
import {
  uploadOrderEvidences,
  getOrderEvidences,
  deleteOrderEvidence,
} from '../services/evidences';
import { me } from '../services/auth';
import {
  formatCurrency,
  formatStatus,
  canonicalizeOrderStatus,
  canonicalizePaymentStatus,
} from '../utils/labels';

/* ============================================================
   🌍 FILE_BASE + normalizePath + toAbsUrl (Option B Production)
=============================================================== */
const FILE_BASE =
  (typeof window !== 'undefined' &&
    (window.__TERANGA_FILE_BASE_URL ||
      window.__TERANGA_API_BASE_URL ||
      '')) ||
  '';

function normalizePath(path = '') {
  if (!path) return '';
  const formatted = String(path).trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(formatted)) return formatted;
  const fixed = formatted.startsWith('/') ? formatted : '/' + formatted;
  return fixed.replace(/\/{2,}/g, '/');
}

function toAbsUrl(path = '') {
  const norm = normalizePath(path);
  if (/^https?:\/\//i.test(norm)) return norm;
  return FILE_BASE.replace(/\/$/, '') + norm;
}

/* ============================================================
   🧾 OrderDetailPage — Clean Shop Premium Edition
=============================================================== */
export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [itemForm, setItemForm] = useState({
    productId: '',
    quantity: 1,
    unitPrice: '',
  });

  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [evidences, setEvidences] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);
  const [fileInputKey, setFileInputKey] = useState(() => Date.now());

  /* ============================================================
     Helper affichage client
  ============================================================ */
  const customerDisplay = useMemo(() => {
    if (!order?.customer) return '—';
    const c = order.customer;
    const first = c.firstName ?? c.firstname ?? '';
    const last = c.lastName ?? c.lastname ?? '';
    const full = `${first} ${last}`.trim();
    return full || c.name || c.email || '—';
  }, [order]);

  /* ============================================================
     Helper affichage uploader
  ============================================================ */
  function formatUploader(uploader) {
    if (!uploader) return '—';
    const first = uploader.firstName ?? uploader.firstname ?? '';
    const last = uploader.lastName ?? uploader.lastname ?? '';
    const full = `${first} ${last}`.trim();
    return full || uploader.name || uploader.email || '—';
  }

  /* ============================================================
     Initialisation
  ============================================================ */
  const init = useCallback(async () => {
    try {
      const ud = await me();
      setUser(ud.user);

      const [o, prods] = await Promise.all([
        getOrderById(id),
        getProducts({ limit: 200 }),
      ]);

      setOrder(o || null);
      setProducts(prods || []);

      const evs = await getOrderEvidences(id);
      setEvidences(evs || []);
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.removeItem('teranga_token');
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (id) init();
  }, [id, init]);

  const refresh = useCallback(async () => {
    const o = await getOrderById(id);
    setOrder(o || null);
  }, [id]);

  /* ============================================================
     Gestion statuts commande
  ============================================================ */
  async function handleOrderUpdate(patch) {
    try {
      const payload = {};
      if (patch.orderStatus) {
        payload.status = canonicalizeOrderStatus(patch.orderStatus);
      }
      if (patch.paymentStatus) {
        payload.paymentStatus = canonicalizePaymentStatus(patch.paymentStatus);
      }
      await updateOrder(id, payload);
      await refresh();
      alert('✅ Commande mise à jour.');
    } catch {
      alert('Erreur mise à jour commande.');
    }
  }

  /* ============================================================
     Gestion articles
  ============================================================ */
  async function handleAddItem(e) {
    e.preventDefault();
    try {
      if (!itemForm.productId) return alert('Produit requis.');
      if (Number(itemForm.quantity) <= 0) return alert('Quantité invalide.');

      const payload = {
        productId: Number(itemForm.productId),
        quantity: Number(itemForm.quantity),
      };

      if (itemForm.unitPrice !== '' && itemForm.unitPrice !== null) {
        payload.unitPrice = Number(itemForm.unitPrice);
      }

      await addOrderItem(id, payload);
      setItemForm({ productId: '', quantity: 1, unitPrice: '' });
      await refresh();
      alert('✅ Article ajouté.');
    } catch {
      alert("Erreur ajout article.");
    }
  }

  async function handleUpdateItem(itemId, patch) {
    try {
      await updateOrderItem(id, itemId, patch);
      await refresh();
    } catch {
      alert('Erreur mise à jour article.');
    }
  }

  async function handleDeleteItem(itemId) {
    if (!window.confirm('Supprimer cet article ?')) return;
    try {
      await deleteOrderItem(id, itemId);
      await refresh();
    } catch {
      alert("Erreur suppression article.");
    }
  }

  /* ============================================================
     Gestion preuves fichier
  ============================================================ */
  function onFilesChange(ev) {
    const selected = Array.from(ev.target.files || []);
    setFiles(selected);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!files.length) return alert('Sélectionnez un fichier');
    setUploading(true);

    try {
      await uploadOrderEvidences(id, files, notes);
      setFiles([]);
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileInputKey(Date.now());

      const evs = await getOrderEvidences(id);
      setEvidences(evs || []);

      alert('✅ Preuves ajoutées.');
    } catch (e) {
      alert("Erreur upload fichiers.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteEvidence(evId) {
    if (!window.confirm('Supprimer cette preuve ?')) return;
    try {
      await deleteOrderEvidence(evId);
      const evs = await getOrderEvidences(id);
      setEvidences(evs || []);
    } catch {
      alert("Erreur suppression preuve.");
    }
  }

  /* ============================================================
     Chargement
  ============================================================ */
  if (!user || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="animate-pulse text-gray-600 text-lg">Chargement…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg">Commande introuvable.</p>
      </div>
    );
  }

  const canAdmin = user.role === 'admin';
  const canUploadProofs = ['admin', 'agent', 'client'].includes(user.role);

  const total = Number(order.totalAmount || 0);
  const currency = order.currency || 'XOF';

  /* ============================================================
     UI Premium — Page complète
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              🧾 <span>{order.code || `Commande #${order.id}`}</span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Suivi détaillé de la commande, des articles et des preuves.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/orders"
              className="px-4 py-2 text-sm rounded-lg bg-slate-700 text-white hover:bg-slate-800"
            >
              ← Retour
            </Link>

            {canAdmin && (
              <button
                onClick={() =>
                  handleOrderUpdate({ orderStatus: 'cancelled' })
                }
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Annuler
              </button>
            )}
          </div>
        </div>

        {/* CLIENT + STATUTS + MONTANT */}
        <div className="grid lg:grid-cols-3 gap-4 mb-10">

          {/* CLIENT */}
          <div className="bg-gray-50 border p-4 rounded-xl">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              👤 Client
            </h3>
            <p className="font-medium text-slate-800">{customerDisplay}</p>
            {order.customer?.email && (
              <p className="text-xs text-slate-500 mt-1">
                {order.customer.email}
              </p>
            )}
            {order.customerNote && (
              <p className="text-sm text-slate-700 mt-3">
                <strong>Note client :</strong> {order.customerNote}
              </p>
            )}
          </div>

          {/* STATUTS */}
          <div className="bg-gray-50 border p-4 rounded-xl">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              📌 Statuts
            </h3>

            <div className="flex flex-wrap gap-2 mb-2">
              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border text-[11px]">
                {formatStatus(order.orderStatus, 'order')}
              </span>
              <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border text-[11px]">
                {formatStatus(order.paymentStatus, 'payment')}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Créée le {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
            </p>

            {canAdmin && (
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  className="px-3 py-1 bg-white border rounded-lg text-xs hover:bg-gray-100"
                  onClick={() => handleOrderUpdate({ orderStatus: 'created' })}
                >
                  Créée
                </button>

                <button
                  className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700"
                  onClick={() =>
                    handleOrderUpdate({ orderStatus: 'paid', paymentStatus: 'paid' })
                  }
                >
                  Payée
                </button>

                <button
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"
                  onClick={() =>
                    handleOrderUpdate({ orderStatus: 'delivered', paymentStatus: 'paid' })
                  }
                >
                  Livrée
                </button>
              </div>
            )}
          </div>

          {/* MONTANT */}
          <div className="bg-gray-50 border p-4 rounded-xl">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              💰 Résumé
            </h3>

            <p className="text-xs text-slate-400 uppercase">Montant total</p>
            <p className="text-2xl font-extrabold text-blue-600">
              {total.toLocaleString()} {formatCurrency(currency)}
            </p>

            {order.items?.length > 0 && (
              <p className="text-xs text-slate-500 mt-3">
                {order.items.length} article{order.items.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* ARTICLES */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            🧩 Articles
          </h2>

          {order.items?.length ? (
            <div className="grid gap-4">
              {order.items.map((it) => (
                <div
                  key={it.id}
                  className="bg-white border p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {it.product?.name || `Article #${it.id}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ID article : #{it.id}
                    </p>

                    <p className="text-sm text-slate-700 mt-2">
                      Qté : <strong>{it.quantity}</strong>
                    </p>
                    <p className="text-sm text-slate-700">
                      PU :{' '}
                      <strong>
                        {Number(it.unitPrice || it.price).toLocaleString()}{' '}
                        {formatCurrency(currency)}
                      </strong>
                    </p>
                    <p className="text-sm text-slate-700">
                      Total :{' '}
                      <strong>
                        {(Number(it.unitPrice || it.price) * it.quantity).toLocaleString()}{' '}
                        {formatCurrency(currency)}
                      </strong>
                    </p>
                  </div>

                  {canAdmin && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs hover:bg-amber-600"
                        onClick={() =>
                          handleUpdateItem(it.id, { itemStatus: 'cancelled' })
                        }
                      >
                        Annuler
                      </button>

                      <button
                        className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700"
                        onClick={() => handleDeleteItem(it.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              Aucun article dans cette commande.
            </p>
          )}

          {canAdmin && (
            <form
              onSubmit={handleAddItem}
              className="mt-5 bg-gray-50 border rounded-xl p-4"
            >
              <h3 className="text-sm font-semibold mb-3">➕ Ajouter un article</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <select
                  value={itemForm.productId}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, productId: e.target.value })
                  }
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Sélectionner —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {Number(p.price).toLocaleString()} {formatCurrency(p.currency)}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, quantity: e.target.value })
                  }
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Quantité"
                />

                <input
                  type="number"
                  step="0.01"
                  value={itemForm.unitPrice}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, unitPrice: e.target.value })
                  }
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="PU (optionnel)"
                />

                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Ajouter
                </button>
              </div>
            </form>
          )}
        </section>

        {/* PREUVES FICHIERS */}
        {canUploadProofs && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">
              📎 Preuves du paiement
            </h2>

            {/* Form Upload */}
            <form
              onSubmit={handleUpload}
              className="bg-gray-50 border p-4 rounded-xl mb-5"
            >
              <div className="grid md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-600">Fichiers</label>
                  <input
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={onFilesChange}
                    className="w-full border px-3 py-2 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600">Notes</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Commentaire…"
                    className="w-full border px-3 py-2 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="text-right mt-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className={`px-4 py-2 text-sm rounded-lg shadow-sm ${
                    uploading
                      ? 'bg-blue-300 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {uploading ? 'Upload…' : 'Uploader les preuves'}
                </button>
              </div>
            </form>

            {/* Liste preuves */}
            {evidences.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Aucune preuve.</p>
            ) : (
              <div className="grid gap-4">
                {evidences.map((ev) => {
                  const isImage = (ev.mimeType || '').startsWith('image/');
                  const fileUrl = toAbsUrl(ev.filePath);

                  return (
                    <div
                      key={ev.id}
                      className="bg-white border p-4 rounded-xl shadow-sm flex flex-col sm:flex-row gap-3 justify-between"
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-16 border bg-gray-50 rounded-lg overflow-hidden">
                          {isImage ? (
                            <img
                              src={fileUrl}
                              alt={ev.originalName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl flex items-center justify-center h-full">
                              📄
                            </span>
                          )}
                        </div>

                        <div>
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 font-semibold hover:underline break-all text-sm"
                          >
                            {ev.originalName || ev.filePath}
                          </a>

                          <p className="text-xs text-slate-500 mt-1">
                            Ajouté le{' '}
                            {new Date(ev.createdAt).toLocaleString()} par{' '}
                            <strong>{formatUploader(ev.uploader)}</strong>
                          </p>

                          {ev.notes && (
                            <p className="text-sm text-slate-700 mt-1">
                              <strong>Notes :</strong> {ev.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {canAdmin && (
                        <button
                          onClick={() => handleDeleteEvidence(ev.id)}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* BOTTOM LINKS */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={`/orders/${id}/transactions`}
            className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900"
          >
            💰 Voir transactions
          </Link>

          <Link
            to="/orders"
            className="px-4 py-2 text-sm bg-gray-200 text-slate-800 rounded-lg hover:bg-gray-300"
          >
            ← Retour commandes
          </Link>
        </div>
      </div>
    </div>
  );
}
