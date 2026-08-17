import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bike, Car, Clock3, Loader2, MapPin, PhoneCall, RefreshCw, ShieldCheck } from "lucide-react";

import { getSharedMission } from "../services/missions";

const STATUS_REFRESH_MS = 60_000;

export default function SharedRidePage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getSharedMission(token));
      setError(null);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t("sharedRide.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, STATUS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (error || !data?.mission) {
    return <div className="mx-auto max-w-lg px-6 py-16 text-center text-sm text-rose-600">{error || t("sharedRide.errors.load")}</div>;
  }

  const mission = data.mission;
  const VehicleIcon = mission.vehicle?.vehicleType === "motorcycle" ? Bike : Car;
  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <div className="rounded-[28px] border border-border bg-surface-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="page-kicker">{t("sharedRide.kicker")}</p>
            <h1 className="text-2xl font-semibold text-text-primary">{mission.title}</h1>
          </div>
          <button type="button" onClick={load} disabled={loading} className="btn-secondary rounded-full p-2.5" aria-label={t("sharedRide.refresh")}>
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3">
          <p className="text-xs text-text-muted">{t("sharedRide.statusLabel")}</p>
          <p className="font-semibold text-blue-800 dark:text-blue-200">
            {t(`missionTracking.status.${mission.missionStatus}`, { defaultValue: mission.missionStatus })}
          </p>
        </div>

        {mission.provider ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border p-3">
            <ShieldCheck className="text-emerald-600" size={22} />
            <div>
              <p className="font-semibold text-text-primary">{mission.provider.displayFirstName}</p>
              <p className="text-xs text-text-muted">{t("sharedRide.verifiedDriver")}</p>
            </div>
          </div>
        ) : null}

        {mission.vehicle ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
            <VehicleIcon size={20} />
            <span>{mission.vehicle.brand} {mission.vehicle.model} - {mission.vehicle.color} - {mission.vehicle.plateNumber}</span>
          </div>
        ) : null}

        <div className="mt-5 space-y-2 text-sm text-text-secondary">
          {mission.pickupAddress ? <p className="flex gap-2"><MapPin size={16} /> {mission.pickupAddress}</p> : null}
          {mission.destinationAddress ? <p className="flex gap-2"><MapPin size={16} /> {mission.destinationAddress}</p> : null}
        </div>

        {mission.position ? (
          <div className="mt-5 rounded-xl bg-surface-main p-3 text-sm text-text-secondary">
            <p className="flex items-center gap-2"><Clock3 size={16} /> {t(mission.position.isStale ? "sharedRide.positionOld" : "sharedRide.positionRecent", { seconds: mission.position.ageSeconds })}</p>
          </div>
        ) : (
          <p className="mt-5 text-sm text-text-muted">{t("sharedRide.noPosition")}</p>
        )}

        <p className="mt-4 text-xs text-text-muted">{t("sharedRide.lowNetworkNote")}</p>
        {mission.assistancePhone ? (
          <a href={`tel:${String(mission.assistancePhone).replace(/\s+/g, "")}`} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm">
            <PhoneCall size={17} /> {t("sharedRide.callTeranga")}
          </a>
        ) : null}
      </div>
    </main>
  );
}
