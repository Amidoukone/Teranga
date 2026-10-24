import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { me } from '../services/auth';
import { normalizeRole } from '../utils/role';
import ClientHome from './ClientHome';
import AgentServicesPage from './AgentServicesPage';
import MyMissionsPage from './MyMissionsPage';
import ManagementHome from './ManagementHome';

export default function DashboardPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    me().then((session) => {
      if (!active) return;
      if (session.user) setUser(session.user);
      else setError(true);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <div role="alert" className="app-alert app-alert-error">{t('workspace.loadError')} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="underline">{t('serviceOrders.retry')}</button></div>;
  if (!user) return <p role="status" className="p-6 text-text-secondary">{t('dashboard.loading')}</p>;
  const role = normalizeRole(user.role);
  if (role === 'client') return <ClientHome key={user.id} user={user} />;
  if (role === 'agent') return <AgentServicesPage />;
  if (role === 'provider') return <MyMissionsPage workspace />;
  if (role === 'admin') return <ManagementHome />;
  return <Link to="/help-support">{t('nav.helpSupport')}</Link>;
}
