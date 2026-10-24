import { useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ServiceStepsPanel from '../features/service-workspace/ServiceStepsPanel';
import { getRequestDetailPath } from '../utils/requestLifecycle';

// Ancien lien conservé, y compris pour un agent autorisé sur une tâche seule.
export default function ServiceTasksPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const search = new URLSearchParams(location.search);
  const taskId = Number(search.get('etape'));
  const pieces = search.get('pieces') === '1';
  const onContext = useCallback((context, viewer) => {
    if (!context || !Number.isSafeInteger(taskId) || taskId <= 0) return;
    const transport = ['mobilite', 'livraison'].includes(context.tradeCategory?.slug) || context.requestedVehicleType;
    if (context.missionStatus && (viewer?.role === 'admin' || transport)) return;
    const path = getRequestDetailPath(context, undefined, viewer?.role);
    const params = new URLSearchParams({ etape: String(taskId), ...(pieces ? { pieces: '1' } : {}) });
    navigate(`${path}?${params.toString()}#steps`, { replace: true, state: location.state });
  }, [taskId, pieces, location.state, navigate]);
  return <div className="app-page-wrap"><div className="app-page-shell max-w-3xl space-y-5">
    <header><h1 className="app-page-headline">{t('serviceSteps.title')}</h1><p className="mt-2 text-sm text-text-secondary">{t('serviceSteps.legacy')}</p></header>
    <ServiceStepsPanel serviceId={id} standalone onContext={onContext} />
  </div></div>;
}
