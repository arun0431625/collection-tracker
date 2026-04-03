import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { ROLES } from "@/types/constants";

export const BranchProfileSchema = z.object({
  branch_code: z.string(),
  branch_name: z.string().nullable(),
  area_manager: z.string().nullable(),
  role: z.enum([ROLES.ADMIN, ROLES.BRANCH]),
  username: z.string(),
  must_change_password: z.boolean(),
  is_active: z.boolean(),
  email: z.string(),
});

export type BranchProfile = z.infer<typeof BranchProfileSchema>;

function unwrapRpcResult<T>(data: T[] | T | null): T | null {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data ?? null;
}

export function branchCodeToEmail(branchCode: string) {
  return `${branchCode.trim().toLowerCase()}@tracker.com`;
}

export async function getCurrentBranchProfile() {
  const { data, error } = await supabase.rpc("get_current_branch_profile");

  if (error) {
    throw error;
  }

  const raw = unwrapRpcResult(data);
  if (!raw) return null;

  try {
    return BranchProfileSchema.parse(raw);
  } catch (err) {
    console.error("Zod Schema Validation Error on Branch Profile Payload:", err);
    throw new Error("Invalid Branch Profile data received from the server.");
  }
}

export async function signInWithBranchPassword(
  branchCode: string,
  password: string
) {
  const normalizedBranchCode = branchCode.trim().toUpperCase();
  const email = branchCodeToEmail(normalizedBranchCode);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  const profile = await getCurrentBranchProfile();

  if (!profile) {
    await supabase.auth.signOut();
    throw new Error("Branch profile not found.");
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    throw new Error("This branch account is disabled.");
  }

  return profile;
}

export async function signOutCurrentUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
