// frontend/src/pages/PropertyListingsPage.jsx
// Vitrine publique de la marketplace immobilière (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7) —
// sans authentification, pensée pour être partagée/promue sur les réseaux sociaux.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, MapPin, ArrowLeft } from 'lucide-react';

import { listPropertyListings } from '../services/propertyListings';
import { getFileUrl } from '../services/api';
import SetSeo from '../components/SetSeo';

function firstPhotoUrl(listing) {
  const first = Array.isArray(listing?.photos) ? listing.photos[0] : null;
  const path = typeof first === 'string' ? first : first?.url;
  return path ? getFileUrl(path) : '';
}

export default function PropertyListingsPage() {
  const { t } = useTranslation();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await listPropertyListings();
        if (active) setListings(rows || []);
      } catch (_err) {
        if (active) setListings([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-6 py-10 text-text-primary">
      <SetSeo
        title={t('propertyListingsPage.seoTitle')}
        description={t('propertyListingsPage.seoDescription')}
      />

      <div className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft size={14} />
          {t('propertyListingsPage.backHome')}
        </Link>

        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {t('propertyListingsPage.title')}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">{t('propertyListingsPage.subtitle')}</p>

        {loading ? (
          <p className="mt-8 text-sm text-text-secondary">{t('propertyListingsPage.loading')}</p>
        ) : listings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-surface-card/70 py-12 text-center text-sm text-text-secondary">
            {t('propertyListingsPage.empty')}
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => {
              const photo = firstPhotoUrl(listing);
              return (
                <Link
                  key={listing.id}
                  to={`/immobilier/${listing.id}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-surface-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-main">
                    {photo ? (
                      <img
                        src={photo}
                        alt={listing.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-text-muted">
                        <Home size={32} />
                      </div>
                    )}
                    {Array.isArray(listing.photos) && listing.photos.length > 1 ? (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] font-medium text-white">
                        +{listing.photos.length - 1}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-1.5 text-[0.65rem] uppercase tracking-wide text-text-muted">
                      <span>{t(`propertyListingsPage.type.${listing.type}`)}</span>
                      <span>·</span>
                      <span>{t(`propertyListingsPage.transactionType.${listing.transactionType}`)}</span>
                    </div>
                    <h2 className="mt-1 truncate text-sm font-semibold text-text-primary">
                      {listing.title}
                    </h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                      <MapPin size={12} />
                      {listing.neighborhood ? `${listing.neighborhood}, ` : ''}
                      {listing.city}
                      {listing.country ? `, ${listing.country}` : ''}
                    </p>
                    <p className="mt-2 text-sm font-bold text-text-primary">
                      {listing.price} {listing.currency}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
