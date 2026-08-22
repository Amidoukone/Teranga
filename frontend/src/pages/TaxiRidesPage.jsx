import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Bike,
  CalendarClock,
  CarFront,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
} from "lucide-react";

import { getMyTaxiRides } from "../services/missions";
import AuthFeedbackBanner from "../components/AuthFeedbackBanner";

const ACTIVE_STATUSES = new Set([
  "CREATED",
  "SEARCHING_EXECUTOR",
  "ASSIGNED",
  "EN_ROUTE",
  "ON_SITE",
  "IN_PROGRESS",
  "COMPLETED",
]);

const RIDES_POLL_MS = (() => {
  const raw = Number.parseInt(String(process.env.REACT_APP_TAXI_RIDES_POLL_MS || ""), 10);
  if (!Number.isFinite(raw) || raw < 5000) return 15000;
  return raw;
})();

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function RideCard({ ride, featured = false }) {
  const { t, i18n } = useTranslation();
  const VehicleIcon = ride.requestedVehicleType === "car" ? CarFront : Bike;
  const status = t(`taxiRides.status.${ride.missionStatus}`, {
    defaultValue: ride.missionStatus,
  });
  const date = ride.createdAt
    ? new Intl.DateTimeFormat(i18n.language || "fr", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(ride.createdAt))
    : null;

  return (
    <article
      className={`rounded-3xl border p-5 shadow-sm ${
        featured
          ? "border-blue-500/30 bg-blue-500/5"
          : "border-border/70 bg-surface-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <VehicleIcon size={21} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-text-muted">
              {t("taxiRides.reference", { id: ride.id })}
            </p>
            <p className="mt-0.5 font-semibold text-text-primary">{status}</p>
          </div>
        </div>
        {date ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-text-muted">
            <CalendarClock size={13} /> {date}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <p className="flex items-start gap-2 text-text-secondary">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-blue-600" />
          <span>{ride.pickupAddress || t("taxiRides.addressUnknown")}</span>
        </p>
        <p className="flex items-start gap-2 text-text-primary">
          <MapPin className="mt-0.5 shrink-0 text-emerald-600" size={16} />
          <span>{ride.address || t("taxiRides.addressUnknown")}</span>
        </p>
      </div>

      <Link
        to={`/courses/${ride.id}`}
        className={`mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold ${
          featured ? "btn-primary" : "btn-secondary"
        }`}
      >
        {featured ? t("taxiRides.follow") : t("taxiRides.details")}
        <ArrowRight size={17} />
      </Link>
    </article>
  );
}

export default function TaxiRidesPage() {
  const { t } = useTranslation();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getMyTaxiRides({ limit: 100 });
      setRides(data?.rides || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const refreshIfVisible = () => {
      if (isDocumentVisible()) load({ silent: true });
    };
    const interval = window.setInterval(refreshIfVisible, RIDES_POLL_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [load]);

  const activeRides = useMemo(
    () => rides.filter((ride) => ACTIVE_STATUSES.has(ride.missionStatus)),
    [rides],
  );
  const previousRides = useMemo(
    () => rides.filter((ride) => !ACTIVE_STATUSES.has(ride.missionStatus)),
    [rides],
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Teranga Taxi</p>
          <h1 className="app-page-headline">{t("taxiRides.title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-text-secondary">
            {t("taxiRides.subtitle")}
          </p>
        </div>
        <Link
          to="/taxi"
          className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold"
        >
          <Plus size={18} /> {t("taxiRides.book")}
        </Link>
      </header>

      {error ? (
        <div className="mt-6">
          <AuthFeedbackBanner
            type="error"
            message={error === true ? t("taxiRides.loadError") : error}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-text-muted">
          <Loader2 className="animate-spin" size={20} />{" "}
          {t("taxiRides.loading")}
        </div>
      ) : rides.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-border bg-surface-card p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-700">
            <CarFront size={25} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-text-primary">
            {t("taxiRides.emptyTitle")}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t("taxiRides.emptyText")}
          </p>
          <Link
            to="/taxi"
            className="btn-primary mt-5 inline-flex min-h-12 items-center rounded-2xl px-6 text-sm font-semibold"
          >
            {t("taxiRides.bookFirst")}
          </Link>
        </section>
      ) : (
        <div className="mt-8 space-y-8">
          {activeRides.length ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">
                  {t("taxiRides.active")}
                </h2>
                <button
                  type="button"
                  onClick={() => load()}
                  className="btn-secondary inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs"
                >
                  <RefreshCw size={14} /> {t("taxiRides.refresh")}
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {activeRides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} featured />
                ))}
              </div>
            </section>
          ) : null}

          {previousRides.length ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-text-primary">
                {t("taxiRides.previous")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {previousRides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
