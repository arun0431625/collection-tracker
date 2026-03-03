import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useBranch } from "../context/BranchContext";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type UserRow = {
  id: string;
  branch_code: string;
  area_manager: string;
  username: string;
  is_active: boolean;
  password_changed_at: string | null;
};

export default function Security() {
  const { role } = useBranch();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteSearch, setDeleteSearch] = useState("");          // branch search input
  const [deleteSummary, setDeleteSummary] = useState<{
    branch: string;
    lrCount: number;
    totalFreight: number;
    paid: number;
    balance: number;
  } | null>(null);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);   // dropdown list
  const [showDropdown, setShowDropdown] = useState(false);            // show/hide list
  const totalBranches = rows.length;
  const activeCount = rows.filter((r) => r.is_active).length;
  const disabledCount = rows.filter((r) => !r.is_active).length;

useEffect(() => {
  if (role !== "ADMIN") return;

  async function fetchBranches() {
    setLoading(true);

    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("branch_code");

    console.log("Branches:", data);
    console.log("Error:", error);

    if (!error && data) {
      setRows(data);
    }

    setLoading(false);
  }

  fetchBranches();
}, [role]);

async function checkBranchData(branch: string) {
  if (!branch) return;
  // count LRs
  const { count: lrCount } = await supabase
    .from("collections_lrs")
    .select("*", { count: "exact", head: true })
    .eq("branch_code", branch.toUpperCase());

  // sum freight
  const { data: freight } = await supabase
    .from("collections_lrs")
    .select("total_freight")
    .eq("branch_code", branch.toUpperCase());

  const totalFreight = freight?.reduce((s, r) => s + (r.total_freight || 0), 0) || 0;

  // sum paid (assuming you store paid_amount in same table – adjust column name)
  const { data: paid } = await supabase
    .from("collections_lrs")
    .select("paid_amount")
    .eq("branch_code", branch.toUpperCase());

  const paidAmt = paid?.reduce((s, r) => s + (r.paid_amount || 0), 0) || 0;

  setDeleteSummary({
    branch: branch.toUpperCase(),
    lrCount: lrCount || 0,
    totalFreight,
    paid: paidAmt,
    balance: totalFreight - paidAmt,
  });
}

async function deleteBranch(branch: string) {
  if (!branch) return;
  const sum = deleteSummary;
  if (!sum || sum.branch !== branch.toUpperCase()) {
    alert("Please check branch data first");
    return;
  }
  const msg = sum.lrCount === 0
    ? `No LRs found. Delete branch ${branch}?`
    : `⚠️  ${sum.lrCount} LRs (₹${sum.totalFreight}) will be PERMANENTLY deleted. Continue?`;
  const yes = window.confirm(msg);
  if (!yes) return;

  // 1. delete LRs
  await supabase.from("collections_lrs").delete().eq("branch_code", branch.toUpperCase());
  // 2. delete branch user
  await supabase.from("branches").delete().eq("branch_code", branch.toUpperCase());

  alert("Branch & its LRs deleted successfully");
  setDeleteSummary(null);
  setDeleteSearch("");
  // refresh table
  const { data } = await supabase
    .from("branches")
    .select("*")
    .order("branch_code");
  setRows(data || [])
  // build unique branch list for delete-search
const uniqueBranches = Array.from(new Set((data || []).map((r) => r.branch_code))).sort();
setBranchOptions(uniqueBranches);
}
  async function toggleActive(branch_code: string, newValue: boolean) {
    const { error } = await supabase
      .from("branches")
      .update({ is_active: newValue })
      .eq("branch_code", branch_code);

    if (error) {
      alert("❌ Failed to update status");
      console.error(error);
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.branch_code === branch_code ? { ...r, is_active: newValue } : r
      )
    );
  }

  async function handleReset(branchCode: string) {
    if (branchCode === "ADMIN") {
      alert("Admin password cannot be reset from here");
      return;
    }

    const confirmReset = window.confirm(
      `Reset password for ${branchCode}?\n\nPassword will be set to Branch@123`
    );

    if (!confirmReset) return;

    const { error } = await supabase.rpc(
      "admin_reset_branch_password",
      { p_branch_code: branchCode }
    );

    if (error) {
      alert("Reset failed");
      console.error(error);
    } else {
      alert("Password reset successful");

      setRows((prev) =>
        prev.map((r) =>
          r.branch_code === branchCode
            ? { ...r, password_changed_at: null }
            : r
        )
      );
    }
  }
  function getDisplayPassword(u: UserRow) {
    const defaultPwd = u.branch_code.slice(0, 3).toUpperCase() + "ATC";
    if (u.password_changed_at) return "******** (custom set)";
    return defaultPwd;
  }

  const filteredRows = rows.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;

    return (
      u.branch_code.toLowerCase().includes(q) ||
      u.area_manager.toLowerCase().includes(q) ||
      u.branch_code.toLowerCase().includes(q)
    );
  });

  function exportExcel() {
    const data = rows.map((u) => ({
      Branch: u.branch_code,
      Area_Manager: u.area_manager,
      Username: u.branch_code,
      Status: u.is_active ? "Active" : "Disabled",
      Default_Password: getDisplayPassword(u),
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

  if (role !== "ADMIN") {
    return <div className="p-6 text-red-600">Access denied</div>;
  }

  if (loading) {
    return <div className="p-6">Loading…</div>;
  }

  return (
      <div className="p-8 space-y-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            🔐 Security – Branch Access Control
          </h1>
          <p className="text-sm text-gray-500">
            Manage branch logins, passwords and access status
          </p>
        </div>

        <div className="text-xs text-gray-400">
          Logged in as: <b>HO (Admin)</b>
        </div>
      </div>

      {/* Search + Export */}
{/* Search + Export + Delete Branch */}
<div className="flex items-center justify-between gap-4">
  <input
    type="text"
    placeholder="Search branch, manager or username…"
    className="rounded border px-3 py-1.5 text-sm w-72"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />

  <div className="flex items-center gap-2">
    <div className="relative w-48">
  <input
    type="text"
    placeholder="Type branch code…"
    className="rounded border px-3 py-1.5 text-sm w-full"
    value={deleteSearch}
    onChange={(e) => {
      const val = e.target.value.toUpperCase();
      setDeleteSearch(val);
      setShowDropdown(true);
      if (val) checkBranchData(val);
      else setDeleteSummary(null);
    }}
    onFocus={() => setShowDropdown(true)}
    onBlur={() => setTimeout(() => setShowDropdown(false), 150)} // allow click
  />

  {/* LIVE DROPDOWN */}
  {showDropdown && branchOptions.length > 0 && (
    <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-auto rounded border bg-white shadow z-10">
      {branchOptions
        .filter((b) => b.startsWith(deleteSearch))
        .map((b) => (
          <div
            key={b}
            className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
            onMouseDown={() => {
              setDeleteSearch(b);
              setShowDropdown(false);
              checkBranchData(b);
            }}
          >
            {b}
          </div>
        ))}
    </div>
  )}
</div>
    <button
      onClick={() => deleteBranch(deleteSearch)}
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

      {/* KPI Cards */}
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
{/* Delete Branch Summary Card */}
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
        <div className="font-semibold">₹{deleteSummary.totalFreight.toLocaleString()}</div>
      </div>
      <div>
        <div className="text-gray-500">Paid</div>
        <div className="font-semibold">₹{deleteSummary.paid.toLocaleString()}</div>
      </div>
      <div>
        <div className="text-gray-500">Balance</div>
        <div className="font-semibold">₹{deleteSummary.balance.toLocaleString()}</div>
      </div>
    </div>
    {deleteSummary.lrCount === 0 ? (
      <div className="text-xs text-green-600">✅ Safe to delete – no LRs found</div>
    ) : (
      <div className="text-xs text-red-600">⚠️ Contains LRs – will be permanently removed</div>
    )}
  </div>
)}
      {/* Table */}
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
              <th className="border px-2 py-1 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50 transition-all duration-200">
                <td className="px-4 py-3">{u.branch_code}</td>
                <td className="px-4 py-3">{u.area_manager}</td>
                <td className="px-4 py-3">
                  {u.branch_code}
                  <div className="text-[10px] text-gray-400">
                    Default: {getDisplayPassword(u)}
                  </div>
                </td>

                <td className="px-4 py-3 text-center">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                u.is_active
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}>
                <span className={`h-2 w-2 rounded-full ${
                  u.is_active ? "bg-emerald-500" : "bg-rose-500"
                }`} />
                {u.is_active ? "Active" : "Disabled"}
              </span>
              </td>

          <td className="px-4 py-3">
            <div className="flex items-center gap-2">

              {u.is_active ? (
                <button
                  onClick={() => toggleActive(u.branch_code, false)}
                  className="rounded-lg border border-rose-300 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50 transition"
                >
                  Disable
                </button>
              ) : (
                <button
                  onClick={() => toggleActive(u.branch_code, true)}
                  className="rounded-lg border border-emerald-300 px-3 py-1 text-xs text-emerald-600 hover:bg-emerald-50 transition"
                >
                  Enable
                </button>
              )}

              {u.branch_code !== "ADMIN" && (
                <button
                  onClick={() => handleReset(u.branch_code)}
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
