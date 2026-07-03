import { supabase } from "@/lib/supabase";

export type ViewerUser = {
  id: string;
  username: string;
  display_name: string | null;
  accessible_pages: string[];
  accessible_branches: string[];
  is_active: boolean;
  created_at: string;
};

export type CreateViewerUserPayload = {
  username: string;
  display_name: string;
  password: string;
  accessible_pages: string[];
  accessible_branches: string[];
};

export const VIEWER_PAGES = ["Dashboard", "Collections", "Reports"] as const;
export type ViewerPage = typeof VIEWER_PAGES[number];

export async function listViewerUsers(): Promise<ViewerUser[]> {
  const { data, error } = await supabase.rpc("admin_list_viewer_users");
  if (error) throw new Error(error.message);
  return (data || []) as ViewerUser[];
}

export async function createViewerUser(payload: CreateViewerUserPayload): Promise<{ success: boolean; user_id: string }> {
  const { data, error } = await supabase.rpc("admin_create_viewer_user", {
    p_username: payload.username.toLowerCase().trim(),
    p_display_name: payload.display_name,
    p_password: payload.password,
    p_accessible_pages: payload.accessible_pages,
    p_accessible_branches: payload.accessible_branches,
  });
  if (error) throw new Error(error.message);
  return data as { success: boolean; user_id: string };
}

export async function deleteViewerUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_viewer_user", { p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function updateViewerUser(
  userId: string,
  payload: { display_name: string; accessible_pages: string[]; accessible_branches: string[]; is_active: boolean }
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_viewer_user", {
    p_user_id: userId,
    p_display_name: payload.display_name,
    p_accessible_pages: payload.accessible_pages,
    p_accessible_branches: payload.accessible_branches,
    p_is_active: payload.is_active,
  });
  if (error) throw new Error(error.message);
}

export async function getViewerProfile() {
  const { data, error } = await supabase.rpc("get_viewer_profile");
  if (error) throw new Error(error.message);
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  return (Array.isArray(data) ? data[0] : data) as ViewerUser;
}
