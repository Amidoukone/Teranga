import { Navigate } from 'react-router-dom';
import { getLocalUser, hasSessionHint, usesCookieAuth } from '../services/auth';

export default function ProtectedRoute({ children }) {
  const hasSession = usesCookieAuth()
    ? Boolean(getLocalUser()) || hasSessionHint()
    : hasSessionHint();
  return hasSession ? children : <Navigate to="/login" replace />;
}


