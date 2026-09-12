import { Loader2 } from "lucide-react";
import { BrandMark } from '@/components/shared/BrandMark';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
};

export function LoadingSpinner({ message = "Carregando...", size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[400px] gap-5">
      {/* glow decorations */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative">
        <div className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-primary/30 to-emerald-500/25 blur-2xl animate-pulse" />
        <div className="relative h-20 w-20 rounded-3xl border border-primary/20 bg-card/95 p-2 grid place-items-center shadow-2xl shadow-primary/20 animate-pulse-glow">
          <BrandMark variant="mark" className="h-full w-full" />
          <Loader2 className={`absolute inset-0 m-auto ${sizeClasses.lg} animate-spin text-primary/35`} />
        </div>
      </div>
      <p className="relative text-sm font-bold text-foreground tracking-wide">
        <span className="inline-block animate-pulse">{message}</span>
      </p>
    </div>
  );
}