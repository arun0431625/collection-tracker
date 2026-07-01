import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useBranch } from "@/context/BranchContext";
import {
  fetchBranchDeleteSummary,
  fetchSecurityRows,
  deleteBranch,
  resetBranchPassword,
  setBranchActive,
  updateBranchUsername,
  mapBranchToMain,
  getAppSetting,
  setAppSetting,
} from "@/services/admin";

type UserRow = Awaited<ReturnType<typeof fetchSecurityRows>>[number];

export default function Security() {
  const { role } = useBranch();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteSearch, setDeleteSearch] = useState("");
  const [deleteSummary, setDeleteSummary] = useState<{
    branch: string;
    lrCount: number;
    totalFreight: number;
    paid: number;
    balance: number;
  } | null>(null);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Username Editing State
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editUsernameVal, setEditUsernameVal] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  // Mapping Editing State
  const [editingMapping, setEditingMapping] = useState<string | null>(null);
  const [editMappingVal, setEditMappingVal] = useState("");
  const [savingMapping, setSavingMapping] = useState(false);

  const [showMappingModal, setShowMappingModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

  const [transferEnabled, setTransferEnabled] = useState(true);

  const totalBranches = rows.length;
  const activeCount = rows.filter((r) => r.is_active).length;
  const disabledCount = rows.filter((r) => !r.is_active).length;

  useEffect(() => {
    if (role !== "ADMIN") return;
    void fetchBranches();
  }, [role]);

  async function fetchBranches() {
    setLoading(true);

    try {
      const data = await fetchSecurityRows();
      setRows(data);
      setBranchOptions(
        Array.from(new Set(data.map((row) => row.branch_code))).sort()
      );

      const isTransferEnabled = await getAppSetting("transfer_enabled");
      if (isTransferEnabled !== null) {
        setTransferEnabled(isTransferEnabled);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }

  async function checkBranchData(branch: string) {
    if (!branch) return;

    const normalizedBranch = branch.toUpperCase();

    try {
      const summary = await fetchBranchDeleteSummary(normalizedBranch);

      setDeleteSummary({
        branch: summary?.branch || normalizedBranch,
        lrCount: Number(summary?.lr_count || 0),
        totalFreight: Number(summary?.total_freight || 0),
        paid: Number(summary?.collected || 0),
        balance: Number(summary?.balance || 0),
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load branch summary");
    }
  }

  async function handleDeleteBranch(branchCode: string) {
    if (!branchCode) return;

    const normalizedBranch = branchCode.toUpperCase();
    const summary = deleteSummary;

    if (!summary || summary.branch !== normalizedBranch) {
      alert("Please check branch data first");
      return;
    }

    const confirmed = window.confirm(
      summary.lrCount === 0
        ? `No LRs found. Delete branch ${normalizedBranch}?`
        : `${summary.lrCount} LRs and branch access will be permanently deleted. Continue?`
    );

    if (!confirmed) return;

    try {
      await deleteBranch(normalizedBranch);
      alert("Branch and related data deleted successfully.");
      setDeleteSummary(null);
      setDeleteSearch("");
      await fetchBranches();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleToggleActive(branchCode: string, isActive: boolean) {
    try {
      await setBranchActive(branchCode, isActive);
      setRows((prev) =>
        prev.map((row) =>
          row.branch_code === branchCode ? { ...row, is_active: isActive } : row
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Status update failed");
    }
  }

  async function handleReset(branchCode: string) {
    if (branchCode === "ADMIN") {
      alert("Admin password cannot be reset from here.");
      return;
    }

    const confirmed = window.confirm(
      `Reset password for ${branchCode}?\n\nTemporary password will be set to Branch@123.`
    );

    if (!confirmed) return;

    try {
      await resetBranchPassword(branchCode);
      alert("Password reset successful.");
      setRows((prev) =>
        prev.map((row) =>
          row.branch_code === branchCode
            ? { ...row, password_changed_at: null }
            : row
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reset failed");
    }
  }

  async function handleSaveUsername(branchCode: string) {
    const val = editUsernameVal.trim().toUpperCase();
    if (!val) {
      alert("Username cannot be empty");
      return;
    }
    setSavingUsername(true);
    try {
      await updateBranchUsername(branchCode, val);
      setRows((prev) =>
        prev.map((r) => (r.branch_code === branchCode ? { ...r, username: val } : r))
      );
      setEditingRow(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update username");
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleSaveMapping(branchCode: string) {
    const val = editMappingVal.trim().toUpperCase();
    if (branchCode === val) {
      alert("A branch cannot be mapped to itself");
      return;
    }
    setSavingMapping(true);
    try {
      await mapBranchToMain(branchCode, val);
      setRows((prev) =>
        prev.map((r) => (r.branch_code === branchCode ? { ...r, mapped_to: val || null } : r))
      );
      setEditingMapping(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update mapping");
    } finally {
      setSavingMapping(false);
    }
  }

  async function handleToggleTransfer() {
    const newVal = !transferEnabled;
    try {
      setTransferEnabled(newVal);
      await setAppSetting("transfer_enabled", newVal);
    } catch (err) {
      alert("Failed to update transfer setting");
      setTransferEnabled(!newVal);
    }
  }

  function getPasswordStatus(row: UserRow) {
    return row.password_changed_at ? "Custom password set" : "Temporary password active";
  }

  function exportExcel() {
    const data = rows.map((row) => ({
      Branch: row.branch_code,
      Area_Manager: row.area_manager || "",
      Username: row.username || row.branch_code,
      Mapped_To: row.mapped_to || "-",
      Status: row.is_active ? "Active" : "Disabled",
      Password_Status: getPasswordStatus(row),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branch_Security");

    const buf = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    });

    saveAs(new Blob([buf]), "Branch_Security.xlsx");
  }

  const filteredRows = rows.filter((row) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;

    return (
      (row.branch_code || "").toLowerCase().includes(query) ||
      (row.area_manager || "").toLowerCase().includes(query)
    );
  });

  const controllingBranches = filteredRows.filter(
    (row) => !row.mapped_to || row.mapped_to === row.branch_code
  );

  const modalBranches = rows.filter((row) => {
    const query = modalSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      (row.branch_code || "").toLowerCase().includes(query) ||
      (row.area_manager || "").toLowerCase().includes(query)
    );
  });

  if (role !== "ADMIN") {
    return <div className="p-6 text-red-600">Access denied</div>;
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Security - Branch Access Control
          </h1>
          <p className="text-sm text-gray-500">
            Manage branch logins, passwords and access status
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-gray-400">
            Logged in as: <b>HO (Admin)</b>
          </div>
          <button
            onClick={() => setShowMappingModal(true)}
            className="rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 shadow-sm transition"
          >
            Branch Mapping
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search branch or manager..."
          className="rounded border px-3 py-1.5 text-sm w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <input
              type="text"
              placeholder="Type branch code..."
              className="rounded border px-3 py-1.5 text-sm w-full"
              value={deleteSearch}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setDeleteSearch(value);
                setShowDropdown(true);
                if (value) {
                  void checkBranchData(value);
                } else {
                  setDeleteSummary(null);
                }
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            />

            {showDropdown && branchOptions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-auto rounded border bg-white shadow z-10">
                {branchOptions
                  .filter((branchCode) => branchCode.startsWith(deleteSearch))
                  .map((branchCode) => (
                    <div
                      key={branchCode}
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
                      onMouseDown={() => {
                        setDeleteSearch(branchCode);
                        setShowDropdown(false);
                        void checkBranchData(branchCode);
                      }}
                    >
                      {branchCode}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <button
            onClick={() => void handleDeleteBranch(deleteSearch)}
            className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
          >
            Delete Branch
          </button>
        </div>

        <button
          onClick={exportExcel}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 ml-2"
        >
          Export Excel
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded border bg-white p-4">
          <div className="text-xs text-gray-500">Global Settings</div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-medium">Transfer Functionality</span>
            <button
              onClick={() => void handleToggleTransfer()}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                transferEnabled ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  transferEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="rounded border bg-white p-4">
          <div className="text-xs text-gray-500">Total Branches</div>
          <div className="text-xl font-semibold">{totalBranches}</div>
        </div>

        <div className="rounded border bg-white p-4">
          <div className="text-xs text-gray-500">Active</div>
          <div className="text-xl font-semibold text-green-700">
            {activeCount}
          </div>
        </div>

        <div className="rounded border bg-white p-4">
          <div className="text-xs text-gray-500">Disabled</div>
          <div className="text-xl font-semibold text-red-700">
            {disabledCount}
          </div>
        </div>
      </div>

      {deleteSummary && (
        <div className="rounded border bg-white p-4 space-y-2">
          <div className="text-sm font-semibold text-gray-700">
            Branch: <span className="uppercase">{deleteSummary.branch}</span>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">LR Count</div>
              <div className="font-semibold">{deleteSummary.lrCount}</div>
            </div>
            <div>
              <div className="text-gray-500">Total Freight</div>
              <div className="font-semibold">Rs {deleteSummary.totalFreight.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500">Collected</div>
              <div className="font-semibold">Rs {deleteSummary.paid.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500">Balance</div>
              <div className="font-semibold">Rs {deleteSummary.balance.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide uppercase">
                Branch
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide uppercase">
                Area Manager
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 tracking-wide uppercase">
                Username
              </th>
              <th className="border px-2 py-1 text-center">Status</th>
              <th className="border px-2 py-1 text-center">Password State</th>
              <th className="border px-2 py-1 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {controllingBranches.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-100 hover:bg-slate-50 transition-all duration-200"
              >
                <td className="px-4 py-3">{row.branch_code}</td>
                <td className="px-4 py-3">{row.area_manager || "-"}</td>
                <td className="px-4 py-3">
                  {editingRow === row.branch_code ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editUsernameVal}
                        onChange={(e) => setEditUsernameVal(e.target.value)}
                        className="w-28 border border-blue-400 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                        disabled={savingUsername}
                      />
                      <button
                        onClick={() => void handleSaveUsername(row.branch_code)}
                        disabled={savingUsername}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded transition"
                      >
                        {savingUsername ? "Saving.." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingRow(null)}
                        disabled={savingUsername}
                        className="text-xs font-medium text-slate-500 hover:bg-slate-100 px-2 py-1 rounded transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{row.username || row.branch_code}</span>
                      <button
                        onClick={() => {
                          setEditingRow(row.branch_code);
                          setEditUsernameVal(row.username || row.branch_code);
                        }}
                        className="opacity-60 hover:opacity-100 transition whitespace-nowrap text-xs text-blue-600 underline"
                      >
                        Edit Alias
                      </button>
                    </div>
                  )}
                </td>

                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      row.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        row.is_active ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    {row.is_active ? "Active" : "Disabled"}
                  </span>
                </td>

                <td className="px-4 py-3 text-center text-xs text-gray-600">
                  {getPasswordStatus(row)}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.is_active ? (
                      <button
                        onClick={() => void handleToggleActive(row.branch_code, false)}
                        className="rounded-lg border border-rose-300 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50 transition"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleToggleActive(row.branch_code, true)}
                        className="rounded-lg border border-emerald-300 px-3 py-1 text-xs text-emerald-600 hover:bg-emerald-50 transition"
                      >
                        Enable
                      </button>
                    )}

                    {row.branch_code !== "ADMIN" && (
                      <button
                        onClick={() => void handleReset(row.branch_code)}
                        className="rounded-lg bg-slate-800 px-3 py-1 text-xs text-white hover:bg-slate-900 transition shadow-sm"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {controllingBranches.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            No controlling branches found
          </div>
        )}
      </div>

      {/* Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-full">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Branch Mapping Configuration</h2>
                <p className="text-sm text-slate-500">Map sub-branches to their controlling main branch</p>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-2"
              >
                &times;
              </button>
            </div>
            
            <div className="p-4 border-b bg-white">
              <input
                type="text"
                placeholder="Search branches..."
                className="w-full rounded border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-auto bg-white p-6">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 uppercase text-xs">Actual Branch</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 uppercase text-xs">Area Manager</th>
                    <th className="px-4 py-3 text-left font-medium text-purple-700 uppercase text-xs">Controlling Branch</th>
                  </tr>
                </thead>
                <tbody>
                  {modalBranches.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-800">{row.branch_code}</td>
                      <td className="px-4 py-3 text-slate-600">{row.area_manager || "-"}</td>
                      <td className="px-4 py-3">
                        {editingMapping === row.branch_code ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editMappingVal}
                              onChange={(e) => setEditMappingVal(e.target.value)}
                              placeholder={row.branch_code}
                              className="w-32 border border-purple-400 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-purple-500 uppercase"
                              disabled={savingMapping}
                            />
                            <button
                              onClick={() => void handleSaveMapping(row.branch_code)}
                              disabled={savingMapping}
                              className="text-xs font-medium text-white hover:bg-purple-700 bg-purple-600 px-3 py-1 rounded transition shadow-sm"
                            >
                              {savingMapping ? "..." : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingMapping(null)}
                              disabled={savingMapping}
                              className="text-xs font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 px-3 py-1 rounded transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-purple-700">{row.mapped_to || row.branch_code}</span>
                            <button
                              onClick={() => {
                                setEditingMapping(row.branch_code);
                                setEditMappingVal(row.mapped_to || row.branch_code);
                              }}
                              className="opacity-60 hover:opacity-100 transition whitespace-nowrap text-xs text-blue-600 underline"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {modalBranches.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        No branches found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
