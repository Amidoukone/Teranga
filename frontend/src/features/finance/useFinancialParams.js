import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const PREFIX = 'paiements_';

// Embedded journals share the dossier URL without consuming its own filters.
export default function useFinancialParams(embedded) {
  const [routeParams, setRouteParams] = useSearchParams();
  const params = useMemo(() => embedded
    ? new URLSearchParams([...routeParams].filter(([key]) => key.startsWith(PREFIX)).map(([key, value]) => [key.slice(PREFIX.length), value]))
    : routeParams, [embedded, routeParams]);
  const setParams = useCallback((next) => {
    if (!embedded) { setRouteParams(next); return; }
    setRouteParams((previous) => {
      const result = new URLSearchParams(previous);
      [...result.keys()].filter((key) => key.startsWith(PREFIX)).forEach((key) => result.delete(key));
      for (const [key, value] of next) result.set(PREFIX + key, value);
      return result;
    }, { preventScrollReset: true });
  }, [embedded, setRouteParams]);
  return [params, setParams];
}
