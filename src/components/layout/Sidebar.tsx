import { NavLink } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import {
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  Upload,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useState } from "react";

export default function Sidebar() {
  const { role, branch } = useBranch();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`h-screen bg-[#0f172a] text-white flex flex-col transition-all duration-300 ${
        collapsed ? "w-20" : "w-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-slate-800">
        {!collapsed && (
          <div>
            <h1 className="text-base font-semibold tracking-wide">
              Collection Tracker
            </h1>
            <p className="text-xs text-slate-400">
              {role === "ADMIN" ? "Admin Panel" : branch}
            </p>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white transition"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-6 space-y-1 text-sm">
        <NavItem to="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" collapsed={collapsed} />
        <NavItem to="/collections" icon={<FolderKanban size={18} />} label="Collections" collapsed={collapsed} />
        <NavItem to="/reports" icon={<BarChart3 size={18} />} label="Reports" collapsed={collapsed} />

        {role === "ADMIN" && (
          <>
            <NavItem to="/admin-upload" icon={<Upload size={18} />} label="Admin Upload" collapsed={collapsed} />
            <NavItem to="/security" icon={<ShieldCheck size={18} />} label="Security" collapsed={collapsed} />
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4">
        <button className="flex items-center gap-3 w-full px-4 py-2 rounded-md text-slate-400 hover:bg-red-600 hover:text-white transition">
          <LogOut size={18} />
          {!collapsed && "Logout"}
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 py-4 text-xs text-slate-500 border-t border-slate-800">
          v1.0 · Internal SaaS
        </div>
      )}
    </aside>
  );
}

function NavItem({
  to,
  icon,
  label,
  collapsed
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={`relative flex items-center gap-3 px-4 py-2 rounded-md transition-all duration-300 ease-out ${
            isActive
              ? "bg-[#1e293b]/90 backdrop-blur-sm text-white"
              : "text-slate-400 hover:bg-[#1e293b]/90 backdrop-blur-sm hover:text-white"
          }`}
        >
          {/* Left active bar */}
          {isActive && (
            <span className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-r transition-all duration-300"></span>
          )}

          {/* Icon slight scale */}
          <div
            className={`transition-all duration-300 ${
              isActive ? "scale-110" : "scale-100"
            }`}
          >
            {icon}
          </div>

          {/* Label grow effect */}
          {!collapsed && (
            <span
              className={`transition-all duration-300 ${
                isActive
                  ? "text-base font-medium"
                  : "text-sm font-normal"
              }`}
            >
              {label}
            </span>
          )}
        </div>
      )}
    </NavLink>
  );
}