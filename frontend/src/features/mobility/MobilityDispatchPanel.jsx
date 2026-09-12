import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bike, CarFront, KeyRound, Loader2, MapPin, PhoneCall, ShieldCheck } from "lucide-react";

import {
  getMobilityDispatchCandidates,
  overrideMissionStart,
  updateMissionAssignment,
} from "../../services/missions";
import DispatchCandidatesMap from "./DispatchCandidatesMap";
import { buildTelHref } from "../../utils/phone";

export default function MobilityDispatchPanel({ missionId, onAssignmentChange }) {
  const { t } = useTranslation();
  const [radiusKm, setRadiusKm] = useState(8);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overridingStart, setOverridingStart] = useState(false);
  const previousCandidateIds = useRef(null);
  const [newCandidateCount, setNewCandidateCount] = useState(0);

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
    setAssignmentSuccess(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!data?.mission || data.mission.providerId) return undefined;
    const refreshTimer = window.setInterval(() => {
      load();
    }, 30000);
    return () => window.clearInterval(refreshTimer);
  }, [data?.mission, load]);

  useEffect(() => {
    if (!data?.candidates) return;
    const currentIds = data.candidates.map((candidate) => `${candidate.provider.id}-${candidate.vehicle.id}`);
    const previousIds = previousCandidateIds.current;
    if (previousIds) {
      const addedCount = currentIds.filter((id) => !previousIds.includes(id)).length;
      if (addedCount > 0) {
        setNewCandidateCount(addedCount);
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.frequency.value = 880;
            gain.gain.setValueAtTime(0.035, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.16);
            oscillator.addEventListener("ended", () => context.close());
          }
        } catch (_error) {
          // Le signal sonore reste facultatif si le navigateur le bloque.
        }
      }
    }
    previousCandidateIds.current = currentIds;
  }, [data?.candidates]);

  const assign = async (candidate) => {
    const isReassignment = mission?.providerId && String(mission.providerId) !== String(candidate.provider.id);
    if (isReassignment && typeof window !== "undefined" && !window.confirm(
      t("mobilityDispatch.confirmReassign", { name: candidate.provider.displayFirstName })
    )) {
      return;
    }
    setAssigningId(candidate.provider.id);
    setError(null);
    setAssignmentSuccess(null);
    try {
      await updateMissionAssignment(missionId, {
        providerId: candidate.provider.id,
        vehicleId: candidate.vehicle.id,
      });
      await load();
      setAssignmentSuccess(
        t("mobilityDispatch.assignedTo", { name: candidate.provider.displayFirstName })
      );
      await onAssignmentChange?.();
    } catch (requestError) {
      const status = requestError?.response?.status;
      const code = requestError?.response?.data?.code;
      const isConflict = status === 409 || status === 423 || ["PROVIDER_BUSY", "MISSION_ALREADY_ASSIGNED"].includes(code);
      if (isConflict) {
        await load();
        setError(t("mobilityDispatch.errors.conflict"));
      } else {
        setError(requestError?.response?.data?.error || t("mobilityDispatch.errors.assign"));
      }
    } finally {
      setAssigningId(null);
    }
  };

  const overrideStart = async () => {
    if (overrideReason.trim().length < 10) return;
    setOverridingStart(true);
    setError(null);
    try {
      await overrideMissionStart(missionId, overrideReason.trim());
      setOverrideReason("");
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t("mobilityDispatch.errors.override"));
    } finally {
      setOverridingStart(false);
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
        <div role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
          <Loader2 size={17} className="animate-spin" /> {t("mobilityDispatch.loading")}
        </div>
      ) : mission ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="order-2 lg:order-1">
            <DispatchCandidatesMap mission={mission} candidates={candidates} />
          </div>
          <div className="order-1 lg:order-2">
            {mission.providerId ? (
              <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                {assignmentSuccess || t("mobilityDispatch.assigned")}
              </div>
            ) : null}
            {!mission.providerId && newCandidateCount > 0 ? (
              <div role="status" aria-live="polite" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                <span>{t("mobilityDispatch.newCandidates", { count: newCandidateCount })}</span>
                <button type="button" onClick={() => setNewCandidateCount(0)} className="shrink-0 font-semibold underline underline-offset-2">
                  {t("mobilityDispatch.dismiss")}
                </button>
              </div>
            ) : null}
            {!mission.providerId ? (
              <p className="mb-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
                {t("mobilityDispatch.autoRefresh")}
              </p>
            ) : null}
            {mission.startCode ? (
              <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                <p className="flex items-center justify-center gap-2 text-xs font-semibold text-text-secondary">
                  <KeyRound size={14} /> {t("mobilityDispatch.startCode")}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-text-primary">{mission.startCode}</p>
              </div>
            ) : null}
            {buildTelHref(mission.assistancePhone) ? (
              <a href={buildTelHref(mission.assistancePhone)} className="btn-secondary mb-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-xs">
                <PhoneCall size={14} /> {t("mobilityDispatch.callAssistance")}
              </a>
            ) : null}
            {mission.missionStatus === "ON_SITE" && !mission.startAuthorizedAt ? (
              <div className="mb-3 rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-text-primary">{t("mobilityDispatch.overrideTitle")}</p>
                <textarea
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value.slice(0, 500))}
                  rows={2}
                  placeholder={t("mobilityDispatch.overridePlaceholder")}
                  className="app-input mt-2 w-full text-xs"
                />
                <button
                  type="button"
                  onClick={overrideStart}
                  disabled={overrideReason.trim().length < 10 || overridingStart}
                  className="btn-secondary mt-2 w-full rounded-full px-4 py-2 text-xs disabled:opacity-50"
                >
                  {overridingStart ? t("mobilityDispatch.overriding") : t("mobilityDispatch.overrideCta")}
                </button>
              </div>
            ) : null}
            {!candidates.length ? (
              <div className="rounded-xl border border-border bg-surface-main/60 p-5 text-sm text-text-muted">
                <p>{t("mobilityDispatch.empty", { radius: radiusKm })}</p>
                <button type="button" onClick={load} disabled={loading} className="btn-secondary mt-3 rounded-full px-4 py-2 text-xs disabled:opacity-50">
                  {loading ? t("mobilityDispatch.loading") : t("mobilityDispatch.refresh")}
                </button>
              </div>
            ) : (
              <>
                {!mission.providerId && candidates[0] ? (
                  <button
                    type="button"
                    disabled={Boolean(assigningId)}
                    onClick={() => assign(candidates[0])}
                    className="btn-primary mb-3 flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-bold disabled:opacity-50"
                  >
                    {assigningId === candidates[0].provider.id
                      ? t("mobilityDispatch.assigning")
                      : t("mobilityDispatch.assignBest")}
                  </button>
                ) : null}
              <ol className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                {candidates.map((candidate, index) => {
                  const Icon = candidate.vehicle.vehicleType === "motorcycle" ? Bike : CarFront;
                  const hasApproachEstimate =
                    candidate.approachDurationSeconds != null &&
                    candidate.approachDistanceMeters != null &&
                    Number.isFinite(Number(candidate.approachDurationSeconds)) &&
                    Number.isFinite(Number(candidate.approachDistanceMeters));
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
                        <Metric icon={MapPin} value={hasApproachEstimate ? `${Math.max(1, Math.round(candidate.approachDurationSeconds / 60))} min` : "—"} label={t("mobilityDispatch.eta")} />
                        <Metric value={hasApproachEstimate ? `${(candidate.approachDistanceMeters / 1000).toFixed(1)} km` : "—"} label={t("mobilityDispatch.distance")} />
                        <Metric icon={ShieldCheck} value={`${candidate.reliabilityScore}/100`} label={t("mobilityDispatch.reliability")} />
                      </div>
                      <p className="mt-2 text-[11px] text-text-muted">
                        {candidate.location
                          ? t("mobilityDispatch.gpsAge", { seconds: candidate.location.ageSeconds })
                          : t("mobilityDispatch.positionUnavailable")}
                        {candidate.distanceSource === "straight_line_fallback" ? ` · ${t("mobilityDispatch.fallback")}` : ""}
                      </p>
                      {buildTelHref(candidate.provider.phone || candidate.provider.user?.phone) ? (
                        <a href={buildTelHref(candidate.provider.phone || candidate.provider.user?.phone)} className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-xs">
                          <PhoneCall size={14} /> {t("mobilityDispatch.callDriver")}
                        </a>
                      ) : null}
                      <button
                        type="button"
                        disabled={Boolean(assigningId) || String(mission.providerId || "") === String(candidate.provider.id)}
                        onClick={() => assign(candidate)}
                        className="btn-primary mt-3 w-full rounded-full px-4 py-2 text-xs disabled:opacity-50"
                      >
                        {assigningId === candidate.provider.id
                          ? t("mobilityDispatch.assigning")
                          : mission.providerId
                          ? t("mobilityDispatch.reassign")
                          : t("mobilityDispatch.assign")}
                      </button>
                    </li>
                  );
                })}
              </ol>
              </>
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
