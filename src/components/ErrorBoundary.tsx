import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
          <div className="max-w-md w-full rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-zinc-100">
              Something went wrong
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
