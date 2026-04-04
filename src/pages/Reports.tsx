// FULL UPDATED Reports.tsx — UI UNCHANGED, ONLY ADDITIONS
// ✔ Date range works on collections_lrs
// ✔ Branch / Area / Party show Total LRs + Collected LRs
// ✔ Area manager name fixed
// ✔ Indian number format (thousands / lacs)

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBranch } from "@/context/BranchContext";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ================= TYPES =================
type AreaManagerSummaryRow = {
area_manager: string;
totalGRs: number;
collectedGRs: number;
totalFreight: number;
collected: number;
balance: number;
};

type MonthlyRow = {
month: string;
branch_code: string;
total_grs: number;
collected_grs: number;
total_freight: number;
collected: number;
};

type AgeingRow = {
month: string;
branch_code: string;
bucket: string;
balance: number;
};

type PartyRow = {
party_name: string;
total_grs: number;
collected_grs: number;
total_freight: number;
collected: number;
balance: number;
};

type AreaRow = AreaManagerSummaryRow;

export default function Reports() {
const { branch, role } = useBranch();

const [areaRows, setAreaRows] = useState<AreaRow[]>([]);

const [fromDate, setFromDate] = useState<string>(() => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
});

const [toDate, setToDate] = useState<string>(() => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
});

const [summaryRows, setSummaryRows] = useState<MonthlyRow[]>([]);
const [ageingRows, setAgeingRows] = useState<AgeingRow[]>([]);
const [loading, setLoading] = useState(true);

const [branchOpen, setBranchOpen] = useState(true);
const [areaOpen, setAreaOpen] = useState(false);
const [partyOpen, setPartyOpen] = useState(false);

const BRANCH_PAGE_SIZE = 25;
const PARTY_PAGE_SIZE = 25;

const [branchPage, setBranchPage] = useState(1);
const [partyPage, setPartyPage] = useState(1);

// 🔹 Sorting state
const [branchSort, setBranchSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
const [areaSort, setAreaSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
const [partySort, setPartySort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

const [partyRows, setPartyRows] = useState<PartyRow[]>([]);
const [partyLoading, setPartyLoading] = useState(false);

const PAGE_SIZE = 25;
const [partySearch, setPartySearch] = useState("");
const [debouncedPartySearch, setDebouncedPartySearch] = useState("");

function exportTable(data: any[], filename: string) {
    if (!data || data.length === 0) {
      alert("No data to export");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), filename + ".xlsx");
  }

  const fmt = (n: number) => n.toLocaleString("en-IN");
const pct = (part: number, total: number) => {
  if (!total || total === 0) return "0%";
  return ((part / total) * 100).toFixed(1) + "%";
};

useEffect(() => {
  const t = setTimeout(() => {
    setDebouncedPartySearch(partySearch);
  }, 300);
  return () => clearTimeout(t);
}, [partySearch]);

// ================= MAIN REPORT FETCH =================
useEffect(() => {
  if (!branch) return;

  async function fetchReports() {
    setLoading(true);

    const branchParam = role === "ADMIN" ? null : branch;
    const [resBranch, resArea, resAgeing] = await Promise.all([
      supabase.rpc("get_reports_branch", { p_from_date: fromDate, p_to_date: toDate, p_branch_code: branchParam }),
      supabase.rpc("get_reports_area", { p_from_date: fromDate, p_to_date: toDate, p_branch_code: branchParam }),
      supabase.rpc("get_reports_ageing", { p_from_date: fromDate, p_to_date: toDate, p_branch_code: branchParam }),
    ]);

    if (!resBranch.error && !resArea.error && !resAgeing.error) {
      const s1: MonthlyRow[] = (resBranch.data || []).map((r: any) => ({
        month: `${fromDate} → ${toDate}`,
        branch_code: r.branch_code,
        total_grs: Number(r.total_grs),
        collected_grs: Number(r.collected_grs),
        total_freight: Number(r.total_freight),
        collected: Number(r.collected),
      }));

      const s2: AgeingRow[] = (resAgeing.data || []).map((r: any) => ({
        month: `${fromDate} → ${toDate}`,
        branch_code: branch!,
        bucket: r.bucket,
        balance: Number(r.balance),
      }));

      const amSummary: AreaRow[] = (resArea.data || []).map((r: any) => ({
        area_manager: r.area_manager,
        totalGRs: Number(r.totalGRs),
        collectedGRs: Number(r.collectedGRs),
        totalFreight: Number(r.totalFreight),
        collected: Number(r.collected),
        balance: Number(r.totalFreight) - Number(r.collected),
      }));

      setSummaryRows(s1);
      setAgeingRows(s2);
      setAreaRows(amSummary);
      setLoading(false);
      return;
    }

    console.warn("RPC missing, falling back to client-side grouping...");

    let q = supabase
      .from("collections_lrs")
      .select("branch_code, area_manager, gr_date, total_freight, received_amount");

    if (role !== "ADMIN") q = q.eq("branch_code", branch);
    q = q.gte("gr_date", fromDate).lte("gr_date", toDate);

    let allRows: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await q.range(from, from + pageSize - 1);
      if (error) break;
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const rows = allRows;

    const summaryMap: Record<string, any> = {};
    rows.forEach((r) => {
      const b = r.branch_code;
      if (!summaryMap[b]) {
        summaryMap[b] = { total_grs: 0, collected_grs: 0, total_freight: 0, collected: 0 };
      }
      const freight = r.total_freight || 0;
      const received = Math.min(r.received_amount || 0, freight);

      summaryMap[b].total_grs += 1;
      if (received >= freight && freight > 0) summaryMap[b].collected_grs += 1;
      summaryMap[b].total_freight += freight;
      summaryMap[b].collected += received;
    });

    const s1: MonthlyRow[] = Object.entries(summaryMap).map(([branch_code, v]) => ({
      month: `${fromDate} → ${toDate}`,
      branch_code,
      total_grs: v.total_grs,
      collected_grs: v.collected_grs,
      total_freight: v.total_freight,
      collected: v.collected,
    }));

    const today = new Date();
    const bucketMap: Record<string, number> = {};
    rows.forEach((r) => {
      const bal = (r.total_freight || 0) - Math.min(r.received_amount || 0, r.total_freight || 0);
      if (bal <= 0) return;
      const d = new Date(r.gr_date);
      const days = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      let bucket = "0–30";
      if (days > 30 && days <= 60) bucket = "31–60";
      else if (days > 60 && days <= 90) bucket = "61–90";
      else if (days > 90) bucket = "90+";
      bucketMap[bucket] = (bucketMap[bucket] || 0) + bal;
    });

    const s2: AgeingRow[] = Object.entries(bucketMap).map(([bucket, balance]) => ({
      month: `${fromDate} → ${toDate}`,
      branch_code: branch!,
      bucket,
      balance,
    }));

    const amMap: Record<string, any> = {};
    rows.forEach((r) => {
      const am = r.area_manager || "UNKNOWN";
      if (!amMap[am]) amMap[am] = { area_manager: am, totalGRs: 0, collectedGRs: 0, totalFreight: 0, collected: 0 };
      const freight = r.total_freight || 0;
      const received = Math.min(r.received_amount || 0, freight);
      amMap[am].totalGRs += 1;
      if (received >= freight && freight > 0) amMap[am].collectedGRs += 1;
      amMap[am].totalFreight += freight;
      amMap[am].collected += received;
    });

    const amSummary: AreaRow[] = Object.entries(amMap).map(([_, v]) => ({
      ...v,
      balance: v.totalFreight - v.collected,
    }));

    setSummaryRows(s1);
    setAgeingRows(s2);
    setAreaRows(amSummary);
    setLoading(false);
  }

  fetchReports();
}, [branch, role, fromDate, toDate]);

// ================= PARTY FETCH =================
useEffect(() => {
  if (!partyOpen || !branch) return;

  async function fetchPartyOutstanding() {
    setPartyLoading(true);

    const { data } = await supabase.rpc("get_party_outstanding", {
      p_branch_code: role === "ADMIN" ? null : branch,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_search: debouncedPartySearch.trim() || null,
    });

    setPartyRows(data || []);
    setPartyLoading(false);
  }

  fetchPartyOutstanding();
  }, [partyOpen, branch, debouncedPartySearch, fromDate, toDate, role]);
  useEffect(() => {
    setBranchPage(1);
  }, [fromDate, toDate, branch]);

  useEffect(() => {
    setPartyPage(1);
  }, [debouncedPartySearch, fromDate, toDate, branch]);

function sortData<T extends Record<string, any>>(
  data: T[],
  sort: { key: string; dir: "asc" | "desc" } | null
) {
  if (!sort) return data;

  const { key, dir } = sort;

  return [...data].sort((a, b) => {
    let av: any = a[key];
    let bv: any = b[key];

    // 🔹 Virtual % columns support
    if (key === "lr_pct") {
      av = a.total_grs ? a.collected_grs / a.total_grs : 0;
      bv = b.total_grs ? b.collected_grs / b.total_grs : 0;
    }

    if (key === "amt_pct") {
      av = a.total_freight ? a.collected / a.total_freight : 0;
      bv = b.total_freight ? b.collected / b.total_freight : 0;
    }

    // 🔹 Balance virtual column
    if (key === "balance") {
      av = (a.total_freight || 0) - (a.collected || 0);
      bv = (b.total_freight || 0) - (b.collected || 0);
    }

    if (av == null && bv == null) return 0;
    if (av == null) return dir === "asc" ? -1 : 1;
    if (bv == null) return dir === "asc" ? 1 : -1;

    if (typeof av === "number" && typeof bv === "number") {
      return dir === "asc" ? av - bv : bv - av;
    }

    return dir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });
}

// ===== SORTED ROWS =====
const sortedBranchRows = useMemo(
  () => sortData(summaryRows, branchSort),
  [summaryRows, branchSort]
);

const sortedAreaRows = useMemo(
  () => sortData(areaRows, areaSort),
  [areaRows, areaSort]
);

const sortedPartyRows = useMemo(
  () => sortData(partyRows, partySort),
  [partyRows, partySort]
);

// ===== PAGED ROWS (AFTER SORT) =====
const pagedBranchRows = useMemo(() => {
  const start = (branchPage - 1) * PAGE_SIZE;
  return sortedBranchRows.slice(start, start + PAGE_SIZE);
}, [sortedBranchRows, branchPage]);

const pagedPartyRows = useMemo(() => {
  const start = (partyPage - 1) * PAGE_SIZE;
  return sortedPartyRows.slice(start, start + PAGE_SIZE);
}, [sortedPartyRows, partyPage]);

// ================= KPI =================
const summary = useMemo(() => {
  let totalGRs = 0;
  let collectedGRs = 0;
  let totalFreight = 0;
  let collected = 0;

  summaryRows.forEach((r) => {
    totalGRs += r.total_grs;
    collectedGRs += r.collected_grs;
    totalFreight += r.total_freight;
    collected += r.collected;
  });

  return {
    totalGRs,
    collectedGRs,
    totalFreight,
    collected,
    balance: totalFreight - collected,
  };
}, [summaryRows]);

if (loading) return <div className="p-6">Loading reports…</div>;

return (
  <div className="p-4 space-y-6">
    <h1 className="text-xl font-semibold">Reports</h1>

    {/* Filters */}
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
        className="rounded border px-2 py-1"
      />
      <span className="text-sm text-gray-600">to</span>
      <input
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
        className="rounded border px-2 py-1"
      />
    </div>

    {/* KPI */}
    <div className="grid grid-cols-4 gap-3">
      <Kpi label="Total LRs" value={summary.totalGRs} />
      <Kpi label="Total Freight" value={`₹ ${fmt(summary.totalFreight)}`} />
      <Kpi label="Collected" value={`₹ ${fmt(summary.collected)}`} green />
      <Kpi label="Balance" value={`₹ ${fmt(summary.balance)}`} red />
    </div>

    {/* Branch-wise */}
    <div className="rounded border bg-white">
            <div
        className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between items-center"
        onClick={() => setBranchOpen((o) => !o)}
      >
        <span>Branch-wise Outstanding</span>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              exportTable(
                summaryRows.map((r) => ({
                  Branch: r.branch_code,
                  "Total LRs": r.total_grs,
                  "Collected LRs": r.collected_grs,
                  Freight: r.total_freight,
                  Collected: r.collected,
                  Balance: r.total_freight - r.collected,
                  "Collection %": pct(r.collected, r.total_freight),
                })),
                `Branch_Outstanding_${fromDate}_to_${toDate}`
              );
            }}
            className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded shadow-sm border border-emerald-200 hover:bg-emerald-100 transition"
          >
            Export Excel
          </button>
          <span>{branchOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {branchOpen && (
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <SortTH
                label="Branch"
                sortKey="branch_code"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "branch_code",
                    dir: s?.key === "branch_code" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />
              <SortTH
                label="Total LRs"
                sortKey="total_grs"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "total_grs",
                    dir: s?.key === "total_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="Collected LRs"
                sortKey="collected_grs"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "collected_grs",
                    dir: s?.key === "collected_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="LR %"
                sortKey="lr_pct"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "lr_pct",
                    dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="Total Freight"
                sortKey="total_freight"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "total_freight",
                    dir: s?.key === "total_freight" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="Amount %"
                sortKey="amt_pct"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "amt_pct",
                    dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="Balance"
                sortKey="balance"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "balance",
                    dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
            </tr>
          </thead>
          <tbody>
              {pagedBranchRows.map((b) => (
              <tr key={b.branch_code}>
                <td className="border px-2 py-1">{b.branch_code}</td>
                <td className="border px-2 py-1 text-center">{b.total_grs}</td>
                <td className="border px-2 py-1 text-center">{b.collected_grs}</td>

                <td className="border px-2 py-1 text-center">
                  {pct(b.collected_grs, b.total_grs)}
                </td>

                <td className="border px-2 py-1 text-right">
                  ₹ {fmt(b.total_freight)}
                </td>

                <td className="border px-2 py-1 text-center">
                  {pct(b.collected, b.total_freight)}
                </td>

                <td className="border px-2 py-1 text-right text-red-700">
                  ₹ {fmt(b.total_freight - b.collected)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>      
        )}
        <div className="flex justify-end gap-2 p-2">
          <button
            disabled={branchPage === 1}
            onClick={() => setBranchPage((p) => p - 1)}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>

          <span className="text-sm px-2">
            Page {branchPage} / {Math.ceil(summaryRows.length / PAGE_SIZE)}
          </span>

          <button
            disabled={branchPage >= Math.ceil(summaryRows.length / PAGE_SIZE)}
            onClick={() => setBranchPage((p) => p + 1)}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
    </div>

    {/* Area Manager */}
    <div className="rounded border bg-white">
            <div
        className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between items-center"
        onClick={() => setAreaOpen((o) => !o)}
      >
        <span>Area Manager-wise Outstanding</span>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              exportTable(
                areaRows.map((r) => ({
                  "Area Manager": r.area_manager || "UNKNOWN",
                  "Total LRs": r.totalGRs,
                  "Collected LRs": r.collectedGRs,
                  Freight: r.totalFreight,
                  Collected: r.collected,
                  Balance: r.balance,
                  "Collection %": pct(r.collected, r.totalFreight),
                })),
                `Area_Outstanding_${fromDate}_to_${toDate}`
              );
            }}
            className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded shadow-sm border border-emerald-200 hover:bg-emerald-100 transition"
          >
            Export Excel
          </button>
          <span>{areaOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {areaOpen && (
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <SortTH
                label="Area Manager"
                sortKey="area_manager"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "area_manager",
                    dir: s?.key === "area_manager" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />
              <SortTH
                label="Total LRs"
                sortKey="totalGRs"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "totalGRs",
                    dir: s?.key === "totalGRs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="Collected LRs"
                sortKey="collectedGRs"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "collectedGRs",
                    dir: s?.key === "collectedGRs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <th className="px-3 py-2 text-right">LR %</th>
              <SortTH
                label="Total Freight"
                sortKey="totalFreight"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "totalFreight",
                    dir: s?.key === "totalFreight" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <th className="px-3 py-2 text-right">Amount %</th>
              <SortTH
                label="Balance"
                sortKey="balance"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "balance",
                    dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {sortedAreaRows.map((a) => (
              <tr key={a.area_manager}>
                <td className="border px-2 py-1">{a.area_manager}</td>
                <td className="border px-2 py-1 text-center">{a.totalGRs}</td>
                <td className="border px-2 py-1 text-center">{a.collectedGRs}</td>

                <td className="border px-2 py-1 text-center">
                  {pct(a.collectedGRs, a.totalGRs)}
                </td>

                <td className="border px-2 py-1 text-right">
                  ₹ {fmt(a.totalFreight)}
                </td>

                <td className="border px-2 py-1 text-center">
                  {pct(a.collected, a.totalFreight)}
                </td>

                <td className="border px-2 py-1 text-right text-red-700">
                  ₹ {fmt(a.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {/* Ageing */}
    <div className="rounded border bg-white">
      <div className="px-3 py-2 border-b font-semibold text-sm">Ageing (Outstanding)</div>
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Bucket</th>
            <th className="border px-2 py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(ageingRows.reduce((m: any, r) => { m[r.bucket] = (m[r.bucket]||0)+r.balance; return m; }, {})).map(
            ([bucket, amt]) => (
              <tr key={bucket}>
                <td className="border px-2 py-1">{bucket} days</td>
                <td className="border px-2 py-1 text-right">₹ {fmt(amt as number)}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>

    {/* Party-wise */}
    <div className="rounded border bg-white">
            <div
        className="flex items-center justify-between px-3 py-2 border-b font-semibold text-sm cursor-pointer"
        onClick={() => setPartyOpen((o) => !o)}
      >
        <span>Party-wise Outstanding</span>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              exportTable(
                partyRows.map((r) => ({
                  Party: r.party_name,
                  "Total LRs": r.total_grs,
                  "Collected LRs": r.collected_grs,
                  Freight: r.total_freight,
                  Collected: r.collected,
                  Balance: r.balance,
                  "Collection %": pct(r.collected, r.total_freight),
                })),
                `Party_Outstanding_${fromDate}_to_${toDate}`
              );
            }}
            className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded shadow-sm border border-emerald-200 hover:bg-emerald-100 transition"
          >
            Export Excel
          </button>
          <span>{partyOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {partyOpen && (
        <div className="p-3 space-y-3">
          <input
            type="text"
            placeholder="Search party name…"
            className="rounded border px-2 py-1 text-sm"
            value={partySearch}
            onChange={(e) => setPartySearch(e.target.value)}
          />

          {partyLoading && (
            <div className="text-sm text-gray-500">Loading party outstanding…</div>
          )}

          <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <SortTH
                label="Party"
                sortKey="party_name"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "party_name",
                    dir: s?.key === "party_name" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />
              <SortTH
                label="Total LRs"
                sortKey="total_grs"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "total_grs",
                    dir: s?.key === "total_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="Collected LRs"
                sortKey="collected_grs"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "collected_grs",
                    dir: s?.key === "collected_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="LR %"
                sortKey="lr_pct"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "lr_pct",
                    dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="Total Freight"
                sortKey="total_freight"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "total_freight",
                    dir: s?.key === "total_freight" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="Amount %"
                sortKey="amt_pct"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "amt_pct",
                    dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH
                label="Balance"
                sortKey="balance"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "balance",
                    dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {pagedPartyRows.map((r) => (
              <tr key={r.party_name}>
                <td className="border px-2 py-1">{r.party_name}</td>
                <td className="border px-2 py-1 text-right">{r.total_grs}</td>
                <td className="border px-2 py-1 text-right">{r.collected_grs}</td>
                <td className="border px-2 py-1 text-right">{pct(r.collected_grs, r.total_grs)}</td>
                <td className="border px-2 py-1 text-right">₹ {fmt(r.total_freight)}</td>
                <td className="border px-2 py-1 text-right">{pct(r.collected, r.total_freight)}</td>
                <td className="border px-2 py-1 text-right text-red-700">₹ {fmt(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          </table>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={partyPage === 1}
                onClick={() => setPartyPage((p) => p - 1)}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                Prev
              </button>

              <span className="text-sm px-2">
                Page {partyPage} / {Math.ceil(partyRows.length / PAGE_SIZE)}
              </span>

              <button
                disabled={partyPage >= Math.ceil(partyRows.length / PAGE_SIZE)}
                onClick={() => setPartyPage((p) => p + 1)}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
        </div>
      )}
    </div>
  </div>
);
}

// ================= HELPERS =================
function SortTH({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const isActive = sortKey === activeKey;
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 cursor-pointer select-none border-b hover:bg-gray-100 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end w-full" : ""}`}>
        {label}
        {isActive && (
          <span className="text-xs text-gray-500">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}

function Kpi({ label, value, green, red }: any) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white border border-gray-200 shadow-sm p-4 hover:shadow-md transition">
      <div
        className={`absolute top-0 left-0 h-1 w-full ${
          green ? "bg-green-500" : red ? "bg-red-500" : "bg-blue-500"
        }`}
      />
      <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-bold ${
          green ? "text-green-700" : red ? "text-red-700" : "text-gray-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
