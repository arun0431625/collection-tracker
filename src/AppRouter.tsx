import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Collections from "./pages/Collections";
import Reports from "./pages/Reports";
import AdminUpload from "./pages/AdminUpload";
import ChangePassword from "./pages/ChangePassword";
import Security from "./pages/Security";

import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/change-password" element={<ChangePassword />} />

          <Route element={<ProtectedRoute requireRole="ADMIN" />}>
            <Route path="/admin-upload" element={<AdminUpload />} />
            <Route path="/security" element={<Security />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
