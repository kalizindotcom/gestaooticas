import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { error: Error | null };

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro não tratado na interface local:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-svh flex items-center justify-center bg-background p-6 text-foreground">
          <section className="w-full max-w-xl rounded-2xl border border-destructive/20 bg-card p-8 shadow-xl">
            <h1 className="text-2xl font-bold">Não foi possível carregar o sistema</h1>
            <p className="mt-2 text-sm text-muted-foreground">A sessão foi preservada, mas a interface encontrou um erro inesperado. Recarregue a página para tentar novamente.</p>
            <pre className="mt-5 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs text-destructive whitespace-pre-wrap">{this.state.error.message}</pre>
            <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Recarregar sistema</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
