import { useState } from "react";
import { X, Eye, EyeOff, CheckSquare, Square, LayoutDashboard, Archive, BarChart2, Building2 } from "lucide-react";
import {
  createViewerUser,
  VIEWER_PAGES,
  type ViewerPage,
} from "@/services/viewerUsers";

type Props = {
  controllingBranches: string[];
  onClose: () => void;
  onCreated: () => void;
};

const PAGE_ICONS: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard size={16} />,
  Collections: <Archive size={16} />,
  Reports: <BarChart2 size={16} />,
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  Dashboard: "KPI overview, charts & trends",
  Collections: "View GR entries & payment status (read-only)",
  Reports: "Ageing, branch & area reports",
};

export default function CreateViewerModal({ controllingBranches, onClose, onCreated }: Props) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPages, setSelectedPages] = useState<ViewerPage[]>([...VIEWER_PAGES]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([...controllingBranches]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchSearch, setBranchSearch] = useState("");

  function togglePage(page: ViewerPage) {
    setSelectedPages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  }

  function toggleBranch(branch: string) {
    setSelectedBranches((prev) =>
      prev.includes(branch) ? prev.filter((b) => b !== branch) : [...prev, branch]
    );
  }

  function toggleAllBranches() {
    if (selectedBranches.length === controllingBranches.length) {
      setSelectedBranches([]);
    } else {
      setSelectedBranches([...controllingBranches]);
    }
  }

  const filteredBranches = controllingBranches.filter((b) =>
    b.toLowerCase().includes(branchSearch.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim()) { setError("Username is required"); return; }
    if (!/^[a-z0-9._-]+$/i.test(username.trim())) { setError("Username can only contain letters, numbers, dots, hyphens, underscores"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (selectedPages.length === 0) { setError("Select at least one page to grant access"); return; }
    if (selectedBranches.length === 0) { setError("Select at least one branch to grant access"); return; }

    setSaving(true);
    try {
      await createViewerUser({
        username: username.trim().toLowerCase(),
        display_name: displayName.trim() || username.trim(),
        password,
        accessible_pages: selectedPages,
        accessible_branches: selectedBranches,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-900">
          <div>
            <h2 className="text-lg font-semibold text-white">Create Viewer User</h2>
            <p className="text-xs text-slate-400 mt-0.5">Read-only access — cannot edit any data</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition rounded-lg p-1.5 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Left Column - User Details */}
            <div className="w-80 shrink-0 p-6 border-r border-slate-100 flex flex-col gap-5 overflow-y-auto">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  User Credentials
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                      placeholder="e.g. viewer1"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-400 mt-1">Login ID: {username || "username"}@viewer.tracker.com</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Region Manager"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Page Access */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Page Access
                </h3>
                <div className="space-y-2">
                  {VIEWER_PAGES.map((page) => {
                    const selected = selectedPages.includes(page);
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => togglePage(page)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition text-left ${
                          selected
                            ? "bg-blue-50 border-blue-300 text-blue-900"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className={selected ? "text-blue-600" : "text-slate-400"}>
                          {PAGE_ICONS[page]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold">{page}</div>
                          <div className="text-[10px] text-slate-400 truncate">{PAGE_DESCRIPTIONS[page]}</div>
                        </div>
                        <span className={selected ? "text-blue-600" : "text-slate-300"}>
                          {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Read-only notice */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex gap-2.5">
                <Eye size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  This user will have <strong>read-only</strong> access. They cannot edit, save, or export any data.
                </p>
              </div>
            </div>

            {/* Right Column - Branch Access */}
            <div className="flex-1 p-6 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Branch Data Access
                </h3>
                <button
                  type="button"
                  onClick={toggleAllBranches}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedBranches.length === controllingBranches.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                Select which controlling branches this user can view data for.
                <span className="ml-1 font-medium text-slate-700">
                  {selectedBranches.length}/{controllingBranches.length} selected
                </span>
              </p>

              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Search branches..."
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {filteredBranches.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No branches found</div>
                ) : (
                  filteredBranches.map((branch) => {
                    const selected = selectedBranches.includes(branch);
                    return (
                      <button
                        key={branch}
                        type="button"
                        onClick={() => toggleBranch(branch)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 ${
                          selected ? "bg-emerald-50" : ""
                        }`}
                      >
                        <span className={selected ? "text-emerald-600" : "text-slate-300"}>
                          {selected ? <CheckSquare size={15} /> : <Square size={15} />}
                        </span>
                        <Building2 size={13} className={selected ? "text-emerald-600" : "text-slate-400"} />
                        <span className={`text-xs font-medium ${selected ? "text-emerald-800" : "text-slate-700"}`}>
                          {branch}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            {error && (
              <p className="text-xs text-red-600 flex-1">{error}</p>
            )}
            {!error && <div className="flex-1" />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-blue-600 text-sm text-white hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                {saving ? "Creating..." : "Create Viewer User"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
