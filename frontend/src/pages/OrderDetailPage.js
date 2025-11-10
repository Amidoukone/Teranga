// frontend/src/pages/OrderDetailPage.js

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

/**
 * ============================================================
 * 🧾 OrderDetailPage
 * ============================================================
 * - Affiche les détails d’une commande : client, statut, articles, preuves
 * - Rôles :
 *   • Admin : peut tout modifier (statuts, items, suppression)
 *   • Agent / Client : lecture + ajout de preuves
 * ============================================================
 */

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [itemForm, setItemForm] = useState({ productId: '', quantity: 1, unitPrice: '' });
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [evidences, setEvidences] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);
  const [fileInputKey, setFileInputKey] = useState(() => Date.now());

  /* ============================================================
     🔹 Helpers affichage
  ============================================================ */
  const customerDisplay = useMemo(() => {
    if (!order?.customer) return '—';
    const c = order.customer;
    const first = c.firstName ?? c.firstname ?? '';
    const last = c.lastName ?? c.lastname ?? '';
    const fullName = `${first} ${last}`.trim();
    if (fullName) return fullName; // affiche le nom complet si dispo
    if (c.name) return c.name;
    if (c.email) return c.email;
    return '—';
  }, [order]);

  /* ============================================================
     🔹 Initialisation
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
      const status = e?.response?.status;
      if (status === 401) {
        localStorage.removeItem('teranga_token');
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }
      console.error('❌ init OrderDetailPage:', e);
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
     🔹 Gestion commande
  ============================================================ */
  async function handleOrderUpdate(patch) {
    try {
      const payload = {};
      if (patch.orderStatus)
        payload.status = canonicalizeOrderStatus(patch.orderStatus);
      if (patch.paymentStatus)
        payload.paymentStatus = canonicalizePaymentStatus(patch.paymentStatus);

      await updateOrder(id, payload);
      await refresh();
      alert('✅ Commande mise à jour avec succès');
    } catch (e) {
      console.error('❌ updateOrder:', e);
      alert('Erreur lors de la mise à jour de la commande.');
    }
  }

  /* ============================================================
     🔹 Gestion des articles
  ============================================================ */
  async function handleAddItem(e) {
    e.preventDefault();
    try {
      if (!itemForm.productId || Number(itemForm.quantity) <= 0) {
        return alert('Produit et quantité requis.');
      }

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
      alert('✅ Article ajouté avec succès');
    } catch (e) {
      console.error('❌ addItem:', e);
      alert("Erreur lors de l'ajout de l'article.");
    }
  }

  async function handleUpdateItem(itemId, patch) {
    try {
      await updateOrderItem(id, itemId, patch);
      await refresh();
    } catch (e) {
      console.error('❌ updateItem:', e);
      alert('Erreur mise à jour article.');
    }
  }

  async function handleDeleteItem(itemId) {
    if (!window.confirm('Supprimer cet article ?')) return;
    try {
      await deleteOrderItem(id, itemId);
      await refresh();
    } catch (e) {
      console.error('❌ deleteItem:', e);
      alert('Erreur suppression article.');
    }
  }

  /* ============================================================
     🔹 Gestion des preuves
  ============================================================ */
  function onFilesChange(ev) {
    const selected = Array.from(ev.target.files || []);
    setFiles(selected);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!files.length) return alert('Sélectionnez au moins un fichier.');
    setUploading(true);
    try {
      await uploadOrderEvidences(id, files, notes);
      setFiles([]);
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileInputKey(Date.now());
      const evs = await getOrderEvidences(id);
      setEvidences(evs || []);
      alert('✅ Preuve(s) ajoutée(s)');
    } catch (e) {
      console.error('❌ uploadOrderEvidences:', e);
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Erreur lors de l'upload des preuves.";
      alert(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteEvidence(evidenceId) {
    if (!window.confirm('Supprimer cette preuve ?')) return;
    try {
      await deleteOrderEvidence(evidenceId);
      const evs = await getOrderEvidences(id);
      setEvidences(evs || []);
    } catch (e) {
      console.error('❌ deleteEvidence:', e);
      alert('Erreur suppression preuve.');
    }
  }

  /* ============================================================
     🔹 États de chargement
  ============================================================ */
  if (!user || loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  if (!order)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg">Commande introuvable.</p>
      </div>
    );

  const canAdmin = user.role === 'admin';
  const canUploadProofs = ['admin', 'agent', 'client'].includes(user.role);

  /* ============================================================
     🔹 UI principale
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            🧾 {order.code || `Commande #${order.id}`}
          </h1>
          <div className="flex gap-2">
            <Link
              to="/orders"
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-700 text-white hover:bg-slate-800 transition"
            >
              ← Retour
            </Link>
            {canAdmin && (
              <button
                onClick={() => handleOrderUpdate({ orderStatus: 'cancelled' })}
                className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-red-600 text-white hover:bg-red-700 transition"
              >
                Annuler
              </button>
            )}
          </div>
        </div>

        {/* 🧍 Informations client et statut */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold mb-2">Client</h3>
            <p className="text-sm text-gray-700">{customerDisplay}</p>
            {order.customerNote && (
              <p className="text-sm text-gray-600 mt-2">
                <strong>Note :</strong> {order.customerNote}
              </p>
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold mb-2">Statuts</h3>
            <p className="text-sm text-gray-700">
              Commande : <strong>{formatStatus(order.orderStatus, 'order')}</strong> • Paiement :{' '}
              <strong>{formatStatus(order.paymentStatus, 'payment')}</strong>
            </p>
            <p className="text-sm text-gray-700 mt-1">
              Total :{' '}
              <strong>
                {Number(order.totalAmount || 0).toLocaleString()}{' '}
                {formatCurrency(order.currency || 'XOF')}
              </strong>
            </p>

            {canAdmin && (
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => handleOrderUpdate({ orderStatus: 'created' })}
                  className="px-3 py-1.5 text-xs rounded bg-gray-200 hover:bg-gray-300"
                >
                  Marquer "Créée"
                </button>
                <button
                  onClick={() =>
                    handleOrderUpdate({ orderStatus: 'paid', paymentStatus: 'paid' })
                  }
                  className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                >
                  Marquer "Payée"
                </button>
                <button
                  onClick={() =>
                    handleOrderUpdate({
                      orderStatus: 'delivered',
                      paymentStatus: 'paid',
                    })
                  }
                  className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Marquer "Livrée"
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 🧩 Articles */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">🧩 Articles</h2>
          </div>

          {order.items?.length ? (
            <div className="grid gap-4">
              {order.items.map((it) => (
                <div
                  key={it.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-start justify-between"
                >
                  <div>
                    <div className="font-semibold">
                      {it.product?.name || `Article #${it.id}`}
                    </div>
                    <div className="text-sm text-gray-700">
                      Qté : <strong>{it.quantity}</strong> • PU :{' '}
                      <strong>
                        {Number(it.unitPrice || it.price || 0).toLocaleString()} {formatCurrency(order.currency || 'XOF')}
                      </strong>
                    </div>
                  </div>

                  {canAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateItem(it.id, { itemStatus: 'cancelled' })}
                        className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleDeleteItem(it.id)}
                        className="px-3 py-1.5 text-xs rounded bg-gray-200 hover:bg-gray-300"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Aucun article dans cette commande.</p>
          )}

          {canAdmin && (
            <form
              onSubmit={handleAddItem}
              className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={itemForm.productId}
                  onChange={(e) => setItemForm({ ...itemForm, productId: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Produit —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {Number(p.price || 0).toLocaleString()} {formatCurrency(p.currency || 'XOF')}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Qté"
                />

                <input
                  type="number"
                  step="0.01"
                  value={itemForm.unitPrice}
                  onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="PU (optionnel)"
                />

                <div className="text-right">
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 transition"
                  >
                    ➕ Ajouter
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>

        {/* 📎 Preuves */}
        {canUploadProofs && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              📎 Preuves du paiement de la commande (Réçu)
            </h2>

            <form
              onSubmit={handleUpload}
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <input
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={onFilesChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    placeholder="Notes (optionnel)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="text-right mt-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition ${
                    uploading
                      ? 'bg-blue-300 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {uploading ? 'Upload…' : 'Uploader'}
                </button>
              </div>
            </form>

            {evidences.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Aucune preuve ajoutée.</p>
            ) : (
              <div className="grid gap-4">
                {evidences.map((ev) => {
                  const isImage = (ev.mimeType || '').startsWith('image/');
                  const fileUrl = `http://localhost:5000${ev.filePath}`;
                  return (
                    <div
                      key={ev.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-start justify-between"
                    >
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
                            Ajouté le {new Date(ev.createdAt).toLocaleString()} par{' '}
                            {ev.uploader ? ev.uploader.email : '—'}
                          </div>
                          {ev.notes && (
                            <div className="text-sm text-gray-700 mt-1">
                              <strong>Notes :</strong> {ev.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      {user.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteEvidence(ev.id)}
                          className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
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

        {/* 🔗 Lien vers transactions */}
        <div className="mt-8 flex gap-3">
          <Link
            to={`/orders/${id}/transactions`}
            className="inline-block px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
          >
            💰 Voir Transactions de cette commande
          </Link>
          <Link
            to="/orders"
            className="inline-block px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300 transition"
          >
            ← Retour aux commandes
          </Link>
        </div>
      </div>
    </div>
  );
}
