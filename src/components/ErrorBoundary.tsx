import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-bold text-red-600">
              页面加载失败
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              请尝试刷新页面。如果问题持续存在，请联系管理员。
            </p>
            {this.state.error && (
              <pre className="max-h-40 overflow-auto rounded bg-gray-100 p-3 text-xs text-red-500">
                {this.state.error}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
