import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered when the WebGL scene throws (e.g. context loss). */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches WebGL / Three.js render errors so a lost context never blanks
 * the whole page. Renders a graceful fallback instead.
 */
export default class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CanvasErrorBoundary] 3D scene failed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-space-900 to-space-950">
            <div className="h-40 w-40 rounded-full bg-gradient-to-br from-accent-blue/30 to-accent-purple/20 blur-2xl animate-pulse-glow" />
          </div>
        )
      );
    }
    return this.props.children;
  }
}
