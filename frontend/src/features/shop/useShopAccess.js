import { useEffect, useState } from 'react';
import { me } from '../../services/auth';

export default function useShopAccess(isAuthenticated) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(isAuthenticated));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    if (!isAuthenticated) { setUser(null); setLoading(false); setError(false); return undefined; }
    setLoading(true);
    me().then((result) => { if (current) { setUser(result?.user || null); setError(false); } })
      .catch(() => { if (current) { setUser(null); setError(true); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [isAuthenticated, attempt]);
  return { user, loading, error, retry: () => setAttempt((value) => value + 1) };
}
