import React from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useCollections } from "@/hooks/useCollections";
import { CollectionRow } from "@/components/collections/CollectionRow";
import { STATUS, StatusFilter } from "@/types/constants";
import { GRRow } from "@/types/collections";
import { fetchCollections } from "@/services/collections.api";
import { toast } from "sonner";

export default function Collections() {
  const {
    rows,
    loading,
    currentPage,
    setCurrentPage,
    pageSize,
    totalCount,
    kpiTotals,
    agingData,
    edits,
    savingRow,
    savedRow,
    rowErrors,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    selectedMonth,
    setSelectedMonth,
    selectedBranch,
    setSelectedBranch,
    branchOptions,
    handleChange,
    handleSave,
    branch,
    role,
    isAdmin,
    canEdit,
  } = useCollections();

  function formatINR(amount: number) {
    return amount.toLocaleString("en-IN");
  }

  function getStatus(r: GRRow): StatusFilter {
    const received = r.received_amount || 0;
    if (received >= r.total_freight) return STATUS.COLLECTED;
    if (received > 0) return STATUS.PARTIAL;
    return STATUS.PENDING;
  }

  function getPendingDays(grDate: string) {
    const today = new Date();
    const d = new Date(grDate);
    const diffMs = today.getTime() - d.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  function isOverdue(r: GRRow) {
    const status = getStatus(r);
    if (status === STATUS.COLLECTED) return false;
    return getPendingDays(r.gr_date) > 30;
  }

  function getRowClass(status: StatusFilter, overdue: boolean) {
    if (overdue) {
      return "bg-red-50 border-l-4 border-red-500 hover:bg-red-100";
    }
    switch (status) {
      case STATUS.COLLECTED:
        return "bg-emerald-50 border-l-4 border-emerald-500 hover:bg-emerald-100";
      case STATUS.PARTIAL:
        return "bg-amber-50 border-l-4 border-amber-500 hover:bg-amber-100";
      case STATUS.PENDING:
      default:
        return "bg-gray-50 border-l-4 border-gray-300 hover:bg-gray-100";
    }
  }

  async function exportExcel() {
    const toastId = toast.loading("Fetching all data for export...");
    try {
      // Paginate through ALL pages to get every row
      let allRows: any[] = [];
      let page = 1;
      const chunkSize = 1000;
      while (true) {
        const result = await fetchCollections({
          branch: isAdmin ? selectedBranch || "" : branch || "",
          role: role as "ADMIN" | "BRANCH",
          page,
          pageSize: chunkSize,
          status: statusFilter,
          search: search,
          month: selectedMonth,
        });
        allRows = allRows.concat(result.rows);
        toast.loading(`Fetched ${allRows.length} of ${result.totalCount} rows...`, { id: toastId });
        if (allRows.length >= result.totalCount || result.rows.length < chunkSize) break;
        page++;
      }

      const wb = XLSX.utils.book_new();
      const data = allRows.map((r: any) => {
        const freight = r.total_freight || 0;
        const received = r.received_amount || 0;
        const capped = Math.min(received, freight);

        return {
          GR_No: r.gr_no,
          Date: r.gr_date,
          Party: r.party_name,
          Freight: freight,
          Received: capped,
          Balance: freight - capped,
          Status: getStatus(r as GRRow),
          Payment_Mode: r.payment_mode || "",
          Ref_No: r.ref_no || "",
          Remarks: r.remarks || "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Collections");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf]), `Collections_${branch}.xlsx`);
      toast.success(`Export successful! ${allRows.length} rows exported.`, { id: toastId });
    } catch (e) {
      toast.error("Export failed.", { id: toastId });
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          Collections
          <span className="text-sm font-normal text-gray-500">
            {" "}· Branch {branch}
          </span>
        </h1>
        <div className="text-xs text-gray-500 mt-0.5">
          Update received payments and track pending GRs
        </div>
      </div>

      {/* KPI BAR */}
      <div className="grid grid-cols-4 gap-6">
        <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow p-4 hover:shadow-md transition-shadow">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Total GRs</div>
          <div className="text-2xl font-bold text-white tracking-tight">{kpiTotals.totalGRs.toLocaleString("en-IN")}</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 border border-indigo-600 shadow p-4 hover:shadow-md transition-shadow">
          <div className="text-xs font-medium text-indigo-200 uppercase tracking-wider mb-1">Total Freight</div>
          <div className="text-2xl font-bold text-white tracking-tight">₹ {formatINR(kpiTotals.totalFreight)}</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 border border-emerald-500 shadow p-4 hover:shadow-md transition-shadow">
          <div className="text-xs font-medium text-emerald-100 uppercase tracking-wider mb-1">Collected</div>
          <div className="text-2xl font-bold text-white tracking-tight">₹ {formatINR(kpiTotals.collected)}</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-rose-600 to-red-700 border border-rose-500 shadow p-4 hover:shadow-md transition-shadow">
          <div className="text-xs font-medium text-rose-100 uppercase tracking-wider mb-1">Balance</div>
          <div className="text-2xl font-bold text-white tracking-tight">₹ {formatINR(kpiTotals.balance)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-4 shadow-sm">
        {(Object.values(STATUS)).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded px-3 py-1 text-xs font-medium border ${
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {s}
          </button>
        ))}

        <input
          type="text"
          placeholder="Search GR No or Party…"
          className="ml-auto rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={selectedMonth}
          onChange={(e) => {
            setCurrentPage(1);
            setSelectedMonth(e.target.value);
          }}
          className="border px-3 py-2 rounded-md text-sm ml-2"
        >
          <option value="">All Months</option>
          <option value="2026-01">Jan 2026</option>
          <option value="2026-02">Feb 2026</option>
          <option value="2026-03">Mar 2026</option>
        </select>
        
        {isAdmin && (
          <select
            value={selectedBranch}
            onChange={(e) => {
              setCurrentPage(1);
              setSelectedBranch(e.target.value);
            }}
            className="border px-3 py-2 rounded-md text-sm ml-2"
          >
            <option value="">All Branches</option>
            {branchOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}
      </div>

      {/* EXPORT + AGING SUMMARY */}
      <div className="flex items-center justify-between bg-white border rounded-md px-3 py-2 shadow-sm">
        <div className="flex items-center gap-5 text-sm leading-tight">
          <div className="flex flex-col text-gray-500 font-medium pr-3 border-r">
            <span>DAYS</span>
            <span>GRs</span>
            <span>Amount</span>
          </div>

          {["0-30","30-90","90-180","180-365","365+"].map((bucket) => {
            const item = agingData?.find((a:any) => a.bucket === bucket);
            const riskColor =
              bucket === "365+" ? "text-red-600" : bucket === "180-365" ? "text-amber-600" : "text-gray-900";

            return (
              <div key={bucket} className="flex flex-col items-center min-w-[85px] border-r last:border-r-0 pr-3">
                <span className="font-medium text-gray-600">{bucket}</span>
                <span className="text-gray-400">{item?.total_grs || 0}</span>
                <span className={`font-semibold ${riskColor}`}>
                  ₹ {formatINR(Number(item?.total_outstanding || 0))}
                </span>
              </div>
            );
          })}
        </div>

        <button onClick={exportExcel} className="text-sm rounded px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700">
          Export Excel
        </button>
      </div>

      {role !== "BRANCH" && (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          🔒 You are in read-only mode
        </div>
      )}

      {/* TABLE */}
      <div className="relative overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin shadow-sm"></div>
          </div>
        )}
        <table className="w-full text-sm border-collapse table-fixed">
          <thead className="sticky top-0 z-10 shadow-sm border-b border-slate-700">
            <tr>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[6%] bg-slate-800 text-slate-200 border-r border-slate-700">GR No</th>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[7%] bg-slate-800 text-slate-200 border-r border-slate-700">Date</th>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[21%] bg-slate-800 text-slate-200 border-r border-slate-700">Party</th>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[8%] bg-slate-800 text-slate-200 border-r border-slate-700">Freight</th>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[6%] bg-slate-800 text-slate-200 border-r border-slate-700">Pay Mode</th>
              
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[8%] bg-slate-800 text-slate-200 border-r border-slate-700">Payment Mode</th>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[8%] bg-slate-800 text-slate-200 border-r border-slate-700">Received</th>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[10%] bg-slate-800 text-slate-200 border-r border-slate-700">Payment Date</th>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[8%] bg-slate-800 text-slate-200 border-r border-slate-700">Ref No</th>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[6%] bg-slate-800 text-slate-200 border-r border-slate-700">Remarks</th>
              
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[7%] bg-slate-800 text-slate-200 border-r border-slate-700">Status</th>
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[5%] bg-slate-800 text-slate-200">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={12} className="text-center py-6 text-gray-500">No records found</td>
              </tr>
            ) : (
              rows.map((r) => {
                const e = edits[r.gr_no];
                const status = getStatus(r);
                const days = getPendingDays(r.gr_date);
                const overdue = isOverdue(r);
                const rowClass = getRowClass(status, overdue);

                return (
                  <CollectionRow
                    key={r.gr_no}
                    r={r}
                    e={e}
                    canEdit={canEdit}
                    savingRow={savingRow}
                    savedRow={savedRow}
                    handleChange={handleChange}
                    handleSave={handleSave}
                    status={status}
                    days={days}
                    overdue={overdue}
                    rowClass={rowClass}
                    rowErrors={rowErrors[r.gr_no] ?? {}}
                  />
                );
              })
            )}
          </tbody>
        </table>

        {/* PAGINATION */}
        <div className="flex items-center justify-between mt-3 text-sm p-2">
          <div>
            {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} - 
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-3 py-1 rounded border disabled:opacity-40"
            >
              ◀ Prev
            </button>
            <span>Page {currentPage} of {Math.ceil(totalCount / pageSize)}</span>
            <button
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1 rounded border disabled:opacity-40"
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
