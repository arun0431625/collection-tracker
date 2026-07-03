import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useBranch } from "../context/BranchContext";
import { useViewer } from "../context/ViewerContext";

type ProtectedRouteProps = {
  requireRole?: "ADMIN" | "BRANCH";
};

export default function ProtectedRoute({ requireRole }: ProtectedRouteProps) {
  const { branch, loading: branchLoading, must_change_password, role } = useBranch();
  const { viewer, loading: viewerLoading } = useViewer();
  const location = useLocation();

  const loading = branchLoading || viewerLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  // Allow viewer users through (they have no branch profile)
  if (!branch && viewer) {
    // Viewers cannot access admin-only routes
    if (requireRole === "ADMIN") {
      return <Navigate to="/dashboard" replace />;
    }
    return <Outlet />;
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
