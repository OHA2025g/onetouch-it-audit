import { useEffect } from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import CIODashboard from "@/pages/CIODashboard";
import IdentityDashboard from "@/pages/IdentityDashboard";
import ComplianceDashboard from "@/pages/ComplianceDashboard";
import ApplicationDashboard from "@/pages/ApplicationDashboard";
import CloudDashboard from "@/pages/CloudDashboard";
import VendorDashboard from "@/pages/VendorDashboard";
import RemediationDashboard from "@/pages/RemediationDashboard";
import AuditUniverse from "@/pages/AuditUniverse";
import Audits from "@/pages/Audits";
import ControlLibrary from "@/pages/ControlLibrary";
import Observations from "@/pages/Observations";
import ObservationDetail from "@/pages/ObservationDetail";
import Evidence from "@/pages/Evidence";
import Copilot from "@/pages/Copilot";
import Policies from "@/pages/Policies";
import Reports from "@/pages/Reports";
import Analytics from "@/pages/Analytics";
import UserManagement from "@/pages/UserManagement";
import Risks from "@/pages/Risks";
import RiskDetail from "@/pages/RiskDetail";
import ControlDetail from "@/pages/ControlDetail";
import RemediationList from "@/pages/RemediationList";
import RemediationDetail from "@/pages/RemediationDetail";
import ApplicationDetail from "@/pages/ApplicationDetail";
import VendorDetail from "@/pages/VendorDetail";
import RegulatoryDeadlineDetail from "@/pages/RegulatoryDeadlineDetail";
import CloudAuditResultDetail from "@/pages/CloudAuditResultDetail";
import UserAccessRiskDetail from "@/pages/UserAccessRiskDetail";
import SodConflictDetail from "@/pages/SodConflictDetail";
import Notifications from "@/pages/Notifications";
import Integrations from "@/pages/Integrations";
import { Toaster } from "@/components/ui/sonner";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ThemeBootstrap() {
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "light";
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <ThemeBootstrap />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<CIODashboard />} />
            <Route path="/dashboard/identity" element={<IdentityDashboard />} />
            <Route path="/dashboard/compliance" element={<ComplianceDashboard />} />
            <Route path="/dashboard/applications" element={<ApplicationDashboard />} />
            <Route path="/dashboard/cloud" element={<CloudDashboard />} />
            <Route path="/dashboard/vendors" element={<VendorDashboard />} />
            <Route path="/dashboard/remediation" element={<RemediationDashboard />} />
            <Route path="/risks/:riskId" element={<RiskDetail />} />
            <Route path="/risks" element={<Risks />} />
            <Route path="/controls/:controlId" element={<ControlDetail />} />
            <Route path="/controls" element={<ControlLibrary />} />
            <Route path="/observations/:obsId" element={<ObservationDetail />} />
            <Route path="/observations" element={<Observations />} />
            <Route path="/remediation/:remediationId" element={<RemediationDetail />} />
            <Route path="/remediation" element={<RemediationList />} />
            <Route path="/universe/applications/:appId" element={<ApplicationDetail />} />
            <Route path="/universe/vendors/:vendorId" element={<VendorDetail />} />
            <Route path="/compliance/deadline/:deadlineId" element={<RegulatoryDeadlineDetail />} />
            <Route path="/cloud/result/:resultId" element={<CloudAuditResultDetail />} />
            <Route path="/identity/user-risk/:userRiskId" element={<UserAccessRiskDetail />} />
            <Route path="/identity/sod/:conflictId" element={<SodConflictDetail />} />
            <Route path="/universe" element={<AuditUniverse />} />
            <Route path="/audits" element={<Audits />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/copilot" element={<Copilot />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/integrations" element={<Integrations />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
