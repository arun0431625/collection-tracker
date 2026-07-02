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
  ChevronRight,
  ArrowRightLeft
} from "lucide-react";
import { useState, useEffect } from "react";
import { getSubBranchCodes } from "../../services/collections.api";

type SidebarProps = {
  onLogout: () => void | Promise<void>;
};

export default function Sidebar({ onLogout }: SidebarProps) {
  const { role, branch } = useBranch();
  const [collapsed, setCollapsed] = useState(false);
  const [subBranches, setSubBranches] = useState<string[]>([]);
  const [showAllSubBranches, setShowAllSubBranches] = useState(false);

  useEffect(() => {
    if (role !== "ADMIN" && branch) {
      getSubBranchCodes(branch).then((codes) => {
        // Filter out the controlling branch itself to only show actual sub-branches
        const actualSubBranches = codes.filter((c) => c !== branch);
        if (actualSubBranches.length > 0) {
          setSubBranches(actualSubBranches);
        }
      });
    }
  }, [role, branch]);

  return (
    <aside
      className={`h-screen bg-[#0f172a] text-white flex flex-col transition-all duration-300 shrink-0 ${
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
            <div className="text-xs text-slate-400 mt-0.5">
              {role === "ADMIN" ? (
                <span>Admin Panel</span>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-300">{branch}</span>
                  {subBranches.length > 0 && (
                    <div className="pl-2 border-l border-slate-600 mt-1 flex flex-col gap-0.5 text-[10px] leading-tight text-slate-500">
                      {(showAllSubBranches ? subBranches : subBranches.slice(0, 3)).map((sb) => (
                        <span key={sb}>↳ {sb}</span>
                      ))}
                      {subBranches.length > 3 && (
                        <button 
                          onClick={() => setShowAllSubBranches(!showAllSubBranches)}
                          className="text-left text-[#3b82f6] hover:text-[#60a5fa] mt-0.5 font-medium"
                        >
                          {showAllSubBranches ? "Show less" : `+${subBranches.length - 3} more`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
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
            <NavItem to="/branch-transfers" icon={<ArrowRightLeft size={18} />} label="Transfers" collapsed={collapsed} />
            <NavItem to="/security" icon={<ShieldCheck size={18} />} label="Security" collapsed={collapsed} />
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-4 py-2 rounded-md text-slate-400 hover:bg-red-600 hover:text-white transition"
        >
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
