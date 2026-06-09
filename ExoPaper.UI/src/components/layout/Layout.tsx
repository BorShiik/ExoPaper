import { Outlet, useLocation } from "react-router-dom";
import FloatingNav from "./FloatingNav";
import CosmicHero from "../three/CosmicHero";

export default function Layout() {
  const location = useLocation();
  const showGlobalCanvas = !location.pathname.startsWith("/planet/");

  return (
    <div className="relative min-h-screen bg-[#05070f] overflow-hidden">
      {/* Layer 0: Full-screen 3D Canvas */}
      {showGlobalCanvas && (
        <div className="fixed inset-0 z-0">
          <CosmicHero />
        </div>
      )}

      {/* Layer 1 & 2: UI Wrapper with pointer-events-none */}
      <div className="fixed inset-0 z-10 pointer-events-none overflow-y-auto custom-scrollbar">
        <FloatingNav />
        <main className="min-h-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
