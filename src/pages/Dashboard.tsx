import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBranch } from "@/context/BranchContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ---------------- Types ---------------- */
type KPI = {
  total_grs: number;
  total_freight: number;
  collected: number;
};

type BranchTrackerRow = {
  branch: string;
  total_grs: number;
  collections_handled: number;
  last_update: string;
  days_inactive: number;
};

type TrendRow = {
  report_date: string;
  daily_collected: number;
  daily_freight: number;
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

const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/* ---------------- Component ---------------- */
export default function Dashboard() {
  const { branch, role } = useBranch();
  const today = new Date();

  /* ================== GLOBAL KPI FILTER ================== */
  const [fy, setFy] = useState(today.getFullYear());
  const [fm, setFm] = useState(today.getMonth() + 1);
  const [fd, setFd] = useState(1);

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

  const [kpiLoading, setKpiLoading] = useState(false);

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

  // Fetch standard KPI
  useEffect(() => {
    if (!range) return;

    async function fetchDashboardKpi() {
      setKpiLoading(true);
      try {
        const branchParam = role !== "ADMIN" ? branch : null;
        const { data: kpiData } = await supabase.rpc("fn_dashboard_kpi", {
          p_from: range.from,
          p_to: range.to,
          p_branch: branchParam,
        });

        if (kpiData && kpiData[0]) {
          setKpi(kpiData[0]);
        }
      } finally {
        setKpiLoading(false);
      }
    }
    fetchDashboardKpi();
  }, [range, branch, role]);

  const balance = useMemo(() => kpi.total_freight - kpi.collected, [kpi]);

  /* ================== NEW DASHBOARD ANALYTICS ================== */
  const [trendDays, setTrendDays] = useState<number>(15);
  const [trendData, setTrendData] = useState<TrendRow[]>([]);
  const [trackerData, setTrackerData] = useState<BranchTrackerRow[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    async function fetchAnalytics() {
      setAnalyticsLoading(true);
      const branchParam = role === "ADMIN" ? null : branch;
      
      try {
        const [resTrend, resTracker] = await Promise.all([
          supabase.rpc("get_dashboard_daily_trend", {
            p_days: trendDays,
            p_branch: branchParam,
          }),
          // Branch tracker is strictly for admins mapping all branches
          role === "ADMIN" ? supabase.rpc("get_branch_activity_monitor") : Promise.resolve({ data: [] }),
        ]);

        if (!resTrend.error && resTrend.data) {
          setTrendData(
            resTrend.data.map((r: any) => ({
              ...r,
              daily_collected: Number(r.daily_collected),
              daily_freight: Number(r.daily_freight),
            }))
          );
        }

        if (!resTracker.error && resTracker.data) {
           setTrackerData(
             resTracker.data.map((r: any) => ({
               ...r,
               total_grs: Number(r.total_grs),
               collections_handled: Number(r.collections_handled),
               days_inactive: Number(r.days_inactive)
             }))
           )
        }
      } catch (err) {
        console.warn("Analytics not loaded yet. Have you run the SQL script?", err);
      } finally {
        setAnalyticsLoading(false);
      }
    }

    fetchAnalytics();
  }, [trendDays, branch, role]);


  /* ---------------- UI ---------------- */
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* DATE RANGE KPI FILTER */}
      <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm space-y-2">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1 font-medium">From</div>
            <div className="flex gap-1">
              <select
                value={fd}
                onChange={(e) => setFd(+e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-gray-50 outline-none"
              >
                {Array.from({ length: daysInMonth(fy, fm) }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>

              <select
                value={fm}
                onChange={(e) => setFm(+e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-gray-50 outline-none"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", { month: "short" })}
                  </option>
                ))}
              </select>

              <select
                value={fy}
                onChange={(e) => setFy(+e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-gray-50 outline-none"
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = 2025 + i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1 font-medium">To</div>
            <div className="flex gap-1">
              <select
                value={td}
                onChange={(e) => setTd(+e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-gray-50 outline-none"
              >
                {Array.from({ length: daysInMonth(ty, tm) }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>

              <select
                value={tm}
                onChange={(e) => setTm(+e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-gray-50 outline-none"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", { month: "short" })}
                  </option>
                ))}
              </select>

              <select
                value={ty}
                onChange={(e) => setTy(+e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-gray-50 outline-none"
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = 2025 + i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <button
            onClick={applyRange}
            disabled={kpiLoading}
            className="ml-2 px-4 py-1.5 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium transition cursor-pointer"
          >
            {kpiLoading ? "Updating..." : "Apply Range"}
          </button>
        </div>

        {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
      </div>

      {/* OVERARCHING KPI BLOCKS */}
      <div
        className={`grid grid-cols-4 gap-4 transition-opacity duration-300 ${
          kpiLoading ? "opacity-60" : "opacity-100"
        }`}
      >
        <Kpi label="Total GRs" value={kpi.total_grs} />
        <Kpi label="Total Freight" value={formatINR(kpi.total_freight)} />
        <Kpi label="Collected" value={formatINR(kpi.collected)} green />
        <Kpi label="Balance" value={formatINR(balance)} red />
      </div>

      {/* NEW INTERACTIVE GRAPH */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Collection Timeline
            </h2>
            <p className="text-sm text-gray-500">
              Daily collections tracking over time
            </p>
          </div>

          {/* Graph Interactive Filter */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            {[7, 15, 30].map((days) => (
              <button
                key={days}
                onClick={() => setTrendDays(days)}
                className={`px-3 py-1 text-sm rounded-md font-medium transition ${
                  trendDays === days
                    ? "bg-white shadow text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

        {analyticsLoading ? (
          <div className="h-72 flex items-center justify-center text-gray-400">
            Scanning trend vectors...
          </div>
        ) : trendData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-gray-400">
            No collection data recorded in the last {trendDays} days.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="report_date"
                  tickFormatter={formatDateLabel}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickFormatter={(val) => `₹ ${val / 1000}k`}
                />
                <Tooltip
                  cursor={{ stroke: "#9CA3AF" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  labelFormatter={formatDateLabel}
                  formatter={(val: number) => [`₹ ${val.toLocaleString("en-IN")}`, "Collected"]}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area
                  type="monotone"
                  dataKey="daily_collected"
                  name="Daily Collections Received"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorCollected)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* NEW BRANCH INACTIVITY HEALTH TRACKER (ADMIN ONLY) */}
      {role === "ADMIN" && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 overflow-x-auto">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Branch Activity Monitor
            </h2>
            <p className="text-sm text-gray-500">
              Track real-time data entry engagement across branches
            </p>
          </div>

          <div className="overflow-x-auto border-t border-gray-100 mt-2">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600 border-b border-gray-200">
                  <th className="px-4 py-3 font-semibold w-1/4">Branch</th>
                  <th className="px-4 py-3 font-semibold text-right">Total GRs</th>
                  <th className="px-4 py-3 font-semibold text-right">Handled</th>
                  <th className="px-4 py-3 font-semibold text-right">Last Update</th>
                  <th className="px-4 py-3 font-semibold text-center w-1/5">Health Status</th>
                </tr>
              </thead>

              <tbody>
                {trackerData.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400">
                            No branch activity logged.
                        </td>
                    </tr>
                ) : (
                trackerData.map((b) => {
                  const isCritical = b.days_inactive > 5;
                  const isWarning = b.days_inactive > 2 && b.days_inactive <= 5;
                  const isHealthy = b.days_inactive <= 2;

                  return (
                    <tr
                      key={b.branch}
                      className={`border-b last:border-0 hover:bg-gray-50 transition ${
                        isCritical
                          ? "bg-red-50/40"
                          : isWarning
                          ? "bg-yellow-50/40"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : isWarning ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        {b.branch}
                      </td>
                      <td className="px-4 py-3 text-right">{b.total_grs}</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">
                        {b.collections_handled}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {b.last_update ? formatDateLabel(b.last_update) : "Never"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isCritical ? (
                           <span className="inline-flex px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-xs font-semibold">Inactive: {b.days_inactive} days</span>
                        ) : isWarning ? (
                           <span className="inline-flex px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-800 text-xs font-semibold">Delayed: {b.days_inactive} days</span>
                        ) : (
                           <span className="inline-flex px-2 py-0.5 rounded-md bg-green-100 text-green-800 text-xs font-semibold">Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })
               )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- UI Helpers ---------------- */
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
