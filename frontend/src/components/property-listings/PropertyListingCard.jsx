import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import PropertyPhotoCollage from "./PropertyPhotoCollage";

export function formatListingPrice(value, language) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat(language === "en" ? "en-US" : "fr-FR", {
    maximumFractionDigits: 0,
  }).format(number);
}

export function listingLocation(listing) {
  return [listing?.neighborhood, listing?.city, listing?.country].filter(Boolean).join(", ");
}

export default function PropertyListingCard({ listing, compact = false }) {
  const { t, i18n } = useTranslation();
  const photoCount = Array.isArray(listing?.photos) ? listing.photos.length : 0;

  return (
    <Link
      to={`/immobilier/${listing.id}`}
      className="group block overflow-hidden rounded-3xl border border-border/80 bg-surface-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-400/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
      aria-label={t("propertyListingsPage.openListing", { title: listing.title })}
    >
      <PropertyPhotoCollage
        photos={listing.photos}
        title={listing.title}
        photoCountLabel={
          photoCount > 1 ? t("propertyListingsPage.photoCount", { count: photoCount }) : undefined
        }
      />
      <div className={compact ? "p-4" : "p-4 sm:p-5"}>
        <div className="flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
          <span>{t(`propertyListingsPage.type.${listing.type}`)}</span>
          <span className="h-1 w-1 rounded-full bg-text-muted" aria-hidden="true" />
          <span>{t(`propertyListingsPage.transactionType.${listing.transactionType}`)}</span>
        </div>
        <h2 className="mt-2 truncate text-base font-semibold text-text-primary">{listing.title}</h2>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-text-secondary">
          <MapPin size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{listingLocation(listing)}</span>
        </p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="text-lg font-bold tracking-tight text-text-primary">
            {formatListingPrice(listing.price, i18n.resolvedLanguage)} {listing.currency}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700 transition group-hover:gap-2 dark:text-blue-300">
            {t("propertyListingsPage.viewDetails")}
            <ArrowRight size={14} aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
