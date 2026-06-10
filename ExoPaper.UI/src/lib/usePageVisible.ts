import { useEffect, useState } from "react";

/**
 * Tracks document visibility so 3D canvases can pause their render loop when the
 * tab is hidden (saves GPU/battery and prevents background frame churn).
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}
