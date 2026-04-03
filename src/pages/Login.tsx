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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-white p-6 rounded shadow"
      >
        <h2 className="text-xl font-semibold mb-4 text-center">
          Branch Login
        </h2>

        <div className="mb-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Branch Username"
            className="w-full border px-3 py-2 rounded focus:outline-none focus:ring"
          />
        </div>

        <div className="mb-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border px-3 py-2 rounded focus:outline-none focus:ring"
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
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
