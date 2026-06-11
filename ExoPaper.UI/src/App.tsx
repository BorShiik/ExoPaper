import { Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { useSignalR } from "./hooks/useSignalR";
import { LanguageProvider } from "./i18n/LanguageContext";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const PlanetsPage = lazy(() => import("./pages/PlanetsPage"));
const PlanetDetailPage = lazy(() => import("./pages/PlanetDetailPage"));
const PapersPage = lazy(() => import("./pages/PapersPage"));

// A subtle glowing orb as the fallback loader
function PageLoader() {
  return (
    <div className="flex h-[80vh] w-full items-center justify-center">
      <div className="h-8 w-8 animate-pulse rounded-full bg-[#88C0D0]/30 shadow-[0_0_15px_#88C0D0]" />
    </div>
  );
}
function App() {
  // Initialize global SignalR connection for the app lifetime
  useSignalR();

  return (
    <LanguageProvider>
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="planets" element={<PlanetsPage />} />
              <Route path="planet/:id" element={<PlanetDetailPage />} />
              <Route path="papers" element={<PapersPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </LanguageProvider>
  );
}

export default App;
