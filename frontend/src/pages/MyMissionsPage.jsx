// frontend/src/pages/MyMissionsPage.jsx
// "Mes missions" — portail agent (superviseur ou exécutant) / prestataire exécutant sur les
// missions filière (executionType='provider', voir docs/DEV_SPEC_TERANGA_v3.md section 2/3).
// Les missions classiques agent (executionType='agent') restent sur AgentServicesPage.js /
// GET /services/agent/services — non dupliquées ici (GET /v1/missions/mine les exclut déjà).

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { me } from '../services/auth';
import { normalizeRole } from '../utils/role';
import { getMyMissions } from '../services/missions';
import { getMyProvider, updateMyAvailability } from '../services/providers';

const AVAILABILITY_VALUES = ['available', 'busy', 'offline'];
const AVAILABILITY_TONE = {
  available: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
  busy: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  offline: 'bg-surface-main text-text-secondary border border-border',
};

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

export default function MyMissionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isAllowed, setIsAllowed] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [savingAvailability, setSavingAvailability] = useState(false);

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

        setIsAllowed(true);

        if (role === 'provider') {
          const myProvider = await getMyProvider();
          if (active) setProvider(myProvider);
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

  const loadMissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyMissions();
      setMissions(data?.missions || []);
    } catch (e) {
      console.error('MyMissionsPage load missions error:', e);
      setError(t('myMissionsPage.errors.load'));
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAllowed) loadMissions();
  }, [isAllowed, loadMissions]);

  async function handleAvailabilityChange(availabilityStatus) {
    setSavingAvailability(true);
    try {
      const updated = await updateMyAvailability(availabilityStatus);
      setProvider(updated);
    } catch (e) {
      console.error('MyMissionsPage update availability error:', e);
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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              {t('myMissionsPage.title')}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">{t('myMissionsPage.subtitle')}</p>
          </div>
          <button
            onClick={loadMissions}
            disabled={loading}
            className="app-btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-full shadow-sm self-start sm:self-auto"
          >
            {loading ? t('myMissionsPage.loading') : t('myMissionsPage.buttons.refresh')}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {provider ? (
          <div className="mb-6 rounded-2xl border border-border bg-surface-main/60 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-text-secondary">
              {t('myMissionsPage.availability.label')}
            </p>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={savingAvailability}
                  onClick={() => handleAvailabilityChange(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                    provider.availabilityStatus === value
                      ? AVAILABILITY_TONE[value]
                      : 'border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t(`myMissionsPage.availability.${value}`)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && missions.length === 0 && !error ? (
          <p className="text-center text-text-muted italic py-10">{t('myMissionsPage.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {missions.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/missions/${m.id}/track`}
                  className="block rounded-2xl border border-border bg-surface-main/60 hover:bg-surface-main px-4 py-4 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-text-primary break-words">
                        {m.title || t('myMissionsPage.missionFallback', { id: m.id })}
                      </div>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {m.tradeCategory?.name || t('myMissionsPage.tradeCategoryUnknown')}
                      </div>
                      {m.address && (
                        <div className="mt-1 text-xs text-text-secondary break-words">
                          {m.address}
                        </div>
                      )}
                      {displayClient(m.client) && (
                        <div className="mt-1 text-xs text-text-muted">
                          {t('myMissionsPage.clientLabel')} {displayClient(m.client)}
                        </div>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${statusBadgeClass(
                        m.missionStatus
                      )}`}
                    >
                      {t(`missionTracking.status.${m.missionStatus}`, {
                        defaultValue: m.missionStatus,
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
