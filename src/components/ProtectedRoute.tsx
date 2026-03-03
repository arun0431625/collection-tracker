import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useBranch } from "../context/BranchContext";

export default function ProtectedRoute() {
  const { branch, must_change_password } = useBranch();
  const location = useLocation();

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

  return <Outlet />;
}