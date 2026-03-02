  import React, {
    useEffect,
    useMemo,
    useState,
    useDeferredValue,
    useCallback
  } from "react";

  import { fetchCollections } from "@/services/collections.firebase";
  import { useBranch } from "@/context/BranchContext";
  import * as XLSX from "xlsx";
  import { saveAs } from "file-saver";
  import { updateCollectionPayment } from "@/services/collections.firebase";
  import { supabase } from "@/lib/supabaseClient";
  type GRRow = {
    gr_no: string;
    area_manager: string;
    branch_code: string;
    gr_date: string;
    party_name: string;
    total_freight: number;
    pay_mode: string | null;
    payment_mode: string | null;
    received_amount: number | null;
    payment_date: string | null;
    ref_no: string | null;
    remarks: string | null;
  };

  type EditState = {
    payment_mode: string;
    received_amount: string;
    payment_date: string;
    ref_no: string;
    remarks: string;
  };

  type StatusFilter = "ALL" | "PENDING" | "PARTIAL" | "COLLECTED";

  export default function Collections() {
    function formatINR(amount: number) {
      return amount.toLocaleString("en-IN");
    }

    const { branch, role } = useBranch();

    const isAdmin = role === "ADMIN";

    const canEdit = role === "BRANCH";

    const [rows, setRows] = useState<GRRow[]>([]);
    const [loading, setLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 150;
    const [totalCount, setTotalCount] = useState(0);

    const [kpiTotals, setKpiTotals] = useState({
      totalGRs: 0,
      totalFreight: 0,
      collected: 0,
      balance: 0,
    });

    const [agingData, setAgingData] = useState<any[]>([]);

    const [edits, setEdits] = useState<Record<string, EditState>>({});
    const [savingRow, setSavingRow] = useState<string | null>(null);
    const [savedRow, setSavedRow] = useState<string | null>(null);

    const [rowErrors, setRowErrors] = useState<
      Record<string, Partial<Record<keyof EditState, boolean>>>
    >({});
    const [deleteTarget, setDeleteTarget] = useState<GRRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [statusFilter, setStatusFilter] =
      useState<StatusFilter>("ALL");

    const [search, setSearch] = useState("");

    const [selectedMonth, setSelectedMonth] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("");
    
    const effectiveBranch = isAdmin
      ? selectedBranch || null
      : branch;
       
    const [branchOptions, setBranchOptions] = useState<string[]>([]);
    const deferredSearch = useDeferredValue(search);

    // 🔥 Fetch branch list for ADMIN
    useEffect(() => {
      if (role !== "ADMIN") return;

      const fetchBranches = async () => {
        const { data, error } = await supabase
          .from("v_distinct_branches")
          .select("branch_code")
          .order("branch_code");

        if (!error && data) {
          setBranchOptions(
            data.map((r: any) => r.branch_code)
          );
        }
      };

      fetchBranches();
    }, [role]);

    useEffect(() => {
      setCurrentPage(1);
    }, [statusFilter, deferredSearch, selectedMonth]);

    const fetchGRs = useCallback(async () => {
    setLoading(true);
    try {
    const [result, kpiResult, agingResult] = await Promise.all([
      fetchCollections({
        branch: role === "ADMIN" ? selectedBranch : branch,
        role: role as "ADMIN" | "BRANCH",
        page: currentPage,
        pageSize,
        status: statusFilter,
        search: deferredSearch,
        month: selectedMonth
      }),
      supabase.rpc("get_collections_kpi", {
        p_branch: effectiveBranch,
        p_month: selectedMonth || null,
        p_status: statusFilter,
        p_search: deferredSearch || null
      }),
      supabase.rpc("get_collections_aging", {
        p_branch: effectiveBranch,
        p_month: selectedMonth || null,
        p_status: statusFilter,
        p_search: deferredSearch || null
      })
    ]);
      // Rows update
      setRows(result.rows);
      setTotalCount(result.totalCount);

      // 🔥 Fast KPI via RPC (Enterprise grade)
    const { data: kpiData, error: kpiError } =
      await supabase.rpc("get_collections_kpi", {
        p_branch: effectiveBranch,
        p_month: selectedMonth || null,
        p_status: statusFilter,
        p_search: deferredSearch || null
      });

    if (!kpiError && kpiData && kpiData.length > 0) {
      const row = kpiData[0];

      const totalFreight = Number(row.total_freight) || 0;
      const collected = Number(row.total_collected) || 0;

      setKpiTotals({
        totalGRs: Number(row.total_grs) || 0,
        totalFreight,
        collected,
        balance: totalFreight - collected
      });

    if (!agingResult.error && agingResult.data) {
      setAgingData(agingResult.data);
    }


    }    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
      }, [
        branch,
        role,
        currentPage,
        statusFilter,
        deferredSearch,
        selectedMonth,
        selectedBranch
      ]);
  useEffect(() => {
      if (!branch) return;
      fetchGRs();
    }, [fetchGRs, branch]);

    const handleChange = useCallback((
    grNo: string,
    field: keyof EditState,
    value: string
  ) => {
    setEdits((prev) => ({
      ...prev,
      [grNo]: {
        ...prev[grNo],
        [field]: value,
      },
    }));
  }, []);

  const handleSave = useCallback(async (r: GRRow) => {
    if (!canEdit) return;

    const e = edits[r.gr_no];
    
    // 🔴 Smart Mandatory Validation

    const finalPaymentMode = e?.payment_mode ?? r.payment_mode;
    const finalAmount =
      e?.received_amount !== undefined
        ? Number(e.received_amount)
        : r.received_amount;
    const finalPaymentDate = e?.payment_date ?? r.payment_date;
    const finalRefNo = e?.ref_no ?? r.ref_no;

    const errors: Partial<Record<keyof EditState, boolean>> = {};

    if (!finalPaymentMode) errors.payment_mode = true;
    if (!finalAmount) errors.received_amount = true;
    if (!finalPaymentDate) errors.payment_date = true;
    if (!finalRefNo) errors.ref_no = true;

    if (Object.keys(errors).length > 0) {
      setRowErrors(prev => ({
        ...prev,
        [r.gr_no]: errors
      }));
      return;
    } else {
      setRowErrors(prev => {
        const copy = { ...prev };
        delete copy[r.gr_no];
        return copy;
      });
    }    
    try {
      setSavingRow(r.gr_no);

    await updateCollectionPayment(
      r.gr_no,
      r.branch_code,
      {
        payment_mode: e.payment_mode ?? r.payment_mode,
        received_amount:
          e.received_amount !== undefined
            ? Number(e.received_amount)
            : r.received_amount,
        payment_date: e.payment_date ?? r.payment_date,
        ref_no: e.ref_no ?? r.ref_no,
        remarks: e.remarks ?? r.remarks,
      }
    ); 
      setEdits((p) => {
        const c = { ...p };
        delete c[r.gr_no];
        return c;
      });

      setRows(prev =>
        prev.map(row =>
          row.gr_no === r.gr_no
            ? {
                ...row,
                payment_mode: finalPaymentMode,
                received_amount: finalAmount,
                payment_date: finalPaymentDate,
                ref_no: finalRefNo,
                remarks: e?.remarks ?? row.remarks
              }
            : row
        )
      );      
      setSavedRow(r.gr_no);

      const { data: kpiData } = await supabase.rpc("get_collections_kpi", {
        p_branch: effectiveBranch,
        p_month: selectedMonth || null,
        p_status: statusFilter,
        p_search: deferredSearch || null
      });

      if (kpiData && kpiData.length > 0) {
        const row = kpiData[0];

        const totalFreight = Number(row.total_freight) || 0;
        const collected = Number(row.total_collected) || 0;

        setKpiTotals({
          totalGRs: Number(row.total_grs) || 0,
          totalFreight,
          collected,
          balance: totalFreight - collected
        });
      }
      setTimeout(() => {
        setSavedRow(null);
      }, 1500);

    } catch (err) {
      alert("Save failed. Check console.");
      console.error(err);
    } finally {
      setSavingRow(null);
    }
    }, [canEdit, edits, fetchGRs]);

    function getStatus(r: GRRow): StatusFilter {
      const received = r.received_amount || 0;
      if (received >= r.total_freight) return "COLLECTED";
      if (received > 0) return "PARTIAL";
      return "PENDING";
    }

    function getPendingDays(grDate: string) {
      const today = new Date();
      const d = new Date(grDate);
      const diffMs = today.getTime() - d.getTime();
      return Math.floor(
        diffMs / (1000 * 60 * 60 * 24)
      );
    }

    function isOverdue(r: GRRow) {
      const status = getStatus(r);
      if (status === "COLLECTED") return false;
      return getPendingDays(r.gr_date) > 30;
    }

    function getRowClass(
      status: StatusFilter,
      overdue: boolean
    ) {
      if (overdue) {
        return "bg-red-50 border-l-4 border-red-500 hover:bg-red-100";
      }

      switch (status) {
        case "COLLECTED":
          return "bg-emerald-50 border-l-4 border-emerald-500 hover:bg-emerald-100";
        case "PARTIAL":
          return "bg-amber-50 border-l-4 border-amber-500 hover:bg-amber-100";
        case "PENDING":
        default:
          return "bg-gray-50 border-l-4 border-gray-300 hover:bg-gray-100";
      }
    }
    function exportExcel() {
      const wb = XLSX.utils.book_new();

      const data = rows.map((r) => {
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
          Status: getStatus(r),
          Payment_Mode: r.payment_mode || "",
          Ref_No: r.ref_no || "",
          Remarks: r.remarks || "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Collections");

      const buf = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      });

      saveAs(
        new Blob([buf]),
        `Collections_${branch}.xlsx`
      );
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
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg bg-white border shadow-sm p-4 hover:shadow-md transition">
            <div className="text-xs text-gray-500">
              Total GRs
            </div>
            <div className="text-lg font-semibold">
              {kpiTotals.totalGRs}
            </div>
          </div>

          <div className="rounded-lg bg-white border shadow-sm p-4 hover:shadow-md transition">
            <div className="text-xs text-gray-500">
              Total Freight
            </div>
            <div className="text-lg font-semibold">
              ₹ {formatINR(kpiTotals.totalFreight)}
            </div>
          </div>

          <div className="rounded-lg bg-white border shadow-sm p-4 hover:shadow-md transition">
            <div className="text-xs text-gray-500">
              Collected
            </div>
            <div className="text-lg font-semibold text-green-700">
              ₹ {formatINR(kpiTotals.collected)}
            </div>
          </div>

          <div className="rounded-lg bg-white border shadow-sm p-4 hover:shadow-md transition">
            <div className="text-xs text-gray-500">
              Balance
            </div>
            <div className="text-lg font-semibold text-red-700">
              ₹ {formatINR(kpiTotals.balance)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3 shadow-sm">
          {(
            ["ALL", "PENDING", "PARTIAL", "COLLECTED"] as StatusFilter[]
          ).map((s) => (
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
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
          <select
            value={selectedMonth}
          onChange={(e) => {
            setCurrentPage(1); // correct state
            setSelectedMonth(e.target.value);
          }}            className="border px-3 py-2 rounded-md text-sm ml-2"
          >
            <option value="">All Months</option>
            <option value="2026-01">Jan 2026</option>
            <option value="2026-02">Feb 2026</option>
            <option value="2026-03">Mar 2026</option>
          </select>          
          {role === "ADMIN" && (
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
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}          
        </div>

      {/* EXPORT + AGING SUMMARY */}
      <div className="flex items-center justify-between bg-white border rounded-md px-3 py-2 shadow-sm">

        {/* Aging Summary Grid */}
        <div className="flex items-center gap-5 text-sm leading-tight">

          {/* Static Label Column */}
          <div className="flex flex-col text-gray-500 font-medium pr-3 border-r">
            <span>DAYS</span>
            <span>GRs</span>
            <span>Amount</span>
          </div>

          {["0-30","30-90","90-180","180-365","365+"].map((bucket) => {
            const item = agingData?.find((a:any) => a.bucket === bucket);

            const riskColor =
              bucket === "365+"
                ? "text-red-600"
                : bucket === "180-365"
                ? "text-amber-600"
                : "text-gray-900";

            return (
              <div key={bucket} className="flex flex-col items-center min-w-[85px] border-r last:border-r-0 pr-3" >

                {/* Days Header */}
                <span className="font-medium text-gray-600">
                  {bucket}
                </span>

                {/* GR Count - Secondary */}
                <span className="text-gray-400">
                  {item?.total_grs || 0}
                </span>

                {/* Amount - Primary Focus */}
                <span className={`font-semibold ${riskColor}`}>
                  ₹ {formatINR(Number(item?.total_outstanding || 0))}
                </span>

              </div>
            );
          })}
        </div>

        {/* Export Button */}
        <button
          onClick={exportExcel}
          className="text-sm rounded px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Export Excel
        </button>

      </div>        {role !== "BRANCH" && (
          <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            🔒 You are in read-only mode
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="border px-2 py-1">
                  GR No
                </th>
                <th className="border px-2 py-1">
                  Date
                </th>
                <th className="border px-2 py-1">
                  Party
                </th>
                <th className="border px-2 py-1 text-right">
                  Freight
                </th>
                <th className="border px-2 py-1">
                  Pay Mode
                </th>
                <th className="border px-2 py-1">
                  Payment Mode
                </th>
                <th className="border px-2 py-1">
                  Received
                </th>
                <th className="border px-2 py-1">
                  Payment Date
                </th>
                <th className="border px-2 py-1">
                  Ref No
                </th>
                <th className="border px-2 py-1">
                  Remarks
                </th>
                <th className="border px-2 py-1">
                  Status
                </th>
                <th className="border px-2 py-1">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-6 text-gray-500">
                      Loading data...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-6 text-gray-500">
                      No records found
                    </td>
                  </tr>
            ) : 
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
                      rowErrors={rowErrors[r.gr_no]}
                    />
                  );
                })
  }

            </tbody>
          </table>

          {/* PAGINATION */}
          <div className="flex items-center justify-between mt-3 text-sm">
            <div>
              {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              {Math.min(
                currentPage * pageSize,
                totalCount
              )}{" "}
              of {totalCount
  }
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage(
                    (p) => p - 1
                  )
                }
                className="px-3 py-1 rounded border disabled:opacity-40"
              >
                ◀ Prev
              </button>

              <span>
                Page {currentPage} of{" "}
                {Math.ceil(
                  totalCount  / pageSize
                )}
              </span>

              <button
                disabled={
                  currentPage >=
                  Math.ceil(
                    totalCount / pageSize
                  )
                }
                onClick={() =>
                  setCurrentPage(
                    (p) => p + 1
                  )
                }
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
  const CollectionRow = React.memo(function CollectionRow({
    r,
    e,
    canEdit,
    savingRow,
    savedRow,
    handleChange,
    handleSave,
    status,
    days,
    overdue,
    rowClass,
    rowErrors
  }: any) {

    return (
        <tr
          className={rowClass}
        >
        <td className="border px-2 py-1">{r.gr_no}</td>
        <td className="border px-2 py-1">{r.gr_date}</td>
        <td className="border px-2 py-1">{r.party_name}</td>
        <td className="border px-2 py-1 text-right">
          ₹ {r.total_freight?.toLocaleString("en-IN")}
        </td>
        <td className="border px-2 py-1">{r.pay_mode}</td>

        <td className="border px-1 py-1">
          <select
            disabled={!canEdit}
            className={`w-full rounded px-1 py-0.5 border ${
              rowErrors?.payment_mode ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
            value={e?.payment_mode ?? r.payment_mode ?? ""}
            onChange={(ev) =>
              handleChange(r.gr_no, "payment_mode", ev.target.value)
            }
          >
            <option value="">—</option>
            <option value="CASH">CASH</option>
            <option value="BANK">BANK</option>
          </select>
        </td>

        <td className="border px-1 py-1">
          <input
            type="number"
            disabled={!canEdit}
            className={`w-full rounded px-1 py-0.5 text-right border ${
              rowErrors?.received_amount ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
            value={
              e?.received_amount ??
              (r.received_amount !== null
                ? String(r.received_amount)
                : "")
            }
            onChange={(ev) =>
              handleChange(r.gr_no, "received_amount", ev.target.value)
            }
          />
        </td>

        <td className="border px-1 py-1">
          <input
            type="date"
            disabled={!canEdit}
            className={`w-full rounded px-1 py-0.5 border ${
              rowErrors?.payment_date ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
            value={e?.payment_date ?? r.payment_date ?? ""}
            onChange={(ev) =>
              handleChange(r.gr_no, "payment_date", ev.target.value)
            }
          />
        </td>

        <td className="border px-1 py-1">
          <input
            type="text"
            disabled={!canEdit}
            className={`w-full rounded px-1 py-0.5 border ${
              rowErrors?.ref_no ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
            value={e?.ref_no ?? r.ref_no ?? ""}
            onChange={(ev) =>
              handleChange(r.gr_no, "ref_no", ev.target.value)
            }
          />
        </td>

        <td className="border px-1 py-1">
          <input
            type="text"
            disabled={!canEdit}
            className="w-full rounded border px-1 py-0.5"
            value={e?.remarks ?? r.remarks ?? ""}
            onChange={(ev) =>
              handleChange(r.gr_no, "remarks", ev.target.value)
            }
          />
        </td>

        <td className="border px-2 py-1 text-xs font-medium">
          {overdue ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              OVERDUE · {days}d
            </span>
          ) : status === "COLLECTED" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              Collected
            </span>
          ) : status === "PARTIAL" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Partial · {days}d
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
              Pending · {days}d
            </span>
          )}
        </td>

        <td className="border px-2 py-1 text-center">
          <button
            disabled={
              !canEdit ||
              savingRow === r.gr_no ||
              savedRow === r.gr_no
            }
            onClick={() => handleSave(r)}
            className={`rounded px-3 py-1 text-xs transition ${
              savedRow === r.gr_no
                ? "bg-green-600 text-white"
                : canEdit
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
          >
            {savingRow === r.gr_no
              ? "Saving…"
              : savedRow === r.gr_no
              ? "Saved ✓"
              : "Save"}
          </button>
        </td>
      </tr>
    );
  });
