import { createContext, useContext, useState } from "react";


type BranchSession = {
  branch: string;
  role: "BRANCH" | "ADMIN";
  username: string;
  must_change_password: boolean;
};

type Ctx = {
  branch: string | null;
  role: "BRANCH" | "ADMIN" | null;
  username: string | null;
  must_change_password: boolean | null;
  setBranchContext: (v: BranchSession) => void;
  logout: () => void;
};

const BranchContext = createContext<Ctx>(null as any);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BranchSession | null>(() => {
    const s = localStorage.getItem("branch_session");
    return s ? JSON.parse(s) : null;
  });

  function setBranchContext(v: BranchSession) {
    localStorage.setItem("branch_session", JSON.stringify(v));
    setSession(v);
  }

  function logout() {
    localStorage.removeItem("branch_session");
    setSession(null); 
  }

  return (
    <BranchContext.Provider
      value={{
        branch: session?.branch ?? null,
        role: session?.role ?? null,
        username: session?.username ?? null,
        must_change_password: session?.must_change_password ?? null,
        setBranchContext,
        logout,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export const useBranch = () => useContext(BranchContext);
