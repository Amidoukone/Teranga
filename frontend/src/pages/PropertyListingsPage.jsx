import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";

import PropertyListingCard from "../components/property-listings/PropertyListingCard";
import SetSeo from "../components/SetSeo";
import { listPropertyListings } from "../services/propertyListings";

function ListingSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-surface-card" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-surface-main" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-2/5 animate-pulse rounded-full bg-surface-main" />
        <div className="h-5 w-4/5 animate-pulse rounded-full bg-surface-main" />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-surface-main" />
      </div>
    </div>
  );
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
      } catch (_error) {
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
    <main className="min-h-screen bg-surface-main px-4 py-6 text-text-primary sm:px-6 sm:py-10">
      <SetSeo
        title={t("propertyListingsPage.seoTitle")}
        description={t("propertyListingsPage.seoDescription")}
      />

      <div className="mx-auto max-w-6xl">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-text-secondary hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 dark:hover:text-blue-300"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          {t("propertyListingsPage.backHome")}
        </Link>

        <header className="mt-5 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            <ShieldCheck size={15} aria-hidden="true" />
            {t("propertyListingsPage.verified")}
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
            {t("propertyListingsPage.title")}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-text-secondary">
            {t("propertyListingsPage.subtitle")}
          </p>
        </header>

        <section
          className="mt-8"
          aria-labelledby="property-listings-heading"
          aria-busy={loading}
        >
          <h2 id="property-listings-heading" className="sr-only">
            {t("propertyListingsPage.results")}
          </h2>
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => <ListingSkeleton key={item} />)}
              <span className="sr-only" aria-live="polite">{t("propertyListingsPage.loading")}</span>
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-3xl border border-border bg-surface-card px-6 py-14 text-center">
              <Building2 className="mx-auto text-text-muted" size={36} aria-hidden="true" />
              <p className="mt-4 text-sm text-text-secondary">{t("propertyListingsPage.empty")}</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <PropertyListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
