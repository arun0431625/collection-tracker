import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getViewerProfile, ViewerUser } from "@/services/viewerUsers";
import { signOutCurrentUser } from "@/services/auth";

type ViewerCtx = {
  viewer: ViewerUser | null;
  loading: boolean;
  isViewer: boolean;
  logout: () => Promise<void>;
};

const ViewerContext = createContext<ViewerCtx>(null as any);

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [viewer, setViewer] = useState<ViewerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const hasBootstrapped = useRef(false);

  async function loadViewer(session: Session | null) {
    if (!session) {
      setViewer(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await getViewerProfile();
      setViewer(profile);
    } catch {
      setViewer(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (hasBootstrapped.current && viewer) {
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      await loadViewer(session);
      hasBootstrapped.current = true;
    }

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        hasBootstrapped.current = false;
        setViewer(null);
        setLoading(false);
      } else if (event === "SIGNED_IN") {
        setLoading(true);
        void loadViewer(session);
        hasBootstrapped.current = true;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    setLoading(true);
    hasBootstrapped.current = false;
    try {
      await signOutCurrentUser();
    } catch {}
    finally {
      setViewer(null);
      sessionStorage.clear();
      setLoading(false);
    }
  }

  return (
    <ViewerContext.Provider value={{ viewer, loading, isViewer: !!viewer, logout }}>
      {children}
    </ViewerContext.Provider>
  );
}

export const useViewer = () => useContext(ViewerContext);
