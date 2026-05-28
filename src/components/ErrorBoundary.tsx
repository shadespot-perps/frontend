import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  title?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Keep a console signal for debugging.
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-[720px] w-full rounded-lg border border-border bg-background p-5 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {this.props.title ?? 'Something crashed while rendering.'}
          </h2>
          <p className="text-xs text-muted-foreground font-mono break-words">
            {this.state.error.message || String(this.state.error)}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs underline underline-offset-2 text-foreground"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

