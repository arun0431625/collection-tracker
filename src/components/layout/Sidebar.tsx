import { NavLink } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";

export default function Sidebar() {
  const { role } = useBranch();

  return (
    <aside className="h-screen w-56 bg-slate-900 text-white flex flex-col">
      <div className="px-4 py-4 text-lg font-semibold border-b border-slate-700">
        Collection Tracker
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 text-sm">
        <NavItem to="/dashboard" label="Dashboard" />

        {(role === "ADMIN" || role === "BRANCH") && (
          <NavItem to="/collections" label="Collections" />
        )}

        {(role === "ADMIN" || role === "BRANCH") && (
          <NavItem to="/reports" label="Reports" />
        )}

        {role === "ADMIN" && (
          <NavItem to="/admin-upload" label="Admin Upload" />
        )}
      </nav>

      <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-700">
        Collection Tracker · v1.0 MVP
      </div>
    </aside>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded px-3 py-2 ${
          isActive
            ? "bg-slate-700 text-white"
            : "text-slate-300 hover:bg-slate-800"
        }`
      }
    >
      {label}
    </NavLink>
  );
}
