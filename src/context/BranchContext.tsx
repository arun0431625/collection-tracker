import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  getCurrentBranchProfile,
  signOutCurrentUser,
  type BranchProfile,
} from "@/services/auth";

type Ctx = {
  branch: string | null;
  branchName: string | null;
  areaManager: string | null;
  role: "BRANCH" | "ADMIN" | null;
  username: string | null;
  must_change_password: boolean;
  is_active: boolean;
  email: string | null;
  loading: boolean;
  refreshProfile: () => Promise<BranchProfile | null>;
  logout: () => Promise<void>;
};

const BranchContext = createContext<Ctx>(null as any);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<BranchProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Track if we've already bootstrapped successfully to avoid re-loading on HMR/tab switch
  const hasBootstrapped = useRef(false);

  async function loadProfile(session: Session | null) {
    if (!session) {
      setProfile(null);
      setLoading(false);
      return null;
    }

    try {
      const nextProfile = await getCurrentBranchProfile();

      if (!nextProfile || !nextProfile.is_active) {
        await signOutCurrentUser();
        setProfile(null);
        return null;
      }

      setProfile(nextProfile);
      return nextProfile;
    } catch {
      // If we already have a profile and the RPC just failed (e.g. network blip),
      // keep the existing profile instead of clearing it
      if (!profile) {
        setProfile(null);
      }
      return profile;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      // If we already have a profile from a previous mount (HMR / tab switch),
      // skip the loading flash entirely
      if (hasBootstrapped.current && profile) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        await loadProfile(session);
        hasBootstrapped.current = true;
      } catch {
        // Session fetch failed (network error, etc.)
        // If we already have a profile, keep it and stop loading
        if (profile) {
          setLoading(false);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      // Only react to real auth changes (login/logout), not token refreshes
      // Token refresh failures on tab switch should NOT reset the UI
      if (event === "SIGNED_OUT") {
        hasBootstrapped.current = false;
        setLoading(true);
        void loadProfile(null);
      } else if (event === "SIGNED_IN") {
        setLoading(true);
        void loadProfile(session);
        hasBootstrapped.current = true;
      }
      // Ignore TOKEN_REFRESHED, INITIAL_SESSION, USER_UPDATED etc.
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setLoading(true);
    return loadProfile(session);
  }

  async function logout() {
    setLoading(true);
    hasBootstrapped.current = false;

    try {
      await signOutCurrentUser();
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BranchContext.Provider
      value={{
        branch: profile?.branch_code ?? null,
        branchName: profile?.branch_name ?? null,
        areaManager: profile?.area_manager ?? null,
        role: profile?.role ?? null,
        username: profile?.username ?? null,
        must_change_password: profile?.must_change_password ?? false,
        is_active: profile?.is_active ?? false,
        email: profile?.email ?? null,
        loading,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export const useBranch = () => useContext(BranchContext);
