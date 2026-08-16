import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Clock, MapPin, Wallet, BadgeCheck, AlertTriangle, Car } from "lucide-react";

import {
  getMissionTrack,
  updateMissionStatus,
  createMissionDispute,
  requestMissionLogistics,
  acceptMission,
  declineMission,
} from "../services/missions";
import MissionTrackingMap from "../features/mission-tracking/MissionTrackingMap";
import AuthFeedbackBanner from "../components/AuthFeedbackBanner";
import { Modal, FormField, Button } from "../components/ui";

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

  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState(null);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  const [requestingLogistics, setRequestingLogistics] = useState(false);
  const [logisticsRequested, setLogisticsRequested] = useState(false);

  const [collectedAmountInput, setCollectedAmountInput] = useState("");

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

  const handleTransition = async (toStatus, extra) => {
    setActionState({ type: "loading" });
    try {
      await updateMissionStatus(id, toStatus, extra);
      await load();
      setActionState(null);
    } catch (_err) {
      setActionState({ type: "error", message: t("missionTracking.errors.action") });
    }
  };

  const handleAcceptCourse = async () => {
    setActionState({ type: "loading" });
    try {
      await acceptMission(id);
      await load();
      setActionState(null);
    } catch (_err) {
      setActionState({ type: "error", message: t("missionTracking.errors.action") });
    }
  };

  const handleDeclineCourse = async () => {
    setActionState({ type: "loading" });
    try {
      await declineMission(id);
      await load();
      setActionState(null);
    } catch (_err) {
      setActionState({ type: "error", message: t("missionTracking.errors.action") });
    }
  };

  function openDisputeModal() {
    setDisputeReason("");
    setDisputeDescription("");
    setDisputeError(null);
    setDisputeSuccess(false);
    setDisputeModalOpen(true);
  }

  async function handleSubmitDispute(event) {
    event.preventDefault();
    if (!disputeReason || disputeDescription.trim().length < 10) return;

    setDisputeSubmitting(true);
    setDisputeError(null);
    try {
      await createMissionDispute(id, { reason: disputeReason, description: disputeDescription.trim() });
      setDisputeSuccess(true);
      await load();
    } catch (_err) {
      setDisputeError(t("missionTracking.disputeModal.error"));
    } finally {
      setDisputeSubmitting(false);
    }
  }

  function handleRequestLogistics() {
    if (!navigator.geolocation) {
      setActionState({ type: "error", message: t("missionTracking.logistics.geolocationUnsupported") });
      return;
    }

    setRequestingLogistics(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await requestMissionLogistics(id, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLogisticsRequested(true);
        } catch (_err) {
          setActionState({ type: "error", message: t("missionTracking.logistics.error") });
        } finally {
          setRequestingLogistics(false);
        }
      },
      () => {
        setRequestingLogistics(false);
        setActionState({ type: "error", message: t("missionTracking.logistics.geolocationError") });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

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

        {track.provider ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface-main/60 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-700 dark:text-blue-300">
              {(track.provider.displayFirstName || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold text-text-primary">
                  {track.provider.displayFirstName}
                </p>
                {track.provider.badgeCertified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700 dark:text-emerald-300">
                    <BadgeCheck size={11} />
                    {t("missionTracking.provider.certified")}
                  </span>
                ) : null}
                {track.provider.plateNumber ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-card px-2 py-0.5 text-[0.65rem] font-medium text-text-secondary">
                    <Car size={11} />
                    {track.provider.plateNumber}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-text-secondary">
                {track.provider.completedMissionsCount > 0
                  ? track.provider.averageRating != null
                    ? t("missionTracking.provider.ratingAndMissions", {
                        rating: Number(track.provider.averageRating).toFixed(1),
                        count: track.provider.completedMissionsCount,
                      })
                    : t("missionTracking.provider.missionsOnly", {
                        count: track.provider.completedMissionsCount,
                      })
                  : t("missionTracking.provider.newProvider")}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <MissionTrackingMap
            latitude={track.position?.latitude}
            longitude={track.position?.longitude}
            destinationLatitude={track.destination?.latitude}
            destinationLongitude={track.destination?.longitude}
          />
        </div>

        {track.pickupAddress ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-text-secondary">
            <MapPin size={14} />
            <span className="font-medium text-text-primary">
              {t(
                track.tradeCategorySlug === "mobilite"
                  ? "missionTracking.departureLabel"
                  : "missionTracking.pickupLabel"
              )}{" "}
              :
            </span>
            {track.pickupAddress}
          </p>
        ) : null}

        {track.destination?.address ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary">
            <MapPin size={14} />
            {track.pickupAddress ? (
              <span className="font-medium text-text-primary">
                {t(
                  track.tradeCategorySlug === "mobilite"
                    ? "missionTracking.destinationLabel"
                    : "missionTracking.dropoffLabel"
                )}{" "}
                :
              </span>
            ) : null}
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

          {track.viewerRole === "client" && track.missionStatus === "COMPLETED" ? (
            <button
              type="button"
              onClick={openDisputeModal}
              className="btn-secondary inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm"
            >
              <AlertTriangle size={14} />
              {t("missionTracking.reportProblemCta")}
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

          {track.viewerRole !== "client" && track.isExecutor && track.acceptanceDeadlineAt ? (
            <>
              <button
                type="button"
                onClick={handleAcceptCourse}
                disabled={actionState?.type === "loading"}
                className="btn-primary rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
              >
                {t("missionTracking.acceptCourseCta")}
              </button>
              <button
                type="button"
                onClick={handleDeclineCourse}
                disabled={actionState?.type === "loading"}
                className="btn-secondary rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
              >
                {t("missionTracking.declineCourseCta")}
              </button>
            </>
          ) : null}

          {track.viewerRole !== "client" &&
          track.isExecutor &&
          !track.acceptanceDeadlineAt &&
          EXECUTOR_NEXT_STATUS[track.missionStatus] ? (
            <div className="flex flex-col gap-2">
              {EXECUTOR_NEXT_STATUS[track.missionStatus] === "COMPLETED" &&
              track.tradeCategorySlug === "livraison" ? (
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={collectedAmountInput}
                  onChange={(event) => setCollectedAmountInput(event.target.value)}
                  placeholder={t("missionTracking.collectedAmountPlaceholder")}
                  className="w-full rounded-full border border-border bg-surface-card px-4 py-2 text-sm text-text-primary"
                />
              ) : null}
              <button
                type="button"
                onClick={() =>
                  handleTransition(
                    EXECUTOR_NEXT_STATUS[track.missionStatus],
                    EXECUTOR_NEXT_STATUS[track.missionStatus] === "COMPLETED" &&
                    track.tradeCategorySlug === "livraison" &&
                    collectedAmountInput.trim() !== ""
                      ? { collectedAmount: Number(collectedAmountInput) }
                      : undefined
                  )
                }
                disabled={actionState?.type === "loading"}
                className="btn-primary rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
              >
                {t(`missionTracking.executorCta.${EXECUTOR_NEXT_STATUS[track.missionStatus]}`)}
              </button>
            </div>
          ) : null}

          {track.viewerRole !== "client" &&
          track.isExecutor &&
          !track.parentServiceId &&
          ["ASSIGNED", "EN_ROUTE"].includes(track.missionStatus) ? (
            <button
              type="button"
              onClick={handleRequestLogistics}
              disabled={requestingLogistics || logisticsRequested}
              className="btn-secondary inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
            >
              <Car size={14} />
              {logisticsRequested
                ? t("missionTracking.logistics.requested")
                : requestingLogistics
                ? t("missionTracking.logistics.requesting")
                : t("missionTracking.logistics.requestCta")}
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

      <Modal
        open={disputeModalOpen}
        onClose={() => setDisputeModalOpen(false)}
        title={t("missionTracking.disputeModal.title")}
      >
        {disputeSuccess ? (
          <div className="mt-3">
            <AuthFeedbackBanner type="success" message={t("missionTracking.disputeModal.success")} />
            <Button
              variant="secondary"
              className="mt-4 rounded-full px-6 py-2.5 text-sm"
              onClick={() => setDisputeModalOpen(false)}
            >
              {t("missionTracking.disputeModal.cancel")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmitDispute} className="mt-4 flex flex-col gap-4">
            <FormField label={t("missionTracking.disputeModal.reasonLabel")} required htmlFor="dispute-reason">
              <select
                id="dispute-reason"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                required
                className="w-full rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
              >
                <option value="" disabled>
                  {t("missionTracking.disputeModal.reasonPlaceholder")}
                </option>
                {["non_conforme", "retard", "comportement", "autre"].map((reason) => (
                  <option key={reason} value={reason}>
                    {t(`missionTracking.disputeModal.reasons.${reason}`)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label={t("missionTracking.disputeModal.descriptionLabel")}
              required
              htmlFor="dispute-description"
              hint={t("missionTracking.disputeModal.descriptionHint")}
            >
              <textarea
                id="dispute-description"
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                required
                minLength={10}
                rows={4}
                placeholder={t("missionTracking.disputeModal.descriptionPlaceholder")}
                className="w-full resize-y rounded-lg border border-border/80 bg-surface-card px-3 py-2 text-sm text-text-primary"
              />
            </FormField>

            {disputeError ? <AuthFeedbackBanner type="error" message={disputeError} /> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={disputeSubmitting} className="rounded-full px-6 py-2.5 text-sm">
                {t("missionTracking.disputeModal.submit")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDisputeModalOpen(false)}
                disabled={disputeSubmitting}
                className="rounded-full px-6 py-2.5 text-sm"
              >
                {t("missionTracking.disputeModal.cancel")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
