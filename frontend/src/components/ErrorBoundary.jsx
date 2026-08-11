import { Component } from "react";
import { Link } from "react-router-dom";

/**
 * Prevents a single page crash from blanking the whole dark-themed shell
 * (looks like a black screen with no message).
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary]", error, info?.componentStack);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message =
      this.state.error?.message ||
      "Something went wrong while opening this page.";

    return (
      <div className="card" style={{ marginTop: 12, borderColor: "rgba(248,113,113,0.55)" }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Page failed to load</div>
        <p className="muted" style={{ marginTop: 8 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" className="btn primary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <Link className="btn" to="/dashboard">
            Dashboard
          </Link>
          <Link className="btn" to="/projects">
            Projects
          </Link>
        </div>
      </div>
    );
  }
}
