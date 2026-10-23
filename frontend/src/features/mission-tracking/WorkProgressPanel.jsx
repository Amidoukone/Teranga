import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getWorkProgress } from '../../services/operations';
import WorkAssignmentCard from './WorkAssignmentCard';

export default function WorkProgressPanel({ entityType, entityId, status, onSaved }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const result = await getWorkProgress(entityType, entityId); setProgress(result); setError('');
  }, [entityType, entityId]);
  useEffect(() => {
    let active = true;
    getWorkProgress(entityType, entityId).then((result) => { if (active) { setProgress(result); setError(''); } })
      .catch((failure) => { if (active) setError(failure?.response?.data?.error || t('operations.failed')); });
    return () => { active = false; };
  }, [entityType, entityId, status, t]);
  if (error) return <p role="alert">{error}</p>;
  if (!progress?.item?.coordination) return null;
  return <WorkAssignmentCard item={progress.item} canAdvance={progress.canAdvance} clientValidation={progress.canValidate}
    onSaved={async () => { await load(); await onSaved?.(); }} />;
}
