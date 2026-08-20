import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react";

import AuthFeedbackBanner from "../components/AuthFeedbackBanner";
import PropertyGalleryModal from "../components/property-listings/PropertyGalleryModal";
import {
  formatListingPrice,
  listingLocation,
} from "../components/property-listings/PropertyListingCard";
import PropertyPhotoCollage, {
  propertyPhotoUrls,
} from "../components/property-listings/PropertyPhotoCollage";
import SetSeo from "../components/SetSeo";
import { getPropertyListing } from "../services/propertyListings";
import { buildTelHref, buildWhatsappHref } from "../utils/phone";

export default function PropertyListingDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setActivePhoto(0);
      setGalleryOpen(false);
      try {
        const data = await getPropertyListing(id);
        if (!active) return;
        if (!data) setNotFound(true);
        else setListing(data);
      } catch (_error) {
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
      <div className="flex min-h-[70vh] items-center justify-center" aria-live="polite">
        <Loader2 className="animate-spin text-blue-600" size={30} aria-hidden="true" />
        <span className="sr-only">{t("propertyListingsPage.loading")}</span>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-xl px-4 py-10 sm:px-6">
        <AuthFeedbackBanner type="error" message={t("propertyListingDetailPage.notFound")} />
        <Link to="/immobilier" className="btn-secondary mt-5 inline-flex min-h-11 items-center rounded-full px-6 py-2.5 text-sm">
          {t("propertyListingDetailPage.backToList")}
        </Link>
      </main>
    );
  }

  const photoUrls = propertyPhotoUrls(listing.photos);
  const mainPhoto = photoUrls[0] || "";
  const whatsappHref = buildWhatsappHref(
    listing.contactPhone,
    t("propertyListingDetailPage.whatsappPrefill", { title: listing.title })
  );
  const telHref = buildTelHref(listing.contactPhone);
  const location = listingLocation(listing);

  const openPhoto = (index) => {
    setActivePhoto(index);
    setGalleryOpen(true);
  };

  const ContactActions = ({ mobile = false }) => (
    <div
      className={
        mobile
          ? `grid gap-3 ${whatsappHref && telHref ? "grid-cols-2" : "grid-cols-1"}`
          : "mt-5 grid gap-3"
      }
    >
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
        >
          <MessageCircle size={18} aria-hidden="true" />
          {t("propertyListingDetailPage.whatsappCta")}
        </a>
      ) : null}
      {telHref ? (
        <a
          href={telHref}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface-card px-4 py-3 text-sm font-semibold text-text-primary shadow-sm hover:border-blue-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
        >
          <Phone size={18} aria-hidden="true" />
          {t("propertyListingDetailPage.callCta")}
        </a>
      ) : null}
    </div>
  );

  return (
    <main className="min-h-screen bg-surface-main px-4 pb-28 pt-5 text-text-primary sm:px-6 sm:pt-8 lg:pb-12">
      <SetSeo
        title={listing.title}
        description={listing.description || t("propertyListingDetailPage.seoDescriptionFallback")}
        image={mainPhoto || undefined}
      />

      <div className="mx-auto max-w-6xl">
        <Link
          to="/immobilier"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-text-secondary hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 dark:hover:text-blue-300"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          {t("propertyListingDetailPage.backToList")}
        </Link>

        <section className="mt-4 overflow-hidden rounded-3xl border border-border/80 bg-surface-card shadow-sm">
          <PropertyPhotoCollage
            photos={listing.photos}
            title={listing.title}
            variant="detail"
            onPhotoClick={photoUrls.length ? openPhoto : undefined}
            photoCountLabel={
              photoUrls.length
                ? t("propertyListingDetailPage.openGallery", { count: photoUrls.length })
                : undefined
            }
            photoLabel={(current, total) =>
              t("propertyListingDetailPage.photoButtonLabel", { current, total })
            }
          />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <article>
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
              <span>{t(`propertyListingsPage.type.${listing.type}`)}</span>
              <span className="h-1 w-1 rounded-full bg-text-muted" aria-hidden="true" />
              <span>{t(`propertyListingsPage.transactionType.${listing.transactionType}`)}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              {listing.title}
            </h1>
            {location ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-text-secondary sm:text-base">
                <MapPin size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                {location}
              </p>
            ) : null}
            <p className="mt-5 text-3xl font-bold tracking-tight text-text-primary">
              {formatListingPrice(listing.price, i18n.resolvedLanguage)} {listing.currency}
            </p>

            {listing.description ? (
              <section className="mt-8 border-t border-border/70 pt-6" aria-labelledby="listing-description-title">
                <h2 id="listing-description-title" className="text-lg font-semibold text-text-primary">
                  {t("propertyListingDetailPage.descriptionTitle")}
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-secondary sm:text-base">
                  {listing.description}
                </p>
              </section>
            ) : null}
          </article>

          <aside className="hidden rounded-3xl border border-border/80 bg-surface-card p-5 shadow-sm lg:sticky lg:top-24 lg:block">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-text-primary">
              {t("propertyListingDetailPage.contactTitle")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {t("propertyListingDetailPage.contactHint")}
            </p>
            {telHref || whatsappHref ? <ContactActions /> : (
              <p className="mt-4 text-sm text-text-muted">{t("propertyListingDetailPage.noContact")}</p>
            )}
          </aside>
        </div>
      </div>

      {telHref || whatsappHref ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-surface-card/95 p-3 shadow-[0_-12px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur lg:hidden">
          <div className="mx-auto max-w-xl"><ContactActions mobile /></div>
        </div>
      ) : null}

      <PropertyGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        photos={listing.photos}
        title={listing.title}
        activeIndex={activePhoto}
        onActiveIndexChange={setActivePhoto}
        t={t}
      />
    </main>
  );
}
