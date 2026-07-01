import { supabase } from "@/lib/supabase";

export type TransferBranchOption = {
  branch_code: string;
  branch_name: string;
  area_manager: string | null;
};

export type BranchTransferRequest = {
  id: string;
  gr_no: string;
  from_branch_code: string;
  to_branch_code: string;
  from_branch_name: string | null;
  to_branch_name: string | null;
  party_name: string | null;
  total_freight: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_at: string;
  requested_by_email: string | null;
  decided_at: string | null;
  reject_reason: string | null;
};

export async function fetchTransferBranches() {
  const { data, error } = await supabase
    .from("branches")
    .select("branch_code, branch_name, area_manager")
    .order("branch_code", { ascending: true });

  if (error) throw error;
  return (data || []) as TransferBranchOption[];
}

export async function createBranchTransferRequest({
  grNo,
  fromBranchCode,
  toBranchCode,
}: {
  grNo: string;
  fromBranchCode: string;
  toBranchCode: string;
}) {
  const { error } = await supabase.rpc("request_branch_transfer", {
    p_gr_no: grNo,
    p_from_branch_code: fromBranchCode,
    p_to_branch_code: toBranchCode,
  });

  if (error) throw error;
}

export async function fetchBranchTransferRequests(status = "PENDING") {
  const { data, error } = await supabase.rpc("admin_list_branch_transfer_requests", {
    p_status: status,
  });

  if (error) throw error;
  return (data || []) as BranchTransferRequest[];
}

export async function approveBranchTransferRequest(id: string) {
  const { error } = await supabase.rpc("admin_approve_branch_transfer", {
    p_request_id: id,
  });

  if (error) throw error;
}

export async function rejectBranchTransferRequest(id: string, reason: string) {
  const { error } = await supabase.rpc("admin_reject_branch_transfer", {
    p_request_id: id,
    p_reason: reason || null,
  });

  if (error) throw error;
}
