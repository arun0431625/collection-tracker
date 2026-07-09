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
}: {
  branch: string;
  role: "ADMIN" | "BRANCH";
  page: number;
  pageSize: number;
  status: string;
  search: string;
  month?: string;
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
    const isExact = branch.startsWith("EXACT:");
    const actualBranch = isExact ? branch.substring(6) : branch;

    if (isExact) {
      query = query.eq("branch_code", actualBranch);
    } else {
      // Get all sub-branches mapped to this controlling branch, then use .in()
      const subCodes = await getSubBranchCodes(actualBranch);
      if (subCodes.length === 0) {
        // No sub-branches found — filter by the branch itself
        query = query.eq("branch_code", actualBranch);
      } else {
        query = query.in("branch_code", subCodes);
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

  // Search
  if (search.trim()) {
    query = query.or(`gr_no.ilike.%${search}%,party_name.ilike.%${search}%`);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("gr_date", { ascending: false })
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
