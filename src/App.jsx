import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import POSWelcome from '@/pages/POSWelcome';
import POSLogin from '@/pages/POSLogin';
import POSRegister from '@/pages/POSRegister';
import AdminLayout from '@/components/AdminLayout';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminOperators from '@/pages/AdminOperators';
import AdminInventory from '@/pages/AdminInventory';
import AdminTransactions from '@/pages/AdminTransactions';
import AdminFunctionKeys from '@/pages/AdminFunctionKeys';
import AdminReceipt from '@/pages/AdminReceipt';
import AdminRegisters from '@/pages/AdminRegisters';
import AdminNetwork from '@/pages/AdminNetwork';
import AdminRegisterLog from '@/pages/AdminRegisterLog';
import AdminRemoteWorkstation from '@/pages/AdminRemoteWorkstation';
import AdminDiscounts from '@/pages/AdminDiscounts';
import AdminEODReports from '@/pages/AdminEODReports';
import AdminCashReconciliation from '@/pages/AdminCashReconciliation';

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
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/operators" element={<AdminOperators />} />
          <Route path="/admin/inventory" element={<AdminInventory />} />
          <Route path="/admin/transactions" element={<AdminTransactions />} />
          <Route path="/admin/function-keys" element={<AdminFunctionKeys />} />
          <Route path="/admin/receipt" element={<AdminReceipt />} />
          <Route path="/admin/registers" element={<AdminRegisters />} />
          <Route path="/admin/network" element={<AdminNetwork />} />
          <Route path="/admin/register-log" element={<AdminRegisterLog />} />
          <Route path="/admin/remote-workstation" element={<AdminRemoteWorkstation />} />
          <Route path="/admin/discounts" element={<AdminDiscounts />} />
          <Route path="/admin/eod-reports" element={<AdminEODReports />} />
          <Route path="/admin/cash-reconciliation" element={<AdminCashReconciliation />} />
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
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App