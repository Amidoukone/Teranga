import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Clock, MapPin, Wallet, BadgeCheck, AlertTriangle, Car, Bike, KeyRound, PhoneCall, RefreshCw, Share2, Star } from "lucide-react";

import {
  getMissionTrack,
  pingMissionLocation,
  updateMissionStatus,
  createMissionDispute,
  requestMissionLogistics,
  acceptMission,
  declineMission,
  verifyMissionStartCode,
  createMissionShare,
  createMissionRating,
} from "../services/missions";
import MissionTrackingMap from "../features/mission-tracking/MissionTrackingMap";
import AuthFeedbackBanner from "../components/AuthFeedbackBanner";
import { Modal, FormField, Button } from "../components/ui";
import { buildTelHref } from "../utils/phone";

// Même idiome que NavBar.js (poll notifications) : intervalle configurable, pause si l'onglet
// n'est pas visible — docs/DEV_SPEC_TERANGA_v3.md section 4.2 recommande 5-10s.
const TRACK_POLL_MS = (() => {
  const raw = Number.parseInt(String(process.env.REACT_APP_MISSION_TRACK_POLL_MS || ""), 10);
  if (!Number.isFinite(raw) || raw < 5000) return 15000;
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

const RATING_STATUSES = [
  "COMPLETED",
  "VALIDATED",
  "CLOSED",
  "DISPUTED",
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

const CLIENT_RIDE_STATUS = {
  CREATED: { icon: Clock, tone: "border-slate-500/25 bg-slate-500/10 text-text-primary" },
  SEARCHING_EXECUTOR: { icon: Clock, tone: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100" },
  ASSIGNED: { icon: Car, tone: "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-100" },
  EN_ROUTE: { icon: Car, tone: "border-blue-500/40 bg-blue-500/15 text-blue-900 dark:text-blue-100" },
  ON_SITE: { icon: MapPin, tone: "border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100" },
  IN_PROGRESS: { icon: Car, tone: "border-violet-500/30 bg-violet-500/10 text-violet-900 dark:text-violet-100" },
  COMPLETED: { icon: BadgeCheck, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" },
};

const DRIVER_LOCATION_POLL_MS = (() => {
  const raw = Number.parseInt(String(process.env.REACT_APP_DRIVER_LOCATION_POLL_MS || ""), 10);
  if (!Number.isFinite(raw) || raw < 30000) return 60000;
  return raw;
})();

const CLIENT_RIDE_PROGRESS_STEPS = [
  { key: "driver", status: "ASSIGNED" },
  { key: "enRoute", status: "EN_ROUTE" },
  { key: "arrived", status: "ON_SITE" },
  { key: "trip", status: "IN_PROGRESS" },
];

const CLIENT_RIDE_PROGRESS_INDEX = {
  CREATED: -1,
  SEARCHING_EXECUTOR: -1,
  ASSIGNED: 0,
  EN_ROUTE: 1,
  ON_SITE: 2,
  IN_PROGRESS: 3,
  COMPLETED: 3,
  VALIDATED: 3,
  CLOSED: 3,
};

function ClientRideStatus({ status, t }) {
  const config = CLIENT_RIDE_STATUS[status];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 ${config.tone}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-card/80 shadow-sm">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-bold">
          {t(`taxiRides.liveStatus.${status}.title`)}
        </p>
        <p className="mt-1 text-sm opacity-80">
          {t(`taxiRides.liveStatus.${status}.hint`)}
        </p>
      </div>
    </div>
  );
}

function ClientRideProgress({ status, t }) {
  const currentIndex = CLIENT_RIDE_PROGRESS_INDEX[status] ?? -1;

  return (
    <ol
      className="mt-3 grid grid-cols-4 gap-1 rounded-2xl border border-border/70 bg-surface-card p-3"
      aria-label={t("taxiRides.progress.label")}
    >
      {CLIENT_RIDE_PROGRESS_STEPS.map((step, index) => {
        const complete = index < currentIndex || (currentIndex === 3 && index === 3 && ["COMPLETED", "VALIDATED", "CLOSED"].includes(status));
        const current = index === currentIndex && !complete;
        return (
          <li
            key={step.status}
            aria-label={t(`taxiRides.progress.${step.key}`)}
            aria-current={current ? "step" : undefined}
            className="flex min-w-0 flex-col items-center text-center"
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${
                complete
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : current
                  ? "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-500/15"
                  : "border-border bg-surface-main text-text-muted"
              }`}
            >
              {complete ? "✓" : index + 1}
            </span>
            <span className={`mt-1.5 text-[10px] leading-tight sm:text-xs ${current || complete ? "font-semibold text-text-primary" : "text-text-muted"}`}>
              {t(`taxiRides.progress.${step.key}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export default function MissionTrackingPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const isRideRoute = location.pathname.startsWith("/courses/");

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
  const [startCodeInput, setStartCodeInput] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  const trackRef = useRef(track);
  const locationPermissionDeniedRef = useRef(false);
  trackRef.current = track;

  const load = useCallback(async ({ skipEta = false } = {}) => {
    try {
      const data = await getMissionTrack(id, skipEta ? { skipEta: 1 } : {});
      setTrack((current) =>
        skipEta && data?.etaMinutes == null && current?.etaMinutes != null
          ? { ...data, etaMinutes: current.etaMinutes }
          : data
      );
      setError(null);
    } catch (_err) {
      setError(t("missionTracking.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();

    function refreshSilentlyIfVisible() {
      if (!isDocumentVisible()) return;
      if (trackRef.current && TERMINAL_STATUSES.includes(trackRef.current.missionStatus)) return;
      load({ skipEta: true });
    }

    function refreshFullyIfVisible() {
      if (!isDocumentVisible()) return;
      if (trackRef.current && TERMINAL_STATUSES.includes(trackRef.current.missionStatus)) return;
      load();
    }

    const interval = setInterval(refreshSilentlyIfVisible, TRACK_POLL_MS);
    window.addEventListener("focus", refreshFullyIfVisible);
    document.addEventListener("visibilitychange", refreshFullyIfVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshFullyIfVisible);
      document.removeEventListener("visibilitychange", refreshFullyIfVisible);
    };
  }, [load]);

  useEffect(() => {
    const shouldReportLocation =
      track?.viewerRole !== "client" &&
      track?.isExecutor &&
      track?.tradeCategorySlug === "mobilite" &&
      ["EN_ROUTE", "ON_SITE"].includes(track?.missionStatus);
    if (
      !shouldReportLocation ||
      typeof navigator === "undefined" ||
      !navigator.geolocation ||
      locationPermissionDeniedRef.current
    ) {
      return undefined;
    }

    let active = true;
    let inFlight = false;
    const reportLocation = () => {
      if (!active || inFlight || locationPermissionDeniedRef.current) return;
      inFlight = true;
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!active) return;
          const accuracy =
            position.coords.accuracy == null ? null : Number(position.coords.accuracy);
          const heading =
            position.coords.heading == null ? null : Number(position.coords.heading);
          try {
            await pingMissionLocation(id, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: accuracy != null && Number.isFinite(accuracy) ? accuracy : null,
              headingDegrees: heading != null && Number.isFinite(heading) ? heading : null,
            });
          } catch (_error) {
            // Best effort : le statut et la course restent utilisables avec un réseau faible.
          } finally {
            inFlight = false;
          }
        },
        (positionError) => {
          if (positionError?.code === 1) locationPermissionDeniedRef.current = true;
          inFlight = false;
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    };

    reportLocation();
    const interval =
      track.missionStatus === "EN_ROUTE"
        ? window.setInterval(reportLocation, DRIVER_LOCATION_POLL_MS)
        : null;

    return () => {
      active = false;
      if (interval) window.clearInterval(interval);
    };
  }, [
    id,
    track?.isExecutor,
    track?.missionStatus,
    track?.tradeCategorySlug,
    track?.viewerRole,
  ]);

  const handleTransition = async (toStatus, extra) => {
    setActionState({ type: "loading" });
    try {
      await updateMissionStatus(id, toStatus, extra);
      await load();
      setActionState(null);
    } catch (requestError) {
      setActionState({
        type: "error",
        message: requestError?.response?.data?.error || t("missionTracking.errors.action"),
      });
    }
  };

  const handleVerifyStartCode = async () => {
    if (!/^\d{4}$/.test(startCodeInput)) {
      setActionState({ type: "error", message: t("missionTracking.startCode.invalid") });
      return;
    }
    setActionState({ type: "loading" });
    try {
      await verifyMissionStartCode(id, startCodeInput);
      setStartCodeInput("");
      await load();
      setActionState(null);
    } catch (requestError) {
      setActionState({
        type: "error",
        message:
          requestError?.response?.data?.error || t("missionTracking.startCode.error"),
      });
    }
  };

  const handleShare = async () => {
    setActionState({ type: "loading" });
    try {
      const share = await createMissionShare(id, 6);
      const url = new URL(share.path, window.location.origin).toString();
      setShareUrl(url);
      if (navigator.share) {
        await navigator.share({ title: track.title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setActionState(null);
    } catch (requestError) {
      if (requestError?.name === "AbortError") {
        setActionState(null);
      } else {
        setActionState({
          type: "error",
          message: requestError?.response?.data?.error || t("missionTracking.share.error"),
        });
      }
    }
  };

  const handleRating = async (event) => {
    event.preventDefault();
    if (!ratingScore) return;
    setActionState({ type: "loading" });
    try {
      await createMissionRating(id, {
        score: ratingScore,
        comment: ratingComment.trim() || null,
      });
      await load();
      setActionState(null);
    } catch (requestError) {
      setActionState({
        type: "error",
        message: requestError?.response?.data?.error || t("missionTracking.rating.error"),
      });
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
        <Link to={isRideRoute ? "/courses" : "/services"} className="btn-secondary mt-4 inline-block rounded-full px-6 py-2.5 text-sm">
          {isRideRoute ? t("taxiRides.backToRides") : t("missionTracking.backToServices")}
        </Link>
      </div>
    );
  }

  const clientTaxiView =
    track.viewerRole === "client" && track.tradeCategorySlug === "mobilite";
  const statusLabel = t(`${clientTaxiView ? "taxiRides.status" : "missionTracking.status"}.${track.missionStatus}`, {
    defaultValue: track.missionStatus,
  });
  const requiresStartCode =
    track.viewerRole !== "client" &&
    track.isExecutor &&
    track.tradeCategorySlug === "mobilite" &&
    track.missionStatus === "ON_SITE";
  const stickyExecutorNextStatus =
    track.viewerRole !== "client" &&
    track.isExecutor &&
    !track.acceptanceDeadlineAt &&
    track.tradeCategorySlug === "mobilite" &&
    ["ASSIGNED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"].includes(track.missionStatus)
      ? EXECUTOR_NEXT_STATUS[track.missionStatus]
      : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="page-kicker">
        {track.tradeCategorySlug === "mobilite" ? "Teranga Taxi" : t("missionTracking.kicker")}
      </p>
      <div className="flex items-start justify-between gap-3">
        <h1 className="app-page-headline">
          {track.tradeCategorySlug === "mobilite"
            ? t("taxiRides.rideReference", { id })
            : track.title || t("missionTracking.title")}
        </h1>
        <button
          type="button"
          onClick={() => load()}
          className="btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs"
        >
          <RefreshCw size={14} /> {t("missionTracking.refresh")}
        </button>
      </div>

      {clientTaxiView ? (
        <>
          <ClientRideStatus status={track.missionStatus} t={t} />
          <ClientRideProgress status={track.missionStatus} t={t} />
        </>
      ) : null}

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
            {track.provider.profilePhotoUrl ? (
              <img
                src={track.provider.profilePhotoUrl}
                alt={track.provider.displayFirstName || ""}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-700 dark:text-blue-300">
                {(track.provider.displayFirstName || "?").charAt(0).toUpperCase()}
              </div>
            )}
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

        {track.vehicle ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-card text-blue-700 dark:text-blue-300">
              {track.vehicle.vehicleType === "motorcycle" ? <Bike size={18} /> : <Car size={18} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {t(`missionTracking.provider.vehicle.${track.vehicle.vehicleType}`, {
                  brand: track.vehicle.brand,
                  model: track.vehicle.model,
                })}
              </p>
              <p className="text-xs text-text-secondary">
                {t("missionTracking.provider.vehicle.identity", {
                  color: track.vehicle.color,
                  plate: track.vehicle.plateNumber,
                })}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {track.vehicle.hasPassengerHelmet ? (
                  <span className="app-badge app-badge-success text-[0.65rem]">
                    {t("missionTracking.provider.vehicle.passengerHelmet")}
                  </span>
                ) : null}
                {track.vehicle.hasAirConditioning ? (
                  <span className="app-badge app-badge-info text-[0.65rem]">
                    {t("missionTracking.provider.vehicle.airConditioning")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {track.viewerRole === "client" && track.startCode ? (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
              <KeyRound size={17} /> {t("missionTracking.startCode.clientTitle")}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-text-primary">
              {track.startCode}
            </p>
            <p className="mt-2 text-xs text-text-muted">{t("missionTracking.startCode.clientHint")}</p>
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

        {track.position?.isStale ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            {t("missionTracking.positionOld", { seconds: track.position.ageSeconds })}
          </p>
        ) : null}

        {!track.position ? (
          <p className="mt-3 text-sm text-text-muted">{t("missionTracking.noPositionYet")}</p>
        ) : null}

        <p className="mt-2 text-xs text-text-muted">{t("missionTracking.lowNetworkNote")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {buildTelHref(track.assistancePhone) ? (
            <a
              href={buildTelHref(track.assistancePhone)}
              className="btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
            >
              <PhoneCall size={15} /> {t("missionTracking.callTeranga")}
            </a>
          ) : null}
          {track.viewerRole === "client" ? (
            <button
              type="button"
              onClick={handleShare}
              disabled={actionState?.type === "loading"}
              className="btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm disabled:opacity-60"
            >
              <Share2 size={15} /> {t("missionTracking.share.cta")}
            </button>
          ) : null}
        </div>
        {shareUrl ? (
          <input
            readOnly
            value={shareUrl}
            onFocus={(event) => event.target.select()}
            className="mt-2 w-full rounded-lg border border-border bg-surface-main px-3 py-2 text-xs text-text-secondary"
            aria-label={t("missionTracking.share.linkLabel")}
          />
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
            <div className={stickyExecutorNextStatus ? "hidden md:flex md:flex-col md:gap-2" : "flex flex-col gap-2"}>
              {requiresStartCode ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <label className="mb-2 block text-xs font-semibold text-text-primary" htmlFor="mission-start-code">
                    {t("missionTracking.startCode.driverTitle")}
                  </label>
                  <input
                    id="mission-start-code"
                    value={startCodeInput}
                    onChange={(event) => setStartCodeInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="0000"
                    className="w-full rounded-full border border-border bg-surface-card px-4 py-2 text-center font-mono text-lg tracking-[0.3em] text-text-primary"
                  />
                  <p className="mt-2 text-[11px] text-text-muted">{t("missionTracking.startCode.driverHint")}</p>
                </div>
              ) : null}
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
                  requiresStartCode
                    ? handleVerifyStartCode()
                    : handleTransition(
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
                {requiresStartCode
                  ? t("missionTracking.startCode.verifyCta")
                  : t(`missionTracking.executorCta.${EXECUTOR_NEXT_STATUS[track.missionStatus]}`)}
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
            to={
              track.tradeCategorySlug === "mobilite"
                ? track.viewerRole === "client"
                  ? "/courses"
                  : "/chauffeur/courses"
                : track.viewerRole === "client"
                ? "/services"
                : "/missions/mine"
            }
            className="btn-secondary rounded-full px-6 py-2.5 text-sm"
          >
            {track.tradeCategorySlug === "mobilite"
              ? t("taxiRides.backToRides")
              : track.viewerRole === "client"
              ? t("missionTracking.backToServices")
              : t("missionTracking.backToMyMissions")}
          </Link>
        </div>

        {track.viewerRole === "client" && track.rating ? (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">
              {t("missionTracking.rating.saved", { score: track.rating.score })}
            </p>
          </div>
        ) : null}

        {track.viewerRole === "client" &&
        !track.rating &&
        RATING_STATUSES.includes(track.missionStatus) ? (
          <form onSubmit={handleRating} className="mt-5 rounded-xl border border-border bg-surface-main/60 p-4">
            <p className="font-semibold text-text-primary">{t("missionTracking.rating.title")}</p>
            <div className="mt-3 flex gap-1" role="radiogroup" aria-label={t("missionTracking.rating.title")}>
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  role="radio"
                  aria-checked={ratingScore === score}
                  onClick={() => setRatingScore(score)}
                  className={ratingScore >= score ? "text-amber-500" : "text-text-muted"}
                  aria-label={t("missionTracking.rating.star", { score })}
                >
                  <Star size={27} fill={ratingScore >= score ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
            <textarea
              value={ratingComment}
              onChange={(event) => setRatingComment(event.target.value.slice(0, 500))}
              rows={3}
              placeholder={t("missionTracking.rating.commentPlaceholder")}
              className="mt-3 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-text-primary"
            />
            <button
              type="submit"
              disabled={!ratingScore || actionState?.type === "loading"}
              className="btn-primary mt-3 rounded-full px-5 py-2 text-sm disabled:opacity-50"
            >
              {t("missionTracking.rating.submit")}
            </button>
          </form>
        ) : null}
      </div>

      {stickyExecutorNextStatus ? (
        <div className="fixed inset-x-0 bottom-24 z-40 px-3 md:hidden">
          <div className="mx-auto max-w-md rounded-3xl border border-border/70 bg-surface-card/95 p-3 shadow-2xl backdrop-blur-xl">
            {requiresStartCode ? (
              <div className="mb-2">
                <label className="mb-1.5 block text-center text-xs font-semibold text-text-primary" htmlFor="mission-start-code-mobile">
                  {t("missionTracking.startCode.driverTitle")}
                </label>
                <input
                  id="mission-start-code-mobile"
                  value={startCodeInput}
                  onChange={(event) => setStartCodeInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="0000"
                  className="w-full rounded-2xl border border-border bg-surface-card px-4 py-2 text-center font-mono text-lg tracking-[0.3em] text-text-primary"
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() =>
                requiresStartCode
                  ? handleVerifyStartCode()
                  : handleTransition(stickyExecutorNextStatus)
              }
              disabled={actionState?.type === "loading"}
              className="btn-primary flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-6 text-base font-bold disabled:opacity-60"
            >
              {actionState?.type === "loading" ? <Loader2 className="animate-spin" size={20} /> : null}
              {requiresStartCode
                ? t("missionTracking.startCode.verifyCta")
                : t(`missionTracking.executorCta.${stickyExecutorNextStatus}`)}
            </button>
          </div>
        </div>
      ) : null}

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
