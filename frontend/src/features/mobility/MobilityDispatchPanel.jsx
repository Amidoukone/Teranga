import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bike, CarFront, Loader2, MapPin, ShieldCheck } from "lucide-react";

import {
  getMobilityDispatchCandidates,
  updateMissionAssignment,
} from "../../services/missions";
import DispatchCandidatesMap from "./DispatchCandidatesMap";

export default function MobilityDispatchPanel({ missionId }) {
  const { t } = useTranslation();
  const [radiusKm, setRadiusKm] = useState(8);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assigningId, setAssigningId] = useState(null);

  const load = useCallback(async () => {
    if (!missionId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getMobilityDispatchCandidates(missionId, { radiusKm, limit: 15 }));
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t("mobilityDispatch.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [missionId, radiusKm, t]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (candidate) => {
    setAssigningId(candidate.provider.id);
    setError(null);
    try {
      await updateMissionAssignment(missionId, {
        providerId: candidate.provider.id,
        vehicleId: candidate.vehicle.id,
      });
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t("mobilityDispatch.errors.assign"));
    } finally {
      setAssigningId(null);
    }
  };

  const mission = data?.mission;
  const candidates = data?.candidates || [];

  return (
    <section className="rounded-[28px] border border-border/70 bg-surface-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-kicker">{t("mobilityDispatch.kicker")}</p>
          <h2 className="text-xl font-semibold text-text-primary">
            {t("mobilityDispatch.title", { id: missionId })}
          </h2>
          {mission ? (
            <p className="mt-1 text-sm text-text-secondary">
              {mission.pickupAddress || t("mobilityDispatch.map.pickup")} → {mission.destinationAddress || t("mobilityDispatch.map.destination")}
            </p>
          ) : null}
        </div>
        <label className="text-xs font-medium text-text-secondary">
          {t("mobilityDispatch.radius")}
          <select
            className="app-input mt-1 min-w-32"
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value))}
          >
            {[5, 8, 15, 25, 50].map((radius) => (
              <option key={radius} value={radius}>{radius} km</option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
          <Loader2 size={17} className="animate-spin" /> {t("mobilityDispatch.loading")}
        </div>
      ) : mission ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <DispatchCandidatesMap mission={mission} candidates={candidates} />
          <div>
            {mission.providerId ? (
              <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                {t("mobilityDispatch.assigned")}
              </div>
            ) : null}
            {!candidates.length ? (
              <div className="rounded-xl border border-border bg-surface-main/60 p-5 text-sm text-text-muted">
                {t("mobilityDispatch.empty", { radius: radiusKm })}
              </div>
            ) : (
              <ol className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                {candidates.map((candidate, index) => {
                  const Icon = candidate.vehicle.vehicleType === "motorcycle" ? Bike : CarFront;
                  return (
                    <li key={`${candidate.provider.id}-${candidate.vehicle.id}`} className="rounded-xl border border-border bg-surface-main/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">{index + 1}</span>
                          <div className="min-w-0">
                            <p className="font-semibold text-text-primary">{candidate.provider.displayFirstName}</p>
                            <p className="flex items-center gap-1 text-xs text-text-secondary">
                              <Icon size={13} /> {candidate.vehicle.brand} {candidate.vehicle.model} · {candidate.vehicle.plateNumber}
                            </p>
                          </div>
                        </div>
                        <span className="app-badge app-badge-success">{candidate.rankingScore}/100</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <Metric icon={MapPin} value={`${Math.max(1, Math.round(candidate.approachDurationSeconds / 60))} min`} label={t("mobilityDispatch.eta")} />
                        <Metric value={`${(candidate.approachDistanceMeters / 1000).toFixed(1)} km`} label={t("mobilityDispatch.distance")} />
                        <Metric icon={ShieldCheck} value={`${candidate.reliabilityScore}/100`} label={t("mobilityDispatch.reliability")} />
                      </div>
                      <p className="mt-2 text-[11px] text-text-muted">
                        {t("mobilityDispatch.gpsAge", { seconds: candidate.location.ageSeconds })}
                        {candidate.distanceSource !== "google" ? ` · ${t("mobilityDispatch.fallback")}` : ""}
                      </p>
                      <button
                        type="button"
                        disabled={Boolean(assigningId) || Boolean(mission.providerId)}
                        onClick={() => assign(candidate)}
                        className="btn-primary mt-3 w-full rounded-full px-4 py-2 text-xs disabled:opacity-50"
                      >
                        {assigningId === candidate.provider.id ? t("mobilityDispatch.assigning") : t("mobilityDispatch.assign")}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ icon: Icon, value, label }) {
  return (
    <div className="rounded-lg bg-surface-card p-2">
      <p className="flex items-center justify-center gap-1 font-semibold text-text-primary">{Icon ? <Icon size={12} /> : null}{value}</p>
      <p className="mt-0.5 text-[10px] text-text-muted">{label}</p>
    </div>
  );
}
