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
 * 🧾 OrderDetailPage — Clean Shop Premium Edition
 * ============================================================
 * - Détail d’une commande (client, statuts, articles, preuves)
 * - Rôles :
 *   • Admin : gérer statuts, articles, preuves
 *   • Agent / Client : lecture + upload de preuves
 * - Design aligné avec OrdersPage & ProductCatalogPage
 * ============================================================
 */

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
     🔹 Helper affichage client
  ============================================================ */
  const customerDisplay = useMemo(() => {
    if (!order?.customer) return '—';
    const c = order.customer;
    const first = c.firstName ?? c.firstname ?? '';
    const last = c.lastName ?? c.lastname ?? '';
    const fullName = `${first} ${last}`.trim();
    if (fullName) return fullName;
    if (c.name) return c.name;
    if (c.email) return c.email;
    return '—';
  }, [order]);

  /* ============================================================
     🔹 Helper affichage uploader preuve
  ============================================================ */
  function formatUploader(uploader) {
    if (!uploader) return '—';
    const first = uploader.firstName ?? uploader.firstname ?? '';
    const last = uploader.lastName ?? uploader.lastname ?? '';
    const fullName = `${first} ${last}`.trim();
    if (fullName) return fullName;
    if (uploader.name) return uploader.name;
    if (uploader.email) return uploader.email;
    return '—';
  }

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
     🔹 Gestion commande (statuts)
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
      alert('✅ Commande mise à jour avec succès.');
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
      alert('✅ Article ajouté avec succès.');
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
      alert('Erreur lors de la mise à jour de l’article.');
    }
  }

  async function handleDeleteItem(itemId) {
    if (!window.confirm('Supprimer cet article ?')) return;
    try {
      await deleteOrderItem(id, itemId);
      await refresh();
    } catch (e) {
      console.error('❌ deleteItem:', e);
      alert('Erreur lors de la suppression de l’article.');
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

      alert('✅ Preuve(s) ajoutée(s).');
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
      alert('Erreur lors de la suppression de la preuve.');
    }
  }

  /* ============================================================
     🔹 États de chargement
  ============================================================ */
  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg">Commande introuvable.</p>
      </div>
    );
  }

  const canAdmin = user.role === 'admin';
  const canUploadProofs = ['admin', 'agent', 'client'].includes(user.role);

  const total = Number(order.totalAmount || 0);
  const currency = order.currency || 'XOF';

  /* ============================================================
     🔹 UI principale — Clean Shop Premium
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 Header premium */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              🧾
              <span>
                {order.code || `Commande #${order.id}`}
              </span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Suivi détaillé de la commande, des articles et des preuves.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Link
              to="/orders"
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-700 text-white hover:bg-slate-800 transition"
            >
              ← Retour aux commandes
            </Link>

            {canAdmin && (
              <button
                onClick={() => handleOrderUpdate({ orderStatus: 'cancelled' })}
                className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-red-600 text-white hover:bg-red-700 transition"
              >
                Annuler la commande
              </button>
            )}
          </div>
        </div>

        {/* Résumé top : Client + Statuts + Montant */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Client */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              👤 Client
            </h3>
            <p className="text-sm text-slate-800 font-medium">
              {customerDisplay}
            </p>
            {order.customer?.email && (
              <p className="text-xs text-slate-500 mt-1">
                {order.customer.email}
              </p>
            )}
            {order.customerNote && (
              <p className="text-sm text-slate-700 mt-3">
                <span className="font-semibold">Note client : </span>
                {order.customerNote}
              </p>
            )}
          </div>

          {/* Statuts */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              📌 Statuts
            </h3>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700">
                {formatStatus(order.orderStatus, 'order')}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-semibold text-emerald-700">
                {formatStatus(order.paymentStatus, 'payment')}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Créée le{' '}
              {order.createdAt
                ? new Date(order.createdAt).toLocaleString()
                : '—'}
            </p>

            {canAdmin && (
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => handleOrderUpdate({ orderStatus: 'created' })}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-300 hover:bg-gray-100"
                >
                  Marquer <strong>Créée</strong>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleOrderUpdate({
                      orderStatus: 'paid',
                      paymentStatus: 'paid',
                    })
                  }
                  className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Marquer <strong>Payée</strong>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleOrderUpdate({
                      orderStatus: 'delivered',
                      paymentStatus: 'paid',
                    })
                  }
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Marquer <strong>Livrée</strong>
                </button>
              </div>
            )}
          </div>

          {/* Montant */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                💰 Résumé montant
              </h3>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Montant total
              </p>
              <p className="text-2xl font-extrabold text-blue-600">
                {total.toLocaleString()} {formatCurrency(currency)}
              </p>
            </div>
            {order.items?.length > 0 && (
              <p className="text-xs text-slate-500 mt-3">
                {order.items.length} article
                {order.items.length > 1 ? 's' : ''} dans cette commande.
              </p>
            )}
          </div>
        </div>

        {/* ===================================================== */}
        {/* 🧩 Articles */}
        {/* ===================================================== */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              🧩 Articles de la commande
            </h2>
          </div>

          {order.items?.length ? (
            <div className="grid gap-4">
              {order.items.map((it) => (
                <div
                  key={it.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {it.product?.name || `Article #${it.id}`}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ID article : #{it.id}
                    </p>

                    <div className="mt-2 text-sm text-slate-700 space-y-0.5">
                      <div>
                        Qté :{' '}
                        <strong>{it.quantity}</strong>
                      </div>
                      <div>
                        Prix unitaire :{' '}
                        <strong>
                          {Number(it.unitPrice || it.price || 0).toLocaleString()}{' '}
                          {formatCurrency(currency)}
                        </strong>
                      </div>
                      <div>
                        Total ligne :{' '}
                        <strong>
                          {(
                            Number(it.unitPrice || it.price || 0) *
                            Number(it.quantity || 0)
                          ).toLocaleString()}{' '}
                          {formatCurrency(currency)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {canAdmin && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateItem(it.id, { itemStatus: 'cancelled' })
                        }
                        className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                      >
                        Marquer annulé
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(it.id)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700"
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
              className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4"
            >
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                ➕ Ajouter un article
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={itemForm.productId}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, productId: e.target.value })
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Sélectionner un produit —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {Number(p.price || 0).toLocaleString()}{' '}
                      {formatCurrency(p.currency || 'XOF')}
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
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Quantité"
                />

                <input
                  type="number"
                  step="0.01"
                  value={itemForm.unitPrice}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, unitPrice: e.target.value })
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="PU (optionnel)"
                />

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>

        {/* ===================================================== */}
        {/* 📎 Preuves de paiement */}
        {/* ===================================================== */}
        {canUploadProofs && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              📎 Preuves du paiement (Reçu)
            </h2>

            {/* Form upload */}
            <form
              onSubmit={handleUpload}
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Fichiers (JPG, PNG, PDF)
                  </label>
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Notes (optionnel)
                  </label>
                  <input
                    placeholder="Référence, commentaire..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
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
                  {uploading ? 'Upload…' : 'Uploader les preuves'}
                </button>
              </div>
            </form>

            {/* Liste des preuves */}
            {evidences.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                Aucune preuve ajoutée pour cette commande.
              </p>
            ) : (
              <div className="grid gap-4">
                {evidences.map((ev) => {
                  const isImage = (ev.mimeType || '').startsWith('image/');
                  const fileUrl = `http://localhost:5000${ev.filePath}`;
                  return (
                    <div
                      key={ev.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
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
                          <div className="text-xs text-slate-500 mt-0.5">
                            Ajouté le{' '}
                            {new Date(ev.createdAt).toLocaleString()} par{' '}
                            <span className="font-medium">
                              {formatUploader(ev.uploader)}
                            </span>
                          </div>
                          {ev.notes && (
                            <div className="text-sm text-slate-700 mt-1">
                              <span className="font-semibold">Notes :</span>{' '}
                              {ev.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {user.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEvidence(ev.id)}
                          className="self-end px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700"
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

        {/* ===================================================== */}
        {/* 🔗 Liens bas de page */}
        {/* ===================================================== */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={`/orders/${id}/transactions`}
            className="inline-flex items-center px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
          >
            💰 Voir les transactions de cette commande
          </Link>
          <Link
            to="/orders"
            className="inline-flex items-center px-4 py-2 text-sm bg-gray-200 text-slate-800 rounded-lg hover:bg-gray-300 transition"
          >
            ← Retour aux commandes
          </Link>
        </div>
      </div>
    </div>
  );
}
