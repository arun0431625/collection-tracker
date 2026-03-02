import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useBranch } from "@/context/BranchContext";

export default function AppLayout() {
  const navigate = useNavigate();
  const { logout } = useBranch();

  function handleLogout() {
    logout();                 // 🔹 session + localStorage clear
    navigate("/login", {      // 🔹 login page pe bhejo
      replace: true,
    });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 bg-gray-100">
        {/* 🔹 Topbar ke andar logout button bhej rahe hain */}
        <Topbar onLogout={handleLogout} />

        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
