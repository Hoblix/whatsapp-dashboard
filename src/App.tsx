import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Index from "@/pages/index";
import ChatPage from "@/pages/chat";
import SettingsPage from "@/pages/settings";
import HistoryPage from "@/pages/history";
import LoginPage from "@/pages/login";
import DocsPage from "@/pages/docs";
import NotFound from "@/pages/not-found";
import TenantsPage from "@/pages/flows/Tenants";
import FlowsPage from "@/pages/flows/Flows";
import AnalyticsPage from "@/pages/flows/Analytics";
import CTWARulesPage from "@/pages/ctwa/CTWARules";
import CTWAEventsPage from "@/pages/ctwa/CTWAEvents";
import AutomationsListPage from "@/pages/automations/AutomationsList";
import AutomationBuilderPage from "@/pages/automations/AutomationBuilder";
import TemplateList from "@/pages/templates/TemplateList";
import CredentialsPage from "@/pages/credentials";
import TemplateCreate from "@/pages/templates/TemplateCreate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

function usePWAStandalone() {
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(display-mode: standalone)");
    setIsStandalone(mql.matches || (navigator as any).standalone === true);
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isStandalone;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => { if (!loading && !user) navigate("/login") }, [user, loading]);
  if (loading) return <Spinner />;
  if (!user) return null;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!loading && !user) navigate("/login");
    if (!loading && user && !isSuperAdmin) navigate("/");
  }, [user, isSuperAdmin, loading]);
  if (loading) return <Spinner />;
  if (!user || !isSuperAdmin) return null;
  return <>{children}</>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-8 w-8 text-[#128C7E]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/docs" component={DocsPage} />

      {/* ── WhatsApp Flows (super-admin only) ─────────────────────────────── */}
      {/* IMPORTANT: More-specific routes MUST come before less-specific ones  */}
      {/* because wouter matches the first route whose prefix matches the URL.  */}
      <Route path="/flows">
        <SuperAdminRoute><Redirect to="/flows/tenants" /></SuperAdminRoute>
      </Route>
      <Route path="/flows/tenants">
        <SuperAdminRoute><TenantsPage /></SuperAdminRoute>
      </Route>
      <Route path="/flows/tenants/:tenantId/flows/:flowId">
        {() => <SuperAdminRoute><FlowsPage /></SuperAdminRoute>}
      </Route>
      <Route path="/flows/tenants/:tenantId/flows">
        {() => <SuperAdminRoute><FlowsPage /></SuperAdminRoute>}
      </Route>
      <Route path="/flows/tenants/:tenantId/analytics">
        {() => <SuperAdminRoute><AnalyticsPage /></SuperAdminRoute>}
      </Route>
      {/* Tenant detail — auto-expands that tenant. Must come LAST among /flows/tenants/* */}
      <Route path="/flows/tenants/:tenantId">
        {() => <SuperAdminRoute><TenantsPage /></SuperAdminRoute>}
      </Route>

      {/* ── Automation Workflows (super-admin only) ──────────────────────── */}
      <Route path="/automations/:id">
        {() => <SuperAdminRoute><AutomationBuilderPage /></SuperAdminRoute>}
      </Route>
      <Route path="/automations">
        <SuperAdminRoute><AutomationsListPage /></SuperAdminRoute>
      </Route>

      {/* ── Templates (super-admin only) ────────────────────────────────── */}
      <Route path="/templates/create">
        <SuperAdminRoute><TemplateCreate /></SuperAdminRoute>
      </Route>
      <Route path="/templates">
        <SuperAdminRoute><TemplateList /></SuperAdminRoute>
      </Route>

      {/* ── CTWA Ad Automations (super-admin only) ────────────────────────── */}
      <Route path="/ctwa/events">
        <SuperAdminRoute><CTWAEventsPage /></SuperAdminRoute>
      </Route>
      <Route path="/ctwa">
        <SuperAdminRoute><CTWARulesPage /></SuperAdminRoute>
      </Route>

      {/* ── Main app ──────────────────────────────────────────────────────── */}
      <Route path="/">
        <ProtectedRoute><Index /></ProtectedRoute>
      </Route>
      <Route path="/chat/:id">
        {() => <ProtectedRoute><ChatPage /></ProtectedRoute>}
      </Route>
      <Route path="/settings/credentials">
        <ProtectedRoute><CredentialsPage /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/history">
        <ProtectedRoute><HistoryPage /></ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const isStandalone = usePWAStandalone();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div
          className="flex flex-col h-full"
          style={{
            paddingTop: isStandalone ? "env(safe-area-inset-top)" : undefined,
            paddingBottom: isStandalone ? "env(safe-area-inset-bottom)" : undefined,
            paddingLeft: isStandalone ? "env(safe-area-inset-left)" : undefined,
            paddingRight: isStandalone ? "env(safe-area-inset-right)" : undefined,
          }}
        >
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
