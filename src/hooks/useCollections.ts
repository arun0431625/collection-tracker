import { useState, useCallback, useDeferredValue, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAccessibleCollectionBranchCodes, fetchCollections, updateCollectionPayment, fetchCollectionMonths } from "@/services/collections.api";
import { EditState, GRRow } from "@/types/collections";
import { StatusFilter, STATUS } from "@/types/constants";
import { toast } from "sonner";
import { useBranch } from "@/context/BranchContext";
import { useViewer } from "@/context/ViewerContext";
import { useSessionStorageState } from "./useSessionStorageState";

export function useCollections() {
  const { branch, role } = useBranch();
  const { isViewer, viewer } = useViewer();
  const isAdmin = role === "ADMIN" || isViewer;
  const canEdit = role === "BRANCH" && !isViewer;

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
  const [rowErrors, setRowErrors] = useState<Record<string, Partial<Record<keyof EditState, boolean>>>>({});
  
  const [statusFilter, setStatusFilter] = useSessionStorageState<StatusFilter>("coll_status", STATUS.ALL);
  const [payModeFilter, setPayModeFilter] = useSessionStorageState<string>("coll_paymode", "ALL");
  const [search, setSearch] = useSessionStorageState<string>("coll_search", "");
  const [selectedMonth, setSelectedMonth] = useSessionStorageState<string>("coll_month", "");
  const [selectedBranch, setSelectedBranch] = useSessionStorageState<string>("coll_branch", "");
  const [selectedFy, setSelectedFy] = useSessionStorageState<string>("coll_fy", "2026-27");
  
  const allowedBranches = isViewer ? (viewer?.accessible_branches || []) : [];

  const effectiveBranch = isAdmin 
    ? (
        selectedBranch
          ? selectedBranch
          : (isViewer ? (allowedBranches.length > 0 ? `IN:${allowedBranches.join(",")}` : "IN:__NONE__") : null)
      ) 
    : (selectedBranch || branch);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [monthOptions, setMonthOptions] = useState<{ value: string; label: string }[]>([]);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const months = await fetchCollectionMonths();
        setMonthOptions(months);
      } catch (error) {
        console.error("Failed to fetch months", error);
      }
    };
    fetchOptions();
  }, []);

  const updateKpiTotals = useCallback((kpiData: any[] | null) => {
    if (!kpiData || kpiData.length === 0) return;
    const row = kpiData[0];
    const totalFreight = Number(row.total_freight) || 0;
    const collected = Number(row.total_collected) || 0;
    setKpiTotals({
      totalGRs: Number(row.total_grs) || 0,
      totalFreight,
      collected,
      balance: totalFreight - collected
    });
  }, []);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        if (isViewer && viewer?.accessible_branches?.length) {
          // Viewer users: use their allowed branches list
          setBranchOptions([...viewer.accessible_branches].sort());
        } else if (role === "ADMIN") {
          const branches = await fetchAccessibleCollectionBranchCodes();
          setBranchOptions(branches);
        } else if (branch) {
          const { getSubBranchCodes } = await import("@/services/collections.api");
          const subBranches = await getSubBranchCodes(branch);
          if (subBranches.length > 1) {
            setBranchOptions(subBranches);
          }
        }
      } catch (error) {
        console.error("Failed to fetch branches", error);
      }
    };
    fetchBranches();
  }, [role, branch, isViewer, viewer]);

  useEffect(() => {
    if (isViewer && allowedBranches.length > 0 && selectedBranch) {
      if (!allowedBranches.includes(selectedBranch)) {
        setSelectedBranch("");
      }
    }
  }, [isViewer, allowedBranches, selectedBranch, setSelectedBranch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, payModeFilter, deferredSearch, selectedMonth, selectedFy]);

  const fetchGRs = useCallback(async () => {
    setLoading(true);
    try {
      const [result, kpiResult, agingResult] = await Promise.all([
        fetchCollections({
          branch: effectiveBranch as string,
          role: isAdmin ? "ADMIN" : (role as "ADMIN" | "BRANCH"),
          page: currentPage,
          pageSize,
          status: statusFilter,
          search: deferredSearch,
          month: selectedMonth,
          fy: selectedFy === "ALL" ? undefined : selectedFy,
          payMode: payModeFilter,
        }),
        supabase.rpc("get_collections_kpi", {
          p_branch: effectiveBranch,
          p_month: selectedMonth || null,
          p_status: statusFilter,
          p_search: deferredSearch || null,
          p_pay_mode: payModeFilter,
          p_fy: selectedFy === "ALL" ? null : selectedFy,
        }),
        supabase.rpc("get_collections_aging", {
          p_branch: effectiveBranch,
          p_month: selectedMonth || null,
          p_status: statusFilter,
          p_search: deferredSearch || null,
          p_pay_mode: payModeFilter,
          p_fy: selectedFy === "ALL" ? null : selectedFy,
        }),
      ]);
      setRows(result.rows as GRRow[]);
      setTotalCount(result.totalCount);

      if (!kpiResult.error) {
        updateKpiTotals(kpiResult.data || null);
      }
      if (!agingResult.error && agingResult.data) {
        setAgingData(agingResult.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load collections");
    } finally {
      setLoading(false);
    }
  }, [branch, currentPage, deferredSearch, effectiveBranch, role, selectedBranch, selectedMonth, selectedFy, statusFilter, payModeFilter, updateKpiTotals, pageSize]);

  useEffect(() => {
    if (!branch && !isViewer) return;
    fetchGRs();
  }, [fetchGRs, branch, isViewer]);

  const handleChange = useCallback((grNo: string, field: keyof EditState, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [grNo]: { ...prev[grNo], [field]: value },
    }));
  }, []);

  const handleSave = useCallback(async (r: GRRow) => {
    if (!canEdit) return;

    const e = edits[r.gr_no];
    const finalPaymentMode = e?.payment_mode ?? r.payment_mode;
    const finalAmount = e?.received_amount !== undefined ? Number(e.received_amount) : r.received_amount;
    const finalTds = e?.tds_amount !== undefined ? Number(e.tds_amount) : (r.tds_amount ?? 0);
    const finalPaymentDate = e?.payment_date ?? r.payment_date;
    const finalRefNo = e?.ref_no ?? r.ref_no;
    const recAmt = finalAmount || 0;
    const maxTds = recAmt > 0
      ? Math.round(((recAmt / 98) * 2 + 1) * 100) / 100
      : Math.round(((r.total_freight || 0) * 0.02 + 1) * 100) / 100;

    const errors: Partial<Record<keyof EditState, boolean>> = {};
    if (!finalPaymentMode) errors.payment_mode = true;
    if (!finalAmount) errors.received_amount = true;
    if (!finalPaymentDate) errors.payment_date = true;
    if (!finalRefNo) errors.ref_no = true;
    if (finalTds > maxTds) errors.tds_amount = true;

    if (Object.keys(errors).length > 0) {
      setRowErrors(prev => ({ ...prev, [r.gr_no]: errors }));
      if (errors.tds_amount) {
        toast.error(`TDS cannot exceed 2% limit for this received amount (max ₹${maxTds.toLocaleString('en-IN')})`);
      } else {
        toast.error("Please fill in all required fields");
      }
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
      await updateCollectionPayment(r.gr_no, r.branch_code, {
        payment_mode: finalPaymentMode,
        received_amount: finalAmount,
        tds_amount: finalTds,
        payment_date: finalPaymentDate,
        ref_no: finalRefNo,
        remarks: e?.remarks ?? r.remarks,
      }); 

      setEdits((p) => {
        const c = { ...p };
        delete c[r.gr_no];
        return c;
      });

      setRows(prev => prev.map(row => row.gr_no === r.gr_no ? {
        ...row,
        payment_mode: finalPaymentMode,
        received_amount: finalAmount,
        tds_amount: finalTds,
        payment_date: finalPaymentDate,
        ref_no: finalRefNo,
        remarks: e?.remarks ?? row.remarks
      } : row));      

      setSavedRow(r.gr_no);
      toast.success("Payment details saved successfully!");

      const { data: kpiData } = await supabase.rpc("get_collections_kpi", {
        p_branch: effectiveBranch,
        p_month: selectedMonth || null,
        p_status: statusFilter,
        p_search: deferredSearch || null,
        p_pay_mode: payModeFilter,
        p_fy: selectedFy === "ALL" ? null : selectedFy,
      });

      updateKpiTotals(kpiData || null);
      setTimeout(() => setSavedRow(null), 1500);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save. Check console.");
      console.error(err);
    } finally {
      setSavingRow(null);
    }
  }, [canEdit, deferredSearch, edits, effectiveBranch, selectedMonth, selectedFy, statusFilter, payModeFilter, updateKpiTotals]);

  return {
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
    selectedFy,
    setSelectedFy,
    branchOptions,
    monthOptions,
    handleChange,
    handleSave,
    fetchGRs,
    branch,
    effectiveBranch,
    role,
    isAdmin,
    canEdit,
  };
}
