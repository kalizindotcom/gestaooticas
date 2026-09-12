import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalFilterProvider } from "@/contexts/GlobalFilterContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PermissionsProvider, usePermissions } from "@/contexts/PermissionsContext";
import { GlobalPermissions, ModulePermissions } from "@/types/permissions";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { useState, useEffect } from "react";
import { localApi } from "@/lib/localApi";

import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import Customers from "./pages/Customers";
import Companies from "./pages/Companies";
import Stores from "./pages/Stores";
import Users from "./pages/Users";
import Financial from "./pages/Financial";
import Fiscal from "./pages/Fiscal";
import Sales from "./pages/Sales";
import ServiceOrders from "./pages/ServiceOrders";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import ProductsSold from "./pages/reports/ProductsSold";
import ExpiredPrescriptions from "./pages/reports/ExpiredPrescriptions";
import AdminCenter from "./pages/AdminCenter";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: Infinity, // Dados nunca ficam "stale" automaticamente
      gcTime: Infinity, // Cache nunca expira
      networkMode: 'offlineFirst', // Usa cache primeiro, depois rede
    },
  },
});

import { useAuth } from "@/contexts/AuthContext";

function ProtectedRoute({
  children,
  module,
  action = 'view'
}: {
  children: React.ReactNode;
  module?: keyof GlobalPermissions;
  action?: keyof ModulePermissions;
}) {
  const { isAuthenticated, user, loading } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const location = useLocation();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (isAuthenticated && !loading && !permissionsLoading) {
      checkOnboardingStatus();
    }
  }, [isAuthenticated, loading, permissionsLoading, user?.id, user?.role, user?.role_id, user?.companies?.length, user?.stores?.length]);

  const checkOnboardingStatus = async () => {
    const normalizedRole = String(user?.role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const normalizedRoleId = String(user?.role_id || '').trim().toLowerCase();
    const assignedCompanies = Array.isArray(user?.companies) ? user.companies : [];
    const assignedStores = Array.isArray(user?.stores) ? user.stores : [];
    const hasAssignedScope = assignedCompanies.length > 0 || assignedStores.length > 0;
    const canProvisionOrganization = ['admin_master', 'admin'].includes(normalizedRole)
      || ['r-admin-master', 'r-admin', 'admin_master', 'admin'].includes(normalizedRoleId);

    // Usuários associados a uma empresa/loja nunca devem passar pelo onboarding.
    // O onboarding é reservado ao administrador que ainda precisa configurar a base local.
    if (hasAssignedScope || !canProvisionOrganization) {
      setNeedsOnboarding(false);
      setCheckingOnboarding(false);
      return;
    }

    try {
      const { data: companies } = await localApi
        .from('companies')
        .select('id')
        .limit(1);

      const { data: stores } = await localApi
        .from('stores')
        .select('id')
        .limit(1);

      setNeedsOnboarding(!companies || companies.length === 0 || !stores || stores.length === 0);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setNeedsOnboarding(false);
    } finally {
      setCheckingOnboarding(false);
    }
  };

  if (loading || permissionsLoading) {
    return <LoadingScreen message="Carregando acessos..." onTimeout={() => {
      // Segurança: se passar de 12s sem liberar, redireciona pro login
      if (!user) {
        window.location.href = '/login';
      } else {
        window.location.reload();
      }
    }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (checkingOnboarding) {
    return <LoadingScreen message="Carregando acessos..." onTimeout={() => {
      window.location.reload();
    }} />;
  }

  if (needsOnboarding) {
    return <OnboardingWizard onComplete={() => setNeedsOnboarding(false)} />;
  }

  // If a module is specified, check for permission
  if (module && !hasPermission(module, action)) {
    // If it's the dashboard and they don't have access, maybe they have access to something else?
    // For now, let's redirect to profile as a safe landing spot for users with no dashboard access
    if (module === 'dashboard') {
      return <Navigate to="/profile" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <GlobalFilterProvider>
      <AppLayout>{children}</AppLayout>
    </GlobalFilterProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <PermissionsProvider>
            <BrowserRouter>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Core Routes */}
              <Route path="/dashboard" element={<ProtectedRoute module="dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/appointments" element={<ProtectedRoute module="appointments"><Appointments /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute module="customers"><Customers /></ProtectedRoute>} />
              <Route path="/companies" element={<ProtectedRoute module="companies"><Companies /></ProtectedRoute>} />
              <Route path="/stores" element={<ProtectedRoute module="stores"><Stores /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute module="users"><Users /></ProtectedRoute>} />
              
              {/* Financial Routes */}
              <Route path="/financial" element={<ProtectedRoute module="financial"><Financial /></ProtectedRoute>} />
              <Route path="/financial/statement" element={<ProtectedRoute module="financial"><Financial initialModule="statement" /></ProtectedRoute>} />
              <Route path="/financial/cashier" element={<ProtectedRoute module="financial"><Financial initialModule="cashier" /></ProtectedRoute>} />
              <Route path="/financial/payable" element={<ProtectedRoute module="financial"><Financial initialModule="payable" /></ProtectedRoute>} />
              <Route path="/financial/receivable" element={<ProtectedRoute module="financial"><Financial initialModule="receivable" /></ProtectedRoute>} />
              <Route path="/fiscal" element={<ProtectedRoute module="fiscal"><Fiscal /></ProtectedRoute>} />
              
              {/* Sales & Products */}
              <Route path="/sales" element={<ProtectedRoute module="sales"><Sales /></ProtectedRoute>} />
              <Route path="/service-orders" element={<ProtectedRoute module="service_orders"><ServiceOrders /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute module="products"><Products /></ProtectedRoute>} />
              
              {/* Reports */}
              <Route path="/reports" element={<ProtectedRoute module="reports"><Reports /></ProtectedRoute>} />
              <Route path="/reports/products-sold" element={<ProtectedRoute module="reports"><ProductsSold /></ProtectedRoute>} />
              <Route path="/reports/expired-prescriptions" element={<ProtectedRoute module="reports"><ExpiredPrescriptions /></ProtectedRoute>} />
              
              {/* Admin & Settings */}
              <Route path="/admin" element={<ProtectedRoute module="admin_center"><AdminCenter /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute module="settings"><Settings /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </PermissionsProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;