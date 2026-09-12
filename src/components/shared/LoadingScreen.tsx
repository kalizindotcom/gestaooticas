import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/shared/BrandMark';
import { useAuth } from '@/contexts/AuthContext';

interface LoadingScreenProps {
  message?: string;
  onTimeout?: () => void;
  /** Timeout em ms. Default: 12000 (12s). */
  timeoutMs?: number;
}

/**
 * Tela de loading com fallback de segurança.
 * Se demorar mais que `timeoutMs`, mostra um botão pra o usuário:
 *  - Tentar novamente (recarrega a página)
 *  - Ir para o login (se não autenticado)
 *
 * Evita o "loop infinito" de spinner quando algo trava no auth/permissões.
 */
export function LoadingScreen({
  message = 'Carregando...',
  onTimeout,
  timeoutMs = 12000,
}: LoadingScreenProps) {
  const { user } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs, onTimeout]);

  if (timedOut) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-5 animate-scale-in">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-2xl" />
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center shadow-xl">
                <AlertCircle className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-heading font-black tracking-tight">Está demorando mais que o normal</h2>
            <p className="text-sm text-muted-foreground">
              Verifique sua conexão com a internet. Se o problema persistir, tente novamente ou vá para o login.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              onClick={() => window.location.reload()}
              className="gap-2 rounded-xl border-border/60"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
            <Button
              onClick={() => (window.location.href = '/login')}
              className="gap-2 btn-shimmer text-white border-0 shadow-lg shadow-primary/30 rounded-xl"
            >
              <LogIn className="h-4 w-4" /> Ir para o login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-svh flex flex-col items-center justify-center gap-5 p-4 bg-background">
      {/* glow decorations */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative">
        <div className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-br from-primary/30 to-emerald-500/25 blur-2xl animate-pulse" />
        <div className="relative h-20 w-20 rounded-3xl border border-primary/20 bg-card/95 p-2 grid place-items-center shadow-2xl shadow-primary/20 animate-pulse-glow">
          <BrandMark variant="mark" className="h-full w-full" priority />
          <Loader2 className="absolute inset-0 m-auto h-10 w-10 animate-spin text-primary/35" />
        </div>
      </div>

      <div className="relative text-center space-y-1">
        <p className="relative text-sm font-bold tracking-wide">
          <span className="inline-block animate-pulse">{message}</span>
        </p>
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">
          GESTÃO ÓTICAS H2K • Sertão ótica & Nordestina
        </p>
      </div>
    </div>
  );
}