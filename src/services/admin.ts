import { supabase } from "@/lib/supabase";

export type UploadRow = {
  area_manager: string;
  branch_code: string;
  gr_no: string;
  gr_date: string;
  party_name: string;
  total_freight: number;
  pay_mode: string;
};

export type CollectionFieldUpdateRow = {
  branch_code: string;
  gr_no: string;
  payment_mode: string;
  received_amount: number;
  payment_date: string;
  ref_no: string;
  remarks: string | null;
};

export type SecurityRow = {
  id: string;
  branch_code: string;
  area_manager: string | null;
  is_active: boolean;
  password_changed_at: string | null;
  username?: string;
};

export type BranchDeleteSummary = {
  branch: string;
  lr_count: number;
  total_freight: number;
  collected: number;
  balance: number;
};

export type ExistingCollectionRow = {
  branch_code: string;
  gr_no: string;
  total_freight: number;
};

function getErrorMessage(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";

  if (message.includes("function")) {
    return "Required SQL function is missing. Please run the secure-auth SQL setup.";
  }

  return error?.message || "Operation failed.";
}

export async function fetchSecurityRows() {
  const { data, error } = await supabase.rpc("admin_list_branch_security_rows");

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return (data || []) as SecurityRow[];
}

export async function fetchBranchDeleteSummary(branchCode: string) {
  const { data, error } = await supabase.rpc("admin_get_branch_delete_summary", {
    p_branch_code: branchCode,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return ((data || [])[0] || null) as BranchDeleteSummary | null;
}

export async function fetchExistingCollectionRows(
  rows: Pick<UploadRow, "branch_code" | "gr_no">[]
) {
  const { data, error } = await supabase.rpc("admin_get_existing_collection_rows", {
    p_rows: rows,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return (data || []) as ExistingCollectionRow[];
}

export async function resetBranchPassword(branchCode: string) {
  const { error } = await supabase.rpc("admin_reset_branch_password", {
    p_branch_code: branchCode,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function setBranchActive(branchCode: string, isActive: boolean) {
  const { error } = await supabase.rpc("admin_set_branch_active", {
    p_branch_code: branchCode,
    p_is_active: isActive,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function deleteBranch(branchCode: string) {
  const { error } = await supabase.rpc("admin_delete_branch", {
    p_branch_code: branchCode,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function insertCollections(rows: UploadRow[]) {
  const { error } = await supabase.rpc("admin_insert_collections_lrs", {
    p_rows: rows,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function upsertCollections(rows: UploadRow[]) {
  const { error } = await supabase.rpc("admin_upsert_collections_lrs", {
    p_rows: rows,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateCollectionFields(rows: CollectionFieldUpdateRow[]) {
  const { error } = await supabase.rpc("admin_update_collection_fields", {
    p_rows: rows,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateBranchUsername(branchCode: string, newUsername: string) {
  const { error } = await supabase.rpc("admin_change_branch_username", {
    p_branch_code: branchCode,
    p_new_username: newUsername,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}
