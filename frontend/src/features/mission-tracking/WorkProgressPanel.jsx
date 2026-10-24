import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getWorkProgress } from '../../services/operations';
import WorkAssignmentCard from './WorkAssignmentCard';

export default function WorkProgressPanel(props) {
  return <Progress key={`${props.entityType}:${props.entityId}`} {...props} />;
}

function Progress({ entityType, entityId, status, onSaved }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const version = useRef(0);
  const active = useRef(true);
  const load = useCallback(async () => {
    const epoch = ++version.current;
    try {
      const result = await getWorkProgress(entityType, entityId);
      if (active.current && version.current === epoch) { setProgress(result); setError(''); }
    } catch (failure) {
      if (active.current && version.current === epoch) {
        if ([401, 403, 404].includes(failure?.response?.status)) setProgress(null);
        setError(failure?.response?.data?.error || t('operations.failed'));
      }
    }
  }, [entityType, entityId, t]);
  useEffect(() => {
    active.current = true; load();
    return () => { active.current = false; version.current += 1; };
  }, [load, status]);
  return <section id="work-progress" className="scroll-mt-24 space-y-3">
    {error && <p role="alert">{error} <button type="button" onClick={load} className="min-h-11 underline">{t('serviceOrders.retry')}</button></p>}
    {progress?.item?.coordination && <WorkAssignmentCard item={progress.item} canAdvance={progress.canAdvance} clientValidation={progress.canValidate} onSaved={async () => { await load(); await onSaved?.(); }} />}
  </section>;
}
