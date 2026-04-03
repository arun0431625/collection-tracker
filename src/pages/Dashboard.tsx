  import { useEffect, useMemo, useState } from "react";
  import { supabase } from "@/lib/supabase";
  import { useBranch } from "@/context/BranchContext";

  /* ---------------- Types ---------------- */

  type KPI = {
    total_grs: number;
    total_freight: number;
    collected: number;
  };

  type BranchSummary = {
    branch_code: string;
    gr_count: number;
    total: number;
    collected: number;
  };

  type PartySummary = {
    party_name: string;
    branches: string[];
    gr_count: number;
    total: number;
    collected: number;
  };
  /* ---------------- Utils ---------------- */

  const formatINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);

  function daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  function toISO(y: number, m: number, d: number) {
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  /* ---------------- Component ---------------- */

  export default function Dashboard() {
    const { branch, role } = useBranch();

    const today = new Date();

    /* FROM DATE */
    const [fy, setFy] = useState(today.getFullYear());
    const [fm, setFm] = useState(today.getMonth() + 1);
    const [fd, setFd] = useState(1);

    /* TO DATE */
    const [ty, setTy] = useState(today.getFullYear());
    const [tm, setTm] = useState(today.getMonth() + 1);
    const [td, setTd] = useState(today.getDate());

    const [range, setRange] = useState<{ from: string; to: string } | null>(null);
    const [error, setError] = useState("");

    const [kpi, setKpi] = useState<KPI>({
      total_grs: 0,
      total_freight: 0,
      collected: 0,
    });

    const [loading, setLoading] = useState(false);

    const [branchSummary, setBranchSummary] = useState<BranchSummary[]>([]);
    const [partySummary, setPartySummary] = useState<PartySummary[]>([]);

    const [page, setPage] = useState(1);
    // PARTY SORT STATE
    const [partySortBy, setPartySortBy] = useState<
      "branch" | "party" | "grs" | "total" | "collected" | "balance"
    >("balance");

    const [partySortDir, setPartySortDir] = useState<"asc" | "desc">("desc");

    const [showPartyTable, setShowPartyTable] = useState(false);
    const PAGE_SIZE = 20;

      // ---- Sorting state ----
    const [branchSort, setBranchSort] = useState<{
      key: keyof BranchSummary;
      dir: "asc" | "desc";
    }>({
      key: "total",
      dir: "desc",
    });

    const [partySort, setPartySort] = useState<{
      key: keyof PartySummary;
      dir: "asc" | "desc";
    }>({
      key: "total",
      dir: "desc",
    });

    /* ---------------- APPLY RANGE ---------------- */

    function applyRange() {
      setError("");

      const from = toISO(fy, fm, fd);
      const to = toISO(ty, tm, td);

      if (from > to) {
        setError("From date cannot be after To date");
        return;
      }

      setRange({ from, to });
    }

    /* ---------------- FETCH DASHBOARD (SUPABASE) ---------------- */

    useEffect(() => {
      if (!range) return;

      async function fetchDashboard() {
        setLoading(true);

        try {
          const branchParam = role !== "ADMIN" ? branch : null;

          // KPI
          const { data: kpiData } = await supabase.rpc("fn_dashboard_kpi", {
            p_from: range.from,
            p_to: range.to,
            p_branch: branchParam
          });

          if (kpiData && kpiData[0]) {
            setKpi(kpiData[0]);
          }

          // Branch Summary
          if (role === "ADMIN") {
            const { data: branchData } = await supabase.rpc("fn_branch_summary", {
              p_from: range.from,
              p_to: range.to,
              p_branch: null
            });

            if (branchData) setBranchSummary(branchData);
          }

          // Party Summary
          const { data: partyData } = await supabase.rpc("fn_party_summary", {
            p_from: range.from,
            p_to: range.to,
            p_branch: branchParam
          });

          if (partyData) {
            setPartySummary(
              partyData.map(p => ({
                party_name: p.party_name,
                branches: p.branches?.split(", ") || [],
                gr_count: p.gr_count,
                total: p.total,
                collected: p.collected
              }))
            );
          }

        } finally {
          setLoading(false);
        }
      }
      fetchDashboard();
    }, [range, branch, role]);

    const balance = useMemo(
      () => kpi.total_freight - kpi.collected,
      [kpi]
    );

    function handlePartySort(col: typeof partySortBy) {
      if (partySortBy === col) {
        setPartySortDir(partySortDir === "asc" ? "desc" : "asc");
      } else {
        setPartySortBy(col);
        setPartySortDir("desc");
      }
    }

    const sortedBranchSummary = useMemo(() => {
      const data = [...branchSummary];
      data.sort((a, b) => {
        const v1 = a[branchSort.key];
        const v2 = b[branchSort.key];

        if (typeof v1 === "number" && typeof v2 === "number") {
          return branchSort.dir === "asc" ? v1 - v2 : v2 - v1;
        }

        return branchSort.dir === "asc"
          ? String(v1).localeCompare(String(v2))
          : String(v2).localeCompare(String(v1));
      });
      return data;
    }, [branchSummary, branchSort]);

      const sortedPartySummary = useMemo(() => {
      return [...partySummary].sort((a, b) => {
        let av: any;
        let bv: any;

        switch (partySortBy) {
          case "branch":
            av = (a.branches || []).join(", ");
            bv = (b.branches || []).join(", ");
            break;          case "party":
            av = a.party_name;
            bv = b.party_name;
            break;
          case "grs":
            av = a.gr_count;
            bv = b.gr_count;
            break;
          case "total":
            av = a.total;
            bv = b.total;
            break;
          case "collected":
            av = a.collected;
            bv = b.collected;
            break;
          case "balance":
            av = a.total - a.collected;
            bv = b.total - b.collected;
            break;
        }

        if (typeof av === "string") {
          return partySortDir === "asc"
            ? av.localeCompare(bv)
            : bv.localeCompare(av);
        }

        return partySortDir === "asc" ? av - bv : bv - av;
      });
    }, [partySummary, partySortBy, partySortDir]);

    /* ---------------- UI ---------------- */

    return (
      <div className="p-4 space-y-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>

        {/* DATE RANGE */}
        <div className="bg-white border p-3 rounded space-y-2">
          <div className="flex flex-wrap items-end gap-4">

            {/* FROM */}
            <div>
              <div className="text-xs text-gray-600 mb-1">From</div>
              <div className="flex gap-1">
                <select value={fd} onChange={e => setFd(+e.target.value)} className="border rounded px-2 py-1">
                  {Array.from({ length: daysInMonth(fy, fm) }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>

                <select value={fm} onChange={e => setFm(+e.target.value)} className="border rounded px-2 py-1">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString("default", { month: "short" })}
                    </option>
                  ))}
                </select>

                <select value={fy} onChange={e => setFy(+e.target.value)} className="border rounded px-2 py-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const y = 2025 + i;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* TO */}
            <div>
              <div className="text-xs text-gray-600 mb-1">To</div>
              <div className="flex gap-1">
                <select value={td} onChange={e => setTd(+e.target.value)} className="border rounded px-2 py-1">
                  {Array.from({ length: daysInMonth(ty, tm) }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>

                <select value={tm} onChange={e => setTm(+e.target.value)} className="border rounded px-2 py-1">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString("default", { month: "short" })}
                    </option>
                  ))}
                </select>

                <select value={ty} onChange={e => setTy(+e.target.value)} className="border rounded px-2 py-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const y = 2025 + i;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>
            </div>

          <button
            onClick={applyRange}
            disabled={loading}
            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            )}
            {loading ? "Updating..." : "Apply Range"}
          </button>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>

        {/* KPI */}
        <div className={`grid grid-cols-4 gap-3 transition-opacity duration-300 ${loading ? "opacity-60" : "opacity-100"}`}>
          <Kpi label="Total GRs" value={kpi.total_grs} />
          <Kpi label="Total Freight" value={formatINR(kpi.total_freight)} />
          <Kpi label="Collected" value={formatINR(kpi.collected)} green />
          <Kpi label="Balance" value={formatINR(balance)} red />
        </div>

      {role === "ADMIN" && (
        <div className="bg-white border rounded-xl shadow-sm p-4 overflow-x-auto">
          <h2 className="font-semibold mb-3">
            Branch-wise Outstanding
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded-lg overflow-hidden table-fixed">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <SortTH
                    label="Branch"
                    sortKey="branch_code"
                    activeKey={branchSort.key}
                    dir={branchSort.dir}
                    onClick={() =>
                      setBranchSort({
                        key: "branch_code",
                        dir:
                          branchSort.key === "branch_code" && branchSort.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  />

                  <SortTH
                    label="GRs"
                    sortKey="gr_count"
                    activeKey={branchSort.key}
                    dir={branchSort.dir}
                    onClick={() =>
                      setBranchSort({
                        key: "gr_count",
                        dir:
                          branchSort.key === "gr_count" && branchSort.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                    align="right"
                  />

                  <SortTH
                    label="Total"
                    sortKey="total"
                    activeKey={branchSort.key}
                    dir={branchSort.dir}
                    onClick={() =>
                      setBranchSort({
                        key: "total",
                        dir:
                          branchSort.key === "total" && branchSort.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                    align="right"
                  />

                  <SortTH
                    label="Collected"
                    sortKey="collected"
                    activeKey={branchSort.key}
                    dir={branchSort.dir}
                    onClick={() =>
                      setBranchSort({
                        key: "collected",
                        dir:
                          branchSort.key === "collected" && branchSort.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                    align="right"
                  />

                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>

              <tbody>
                {sortedBranchSummary
                  .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                  .map((b) => (
                    <tr
                      key={b.branch_code}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      <td className="px-3 py-2 font-medium">
                        {b.branch_code}
                      </td>

                      <td className="px-3 py-2 text-right">
                        {b.gr_count}
                      </td>

                      <td className="px-3 py-2 text-right">
                        {formatINR(b.total)}
                      </td>

                      <td className="px-3 py-2 text-right text-green-700">
                        {formatINR(b.collected)}  
                      </td>

                      <td className="px-3 py-2 text-right text-red-600">
                        {formatINR(b.total - b.collected)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}      

        {/* PARTY-WISE OUTSTANDING (ADMIN + BRANCH) */}
        {(role === "ADMIN" || role === "BRANCH") && (
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          {role === "ADMIN" && (
          <button
            onClick={() => setShowPartyTable(!showPartyTable)}
            className="w-full flex justify-between items-center font-semibold mb-3"
          >
            <span>
              {role === "ADMIN"
                ? "Party-wise Outstanding (All Branches)"
                : "Party-wise Outstanding"}
            </span>
            <span className="text-sm text-gray-500">
              {showPartyTable ? "▲ Hide" : "▼ Show"}
            </span>
          </button>
          )}

          {role === "BRANCH" && (
            <h2 className="font-semibold mb-3">
              Party-wise Outstanding
            </h2>
          )}

        {(role === "BRANCH" || showPartyTable) && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded-lg overflow-hidden table-fixed">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  {role === "ADMIN" && (
                      <th
                        onClick={() => handlePartySort("branch")}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                      >
                        Branch {partySortBy === "branch" && (partySortDir === "asc" ? "▲" : "▼")}
                      </th>
                    )}
                      <th
                        onClick={() => handlePartySort("party")}
                        className="px-3 py-2 cursor-pointer select-none hover:bg-gray-100"
                      >
                        Party {partySortBy === "party" && (partySortDir === "asc" ? "▲" : "▼")}
                      </th>
                      <th
                        onClick={() => handlePartySort("grs")}
                        className="px-3 py-2 text-right cursor-pointer hover:bg-gray-100"
                      >
                        GRs {partySortBy === "grs" && (partySortDir === "asc" ? "▲" : "▼")}
                      </th>
                      <th
                        onClick={() => handlePartySort("total")}
                        className="px-3 py-2 text-right cursor-pointer hover:bg-gray-100"
                      >
                        Total {partySortBy === "total" && (partySortDir === "asc" ? "▲" : "▼")}
                      </th>
                      <th
                        onClick={() => handlePartySort("collected")}
                        className="px-3 py-2 text-right cursor-pointer hover:bg-gray-100"
                      >
                        Collected {partySortBy === "collected" && (partySortDir === "asc" ? "▲" : "▼")}
                      </th>
                      <th
                        onClick={() => handlePartySort("balance")}
                        className="px-3 py-2 text-right cursor-pointer hover:bg-gray-100"
                      >
                        Balance {partySortBy === "balance" && (partySortDir === "asc" ? "▲" : "▼")}
                      </th>
                </tr>
              </thead>

              <tbody>
                {sortedPartySummary
                  .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                  .map((p, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      {role === "ADMIN" && (
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {p.branches.join(", ")}
                        </td>
                      )}                      <td className="px-3 py-2 font-medium">{p.party_name}</td>
                      <td className="px-3 py-2 text-right">{p.gr_count}</td>
                      <td className="px-3 py-2 text-right">{formatINR(p.total)}</td>
                      <td className="px-3 py-2 text-right text-green-700">
                        {formatINR(p.collected)}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600">
                        {formatINR(p.total - p.collected)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>  
        )}
      
      {role === "ADMIN" && (
        <div className="flex justify-between items-center pt-3">
          <div className="text-xs text-gray-500">
            Page {page}
          </div>

          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
            >
              ← Prev
            </button>

            <button
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 border rounded hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}

        {kpi.total_grs === 0 && (
          <div className="text-sm text-gray-500">
            No data found for selected range
          </div>
        )}
      </div>
    );
  }
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
          className={`px-3 py-2 cursor-pointer select-none ${
            align === "right" ? "text-right" : "text-left"
          }`}
        >
          <span className="inline-flex items-center gap-1">
            {label}
            {isActive && (
              <span className="text-xs">{dir === "asc" ? "▲" : "▼"}</span>
            )}
          </span>
        </th>
      );
    }

  /* ---------------- UI Helpers ---------------- */

  function Kpi({ label, value, green, red }: any) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-white border shadow-sm p-4 hover:shadow-md transition">
        
        {/* top accent */}
        <div
          className={`absolute top-0 left-0 h-1 w-full ${
            green ? "bg-green-500" : red ? "bg-red-500" : "bg-blue-500"
          }`}
        />

        <div className="text-xs uppercase tracking-wide text-gray-500">
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

