import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCofheClient } from "@/hooks/useCofhe";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import TradePage from "./pages/TradePage";
import PositionsPage from "./pages/PositionsPage";
import HistoryPage from "./pages/HistoryPage";
import EarnPage from "./pages/EarnPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import DevFaucetPage from "./pages/DevFaucetPage";
import NotFound from "./pages/NotFound.tsx";
import LandingPage from "./pages/LandingPage";

const queryClient = new QueryClient();

// Inner component so useCofheClient can access the wagmi context from main.tsx.
function AppInner() {
  useCofheClient();
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary title="App crashed">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route element={<AppLayout />}>
              <Route path="/trade" element={<TradePage />} />
              <Route path="/positions" element={<PositionsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/earn" element={<EarnPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/dev/faucet" element={<DevFaucetPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppInner />
  </QueryClientProvider>
);

export default App;
