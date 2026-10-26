import { Navigate, useLocation } from 'react-router-dom';
export default function FinanceRouteAlias() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('vue', 'bilan');
  return <Navigate to={`/transactions?${params}${location.hash || ''}`} replace state={location.state} />;
}
