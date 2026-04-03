import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useBranch } from "@/context/BranchContext";

export default function AppLayout() {
  const navigate = useNavigate();
  const { logout } = useBranch();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onLogout={handleLogout} />

      <div className="flex flex-col flex-1 min-w-0 bg-gray-50">
        <Topbar onLogout={handleLogout} />

        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
