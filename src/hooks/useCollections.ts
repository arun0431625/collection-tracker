import { useState, useCallback, useDeferredValue, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAccessibleCollectionBranchCodes, fetchCollections, updateCollectionPayment, fetchCollectionMonths } from "@/services/collections.api";
import { EditState, GRRow } from "@/types/collections";
import { StatusFilter, STATUS } from "@/types/constants";
import { toast } from "sonner";
import { useBranch } from "@/context/BranchContext";
import { useSessionStorageState } from "./useSessionStorageState";

export function useCollections() {
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
  const [rowErrors, setRowErrors] = useState<Record<string, Partial<Record<keyof EditState, boolean>>>>({});
  
  const [statusFilter, setStatusFilter] = useSessionStorageState<StatusFilter>("coll_status", STATUS.ALL);
  const [search, setSearch] = useSessionStorageState<string>("coll_search", "");
  const [selectedMonth, setSelectedMonth] = useSessionStorageState<string>("coll_month", "");
  const [selectedBranch, setSelectedBranch] = useSessionStorageState<string>("coll_branch", "");
  
  const effectiveBranch = isAdmin ? selectedBranch || null : branch;
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
    if (role !== "ADMIN") return;
    const fetchBranches = async () => {
      try {
        const branches = await fetchAccessibleCollectionBranchCodes();
        setBranchOptions(branches);
      } catch (error) {
        console.error("Failed to fetch branches", error);
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
          branch: role === "ADMIN" ? selectedBranch : branch!!,
          role: role as "ADMIN" | "BRANCH",
          page: currentPage,
          pageSize,
          status: statusFilter,
          search: deferredSearch,
          month: selectedMonth,
        }),
        supabase.rpc("get_collections_kpi", {
          p_branch: effectiveBranch,
          p_month: selectedMonth || null,
          p_status: statusFilter,
          p_search: deferredSearch || null,
        }),
        supabase.rpc("get_collections_aging", {
          p_branch: effectiveBranch,
          p_month: selectedMonth || null,
          p_status: statusFilter,
          p_search: deferredSearch || null,
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
  }, [branch, currentPage, deferredSearch, effectiveBranch, role, selectedBranch, selectedMonth, statusFilter, updateKpiTotals, pageSize]);

  useEffect(() => {
    if (!branch) return;
    fetchGRs();
  }, [fetchGRs, branch]);

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
    const finalPaymentDate = e?.payment_date ?? r.payment_date;
    const finalRefNo = e?.ref_no ?? r.ref_no;

    const errors: Partial<Record<keyof EditState, boolean>> = {};
    if (!finalPaymentMode) errors.payment_mode = true;
    if (!finalAmount) errors.received_amount = true;
    if (!finalPaymentDate) errors.payment_date = true;
    if (!finalRefNo) errors.ref_no = true;

    if (Object.keys(errors).length > 0) {
      setRowErrors(prev => ({ ...prev, [r.gr_no]: errors }));
      toast.error("Please fill in all required fields");
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
        p_search: deferredSearch || null
      });

      updateKpiTotals(kpiData || null);
      setTimeout(() => setSavedRow(null), 1500);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save. Check console.");
      console.error(err);
    } finally {
      setSavingRow(null);
    }
  }, [canEdit, deferredSearch, edits, effectiveBranch, selectedMonth, statusFilter, updateKpiTotals]);

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
    role,
    isAdmin,
    canEdit,
  };
}
