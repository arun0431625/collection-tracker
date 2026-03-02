import { Navigate, Outlet } from "react-router-dom";
import { useBranch } from "@/context/BranchContext";

export default function ProtectedRoute() {
  const { branch } = useBranch();

  // agar login nahi
  if (!branch) {
    return <Navigate to="/login" replace />;
  }

  // agar login hai
  return <Outlet />;
}
