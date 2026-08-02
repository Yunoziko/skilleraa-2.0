import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { btnPrimarySm, btnGhostMd } from "@/lib/uiClasses";

/**
 * Catches uncaught render errors so the app does not white-screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === "function") {
      this.props.onError(error, info);
    }
  }

  handleReload = () => {
    window.location.assign("/");
  };

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="min-h-screen grid place-items-center bg-white px-6"
          role="alert"
          data-testid="error-boundary"
        >
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-xl border skl-border grid place-items-center">
              <AlertTriangle size={20} className="text-neutral-600" aria-hidden />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="text-sm text-neutral-600">
              An unexpected error occurred. You can try again or return to the home page.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button type="button" onClick={this.handleRetry} className={btnPrimarySm}>
                Try again
              </button>
              <button type="button" onClick={this.handleReload} className={btnGhostMd}>
                Go home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
