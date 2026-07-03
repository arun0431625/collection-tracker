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

export function viewerUsernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@viewer.tracker.com`;
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

// Sign in as a viewer user (username@viewer.tracker.com)
export async function signInAsViewer(username: string, password: string) {
  const email = viewerUsernameToEmail(username);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return email;
}

// Try branch login first, then viewer login
export async function signInAuto(
  username: string,
  password: string
): Promise<{ type: "branch"; profile: BranchProfile } | { type: "viewer" }> {
  // Try branch login first
  const branchEmail = branchCodeToEmail(username.trim().toUpperCase());
  const { error: branchError } = await supabase.auth.signInWithPassword({
    email: branchEmail,
    password,
  });

  if (!branchError) {
    // Branch login succeeded
    const profile = await getCurrentBranchProfile();
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error("Branch profile not found.");
    }
    if (!profile.is_active) {
      await supabase.auth.signOut();
      throw new Error("This branch account is disabled.");
    }
    return { type: "branch", profile };
  }

  // Branch login failed — try viewer login
  const viewerEmail = viewerUsernameToEmail(username);
  const { error: viewerError } = await supabase.auth.signInWithPassword({
    email: viewerEmail,
    password,
  });

  if (!viewerError) {
    return { type: "viewer" };
  }

  // Both failed
  throw new Error("Invalid username or password");
}

export async function signOutCurrentUser() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("Supabase signOut returned an error:", error.message);
    }
  } catch (err) {
    console.error("Critical error during supabase.auth.signOut():", err);
  }
}
