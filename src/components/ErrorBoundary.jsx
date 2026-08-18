import React from "react";
import { AlertTriangle } from "lucide-react";

// Keeps one failing panel from blanking the entire page. Shows which panel failed
// and why, so the rest of the dashboard stays usable.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.label || "Panel"}] render error:`, error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4 flex items-start gap-3">
        <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {this.props.label || "This panel"} could not be displayed
          </p>
          <p className="text-xs text-red-600 mt-1 break-words">{String(this.state.error?.message || this.state.error)}</p>
        </div>
      </div>
    );
  }
}