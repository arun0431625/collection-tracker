import { Routes, Route, Navigate } from "react-router-dom";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Collections from "./pages/Collections";
import Reports from "./pages/Reports";
import AdminUpload from "./pages/AdminUpload";
import ChangePassword from "./pages/ChangePassword";
import Security from "./pages/Security";

// Layout & Guard
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

export default function AppRouter() {
return (
  <Routes>
    {/* 🔓 Public route */}
    <Route path="/login" element={<Login />} />

    {/* 🔐 Protected app */}
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin-upload" element={<AdminUpload />} />
        <Route path="/security" element={<Security />} />     
        <Route path="/change-password" element={<ChangePassword />} /> 
      </Route>
    </Route>

    {/* fallback */}
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);
}
