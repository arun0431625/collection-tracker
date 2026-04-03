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

export async function fetchCollections({
  branch,
  role,
  page,
  pageSize,
  status,
  search,
  month
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
    .select(`
  gr_no,
  area_manager,
  branch_code,
  gr_date,
  party_name,
  total_freight,
  pay_mode,
  payment_mode,
  received_amount,
  payment_date,
  ref_no,
  remarks,
  status_calc
`, { count: "exact" });

  // Branch filter
    if (role !== "ADMIN") {
      query = query.eq("branch_code", branch);
    } else if (branch) {
      query = query.eq("branch_code", branch);
    }

// Status filter (correct working logic)

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
    query = query.or(
      `gr_no.ilike.%${search}%,party_name.ilike.%${search}%`
    );
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
    totalCount: count || 0
  };
}

export async function updateCollectionPayment(
  gr_no: string,
  branch_code: string,
  payload: {
    payment_mode?: string;
    received_amount?: number;
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
    p_payment_date: payload.payment_date ?? null,
    p_ref_no: payload.ref_no ?? null,
    p_remarks: payload.remarks ?? null,
  });

  if (error) {
    throw error;
  }
}
