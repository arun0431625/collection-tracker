import { useState } from "react";
import { useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs";
import { supabase } from "../lib/supabaseClient";
import { useBranch } from "../context/BranchContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { setBranchContext } = useBranch();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const uname = username.trim().toUpperCase();

    const { data, error } = await supabase
      .from("branches")
      .select("branch_code, branch_name, area_manager, password_hash, role, must_change_password, is_active")
      .eq("branch_code", uname)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      setError("Invalid username or password");
      return;
    }

    const match = await bcrypt.compare(password, data.password_hash);

    if (!match) {
      setError("Invalid username or password");
      return;
    }

    console.log("LOGIN DATA:", data);

        // ✅ LOGIN SUCCESS
    setBranchContext({
      branch: data.branch_code,
      role: data.role,
      username: data.branch_code,
      must_change_password: data.must_change_password,
    });
    if (data.must_change_password) {
      navigate("/change-password", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
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
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </div>
  );
}
