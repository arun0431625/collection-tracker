import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useBranch } from "@/context/BranchContext";

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { refreshProfile } = useBranch();

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (authError) {
      setLoading(false);
      setError(authError.message || "Password update failed. Please try again.");
      return;
    }

    const { error: profileError } = await supabase.rpc(
      "branch_complete_password_change"
    );

    if (profileError) {
      setLoading(false);
      setError(
        profileError.message?.toLowerCase().includes("function")
          ? "Password change function not found. Please run the SQL setup once."
          : "Password updated, but profile sync failed. Please contact admin."
      );
      return;
    }

    const profile = await refreshProfile();
    setLoading(false);

    if (!profile) {
      setError("Session refresh failed. Please login again.");
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleChangePassword}
        className="w-full max-w-sm bg-white p-6 rounded shadow"
      >
        <h2 className="text-xl font-semibold mb-4 text-center">
          Set New Password
        </h2>

        <div className="mb-3">
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded focus:outline-none focus:ring"
          />
        </div>

        <div className="mb-3">
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Updating..." : "Save Password"}
        </button>
      </form>
    </div>
  );
}
