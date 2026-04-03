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

  function getPasswordStatus(row: UserRow) {
    return row.password_changed_at ? "Custom password set" : "Temporary password active";
  }

  function exportExcel() {
    const data = rows.map((row) => ({
      Branch: row.branch_code,
      Area_Manager: row.area_manager || "",
      Username: row.branch_code,
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

        <div className="text-xs text-gray-400">
          Logged in as: <b>HO (Admin)</b>
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

      <div className="grid grid-cols-3 gap-4">
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
            {filteredRows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-100 hover:bg-slate-50 transition-all duration-200"
              >
                <td className="px-4 py-3">{row.branch_code}</td>
                <td className="px-4 py-3">{row.area_manager || "-"}</td>
                <td className="px-4 py-3">{row.branch_code}</td>

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

        {filteredRows.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            No branches found
          </div>
        )}
      </div>
    </div>
  );
}
