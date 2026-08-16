// frontend/src/pages/AdminPropertyListingsPage.jsx
// Gestion des annonces immobilières (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7) — admin/master
// uniquement, aucun compte agence. Un master régional est verrouillé à sa région exacte ; un
// master pays choisit la région (parmi les siennes) mais pas le pays ; seul l'admin global
// choisit librement (voir backend propertyListing.controller.js resolveWriteScope).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';
import { me } from '../services/auth';
import { normalizeRole, isMasterUser, isGlobalAdminUser } from '../utils/role';
import { notify } from '../utils/notify';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import { getCountries } from '../services/countries';
import { getRegions } from '../services/regions';
import { getFileUrl } from '../services/api';
import {
  listPropertyListingsAdmin,
  createPropertyListing,
  updatePropertyListing,
  deletePropertyListing,
} from '../services/propertyListings';
import {
  AdminField,
  AdminFormPanel,
  AdminPageHeader,
  AdminPanelCard,
} from '../components/admin/AdminFormUi';
import { Badge, Button } from '../components/ui';

function photoUrl(entry) {
  const path = typeof entry === 'string' ? entry : entry?.url;
  return path ? getFileUrl(path) : '';
}

function isTruthyId(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return Boolean(s) && s !== '0';
}

const TYPES = ['house', 'apartment', 'land'];
const TRANSACTION_TYPES = ['rent', 'sale'];
const STATUSES = ['available', 'rented', 'sold'];

const STATUS_TONE = { available: 'success', rented: 'info', sold: 'neutral' };

const DEFAULT_FORM = {
  title: '',
  type: 'house',
  transactionType: 'rent',
  neighborhood: '',
  city: '',
  countryId: '',
  regionId: '',
  price: '',
  currency: 'XOF',
  description: '',
  status: 'available',
};

export default function AdminPropertyListingsPage() {
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();

  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [photos, setPhotos] = useState([]);

  // Aperçu des fichiers fraîchement sélectionnés — mémorisé pour ne créer/révoquer les
  // object URLs que lorsque la sélection change, pas à chaque re-render du formulaire.
  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  const isMaster = useMemo(() => isMasterUser(user), [user]);
  const globalAdmin = useMemo(() => isGlobalAdminUser(user), [user]);
  // Master pays (pas de regionId propre) : choisit la région parmi celles de SON pays.
  const countryLockedMaster = isMaster && !globalAdmin && !isTruthyId(user?.regionId);
  const regionLockedMaster = isMaster && !globalAdmin && isTruthyId(user?.regionId);

  const regionsForCountry = useMemo(() => {
    const countryId = globalAdmin ? form.countryId : user?.countryId;
    return regions.filter((r) => String(r.countryId) === String(countryId));
  }, [regions, form.countryId, globalAdmin, user]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const rows = await listPropertyListingsAdmin();
      setListings(rows || []);
    } catch (_err) {
      setErrorMsg(t('adminPropertyListingsPage.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const { user: current } = await me();
        if (!mounted || !current) return;
        if (normalizeRole(current.role) !== 'admin') {
          window.location.href = '/dashboard';
          return;
        }
        setUser(current);
        await load();

        const [countryList, regionList] = await Promise.all([getCountries(), getRegions()]);
        if (!mounted) return;
        setCountries(countryList || []);
        setRegions(regionList || []);
      } catch (_err) {
        if (mounted) setErrorMsg(t('adminPropertyListingsPage.errors.load'));
      }
    }
    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setPhotos([]);
    setEditing(null);
  }

  function startEdit(listing) {
    setEditing(listing);
    setForm({
      title: listing.title || '',
      type: listing.type || 'house',
      transactionType: listing.transactionType || 'rent',
      neighborhood: listing.neighborhood || '',
      city: listing.city || '',
      countryId: listing.countryId ? String(listing.countryId) : '',
      regionId: listing.regionId ? String(listing.regionId) : '',
      price: listing.price != null ? String(listing.price) : '',
      currency: listing.currency || 'XOF',
      description: listing.description || '',
      status: listing.status || 'available',
    });
    setPhotos([]);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    if (!form.title.trim() || !form.city.trim() || !form.price) {
      notify(t('adminPropertyListingsPage.errors.requiredFields'));
      return;
    }
    if (globalAdmin && !form.countryId) {
      notify(t('adminPropertyListingsPage.errors.countryRequired'));
      return;
    }

    const payload = {
      title: form.title.trim(),
      type: form.type,
      transactionType: form.transactionType,
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      price: form.price,
      currency: form.currency || 'XOF',
      description: form.description.trim(),
    };

    if (editing) payload.status = form.status;

    // countryId : uniquement pour l'admin global (un master hérite du sien, backend l'impose).
    if (globalAdmin) payload.countryId = form.countryId;
    // regionId : admin global ou master pays peuvent choisir ; un master région est verrouillé.
    if (globalAdmin || countryLockedMaster) payload.regionId = form.regionId;

    try {
      setSaving(true);
      setErrorMsg('');
      if (editing) {
        await updatePropertyListing(editing.id, payload, photos);
        notify(t('adminPropertyListingsPage.alerts.updated'));
      } else {
        await createPropertyListing(payload, photos);
        notify(t('adminPropertyListingsPage.alerts.created'));
      }
      resetForm();
      setShowForm(false);
      await load();
    } catch (err) {
      const message = err?.response?.data?.error || t('adminPropertyListingsPage.errors.save');
      setErrorMsg(message);
      notify(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirmDelete('propertyListing');
    if (!ok) return;
    try {
      await deletePropertyListing(id);
      await load();
    } catch (_err) {
      notify(t('adminPropertyListingsPage.errors.delete'));
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-sm text-text-secondary">{t('adminPropertyListingsPage.loading')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <AdminPageHeader
        title={t('adminPropertyListingsPage.title')}
        subtitle={t('adminPropertyListingsPage.subtitle')}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (showForm) resetForm();
                setShowForm((v) => !v);
              }}
              className="rounded-full px-4 py-2 text-sm"
            >
              {showForm ? t('adminPropertyListingsPage.buttons.hideForm') : t('adminPropertyListingsPage.buttons.newListing')}
            </Button>
            <Button onClick={load} loading={loading} className="rounded-full px-4 py-2 text-sm">
              {t('adminPropertyListingsPage.buttons.refresh')}
            </Button>
          </>
        }
      />

      {errorMsg ? <p className="mb-4 text-sm text-red-600">{errorMsg}</p> : null}

      {showForm ? (
        <AdminFormPanel onSubmit={handleSubmit} className="mb-8">
          <AdminField label={t('adminPropertyListingsPage.form.titleLabel')}>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="app-input"
            />
          </AdminField>

          <AdminField label={t('adminPropertyListingsPage.form.typeLabel')}>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="app-input"
            >
              {TYPES.map((v) => (
                <option key={v} value={v}>
                  {t(`adminPropertyListingsPage.type.${v}`)}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label={t('adminPropertyListingsPage.form.transactionTypeLabel')}>
            <select
              value={form.transactionType}
              onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
              className="app-input"
            >
              {TRANSACTION_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t(`adminPropertyListingsPage.transactionType.${v}`)}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label={t('adminPropertyListingsPage.form.cityLabel')}>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
              className="app-input"
            />
          </AdminField>

          <AdminField label={t('adminPropertyListingsPage.form.neighborhoodLabel')}>
            <input
              value={form.neighborhood}
              onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
              className="app-input"
            />
          </AdminField>

          <AdminField label={t('adminPropertyListingsPage.form.priceLabel')}>
            <input
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
              className="app-input"
            />
          </AdminField>

          <AdminField label={t('adminPropertyListingsPage.form.currencyLabel')}>
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="app-input"
            />
          </AdminField>

          {globalAdmin ? (
            <AdminField label={t('adminPropertyListingsPage.form.countryLabel')}>
              <select
                value={form.countryId}
                onChange={(e) => setForm({ ...form, countryId: e.target.value, regionId: '' })}
                required
                className="app-input"
              >
                <option value="" disabled>
                  {t('adminPropertyListingsPage.form.countryPlaceholder')}
                </option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </AdminField>
          ) : null}

          {globalAdmin || countryLockedMaster ? (
            <AdminField label={t('adminPropertyListingsPage.form.regionLabel')}>
              <select
                value={form.regionId}
                onChange={(e) => setForm({ ...form, regionId: e.target.value })}
                disabled={globalAdmin && !form.countryId}
                className="app-input disabled:opacity-60"
              >
                <option value="">{t('adminPropertyListingsPage.form.regionPlaceholder')}</option>
                {regionsForCountry.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </AdminField>
          ) : null}

          {regionLockedMaster ? (
            <p className="sm:col-span-2 text-xs italic text-text-muted">
              {t('adminPropertyListingsPage.form.regionLockedNotice')}
            </p>
          ) : null}

          <AdminField label={t('adminPropertyListingsPage.form.descriptionLabel')} className="sm:col-span-2">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="app-input"
            />
          </AdminField>

          {editing ? (
            <AdminField label={t('adminPropertyListingsPage.form.statusLabel')}>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="app-input"
              >
                {STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {t(`adminPropertyListingsPage.status.${v}`)}
                  </option>
                ))}
              </select>
            </AdminField>
          ) : null}

          <AdminField
            label={t('adminPropertyListingsPage.form.photosLabel')}
            className="sm:col-span-2"
          >
            {editing?.photos?.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {editing.photos.map((p, idx) => (
                  <img
                    key={idx}
                    src={photoUrl(p)}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            ) : null}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files || []))}
              className="app-input"
            />
            {photoPreviews.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {photoPreviews.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded-lg border-2 border-blue-500 object-cover"
                  />
                ))}
              </div>
            ) : null}
            {editing ? (
              <p className="mt-1 text-xs text-text-muted">{t('adminPropertyListingsPage.form.photosReplaceHint')}</p>
            ) : null}
          </AdminField>

          <div className="sm:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" loading={saving} className="rounded-full px-6 py-2.5 text-sm">
              {editing ? t('adminPropertyListingsPage.buttons.save') : t('adminPropertyListingsPage.buttons.create')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="rounded-full px-6 py-2.5 text-sm"
            >
              {t('adminPropertyListingsPage.buttons.cancel')}
            </Button>
          </div>
        </AdminFormPanel>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-secondary">{t('adminPropertyListingsPage.loading')}</p>
      ) : listings.length === 0 ? (
        <AdminPanelCard className="py-10 text-center text-sm text-text-secondary">
          {t('adminPropertyListingsPage.empty')}
        </AdminPanelCard>
      ) : (
        <div className="grid gap-4">
          {listings.map((listing) => {
            const thumb = Array.isArray(listing.photos) && listing.photos[0] ? photoUrl(listing.photos[0]) : '';
            return (
              <AdminPanelCard key={listing.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-main">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-text-muted">
                          <Home size={20} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text-primary">{listing.title}</p>
                        <Badge tone={STATUS_TONE[listing.status] || 'neutral'}>
                          {t(`adminPropertyListingsPage.status.${listing.status}`)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">
                        {t(`adminPropertyListingsPage.type.${listing.type}`)} ·{' '}
                        {t(`adminPropertyListingsPage.transactionType.${listing.transactionType}`)} ·{' '}
                        {listing.neighborhood ? `${listing.neighborhood}, ` : ''}
                        {listing.city}
                        {listing.country?.name ? `, ${listing.country.name}` : ''}
                        {listing.region?.name ? ` (${listing.region.name})` : ''}
                      </p>
                      <p className="mt-1 text-sm font-medium text-text-primary">
                        {listing.price} {listing.currency}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" size="sm" onClick={() => startEdit(listing)} className="rounded-full px-4 py-1.5 text-xs">
                      {t('adminPropertyListingsPage.buttons.edit')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(listing.id)} className="rounded-full px-4 py-1.5 text-xs">
                      {t('adminPropertyListingsPage.buttons.delete')}
                    </Button>
                  </div>
                </div>
              </AdminPanelCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
