import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Clock, MapPin, Wallet } from "lucide-react";

import { getMissionTrack, updateMissionStatus } from "../services/missions";
import MissionTrackingMap from "../features/mission-tracking/MissionTrackingMap";
import AuthFeedbackBanner from "../components/AuthFeedbackBanner";

// Même idiome que NavBar.js (poll notifications) : intervalle configurable, pause si l'onglet
// n'est pas visible — docs/DEV_SPEC_TERANGA_v3.md section 4.2 recommande 5-10s.
const TRACK_POLL_MS = (() => {
  const raw = Number.parseInt(String(process.env.REACT_APP_MISSION_TRACK_POLL_MS || ""), 10);
  if (!Number.isFinite(raw) || raw < 5000) return 8000;
  return raw;
})();

const TERMINAL_STATUSES = [
  "CLOSED",
  "CANCELLED_BY_CLIENT",
  "NO_EXECUTOR_FOUND",
  "VALIDATED",
  "RESOLVED_REFUND",
  "RESOLVED_REDO",
  "RESOLVED_CLOSED",
];

// Action suivante pour un exécutant (agent ou prestataire) — supervision passive : un agent
// superviseur (isExecutor=false) ne voit jamais ces boutons, voir mission.controller.js
// updateStatus.
const EXECUTOR_NEXT_STATUS = {
  ASSIGNED: "EN_ROUTE",
  EN_ROUTE: "ON_SITE",
  ON_SITE: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export default function MissionTrackingPage() {
  const { t } = useTranslation();
  const { id } = useParams();

  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionState, setActionState] = useState(null);

  const trackRef = useRef(track);
  trackRef.current = track;

  const load = useCallback(async () => {
    try {
      const data = await getMissionTrack(id);
      setTrack(data);
      setError(null);
    } catch (_err) {
      setError(t("missionTracking.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();

    function refreshIfVisible() {
      if (!isDocumentVisible()) return;
      if (trackRef.current && TERMINAL_STATUSES.includes(trackRef.current.missionStatus)) return;
      load();
    }

    const interval = setInterval(refreshIfVisible, TRACK_POLL_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [load]);

  const handleTransition = async (toStatus) => {
    setActionState({ type: "loading" });
    try {
      await updateMissionStatus(id, toStatus);
      await load();
      setActionState(null);
    } catch (_err) {
      setActionState({ type: "error", message: t("missionTracking.errors.action") });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-text-muted" size={28} />
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <AuthFeedbackBanner type="error" message={error || t("missionTracking.errors.load")} />
        <Link to="/services" className="btn-secondary mt-4 inline-block rounded-full px-6 py-2.5 text-sm">
          {t("missionTracking.backToServices")}
        </Link>
      </div>
    );
  }

  const statusLabel = t(`missionTracking.status.${track.missionStatus}`, {
    defaultValue: track.missionStatus,
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="page-kicker">{t("missionTracking.kicker")}</p>
      <h1 className="app-page-headline">{track.title || t("missionTracking.title")}</h1>

      <div className="mt-6 rounded-2xl border border-border bg-surface-card p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300">
            {statusLabel}
          </span>
          {track.etaMinutes != null ? (
            <span className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Clock size={15} />
              {t("missionTracking.eta", { minutes: track.etaMinutes })}
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          <MissionTrackingMap
            latitude={track.position?.latitude}
            longitude={track.position?.longitude}
            destinationLatitude={track.destination?.latitude}
            destinationLongitude={track.destination?.longitude}
          />
        </div>

        {track.destination?.address ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-text-secondary">
            <MapPin size={14} />
            {track.destination.address}
          </p>
        ) : null}

        {track.budget != null ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-text-primary">
            <Wallet size={14} />
            {track.budget}{" "}
            {t(`currency.${String(track.currency || "XOF").toUpperCase()}`, {
              defaultValue: String(track.currency || "XOF").toUpperCase(),
            })}
          </p>
        ) : null}

        {!track.position ? (
          <p className="mt-3 text-sm text-text-muted">{t("missionTracking.noPositionYet")}</p>
        ) : null}

        {actionState?.type === "error" ? (
          <div className="mt-4">
            <AuthFeedbackBanner type="error" message={actionState.message} />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {track.viewerRole === "client" && track.missionStatus === "COMPLETED" ? (
            <button
              type="button"
              onClick={() => handleTransition("VALIDATED")}
              disabled={actionState?.type === "loading"}
              className="btn-primary rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
            >
              {t("missionTracking.validateCta")}
            </button>
          ) : null}

          {track.viewerRole === "client" && ["ASSIGNED", "EN_ROUTE"].includes(track.missionStatus) ? (
            <button
              type="button"
              onClick={() => handleTransition("CANCELLED_BY_CLIENT")}
              disabled={actionState?.type === "loading"}
              className="btn-secondary rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
            >
              {t("missionTracking.cancelCta")}
            </button>
          ) : null}

          {track.viewerRole !== "client" && track.isExecutor && EXECUTOR_NEXT_STATUS[track.missionStatus] ? (
            <button
              type="button"
              onClick={() => handleTransition(EXECUTOR_NEXT_STATUS[track.missionStatus])}
              disabled={actionState?.type === "loading"}
              className="btn-primary rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
            >
              {t(`missionTracking.executorCta.${EXECUTOR_NEXT_STATUS[track.missionStatus]}`)}
            </button>
          ) : null}

          {track.viewerRole !== "client" && !track.isExecutor ? (
            <p className="text-sm text-text-muted">{t("missionTracking.supervisorReadOnly")}</p>
          ) : null}

          <Link
            to={track.viewerRole === "client" ? "/services" : "/missions/mine"}
            className="btn-secondary rounded-full px-6 py-2.5 text-sm"
          >
            {track.viewerRole === "client"
              ? t("missionTracking.backToServices")
              : t("missionTracking.backToMyMissions")}
          </Link>
        </div>
      </div>
    </div>
  );
}
