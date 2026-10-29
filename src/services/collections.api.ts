import { supabase } from "@/lib/supabase";

export async function fetchAccessibleCollectionBranchCodes() {
  const { data, error } = await supabase.rpc(
    "get_accessible_collection_branch_codes"
  );

  if (error) throw error;

  return ((data || []) as { branch_code: string }[]).map(
    (row) => row.branch_code
  );
}

export async function fetchBranchLookup(branchCodes: string[]) {
  const uniqueCodes = Array.from(
    new Set(branchCodes.map((code) => code?.trim().toUpperCase()).filter(Boolean))
  );

  if (!uniqueCodes.length) return new Map<string, { branch_name: string; area_manager: string; mapped_to: string }>();

  const lookup = new Map<string, { branch_name: string; area_manager: string; mapped_to: string }>();

  for (let i = 0; i < uniqueCodes.length; i += 500) {
    const chunk = uniqueCodes.slice(i, i + 500);
    const { data, error } = await supabase
      .from("branches")
      .select("branch_code, branch_name, area_manager, mapped_to")
      .in("branch_code", chunk);

    if (error) throw error;

    (data || []).forEach((row) => {
      lookup.set(row.branch_code, {
        branch_name: row.branch_name || row.branch_code,
        area_manager: row.area_manager || "",
        mapped_to: row.mapped_to || row.branch_code,
      });
    });
  }

  return lookup;
}

export async function fetchAllBranchesLookup() {
  const { data, error } = await supabase
    .from("branches")
    .select("branch_code, branch_name, area_manager, mapped_to");

  if (error) throw error;

  const lookup = new Map<string, { branch_name: string; area_manager: string; mapped_to: string }>();
  (data || []).forEach((row) => {
    const code = (row.branch_code || "").trim().toUpperCase();
    lookup.set(code, {
      branch_name: row.branch_name || row.branch_code,
      area_manager: row.area_manager || "",
      mapped_to: row.mapped_to || row.branch_code,
    });
  });

  return lookup;
}

// Cache sub-branch code lookups to avoid repeated DB calls
const subBranchCache = new Map<string, string[]>();

export async function getSubBranchCodes(controllingBranch: string): Promise<string[]> {
  if (subBranchCache.has(controllingBranch)) {
    return subBranchCache.get(controllingBranch)!;
  }
  const { data, error } = await supabase.rpc("get_sub_branch_codes", {
    p_controlling_branch: controllingBranch,
  });
  if (error) throw error;
  const codes = ((data || []) as { branch_code: string }[]).map((r) => r.branch_code);
  subBranchCache.set(controllingBranch, codes);
  return codes;
}

export async function getExpandedBranchCodes(branches: string[]): Promise<string[]> {
  const upperBranches = branches.map((b) => b.trim().toUpperCase()).filter(Boolean);
  if (upperBranches.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from("branches")
      .select("branch_code, mapped_to");

    if (error || !data) return upperBranches;

    const set = new Set<string>(upperBranches);
    data.forEach((r) => {
      const code = (r.branch_code || "").trim().toUpperCase();
      const mapped = (r.mapped_to || "").trim().toUpperCase();
      if (upperBranches.includes(mapped) && code) {
        set.add(code);
      }
    });
    return Array.from(set);
  } catch {
    return upperBranches;
  }
}

export async function getSubBranchDetails(controllingBranch: string): Promise<{ branch_code: string; pending_count: number }[]> {
  const { data, error } = await supabase.rpc("get_sub_branch_codes", {
    p_controlling_branch: controllingBranch,
  });
  if (error) throw error;
  return (data || []) as { branch_code: string; pending_count: number }[];
}

export async function fetchCollections({
  branch,
  role,
  page,
  pageSize,
  status,
  search,
  month,
  fy,
  payMode = "ALL",
}: {
  branch: string;
  role: "ADMIN" | "BRANCH";
  page: number;
  pageSize: number;
  status: string;
  search: string;
  month?: string;
  fy?: string;
  payMode?: string;
}) {
  let query = supabase
    .from("collections_with_status")
    .select(
      `gr_no, area_manager, branch_code, gr_date, party_name, total_freight,
       pay_mode, payment_mode, received_amount, tds_amount, payment_date, ref_no, remarks, status_calc`,
      { count: "exact" }
    );

  // Branch filter
  if (branch) {
    if (branch.startsWith("IN:")) {
      const list = branch.substring(3).split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length === 0 || list.includes("__NONE__")) {
        query = query.eq("branch_code", "__NONE__");
      } else {
        const expanded = await getExpandedBranchCodes(list);
        query = query.in("branch_code", expanded);
      }
    } else if (branch.startsWith("EXACT:")) {
      const actualBranch = branch.substring(6);
      query = query.eq("branch_code", actualBranch);
    } else {
      // Single branch selected (e.g. "PUNJABI BAGH")
      // Expand mapped sub-branches so controlling branch includes all its mapped points
      const expanded = await getExpandedBranchCodes([branch]);
      if (expanded.length === 0) {
        query = query.eq("branch_code", branch);
      } else {
        query = query.in("branch_code", expanded);
      }
    }
  }

  // Status filter
  if (status !== "ALL") {
    query = query.eq("status_calc", status);
  }

  // Month filter
  if (month) {
    const start = `${month}-01`;
    const end = new Date(month + "-01");
    end.setMonth(end.getMonth() + 1);
    query = query
      .gte("gr_date", start)
      .lt("gr_date", end.toISOString().slice(0, 10));
  }

  // FY filter (e.g. "2025-26")
  if (fy) {
    const startYear = fy.split("-")[0];
    const endYear = (parseInt(startYear, 10) + 1).toString();
    query = query
      .gte("gr_date", `${startYear}-04-01`)
      .lt("gr_date", `${endYear}-04-01`);
  }

  // Search
  if (search.trim()) {
    query = query.or(`gr_no.ilike.%${search}%,party_name.ilike.%${search}%`);
  }

  // Pay Mode Filter
  if (payMode !== "ALL") {
    query = query.eq("pay_mode", payMode);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("gr_date", { ascending: false })
    .order("gr_no", { ascending: true })
    .range(from, to);

  if (error) throw error;

  return {
    rows: data || [],
    totalCount: count || 0,
  };
}

export async function updateCollectionPayment(
  gr_no: string,
  branch_code: string,
  payload: {
    payment_mode?: string;
    received_amount?: number;
    tds_amount?: number;
    payment_date?: string;
    ref_no?: string;
    remarks?: string;
  }
) {
  const { error } = await supabase.rpc("branch_update_collection_payment", {
    p_gr_no: gr_no,
    p_branch_code: branch_code,
    p_payment_mode: payload.payment_mode ?? null,
    p_received_amount: payload.received_amount ?? null,
    p_tds_amount: payload.tds_amount ?? null,
    p_payment_date: payload.payment_date ?? null,
    p_ref_no: payload.ref_no ?? null,
    p_remarks: payload.remarks ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function fetchCollectionMonths() {
  const { data, error } = await supabase.rpc("get_collection_months");
  if (error) throw error as any;
  return (data || []) as { value: string; label: string }[];
}

export type PaymentHistoryRecord = {
  id: string;
  gr_no: string;
  branch_code: string;
  payment_mode: string;
  received_amount: number;
  tds_amount: number;
  payment_date: string;
  ref_no: string | null;
  remarks: string | null;
  created_at: string;
};

export async function fetchCollectionPaymentHistory(gr_no: string, branch_code: string): Promise<PaymentHistoryRecord[]> {
  const { data, error } = await supabase.rpc("get_collection_payment_history", {
    p_gr_no: gr_no,
    p_branch_code: branch_code,
  });
  if (error) throw error;
  return data as PaymentHistoryRecord[];
}

export async function addCollectionPayment(
  gr_no: string,
  branch_code: string,
  payload: {
    payment_mode: string;
    received_amount: number;
    tds_amount: number;
    payment_date: string;
    ref_no?: string;
    remarks?: string;
  }
) {
  const { error } = await supabase.rpc("add_collection_payment", {
    p_gr_no: gr_no,
    p_branch_code: branch_code,
    p_payment_mode: payload.payment_mode,
    p_received_amount: payload.received_amount,
    p_tds_amount: payload.tds_amount,
    p_payment_date: payload.payment_date,
    p_ref_no: payload.ref_no ?? null,
    p_remarks: payload.remarks ?? null,
  });
  if (error) throw error;
}
