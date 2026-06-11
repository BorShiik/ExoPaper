import { Suspense, lazy } from "react";
import { Outlet, useLocation } from "react-router-dom";
import FloatingNav from "./FloatingNav";

const CosmicHero = lazy(() => {
  return new Promise<typeof import("../three/CosmicHero")>((resolve) => {
    // Delay the download and parsing of the huge three.js bundle by 300ms.
    // This gives the browser enough time to paint the 2D UI (FCP) first.
    setTimeout(() => resolve(import("../three/CosmicHero")), 300);
  });
});

export default function Layout() {
  const location = useLocation();
  const showGlobalCanvas = !location.pathname.startsWith("/planet/");
  // Catalog / papers are content-heavy: dim the live cosmos behind them so the
  // 3D backdrop still breathes through, but text stays crisp and readable.
  const isContentRoute =
    location.pathname.startsWith("/planets") || location.pathname.startsWith("/papers");

  return (
    <div className="relative min-h-screen bg-[#05070f] overflow-hidden">
      {/* Layer 0: Full-screen 3D Canvas */}
      {showGlobalCanvas && (
        <div 
          className="fixed inset-0 z-0"
          onWheel={(e) => {
            const scrollEl = document.getElementById("main-scroll-container");
            if (scrollEl) scrollEl.scrollTop += e.deltaY;
          }}
        >
          <Suspense fallback={null}>
            <CosmicHero />
          </Suspense>
        </div>
      )}

      {/* Readability scrim for content-heavy routes */}
      {isContentRoute && (
        <div
          className="fixed inset-0 z-[1] pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 90% at 80% -10%, rgba(5,7,15,0) 0%, rgba(5,7,15,0.55) 45%, rgba(5,7,15,0.86) 100%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Layer 1 & 2: UI Wrapper with pointer-events-none */}
      <div id="main-scroll-container" className="fixed inset-0 z-10 pointer-events-none overflow-y-auto custom-scrollbar">
        <FloatingNav />
        <main className="min-h-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
