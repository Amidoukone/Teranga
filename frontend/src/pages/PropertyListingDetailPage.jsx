// frontend/src/pages/PropertyListingDetailPage.jsx
// Fiche annonce publique, partageable (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7) — lien
// individuel par annonce, contact par appel ou WhatsApp (numéro Teranga de la région, jamais
// le contact d'origine du bien).

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, MapPin, Phone, MessageCircle, ArrowLeft, Loader2 } from 'lucide-react';

import { getPropertyListing } from '../services/propertyListings';
import { getFileUrl } from '../services/api';
import SetSeo from '../components/SetSeo';
import AuthFeedbackBanner from '../components/AuthFeedbackBanner';

function photoUrl(entry) {
  const path = typeof entry === 'string' ? entry : entry?.url;
  return path ? getFileUrl(path) : '';
}

function buildWhatsappHref(phone, message) {
  const digits = String(phone || '').replace(/[^\d]/g, '').replace(/^00/, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function PropertyListingDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await getPropertyListing(id);
        if (!active) return;
        if (!data) setNotFound(true);
        else setListing(data);
      } catch (_err) {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-text-muted" size={28} />
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <AuthFeedbackBanner type="error" message={t('propertyListingDetailPage.notFound')} />
        <Link to="/immobilier" className="btn-secondary mt-4 inline-block rounded-full px-6 py-2.5 text-sm">
          {t('propertyListingDetailPage.backToList')}
        </Link>
      </div>
    );
  }

  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const mainPhoto = photos[activePhoto] ? photoUrl(photos[activePhoto]) : '';
  const whatsappHref = buildWhatsappHref(
    listing.contactPhone,
    t('propertyListingDetailPage.whatsappPrefill', { title: listing.title })
  );
  const telHref = listing.contactPhone ? `tel:${listing.contactPhone.replace(/\s+/g, '')}` : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-6 py-10 text-text-primary">
      <SetSeo
        title={listing.title}
        description={listing.description || t('propertyListingDetailPage.seoDescriptionFallback')}
        image={mainPhoto || undefined}
      />

      <div className="mx-auto max-w-3xl">
        <Link to="/immobilier" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft size={14} />
          {t('propertyListingDetailPage.backToList')}
        </Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card shadow-sm">
          <div className="aspect-[16/9] w-full bg-surface-main">
            {mainPhoto ? (
              <img src={mainPhoto} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-muted">
                <Home size={40} />
              </div>
            )}
          </div>

          {photos.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto p-3">
              {photos.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhoto(idx)}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    idx === activePhoto
                      ? 'border-blue-500 opacity-100'
                      : 'border-transparent opacity-60 hover:opacity-90'
                  }`}
                >
                  <img src={photoUrl(p)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="p-6">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
              <span>{t(`propertyListingsPage.type.${listing.type}`)}</span>
              <span>·</span>
              <span>{t(`propertyListingsPage.transactionType.${listing.transactionType}`)}</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-text-primary sm:text-2xl">{listing.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
              <MapPin size={14} />
              {listing.neighborhood ? `${listing.neighborhood}, ` : ''}
              {listing.city}
              {listing.country ? `, ${listing.country}` : ''}
            </p>
            <p className="mt-3 text-2xl font-bold text-text-primary">
              {listing.price} {listing.currency}
            </p>

            {listing.description ? (
              <p className="mt-4 whitespace-pre-line text-sm text-text-secondary">{listing.description}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {telHref ? (
                <a
                  href={telHref}
                  className="btn-primary inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm"
                >
                  <Phone size={15} />
                  {t('propertyListingDetailPage.callCta')}
                </a>
              ) : null}
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <MessageCircle size={15} />
                  {t('propertyListingDetailPage.whatsappCta')}
                </a>
              ) : null}
              {!telHref && !whatsappHref ? (
                <p className="text-sm text-text-muted">{t('propertyListingDetailPage.noContact')}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
