'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Sentry / Telemetry Dispatch
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    } else {
      console.error('[CRITICAL UI FAULT]', error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 p-6 text-slate-100"
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
                <span className="text-xl font-bold">!</span>
              </div>
              <div>
                <h1 className="text-base font-bold text-white">
                  {this.props.fallbackTitle || 'Component Rendering Interrupted'}
                </h1>
                <p className="text-xs text-slate-400">A client-side exception was intercepted.</p>
              </div>
            </div>

            {this.state.error && (
              <pre className="mt-4 max-h-32 overflow-auto rounded bg-slate-950 p-3 text-[11px] font-mono text-rose-300 border border-slate-800">
                {this.state.error.message}
              </pre>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors"
              >
                Reload Component
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
