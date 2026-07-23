import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, background: "#fff2f2", color: "#900", fontFamily: "sans-serif", borderRadius: 12, margin: 20 }}>
          <h2 style={{ margin: "0 0 10px" }}>⚠️ UI Render Error</h2>
          <pre style={{ background: "#fff", padding: 15, borderRadius: 6, overflow: "auto", fontSize: 13, border: "1px solid #fcc" }}>
            {this.state.error && this.state.error.toString()}
            {"\n\nComponent Stack:\n"}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              style={{ padding: "10px 18px", background: "#900", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 18px", background: "#fff", color: "#900", border: "1px solid #900", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
