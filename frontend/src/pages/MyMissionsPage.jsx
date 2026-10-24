import AgentCoordinationPanel from '../features/mission-tracking/AgentCoordinationPanel';
// frontend/src/pages/MyMissionsPage.jsx
// "Mes missions" — portail agent (superviseur ou exécutant) / prestataire exécutant sur les
// missions filière (executionType='provider', voir docs/DEV_SPEC_TERANGA_v3.md section 2/3).
// Les missions classiques agent (executionType='agent') restent sur AgentServicesPage.js /
// GET /services/agent/services — non dupliquées ici (GET /v1/missions/mine les exclut déjà).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bike, CarFront, Check, Loader2, MapPin, PackageCheck, Power, X } from 'lucide-react';
import { me } from '../services/auth';
import { normalizeRole } from '../utils/role';
import { isRequestHistory } from '../utils/requestLifecycle';
import { acceptMission, declineMission, getMyMissions } from '../services/missions';
import {
  getMyDispatchPresence,
  getMyProvider,
  updateMyAvailability,
  updateMyLiveLocation,
} from '../services/providers';

const DRIVER_RIDES_POLL_MS = (() => {
  const raw = Number.parseInt(String(process.env.REACT_APP_DRIVER_RIDES_POLL_MS || ''), 10);
  if (!Number.isFinite(raw) || raw < 30000) return 60000;
  return raw;
})();

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function displayClient(client) {
  if (!client) return null;
  const name = [client.firstName, client.lastName].filter(Boolean).join(' ');
  return [name || null, client.phone || null].filter(Boolean).join(' · ') || null;
}

function statusBadgeClass(missionStatus) {
  switch (missionStatus) {
    case 'ASSIGNED':
      return 'app-badge app-badge-info';
    case 'EN_ROUTE':
    case 'ON_SITE':
    case 'IN_PROGRESS':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30';
    case 'COMPLETED':
      return 'app-badge app-badge-success';
    case 'VALIDATED':
    case 'CLOSED':
      return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30';
    default:
      return 'bg-surface-main text-text-secondary border border-border';
  }
}

function missionDetailPath(mission) {
  if (mission?.tradeCategory?.slug === 'mobilite') return `/courses/${mission.id}`;
  if (mission?.tradeCategory?.slug === 'livraison') return `/livraisons/${mission.id}`;
  return `/missions/${mission.id}/track`;
}

export default function MyMissionsPage({ mobilityOnly = false, deliveryOnly = false, serviceOnly = false, workspace = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const transportOnly = mobilityOnly || deliveryOnly;
  const transportTranslationRoot = mobilityOnly ? 'taxiRides' : 'deliveryOrders';
  const selectedTradeCategorySlug = mobilityOnly
    ? 'mobilite'
    : deliveryOnly
    ? 'livraison'
    : null;

  const [isAgent, setIsAgent] = useState(false);
  const [isAllowed, setIsAllowed] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [dispatchPresence, setDispatchPresence] = useState(null);
  const [activeVehicleId, setActiveVehicleId] = useState('');
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);
  const [rideAction, setRideAction] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const loadVersion = useRef(0);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const { user } = await me();
        if (!active) return;

        if (!user) {
          navigate('/login');
          return;
        }

        const role = normalizeRole(user.role);
        if (role !== 'agent' && role !== 'provider') {
          navigate('/dashboard');
          return;
        }

        setIsAllowed(true); setIsAgent(role === 'agent');

        if (role === 'provider') {
          const [myProvider, presence] = await Promise.all([
            getMyProvider(),
            getMyDispatchPresence().catch(() => null),
          ]);
          if (active) {
            setProvider(myProvider);
            setDispatchPresence(presence);
            setActiveVehicleId(
              presence?.liveLocation?.vehicleId || presence?.eligibleVehicles?.[0]?.id || ''
            );
          }
        }
      } catch (e) {
        navigate('/login');
      }
    }

    checkAccess();
    return () => {
      active = false;
    };
  }, [navigate]);

  const loadMissions = useCallback(async ({ silent = false } = {}) => {
    const version = ++loadVersion.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await getMyMissions(
        selectedTradeCategorySlug
          ? { tradeCategorySlug: selectedTradeCategorySlug, limit: 100, view: showHistory ? 'history' : 'active', offset }
          : { limit: 100, view: showHistory ? 'history' : 'active', offset, ...(serviceOnly ? { excludeTradeCategorySlug: 'mobilite,livraison' } : {}) }
      );
      if (loadVersion.current !== version) return;
      const items = Array.isArray(data?.missions) ? data.missions : [];
      setMissions(
        serviceOnly
          ? items.filter((mission) => !['mobilite', 'livraison'].includes(mission.tradeCategory?.slug))
          : items
      );
      setTotal(data?.pagination?.total ?? items.length);
    } catch (e) {
      console.error('MyMissionsPage load missions error:', e);
      if (!silent && loadVersion.current === version) {
        setError(true);
        setMissions([]);
      }
    } finally {
      if (!silent && loadVersion.current === version) setLoading(false);
    }
  }, [selectedTradeCategorySlug, serviceOnly, showHistory, offset]);

  async function handleRideOffer(event, mission, action) {
    event.preventDefault();
    event.stopPropagation();
    const missionId = mission.id;
    setRideAction({ missionId, action });
    setError(null);
    try {
      if (action === 'accept') {
        await acceptMission(missionId);
        navigate(missionDetailPath(mission));
        return;
      }
      await declineMission(missionId);
      await loadMissions();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t('myMissionsPage.errors.load'));
    } finally {
      setRideAction(null);
    }
  }

  useEffect(() => {
    if (!isAllowed) return undefined;
    loadMissions();

    const refreshIfVisible = () => {
      if (isDocumentVisible()) loadMissions({ silent: true });
    };
    const interval = window.setInterval(refreshIfVisible, DRIVER_RIDES_POLL_MS);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      loadVersion.current += 1;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [isAllowed, loadMissions, serviceOnly, transportOnly]);

  async function handleAvailabilityChange(availabilityStatus) {
    setSavingAvailability(true);
    setAvailabilityError(null);
    try {
      if (availabilityStatus === 'available' && dispatchPresence?.eligibleVehicles?.length) {
        if (!activeVehicleId) throw new Error(t('myMissionsPage.errors.vehicleRequired'));
        // La position améliore le classement du chauffeur, mais une autorisation refusée ou un
        // réseau faible ne doit jamais empêcher de recevoir une course.
        if (navigator.geolocation) {
          try {
            const position = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 8000,
                maximumAge: 5 * 60 * 1000,
              });
            });
            const locationResult = await updateMyLiveLocation({
              vehicleId: Number(activeVehicleId),
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy ?? null,
              headingDegrees: position.coords.heading ?? null,
            });
            setDispatchPresence((current) => ({
              ...current,
              liveLocation: locationResult.location,
            }));
          } catch (_locationError) {
            // Best effort uniquement : la disponibilité est enregistrée juste après.
          }
        }
      }
      const updated = await updateMyAvailability(
        availabilityStatus,
        availabilityStatus === 'available' ? activeVehicleId : null
      );
      setProvider(updated);
    } catch (e) {
      console.error('MyMissionsPage update availability error:', e);
      setAvailabilityError(
        e?.response?.data?.error || e?.message || t('myMissionsPage.errors.availability')
      );
    } finally {
      setSavingAvailability(false);
    }
  }

  if (isAllowed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-main">
        <p className="text-text-muted text-lg animate-pulse">{t('myMissionsPage.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-3 sm:px-4 py-8 sm:py-10">
      <div className="max-w-4xl mx-auto bg-surface-card/90 backdrop-blur-sm shadow-xl rounded-2xl border border-border/70 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isAgent && <AgentCoordinationPanel />}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              {workspace ? t('fieldWorkspace.title') : serviceOnly
                ? t('serviceProvider.title')
                : transportOnly
                ? t(`${transportTranslationRoot}.driverTitle`)
                : t('myMissionsPage.title')}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {workspace ? t('fieldWorkspace.hint') : serviceOnly
                ? t('serviceProvider.subtitle')
                : transportOnly
                ? t(`${transportTranslationRoot}.driverSubtitle`)
                : t('myMissionsPage.subtitle')}
            </p>
          </div>
          <button
            onClick={() => loadMissions()}
            disabled={loading}
            className="app-btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-full shadow-sm self-start sm:self-auto"
          >
            {loading ? t('myMissionsPage.loading') : t('myMissionsPage.buttons.refresh')}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {error === true ? t('myMissionsPage.errors.load') : error}
          </div>
        )}

        {provider ? (
          <section className="mb-6 rounded-3xl border border-border bg-surface-main/60 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {provider.availabilityStatus === 'available'
                    ? t('fieldWorkspace.available')
                    : provider.availabilityStatus === 'busy'
                    ? t('fieldWorkspace.busy')
                    : t('fieldWorkspace.offline')}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {t('fieldWorkspace.providerHint')}
                </p>
              </div>
              <button
                type="button"
                disabled={savingAvailability || provider.availabilityStatus === 'busy'}
                onClick={() =>
                  handleAvailabilityChange(
                    provider.availabilityStatus === 'available' ? 'offline' : 'available'
                  )
                }
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold disabled:opacity-60 ${
                  provider.availabilityStatus === 'available' ? 'btn-secondary' : 'btn-primary'
                }`}
              >
                {savingAvailability ? <Loader2 className="animate-spin" size={18} /> : <Power size={18} />}
                {provider.availabilityStatus === 'available'
                  ? t('fieldWorkspace.goOffline')
                  : provider.availabilityStatus === 'busy'
                  ? t('fieldWorkspace.busy')
                  : t('fieldWorkspace.goAvailable')}
              </button>
            </div>
            {dispatchPresence?.eligibleVehicles?.length > 1 ? (
              <select
                className="app-input mt-4 max-w-sm"
                value={activeVehicleId}
                disabled={provider.availabilityStatus === 'busy'}
                onChange={(event) => setActiveVehicleId(event.target.value)}
                aria-label={t('myMissionsPage.availability.activeVehicle')}
              >
                {dispatchPresence.eligibleVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model} · {vehicle.plateNumber}
                  </option>
                ))}
              </select>
            ) : null}
            {availabilityError ? (
              <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{availabilityError}</p>
            ) : null}
          </section>
        ) : null}

        <button type="button" aria-pressed={showHistory} onClick={() => { setMissions([]); setOffset(0); setShowHistory((value) => !value); }} className="btn-secondary mb-4 min-h-11 rounded-xl px-4 text-sm">{t(showHistory ? 'fieldWorkspace.showActive' : 'fieldWorkspace.showHistory')}</button>
        {(total > 100 || offset > 0) && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm"><button type="button" disabled={!offset || loading} onClick={() => setOffset((value) => Math.max(0, value - 100))} className="btn-secondary min-h-11 rounded-xl px-4">{t('operations.previous')}</button><span>{offset + 1}–{offset + missions.length} / {total}</span><button type="button" disabled={offset + 100 >= total || loading} onClick={() => setOffset((value) => value + 100)} className="btn-secondary min-h-11 rounded-xl px-4">{t('operations.next')}</button></div>}

        {!loading && missions.length === 0 && !error ? (
          <p className="text-center text-text-muted italic py-10">
            {serviceOnly
              ? t('serviceProvider.empty')
              : transportOnly
              ? t(`${transportTranslationRoot}.driverEmpty`)
              : t('myMissionsPage.empty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {missions.filter((mission) => showHistory ? isRequestHistory(mission) : !isRequestHistory(mission)).sort((a, b) => Number(Boolean(b.acceptanceDeadlineAt)) - Number(Boolean(a.acceptanceDeadlineAt)) || Number(a.missionStatus === 'COMPLETED') - Number(b.missionStatus === 'COMPLETED')).map((m) => {
              const isOffer = Boolean(m.acceptanceDeadlineAt);
              const VehicleIcon = m.requestedVehicleType === 'car' ? CarFront : Bike;
              const missionTranslationRoot =
                m.tradeCategory?.slug === 'mobilite'
                  ? 'taxiRides'
                  : m.tradeCategory?.slug === 'livraison'
                  ? 'deliveryOrders'
                  : null;
              const actionTranslationRoot =
                missionTranslationRoot || (serviceOnly ? 'serviceProvider' : 'myMissionsPage');
              return (
                <li
                  key={m.id}
                  className={`rounded-3xl border p-4 transition-colors ${
                    isOffer
                      ? 'border-blue-500/40 bg-blue-500/10 shadow-sm'
                      : 'border-border bg-surface-main/60'
                  }`}
                >
                  <Link
                    to={missionDetailPath(m)}
                    className="block"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        {transportOnly ? (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                            {deliveryOnly ? <PackageCheck size={19} /> : <VehicleIcon size={19} />}
                          </span>
                        ) : null}
                        <div className="min-w-0">
                          {isOffer ? (
                            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                              {t(`${actionTranslationRoot}.newOffer`)}
                            </p>
                          ) : null}
                          <div className="font-medium text-text-primary break-words">
                            {m.title || t('myMissionsPage.missionFallback', { id: m.id })}
                          </div>
                          <div className="mt-0.5 text-xs text-text-muted">
                            {m.tradeCategory?.name || t('myMissionsPage.tradeCategoryUnknown')}
                          </div>
                          {m.pickupAddress ? (
                            <div className="mt-2 flex items-start gap-1.5 text-sm text-text-secondary">
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-blue-600" />
                              {m.pickupAddress}
                            </div>
                          ) : null}
                          {m.address ? (
                            <div className="mt-1 flex items-start gap-1.5 text-sm text-text-secondary break-words">
                              <MapPin className="mt-0.5 shrink-0 text-emerald-600" size={14} />
                              {m.address}
                            </div>
                          ) : null}
                          {displayClient(m.client) && (
                            <div className="mt-2 text-xs text-text-muted">
                              {t('myMissionsPage.clientLabel')} {displayClient(m.client)}
                            </div>
                          )}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${statusBadgeClass(
                          m.missionStatus
                        )}`}
                      >
                        {t(`${missionTranslationRoot || 'missionTracking'}.status.${m.missionStatus}`, {
                          defaultValue: m.missionStatus,
                        })}
                      </span>
                    </div>
                  </Link>
                  {isOffer ? (
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <button
                        type="button"
                        onClick={(event) => handleRideOffer(event, m, 'accept')}
                        disabled={Boolean(rideAction)}
                        className="btn-primary flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold disabled:opacity-60"
                      >
                        {rideAction?.missionId === m.id && rideAction.action === 'accept' ? (
                          <Loader2 className="animate-spin" size={20} />
                        ) : (
                          <Check size={21} />
                        )}
                        {t(`${actionTranslationRoot}.accept`)}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleRideOffer(event, m, 'decline')}
                        disabled={Boolean(rideAction)}
                        className="btn-secondary flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold disabled:opacity-60"
                        aria-label={t(`${actionTranslationRoot}.decline`)}
                        title={t(`${actionTranslationRoot}.decline`)}
                      >
                        <X size={21} />
                        <span>{t(`${actionTranslationRoot}.decline`)}</span>
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
