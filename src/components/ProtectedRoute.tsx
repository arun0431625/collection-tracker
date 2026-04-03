import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useBranch } from "../context/BranchContext";

type ProtectedRouteProps = {
  requireRole?: "ADMIN" | "BRANCH";
};

export default function ProtectedRoute({ requireRole }: ProtectedRouteProps) {
  const { branch, loading, must_change_password, role } = useBranch();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  if (!branch) {
    return <Navigate to="/login" replace />;
  }

  // Force password change
  if (
    must_change_password &&
    location.pathname !== "/change-password"
  ) {
    return <Navigate to="/change-password" replace />;
  }

  if (requireRole && role !== requireRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
