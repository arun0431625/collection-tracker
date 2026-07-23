// FULL UPDATED Reports.tsx — UI UNCHANGED, ONLY ADDITIONS
// ✔ Date range works on collections_lrs
// ✔ Branch / Area / Party show Total LRs + Collected LRs
// ✔ Area manager name fixed
// ✔ Indian number format (thousands / lacs)

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBranch } from "@/context/BranchContext";
import { useViewer } from "@/context/ViewerContext";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import { toast } from "sonner";

// ================= TYPES =================
type AreaManagerSummaryRow = {
area_manager: string;
totalGRs: number;
collectedGRs: number;
totalFreight: number;
collected: number;
balance: number;
};

type SubBranchRow = {
  branch_code: string;
  total_grs: number;
  collected_grs: number;
  total_freight: number;
  collected: number;
};

type MonthlyRow = {
  month: string;
  branch_code: string;
  total_grs: number;
  collected_grs: number;
  total_freight: number;
  collected: number;
  sub_branches?: SubBranchRow[];
};

type AgeingRow = {
month: string;
branch_code: string;
bucket: string;
balance: number;
};

type PartyRow = {
party_name: string;
  branches?: string;
total_grs: number;
collected_grs: number;
total_freight: number;
collected: number;
balance: number;
total_count?: number;
};

type AreaRow = AreaManagerSummaryRow;
type SortState = { key: string; dir: "asc" | "desc" };
type PartyFetchProgress = {
  fetchedCount: number;
  totalCount: number | null;
};

const CURRENCY_LABEL = "Rs.";
const UP_ARROW = "^";
const DOWN_ARROW = "v";
const DATE_RANGE_ARROW = "->";

const DEFAULT_PARTY_SORT: SortState = {
  key: "total_freight",
  dir: "desc",
};

function normalizePartyRows(rows: any[]): PartyRow[] {
  return (rows || []).map((row: any) => ({
    party_name: row.party_name || "UNKNOWN",
    branches: row.branches || "",
    total_grs: Number(row.total_grs) || 0,
    collected_grs: Number(row.collected_grs) || 0,
    total_freight: Number(row.total_freight) || 0,
    collected: Number(row.collected) || 0,
    balance: Number(row.balance) || 0,
    total_count: Number(row.total_count) || 0,
  }));
}

async function fetchAllPartyOutstandingRows({
  branchCode,
  fromDate,
  toDate,
  search,
  sort,
  onProgress,
}: {
  branchCode: string | null;
  fromDate: string;
  toDate: string;
  search: string;
  sort: SortState;
  onProgress?: (progress: PartyFetchProgress) => void;
}) {
  const allRows: PartyRow[] = [];
  let from = 0;
  const chunkSize = 1000;
  let usedFallback = false;

  while (true) {
    const { data, error } = await supabase.rpc("get_party_outstanding_page", {
      p_branch_code: branchCode,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_search: search.trim() || null,
      p_sort_key: sort.key,
      p_sort_dir: sort.dir,
      p_limit: chunkSize,
      p_offset: from,
    });

    if (error) {
      usedFallback = true;
      const { data: fallbackData, error: fallbackError } = await supabase.rpc(
        "get_party_outstanding",
        {
          p_branch_code: branchCode,
          p_from_date: fromDate,
          p_to_date: toDate,
          p_search: search.trim() || null,
        }
      ).range(from, from + chunkSize - 1);

      if (fallbackError) {
        throw fallbackError;
      }

      allRows.push(...normalizePartyRows(fallbackData || []));
      onProgress?.({
        fetchedCount: allRows.length,
        totalCount: null,
      });

      if (!fallbackData || fallbackData.length < chunkSize) {
        break;
      }

      from += chunkSize;
      continue;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...normalizePartyRows(data));
    const totalCount = Number(data[0]?.total_count) || 0;
    onProgress?.({
      fetchedCount: allRows.length,
      totalCount: totalCount || null,
    });

    if (data.length < chunkSize) {
      break;
    }

    from += chunkSize;
  }

  return usedFallback ? sortData(allRows, sort) : allRows;
}

async function fetchPartyOutstandingPage({
  branchCode,
  fromDate,
  toDate,
  search,
  sort,
  page,
  pageSize,
}: {
  branchCode: string | null;
  fromDate: string;
  toDate: string;
  search: string;
  sort: SortState;
  page: number;
  pageSize: number;
}) {
  const offset = (page - 1) * pageSize;

  const { data, error } = await supabase.rpc("get_party_outstanding_page", {
    p_branch_code: branchCode,
    p_from_date: fromDate,
    p_to_date: toDate,
    p_search: search.trim() || null,
    p_sort_key: sort.key,
    p_sort_dir: sort.dir,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (!error) {
    return {
      rows: normalizePartyRows(data || []),
      totalCount: Number(data?.[0]?.total_count) || 0,
    };
  }

  const allRows = await fetchAllPartyOutstandingRows({
    branchCode,
    fromDate,
    toDate,
    search,
    sort,
  });

  return {
    rows: allRows.slice(offset, offset + pageSize),
    totalCount: allRows.length,
  };
}

export default function Reports() {
const { branch, role } = useBranch();
const { isViewer } = useViewer();
const isAdminOrViewer = role === "ADMIN" || isViewer;

const [areaRows, setAreaRows] = useState<AreaRow[]>([]);

const [fromDate, setFromDate] = useSessionStorageState<string>("reports_from_date", () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
});

const [toDate, setToDate] = useSessionStorageState<string>("reports_to_date", () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
});

const [summaryRows, setSummaryRows] = useState<MonthlyRow[]>([]);
const [ageingRows, setAgeingRows] = useState<AgeingRow[]>([]);
const [loading, setLoading] = useState(true);

const [branchOpen, setBranchOpen] = useSessionStorageState<boolean>("reports_branch_open", true);
const [areaOpen, setAreaOpen] = useSessionStorageState<boolean>("reports_area_open", false);
const [partyOpen, setPartyOpen] = useSessionStorageState<boolean>("reports_party_open", false);

const BRANCH_PAGE_SIZE = 25;
const PARTY_PAGE_SIZE = 25;

const [branchPage, setBranchPage] = useState(1);
const [partyPage, setPartyPage] = useState(1);

const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});

const toggleBranch = (branchCode: string) => {
  setExpandedBranches(prev => ({ ...prev, [branchCode]: !prev[branchCode] }));
};

// 🔹 Sorting state
const [branchSort, setBranchSort] = useState<SortState | null>(null);
const [areaSort, setAreaSort] = useState<SortState | null>(null);
const [partySort, setPartySort] = useState<SortState>(DEFAULT_PARTY_SORT);

const [partyRows, setPartyRows] = useState<PartyRow[]>([]);
const [partyLoading, setPartyLoading] = useState(false);
const [partyTotalCount, setPartyTotalCount] = useState(0);
const [partyExporting, setPartyExporting] = useState(false);

const PAGE_SIZE = 25;
const [partySearch, setPartySearch] = useSessionStorageState<string>("reports_party_search", "");
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
  if (!branch && !isViewer) return;

  async function fetchReports() {
    setLoading(true);

    const branchParam = isAdminOrViewer ? null : branch;
    const [resBranch, resArea, resAgeing] = await Promise.all([
      supabase.rpc("get_reports_branch_detailed", { p_from_date: fromDate, p_to_date: toDate, p_branch_code: branchParam }),
      supabase.rpc("get_reports_area", { p_from_date: fromDate, p_to_date: toDate, p_branch_code: branchParam }),
      supabase.rpc("get_reports_ageing", { p_from_date: fromDate, p_to_date: toDate, p_branch_code: branchParam }),
    ]);

    if (!resBranch.error && !resArea.error && !resAgeing.error) {
      const summaryMap: Record<string, MonthlyRow> = {};

      (resBranch.data || []).forEach((r: any) => {
        const cb = r.controlling_branch;
        if (!summaryMap[cb]) {
          summaryMap[cb] = {
            month: `${fromDate} → ${toDate}`,
            branch_code: cb,
            total_grs: 0,
            collected_grs: 0,
            total_freight: 0,
            collected: 0,
            sub_branches: []
          };
        }
        
        summaryMap[cb].total_grs += Number(r.total_grs);
        summaryMap[cb].collected_grs += Number(r.collected_grs);
        summaryMap[cb].total_freight += Number(r.total_freight);
        summaryMap[cb].collected += Number(r.collected);
        
        summaryMap[cb].sub_branches!.push({
          branch_code: r.branch_code === cb ? `${r.branch_code} (Direct)` : r.branch_code,
          total_grs: Number(r.total_grs),
          collected_grs: Number(r.collected_grs),
          total_freight: Number(r.total_freight),
          collected: Number(r.collected),
        });
      });
      
      const s1: MonthlyRow[] = Object.values(summaryMap).map(row => {
        if (row.sub_branches!.length <= 1) {
          row.sub_branches = [];
        } else {
          row.sub_branches!.sort((a, b) => a.branch_code.includes('(Direct)') ? -1 : b.branch_code.includes('(Direct)') ? 1 : a.branch_code.localeCompare(b.branch_code));
        }
        return row;
      });

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

    const { data: branchesData } = await supabase.from("branches").select("branch_code, mapped_to");
    const branchMap: Record<string, string> = {};
    (branchesData || []).forEach(b => {
      branchMap[b.branch_code.toUpperCase()] = b.mapped_to ? b.mapped_to.toUpperCase() : b.branch_code.toUpperCase();
    });

    let q = supabase
      .from("collections_lrs")
      .select("branch_code, area_manager, gr_date, total_freight, received_amount, tds_amount");

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

    const summaryMap: Record<string, MonthlyRow> = {};
    rows.forEach((r) => {
      const actualBranch = (r.branch_code || "UNKNOWN").toUpperCase();
      const cb = branchMap[actualBranch] || actualBranch;
      
      if (!summaryMap[cb]) {
        summaryMap[cb] = { month: `${fromDate} → ${toDate}`, branch_code: cb, total_grs: 0, collected_grs: 0, total_freight: 0, collected: 0, sub_branches: [] };
      }
      
      const freight = r.total_freight || 0;
      const received = Math.min((r.received_amount || 0) + (r.tds_amount || 0), freight);

      summaryMap[cb].total_grs += 1;
      if (received >= freight && freight > 0) summaryMap[cb].collected_grs += 1;
      summaryMap[cb].total_freight += freight;
      summaryMap[cb].collected += received;
      
      const subBranchCode = actualBranch === cb ? `${actualBranch} (Direct)` : actualBranch;
      let sub = summaryMap[cb].sub_branches!.find(s => s.branch_code === subBranchCode);
      if (!sub) {
        sub = { branch_code: subBranchCode, total_grs: 0, collected_grs: 0, total_freight: 0, collected: 0 };
        summaryMap[cb].sub_branches!.push(sub);
      }
      sub.total_grs += 1;
      if (received >= freight && freight > 0) sub.collected_grs += 1;
      sub.total_freight += freight;
      sub.collected += received;
    });

    const s1: MonthlyRow[] = Object.values(summaryMap).map(row => {
      if (row.sub_branches!.length <= 1) {
        row.sub_branches = [];
      } else {
        row.sub_branches!.sort((a, b) => a.branch_code.includes('(Direct)') ? -1 : b.branch_code.includes('(Direct)') ? 1 : a.branch_code.localeCompare(b.branch_code));
      }
      return row;
    });

    const today = new Date();
    const bucketMap: Record<string, number> = {};
    rows.forEach((r) => {
      const bal = (r.total_freight || 0) - Math.min((r.received_amount || 0) + (r.tds_amount || 0), r.total_freight || 0);
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
      const received = Math.min((r.received_amount || 0) + (r.tds_amount || 0), freight);
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

    try {
      const result = await fetchPartyOutstandingPage({
        branchCode: role === "ADMIN" ? null : branch,
        fromDate,
        toDate,
        search: debouncedPartySearch,
        sort: partySort,
        page: partyPage,
        pageSize: PARTY_PAGE_SIZE,
      });

      setPartyRows(result.rows);
      setPartyTotalCount(result.totalCount);
    } finally {
      setPartyLoading(false);
    }
  }

  fetchPartyOutstanding();
  }, [partyOpen, branch, debouncedPartySearch, fromDate, toDate, role, partySort, partyPage]);
  useEffect(() => {
    setBranchPage(1);
  }, [fromDate, toDate, branch]);

  useEffect(() => {
    setPartyPage(1);
  }, [debouncedPartySearch, fromDate, toDate, branch, partySort]);

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
      const aT = a.total_grs ?? a.totalGRs ?? 0;
      const aC = a.collected_grs ?? a.collectedGRs ?? 0;
      av = aT ? aC / aT : 0;
      const bT = b.total_grs ?? b.totalGRs ?? 0;
      const bC = b.collected_grs ?? b.collectedGRs ?? 0;
      bv = bT ? bC / bT : 0;
    }

    if (key === "amt_pct") {
      const aF = a.total_freight ?? a.totalFreight ?? 0;
      av = aF ? (a.collected || 0) / aF : 0;
      const bF = b.total_freight ?? b.totalFreight ?? 0;
      bv = bF ? (b.collected || 0) / bF : 0;
    }

    // 🔹 Balance virtual column
    if (key === "balance") {
      const aF2 = a.total_freight ?? a.totalFreight ?? 0;
      av = aF2 - (a.collected || 0);
      const bF2 = b.total_freight ?? b.totalFreight ?? 0;
      bv = bF2 - (b.collected || 0);
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
  () => partyRows,
  [partyRows]
);

// ===== PAGED ROWS (AFTER SORT) =====
const pagedBranchRows = useMemo(() => {
  const start = (branchPage - 1) * PAGE_SIZE;
  return sortedBranchRows.slice(start, start + PAGE_SIZE);
}, [sortedBranchRows, branchPage]);

const pagedPartyRows = useMemo(() => {
  return sortedPartyRows;
}, [sortedPartyRows]);

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

if (loading) return <div className="p-6">Loading reports...</div>;

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
      <Kpi label="Total Freight" value={`${CURRENCY_LABEL} ${fmt(summary.totalFreight)}`} />
      <Kpi label="Collected" value={`${CURRENCY_LABEL} ${fmt(summary.collected)}`} green />
      <Kpi label="Balance" value={`${CURRENCY_LABEL} ${fmt(summary.balance)}`} red />
    </div>

    {/* Ageing */}
    <div className="rounded border bg-white">
      <div className="px-4 py-3 border-b font-bold text-sm bg-slate-600 text-white rounded-t">Ageing (Outstanding)</div>
      <table className="w-full table-fixed border-collapse text-sm">
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
                <td className="border px-2 py-1 text-right">{CURRENCY_LABEL} {fmt(amt as number)}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>

    {/* Branch-wise */}
    <div className="rounded border bg-white">
            <div
        className="px-4 py-3 border-b font-bold text-sm cursor-pointer flex justify-between items-center bg-slate-600 text-white rounded-t hover:bg-slate-500 transition"
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
            className="text-xs bg-emerald-500 text-white px-3 py-1 rounded shadow border border-emerald-600 hover:bg-emerald-600 transition"
          >
            Export Excel
          </button>
          <span>{branchOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {branchOpen && (
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <SortTH width="40%" label="Branch" sortKey="branch_code"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "branch_code",
                    dir: s?.key === "branch_code" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />
              <SortTH width="7%" label="Total LRs"
                sortKey="total_grs"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "total_grs",
                    dir: s?.key === "total_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="7%" label="Coll. LRs"
                sortKey="collected_grs"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "collected_grs",
                    dir: s?.key === "collected_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="5%" label="LR %"
                sortKey="lr_pct"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "lr_pct",
                    dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="14%" label="Total Freight"
                sortKey="total_freight"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "total_freight",
                    dir: s?.key === "total_freight" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="5%" label="Amt %"
                sortKey="amt_pct"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "amt_pct",
                    dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="14%" label="Balance"
                sortKey="balance"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "balance",
                    dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
            </tr>
          </thead>
          <tbody>
              {pagedBranchRows.map((b) => {
                const hasSub = b.sub_branches && b.sub_branches.length > 0;
                const isExpanded = expandedBranches[b.branch_code];
                return (
                  <React.Fragment key={b.branch_code}>
                    <tr 
                      className={`${hasSub ? "cursor-pointer hover:bg-blue-50" : "hover:bg-gray-50"}`}
                      onClick={() => hasSub && toggleBranch(b.branch_code)}
                    >
                      <td className="border px-2 py-1 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{b.branch_code}</span>
                          {hasSub && (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                              +{b.sub_branches!.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border px-2 py-1 text-center font-medium">{b.total_grs}</td>
                      <td className="border px-2 py-1 text-center font-medium">{b.collected_grs}</td>
                      <td className="border px-2 py-1 text-center font-medium">
                        {pct(b.collected_grs, b.total_grs)}
                      </td>
                      <td className="border px-2 py-1 text-right font-medium">
                        {CURRENCY_LABEL} {fmt(b.total_freight)}
                      </td>
                      <td className="border px-2 py-1 text-center font-medium">
                        {pct(b.collected, b.total_freight)}
                      </td>
                      <td className="border px-2 py-1 text-right text-red-700 font-bold">
                        {CURRENCY_LABEL} {fmt(b.total_freight - b.collected)}
                      </td>
                    </tr>
                    
                    {isExpanded && hasSub && b.sub_branches!.map((sub, i) => (
                      <tr key={`${b.branch_code}-sub-${i}`} className="bg-slate-50 hover:bg-slate-100 text-sm">
                        <td className="border px-2 py-1 pl-6 text-slate-600 border-l-4 border-l-blue-400">
                          &#x21b3; {sub.branch_code}
                        </td>
                        <td className="border px-2 py-1 text-center text-slate-600">{sub.total_grs}</td>
                        <td className="border px-2 py-1 text-center text-slate-600">{sub.collected_grs}</td>
                        <td className="border px-2 py-1 text-center text-slate-600">
                          {pct(sub.collected_grs, sub.total_grs)}
                        </td>
                        <td className="border px-2 py-1 text-right text-slate-600">
                          {CURRENCY_LABEL} {fmt(sub.total_freight)}
                        </td>
                        <td className="border px-2 py-1 text-center text-slate-600">
                          {pct(sub.collected, sub.total_freight)}
                        </td>
                        <td className="border px-2 py-1 text-right text-red-600">
                          {CURRENCY_LABEL} {fmt(sub.total_freight - sub.collected)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
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
        className="px-4 py-3 border-b font-bold text-sm cursor-pointer flex justify-between items-center bg-slate-600 text-white rounded-t hover:bg-slate-500 transition"
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
            className="text-xs bg-emerald-500 text-white px-3 py-1 rounded shadow border border-emerald-600 hover:bg-emerald-600 transition"
          >
            Export Excel
          </button>
          <span>{areaOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {areaOpen && (
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <SortTH width="40%" label="Area Manager" sortKey="area_manager"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "area_manager",
                    dir: s?.key === "area_manager" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />
              <SortTH width="7%" label="Total LRs"
                sortKey="totalGRs"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "totalGRs",
                    dir: s?.key === "totalGRs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="7%" label="Coll. LRs"
                sortKey="collectedGRs"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "collectedGRs",
                    dir: s?.key === "collectedGRs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="5%" label="LR %" sortKey="lr_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "lr_pct", dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH width="14%" label="Total Freight"
                sortKey="totalFreight"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "totalFreight",
                    dir: s?.key === "totalFreight" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="5%" label="Amt %" sortKey="amt_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "amt_pct", dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH width="14%" label="Balance"
                sortKey="balance"
                activeKey={areaSort?.key || ""}
                dir={areaSort?.dir || "asc"}
                onClick={() =>
                  setAreaSort(s => ({
                    key: "balance",
                    dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
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
                  {CURRENCY_LABEL} {fmt(a.totalFreight)}
                </td>

                <td className="border px-2 py-1 text-center">
                  {pct(a.collected, a.totalFreight)}
                </td>

                <td className="border px-2 py-1 text-right text-red-700">
                  {CURRENCY_LABEL} {fmt(a.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {/* Party-wise */}
    <div className="rounded border bg-white">
            <div
        className="flex items-center justify-between px-4 py-3 border-b font-bold text-sm cursor-pointer bg-slate-600 text-white rounded-t hover:bg-slate-500 transition"
        onClick={() => setPartyOpen((o) => !o)}
      >
        <span>Party-wise Outstanding</span>
        <div className="flex items-center gap-3">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const toastId = toast.loading("Preparing party export...");
              setPartyExporting(true);

              try {
                const allParty = await fetchAllPartyOutstandingRows({
                  branchCode: role === "ADMIN" ? null : branch,
                  fromDate,
                  toDate,
                  search: debouncedPartySearch,
                  sort: partySort,
                  onProgress: ({ fetchedCount, totalCount }) => {
                    toast.loading(
                      totalCount
                        ? `Fetched ${fetchedCount} of ${totalCount} parties...`
                        : `Fetched ${fetchedCount} parties...`,
                      { id: toastId }
                    );
                  },
                });

                exportTable(
                  allParty.map((r: PartyRow) => ({
                    Party: r.party_name,
                    Branches: r.branches || "-",
                    "Total LRs": r.total_grs,
                    "Collected LRs": r.collected_grs,
                    Freight: r.total_freight,
                    Collected: r.collected,
                    Balance: r.balance,
                    "Collection %": pct(r.collected, r.total_freight),
                  })),
                  `Party_Outstanding_${fromDate}_to_${toDate}`
                );

                toast.success(`Party export ready. ${allParty.length} rows exported.`, {
                  id: toastId,
                });
              } catch (error) {
                console.error(error);
                toast.error("Party export failed.", { id: toastId });
              } finally {
                setPartyExporting(false);
              }
            }}
            disabled={partyExporting || partyLoading}
            className="text-xs bg-emerald-500 text-white px-3 py-1 rounded shadow border border-emerald-600 hover:bg-emerald-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {partyExporting ? "Exporting..." : "Export Excel"}
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

          <table className={`w-full table-fixed border-collapse text-sm transition-opacity ${partyLoading ? "opacity-85" : "opacity-100"}`}>
          <thead className="bg-gray-50">
            <tr className="text-left">
              <SortTH width="25%" label="Party" sortKey="party_name"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "party_name",
                    dir: s?.key === "party_name" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />
              <SortTH width="15%" label="Branch" sortKey="branches"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "branches",
                    dir: s?.key === "branches" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />
              <SortTH width="7%" label="Total LRs"
                sortKey="total_grs"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "total_grs",
                    dir: s?.key === "total_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="7%" label="Coll. LRs"
                sortKey="collected_grs"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "collected_grs",
                    dir: s?.key === "collected_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="5%" label="LR %"
                sortKey="lr_pct"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "lr_pct",
                    dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="14%" label="Total Freight"
                sortKey="total_freight"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "total_freight",
                    dir: s?.key === "total_freight" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="5%" label="Amt %"
                sortKey="amt_pct"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "amt_pct",
                    dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
              <SortTH width="14%" label="Balance"
                sortKey="balance"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "balance",
                    dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                
              />
            </tr>
          </thead>
          <tbody>
            {pagedPartyRows.map((r) => (
              <tr key={r.party_name}>
                <td className="border px-2 py-1 break-words">{r.party_name}</td>
                <td className="border px-2 text-xs py-1 text-center truncate">{r.branches || "-"}</td>
                <td className="border px-2 py-1 text-right">{r.total_grs}</td>
                <td className="border px-2 py-1 text-right">{r.collected_grs}</td>
                <td className="border px-2 py-1 text-right">{pct(r.collected_grs, r.total_grs)}</td>
                <td className="border px-2 py-1 text-right">{CURRENCY_LABEL} {fmt(r.total_freight)}</td>
                <td className="border px-2 py-1 text-right">{pct(r.collected, r.total_freight)}</td>
                <td className="border px-2 py-1 text-right text-red-700">{CURRENCY_LABEL} {fmt(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          </table>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={partyPage === 1 || partyLoading}
                onClick={() => setPartyPage((p) => p - 1)}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                Prev
              </button>

              <span className="text-sm px-2">
                Page {partyPage} / {Math.max(1, Math.ceil(partyTotalCount / PARTY_PAGE_SIZE))}
              </span>

              <button
                disabled={partyLoading || partyPage >= Math.max(1, Math.ceil(partyTotalCount / PARTY_PAGE_SIZE))}
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
  width,
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: "asc" | "desc";
  onClick: () => void;
  width?: string;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th
      onClick={onClick}
      style={width ? { width } : undefined}
      className="px-2 py-2 cursor-pointer select-none border-b hover:bg-gray-100 text-center align-middle whitespace-nowrap"
    >
      <span className="inline-flex items-center justify-center w-full gap-1">
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
