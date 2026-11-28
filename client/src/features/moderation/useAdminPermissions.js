import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Whether to SHOW admin-only controls. This is presentation only: the server
 * re-checks the role from its own database on every moderation request.
 */
export function useAdminPermissions() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' && user?.status !== 'blocked';
  return { isAdmin, canModerate: isAdmin };
}
