import WorkspaceHeader from '../components/WorkspaceHeader';
// frontend/src/pages/MyMissionsPage.jsx
// "Mes missions" — portail agent (superviseur ou exécutant) / prestataire exécutant sur les
// missions filière (executionType='provider', voir docs/DEV_SPEC_TERANGA_v3.md section 2/3).
// Les missions classiques agent (executionType='agent') restent sur AgentServicesPage.js /
// GET /services/agent/services — non dupliquées ici (GET /v1/missions/mine les exclut déjà).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bike, CarFront, Check, Loader2, MapPin, PackageCheck, X } from 'lucide-react';
import { me } from '../services/auth';
import { normalizeRole } from '../utils/role';
import { isRequestHistory } from '../utils/requestLifecycle';
import { acceptMission, declineMission, getMyMissions } from '../services/missions';

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

export default function MyMissionsPage({ mobilityOnly = false, deliveryOnly = false, serviceOnly = false, workspace = false, user: verifiedUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const transportOnly = mobilityOnly || deliveryOnly;
  const transportTranslationRoot = mobilityOnly ? 'taxiRides' : 'deliveryOrders';
  const selectedTradeCategorySlug = mobilityOnly
    ? 'mobilite'
    : deliveryOnly
    ? 'livraison'
    : null;

  const [isAllowed, setIsAllowed] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rideAction, setRideAction] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const loadVersion = useRef(0);
  const offerMutation = useRef(false);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const user = verifiedUser || (await me()).user;
        if (!active) return;

        if (!user) {
          navigate('/login');
          return;
        }

        const role = normalizeRole(user.role);
        if (role !== 'agent' && role !== 'provider') {
          navigate('/operations');
          return;
        }

        setIsAllowed(true);

      } catch (e) {
        navigate('/login');
      }
    }

    checkAccess();
    return () => {
      active = false;
    };
  }, [navigate, verifiedUser]);

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
    if (offerMutation.current) return;
    offerMutation.current = true;
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
      offerMutation.current = false;
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

  if (isAllowed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-main">
        <p className="text-text-muted text-lg animate-pulse">{t('myMissionsPage.loading')}</p>
      </div>
    );
  }

  return (
    <div className="app-page-wrap">
      <div className="app-page-shell max-w-4xl space-y-6">
        <WorkspaceHeader title={workspace ? t('fieldWorkspace.title') : serviceOnly
                ? t('serviceProvider.title')
                : transportOnly
                ? t(`${transportTranslationRoot}.driverTitle`)
                : t('myMissionsPage.title')} hint={workspace ? t('workspace.fieldHint') : serviceOnly
                ? t('serviceProvider.subtitle')
                : transportOnly
                ? t(`${transportTranslationRoot}.driverSubtitle`)
                : t('myMissionsPage.subtitle')} />

        {error && (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {error === true ? t('myMissionsPage.errors.load') : error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" aria-pressed={showHistory} onClick={() => { setMissions([]); setOffset(0); setShowHistory((value) => !value); }} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t(showHistory ? 'fieldWorkspace.showActive' : 'fieldWorkspace.showHistory')}</button><button type="button" onClick={() => loadMissions()} disabled={loading} className="btn-secondary min-h-11 rounded-xl px-4 text-sm">{t('myMissionsPage.buttons.refresh')}</button></div>
        {(total > 100 || offset > 0) && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm"><button type="button" disabled={!offset || loading} onClick={() => setOffset((value) => Math.max(0, value - 100))} className="btn-secondary min-h-11 rounded-xl px-4">{t('operations.previous')}</button><span>{offset + 1}–{offset + missions.length} / {total}</span><button type="button" disabled={offset + 100 >= total || loading} onClick={() => setOffset((value) => value + 100)} className="btn-secondary min-h-11 rounded-xl px-4">{t('operations.next')}</button></div>}

        {!loading && missions.length === 0 && !error ? (
          <p className="text-center text-text-muted italic py-10">
            {showHistory ? t('workspace.emptyHistory') : serviceOnly
              ? t('serviceProvider.empty')
              : transportOnly
              ? t(`${transportTranslationRoot}.driverEmpty`)
              : t('myMissionsPage.empty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {missions.filter((mission) => showHistory ? isRequestHistory(mission) : !isRequestHistory(mission)).sort((a, b) => Number(Boolean(b.acceptanceDeadlineAt)) - Number(Boolean(a.acceptanceDeadlineAt)) || Number(a.missionStatus === 'COMPLETED') - Number(b.missionStatus === 'COMPLETED')).map((m, index, list) => {
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
                <li key={m.id} className="space-y-3">
                  {!showHistory && (index === 0 || Boolean(list[index - 1].acceptanceDeadlineAt) !== isOffer) && <h2 className="pt-2 text-lg font-bold">{t(isOffer ? 'workspace.offers' : 'workspace.jobs')}</h2>}
                  <article aria-labelledby={`mission-card-${m.id}`}
                  className={`rounded-3xl border p-4 transition-colors ${
                    isOffer
                      ? 'border-blue-500/40 bg-blue-500/10 shadow-sm'
                      : 'border-border bg-surface-main/60'
                  }`}
                >
                  <div>
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
                          <h3 id={`mission-card-${m.id}`} className="font-medium text-text-primary break-words">
                            {m.title || t('myMissionsPage.missionFallback', { id: m.id })}
                          </h3>
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
                  </div>
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
                  <Link to={missionDetailPath(m)} className={`${isOffer ? 'text-blue-700 underline dark:text-blue-300' : 'btn-primary rounded-xl px-4'} mt-3 inline-flex min-h-12 items-center justify-center text-sm font-semibold`}>{t(isOffer ? 'serviceAgent.details' : ['COMPLETED', 'VALIDATED', 'CLOSED'].includes(m.missionStatus) ? 'workspace.viewReport' : ['EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'].includes(m.missionStatus) ? 'workspace.continueWork' : 'workspace.openWork')}</Link>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
