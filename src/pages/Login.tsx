import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithBranchPassword } from "@/services/auth";
import { useBranch } from "@/context/BranchContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { branch, loading: authLoading } = useBranch();

  useEffect(() => {
    if (!authLoading && branch) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, branch, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const profile = await signInWithBranchPassword(username, password);

      if (profile.must_change_password) {
        navigate("/change-password", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid username or password";
      setError(
        message === "Invalid login credentials"
          ? "Invalid username or password"
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,#f4f7fb_0%,#eef2f7_100%)] px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <img
                src="/atc-logo.png"
                alt="ATC"
                className="h-7 w-auto object-contain"
              />
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Branch Login
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Collection Tracker access panel
            </p>
          </div>
        </div>

        <div className="mb-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Branch Username"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="mb-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm mb-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
