import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useCollections } from "@/hooks/useCollections";
import { CollectionRow } from "@/components/collections/CollectionRow";
import { STATUS, StatusFilter } from "@/types/constants";
import { GRRow } from "@/types/collections";
import { fetchAllBranchesLookup, fetchCollections } from "@/services/collections.api";

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
    payModeFilter,
    setPayModeFilter,
    search,
    setSearch,
    selectedMonth,
    setSelectedMonth,
    selectedBranch,
    setSelectedBranch,
    branchOptions,
    monthOptions,
    handleChange,
    handleSave,
    branch,
    effectiveBranch,
    role,
    isAdmin,
    canEdit,
  } = useCollections();
  useEffect(() => {
  }, []);

  function formatINR(amount: number) {
    return Math.round(amount).toLocaleString("en-IN");
  }

  function getStatus(r: GRRow): StatusFilter {
    const received = Number(r.received_amount) || 0;
    const tds = Number(r.tds_amount) || 0;
    const freight = Number(r.total_freight) || 0;
    if (received + tds >= freight && freight > 0) return STATUS.COLLECTED;
    if (received + tds > 0) return STATUS.PARTIAL;
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
      // Paginate through ALL pages — Supabase max is 1000 rows per request
      let allRows: any[] = [];
      let page = 1;
      const chunkSize = 1000;
      let totalCount = 0;
      while (true) {
        const result = await fetchCollections({
          branch: effectiveBranch as string,
          role: role as "ADMIN" | "BRANCH",
          page,
          pageSize: chunkSize,
          status: statusFilter,
          search: search,
          month: selectedMonth,
          payMode: payModeFilter,
        });
        totalCount = result.totalCount;
        allRows = allRows.concat(result.rows);
        toast.loading(`Fetched ${allRows.length} of ${totalCount} rows...`, { id: toastId });
        if (allRows.length >= totalCount || result.rows.length === 0) break;
        page++;
      }

      toast.loading(`Processing ${allRows.length} rows for export...`, { id: toastId });
      const branchLookup = await fetchAllBranchesLookup();

      // Sort in place
      allRows.sort((a: any, b: any) => {
        const branchCompare = String(a.branch_code || "").localeCompare(String(b.branch_code || ""));
        if (branchCompare !== 0) return branchCompare;
        return String(b.gr_date || "").localeCompare(String(a.gr_date || ""));
      });

      // Build summary WHILE transforming (single pass)
      const summaryMap = new Map<string, { controllingBranch: string; branchName: string; areaManager: string; grs: number; freight: number; received: number; tds: number; balance: number }>();

      for (let i = 0; i < allRows.length; i++) {
        const r = allRows[i];
        const freight = r.total_freight || 0;
        const received = r.received_amount || 0;
        const tds = r.tds_amount || 0;
        const totalCollected = received + tds;
        const capped = Math.min(totalCollected, freight);
        const branchCodeUpper = (r.branch_code || "").trim().toUpperCase();
        const branchInfo = branchLookup.get(branchCodeUpper) || {
          branch_name: r.branch_code || "",
          area_manager: r.area_manager || "",
          mapped_to: r.branch_code || "",
        };
        const bal = freight - capped;

        // Accumulate summary
        if (isAdmin && !selectedBranch) {
          const code = r.branch_code || "";
          const item = summaryMap.get(code) || {
            controllingBranch: branchInfo.mapped_to,
            branchName: branchInfo.branch_name,
            areaManager: branchInfo.area_manager || r.area_manager || "",
            grs: 0, freight: 0, received: 0, tds: 0, balance: 0,
          };
          item.grs += 1;
          item.freight += freight;
          item.received += received;
          item.tds += tds;
          item.balance += bal;
          summaryMap.set(code, item);
        }

        allRows[i] = {
          Controlling_Branch: branchInfo.mapped_to,
          Branch_Code: r.branch_code || "",
          Branch_Name: branchInfo.branch_name,
          Area_Manager: branchInfo.area_manager || r.area_manager || "",
          GR_No: r.gr_no,
          Date: r.gr_date,
          Party: r.party_name,
          Freight: freight,
          Received: received,
          TDS: tds,
          Balance: bal,
          Status: getStatus(r as GRRow),
          Payment_Mode: r.payment_mode || "",
          Ref_No: r.ref_no || "",
          Remarks: r.remarks || "",
        };
      }

      const exportBranch = selectedBranch || "All_Branches";
      const LARGE_THRESHOLD = 50000;

      if (allRows.length >= LARGE_THRESHOLD) {
        // ---- CSV export for large datasets (browser can't handle XLSX for 2L+ rows) ----
        toast.loading(`Generating CSV for ${allRows.length} rows...`, { id: toastId });

        const headers = ["Controlling_Branch","Branch_Code","Branch_Name","Area_Manager","GR_No","Date","Party","Freight","Received","TDS","Balance","Status","Payment_Mode","Ref_No","Remarks"];

        // Build CSV in chunks to avoid single giant string allocation
        const csvChunks: string[] = [];
        csvChunks.push(headers.join(",") + "\n");

        const escapeCSV = (val: any) => {
          const s = String(val ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        };

        const BATCH = 10000;
        for (let i = 0; i < allRows.length; i += BATCH) {
          const lines: string[] = [];
          const end = Math.min(i + BATCH, allRows.length);
          for (let j = i; j < end; j++) {
            const r = allRows[j];
            lines.push(headers.map((h) => escapeCSV(r[h])).join(","));
          }
          csvChunks.push(lines.join("\n") + "\n");
        }

        // Free allRows memory before creating blob
        allRows.length = 0;

        const csvBlob = new Blob(csvChunks, { type: "text/csv;charset=utf-8;" });
        saveAs(csvBlob, `Collections_${exportBranch}.csv`);

        // Generate summary as small XLSX separately
        if (isAdmin && !selectedBranch && summaryMap.size > 0) {
          const summaryData = Array.from(summaryMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => ({
              Controlling_Branch: val.controllingBranch,
              Branch_Code: key,
              Branch_Name: val.branchName,
              Area_Manager: val.areaManager,
              GRs: val.grs,
              Freight: val.freight,
              Received: val.received,
              TDS: val.tds,
              Balance: val.balance,
            }));

          const swb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(swb, XLSX.utils.json_to_sheet(summaryData), "Branch Summary");
          const sBuf = XLSX.write(swb, { bookType: "xlsx", type: "array", bookSST: false });
          saveAs(new Blob([sBuf]), `Collections_Summary_${exportBranch}.xlsx`);
        }

        toast.success(`Export done! ${csvChunks.reduce((s, c) => s + c.length, 0) > 0 ? "CSV" : ""} data + Summary downloaded.`, { id: toastId });

      } else {
        // ---- Standard XLSX for smaller datasets ----
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(allRows);
        XLSX.utils.book_append_sheet(wb, ws, "Collections");

        if (isAdmin && !selectedBranch && summaryMap.size > 0) {
          const summaryData = Array.from(summaryMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => ({
              Controlling_Branch: val.controllingBranch,
              Branch_Code: key,
              Branch_Name: val.branchName,
              Area_Manager: val.areaManager,
              GRs: val.grs,
              Freight: val.freight,
              Received: val.received,
              TDS: val.tds,
              Balance: val.balance,
            }));

          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Branch Summary");
        }

        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array", bookSST: false });
        saveAs(new Blob([buf]), `Collections_${exportBranch}.xlsx`);
        toast.success(`Export successful! ${allRows.length} rows exported.`, { id: toastId });
      }
    } catch (e: any) {
      console.error("Export error:", e);
      toast.error(`Export failed: ${e?.message || "Unknown error"}`, { id: toastId });
    }
  }



  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
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

        {branchOptions.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Branch:</span>
            <select
              className="w-full sm:w-auto min-w-[150px] px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={selectedBranch}
              onChange={(e) => {
                setCurrentPage(1);
                setSelectedBranch(e.target.value);
              }}
            >
              <option value="">All Branches</option>
              {branchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}
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

        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm font-bold text-gray-700">Pay Mode:</span>
          <select
            value={payModeFilter}
            onChange={(e) => {
              setCurrentPage(1);
              setPayModeFilter(e.target.value);
            }}
            className="border px-3 py-1.5 rounded-md text-sm bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Modes</option>
            <option value="Paid">Paid</option>
            <option value="To Pay">To Pay</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm font-bold text-gray-700">Month:</span>
          <select
            value={selectedMonth}
            onChange={(e) => {
              setCurrentPage(1);
              setSelectedMonth(e.target.value);
            }}
            className="border px-3 py-1.5 rounded-md text-sm bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Months</option>
            {(monthOptions || []).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        
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
              <th className="px-1 py-1.5 font-semibold tracking-wide text-center align-middle w-[6%] bg-slate-800 text-slate-200 border-r border-slate-700">TDS</th>
              
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
                const currentData = { ...r, ...e };
                const status = getStatus(currentData as GRRow);
                const days = getPendingDays(r.gr_date);
                const overdue = isOverdue(currentData as GRRow);
                const rowClass = getRowClass(status, overdue);

                return (
                  <CollectionRow
                    key={`${r.branch_code}__${r.gr_no}`}
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
