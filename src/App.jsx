import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
// Captures a PXE lane's register_id off the boot URL before routing or any auth
// redirect can strip the query string.
import '@/lib/laneIdentity';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import POSWelcome from '@/pages/POSWelcome';
import POSLogin from '@/pages/POSLogin';
import POSRegister from '@/pages/POSRegister';
import AdminLogin from '@/pages/AdminLogin';
import AdminLayout from '@/components/AdminLayout';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminOperators from '@/pages/AdminOperators';
import AdminEmployeeCreation from '@/pages/AdminEmployeeCreation';
import AdminEmployeeManager from '@/pages/AdminEmployeeManager';
import AdminInventory from '@/pages/AdminInventory';
import AdminTransactions from '@/pages/AdminTransactions';
import AdminFunctionKeys from '@/pages/AdminFunctionKeys';
import AdminActionCodes from '@/pages/AdminActionCodes';
import AdminReceipt from '@/pages/AdminReceipt';
import AdminRegisters from '@/pages/AdminRegisters';
import AdminNetwork from '@/pages/AdminNetwork';
import AdminRegisterLog from '@/pages/AdminRegisterLog';
import AdminRemoteWorkstation from '@/pages/AdminRemoteWorkstation';
import AdminDiscounts from '@/pages/AdminDiscounts';
import AdminEODReports from '@/pages/AdminEODReports';
import AdminCashReconciliation from '@/pages/AdminCashReconciliation';
import POSCashExport from '@/pages/POSCashExport';
import AdminStaffReport from '@/pages/AdminStaffReport';
import AdminEmergencyLog from '@/pages/AdminEmergencyLog';
import AdminShiftScheduling from '@/pages/AdminShiftScheduling';
import AdminPayrollReport from '@/pages/AdminPayrollReport';
import AdminGiftCardManager from '@/pages/AdminGiftCardManager';
import AdminTaxExempt from '@/pages/AdminTaxExempt';
import AdminLoyaltyMembers from '@/pages/AdminLoyaltyMembers';
import AdminTrainingGuides from '@/pages/AdminTrainingGuides';
import AdminSystemAlerts from '@/pages/AdminSystemAlerts';
import AdminMaintenanceLog from '@/pages/AdminMaintenanceLog';
import AdminStoreSettings from '@/pages/AdminStoreSettings';
import AdminLossPrevention from '@/pages/AdminLossPrevention';
import AdminVendorInsights from '@/pages/AdminVendorInsights';
import AdminVendorCompanies from '@/pages/AdminVendorCompanies';
import VendorDashboard from '@/pages/VendorDashboard';
import AdminHardwareStatus from '@/pages/AdminHardwareStatus';
import AdminPermissions from '@/pages/AdminPermissions';
import AdminDataViewer from '@/pages/AdminDataViewer';
import AdminDiagnosticTools from '@/pages/AdminDiagnosticTools';
import AdminAuditLog from '@/pages/AdminAuditLog';
import AdminAnnouncements from '@/pages/AdminAnnouncements';
import AdminNoReceiptCustomers from '@/pages/AdminNoReceiptCustomers';
import AdminInventoryReconciliation from '@/pages/AdminInventoryReconciliation';
import AdminClaims from '@/pages/AdminClaims';
import AdminProfitLoss from '@/pages/AdminProfitLoss';
import AdminFinancials from '@/pages/AdminFinancials';
import EmployeeTrainingCenter from '@/pages/EmployeeTrainingCenter';
import AdminPOSFeedback from '@/pages/AdminPOSFeedback';
import AdminTechnicalDocs from '@/pages/AdminTechnicalDocs';
import AdminKeyboardMapper from '@/pages/AdminKeyboardMapper';
import AdminKeyboardLabels from '@/pages/AdminKeyboardLabels';
import AdminCheckRegister from '@/pages/AdminCheckRegister';
import AdminCustomerService from '@/pages/AdminCustomerService';
import AdminControllerUpdates from '@/pages/AdminControllerUpdates';
import AdminFacilityManagement from '@/pages/AdminFacilityManagement';
import AdminCustomerDisplay from '@/pages/AdminCustomerDisplay';
import CustomerDisplay from '@/pages/CustomerDisplay';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0e27]">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<Home />} />
        <Route path="/pos" element={<POSLogin />} />
        <Route path="/pos/login" element={<POSLogin />} />
        <Route path="/pos/register" element={<POSRegister />} />
        {/* Customer-facing second monitor on a lane — opened by the kiosk launcher as its
            own fullscreen window. Read-only; it follows what the POS window publishes. */}
        <Route path="/customer-display" element={<CustomerDisplay />} />
        <Route path="/vendor-dashboard" element={<VendorDashboard />} />
        <Route path="/training-center" element={<EmployeeTrainingCenter />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/operators" element={<AdminOperators />} />
          <Route path="/admin/employee-creation" element={<AdminEmployeeCreation />} />
          <Route path="/admin/employee-manager" element={<AdminEmployeeManager />} />
          <Route path="/admin/inventory" element={<AdminInventory />} />
          <Route path="/admin/transactions" element={<AdminTransactions />} />
          <Route path="/admin/function-keys" element={<AdminFunctionKeys />} />
          <Route path="/admin/action-codes" element={<AdminActionCodes />} />
          <Route path="/admin/receipt" element={<AdminReceipt />} />
          <Route path="/admin/registers" element={<AdminRegisters />} />
          <Route path="/admin/network" element={<AdminNetwork />} />
          <Route path="/admin/register-log" element={<AdminRegisterLog />} />
          <Route path="/admin/remote-workstation" element={<AdminRemoteWorkstation />} />
          <Route path="/admin/discounts" element={<AdminDiscounts />} />
          <Route path="/admin/eod-reports" element={<AdminEODReports />} />
          <Route path="/admin/cash-reconciliation" element={<AdminCashReconciliation />} />
          <Route path="/admin/cash-export" element={<POSCashExport />} />
          <Route path="/admin/staff-report" element={<AdminStaffReport />} />
          <Route path="/admin/emergency-log" element={<AdminEmergencyLog />} />
          <Route path="/admin/shift-scheduling" element={<AdminShiftScheduling />} />
          <Route path="/admin/payroll" element={<AdminPayrollReport />} />
          <Route path="/admin/gift-cards" element={<AdminGiftCardManager />} />
          <Route path="/admin/tax-exempt" element={<AdminTaxExempt />} />
          <Route path="/admin/loyalty-members" element={<AdminLoyaltyMembers />} />
          <Route path="/admin-training-guides" element={<AdminTrainingGuides />} />
          <Route path="/admin-system-alerts" element={<AdminSystemAlerts />} />
          <Route path="/admin-maintenance-log" element={<AdminMaintenanceLog />} />
          <Route path="/admin/settings" element={<AdminStoreSettings />} />
          <Route path="/admin/loss-prevention" element={<AdminLossPrevention />} />
          <Route path="/admin/vendor-insights" element={<AdminVendorInsights />} />
          <Route path="/admin/vendor-companies" element={<AdminVendorCompanies />} />
          <Route path="/admin/hardware" element={<AdminHardwareStatus />} />
          <Route path="/admin/permissions" element={<AdminPermissions />} />
          <Route path="/admin/data-viewer" element={<AdminDataViewer />} />
          <Route path="/admin/diagnostics" element={<AdminDiagnosticTools />} />
          <Route path="/admin-audit-log" element={<AdminAuditLog />} />
          <Route path="/admin-announcements" element={<AdminAnnouncements />} />
          <Route path="/admin/no-receipt-customers" element={<AdminNoReceiptCustomers />} />
          <Route path="/admin/inventory-reconciliation" element={<AdminInventoryReconciliation />} />
          <Route path="/admin/claims" element={<AdminClaims />} />
          <Route path="/admin/profit-loss" element={<AdminProfitLoss />} />
          <Route path="/admin/financials" element={<AdminFinancials />} />
          <Route path="/admin/pos-feedback" element={<AdminPOSFeedback />} />
          <Route path="/admin/technical-docs" element={<AdminTechnicalDocs />} />
          <Route path="/admin/keyboard-mapper" element={<AdminKeyboardMapper />} />
          <Route path="/admin/keyboard-labels" element={<AdminKeyboardLabels />} />
          <Route path="/admin/check-register" element={<AdminCheckRegister />} />
          <Route path="/admin/customer-service" element={<AdminCustomerService />} />
          <Route path="/admin/controller-updates" element={<AdminControllerUpdates />} />
          <Route path="/admin/facility" element={<AdminFacilityManagement />} />
          <Route path="/admin/customer-display" element={<AdminCustomerDisplay />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
          <Toaster />
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App