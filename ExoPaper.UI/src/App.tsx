import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import DashboardPage from "./pages/DashboardPage";
import PlanetsPage from "./pages/PlanetsPage";
import PlanetDetailPage from "./pages/PlanetDetailPage";
import PapersPage from "./pages/PapersPage";
import { useSignalR } from "./hooks/useSignalR";
import { LanguageProvider } from "./i18n/LanguageContext";

function App() {
  // Initialize global SignalR connection for the app lifetime
  useSignalR();

  return (
    <LanguageProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="planets" element={<PlanetsPage />} />
            <Route path="planet/:id" element={<PlanetDetailPage />} />
            <Route path="papers" element={<PapersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </LanguageProvider>
  );
}

export default App;
