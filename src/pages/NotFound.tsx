import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/BrandMark";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* BG */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
      <div className="pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-primary/30 blur-3xl animate-blob" />
      <div
        className="pointer-events-none absolute -bottom-40 -right-20 h-[520px] w-[520px] rounded-full blur-3xl animate-blob-2"
        style={{ background: "hsl(265 80% 55% / 0.35)" }}
      />
      <div
        className="pointer-events-none absolute top-1/3 right-1/4 h-[360px] w-[360px] rounded-full blur-3xl animate-blob-3"
        style={{ background: "hsl(330 85% 60% / 0.25)" }}
      />

      <div className="relative max-w-[520px] mx-auto px-6 text-center animate-scale-in">
        {/* Logo */}
        <div className="inline-flex items-center gap-2.5 mb-10 animate-fade-in">
          <div className="h-10 w-10 overflow-hidden rounded-2xl border border-primary/20 bg-card/95 p-1.5 shadow-lg shadow-primary/20 animate-pulse-glow">
            <BrandMark variant="icon" className="h-full w-full" alt="Símbolo do cacto" priority />
          </div>
          <span className="font-heading text-base font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
            GESTÃO ÓTICAS H2K
          </span>
        </div>

        {/* 404 gigante */}
        <div className="relative mb-6">
          <div className="absolute inset-0 blur-3xl opacity-50">
            <div className="text-[160px] sm:text-[220px] font-heading font-black leading-none text-gradient text-center" style={{ WebkitTextFillColor: "transparent" }}>
              404
            </div>
          </div>
          <h1 className="relative text-[160px] sm:text-[220px] font-heading font-black leading-none text-gradient tracking-tighter" style={{ WebkitTextFillColor: "transparent" }}>
            404
          </h1>
        </div>

        <div className="space-y-3 mb-8 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary backdrop-blur">
            <Compass className="h-3.5 w-3.5" /> Página perdida
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tight">
            Ops! Não encontramos essa rota.
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            A página <span className="font-mono font-bold text-foreground">{location.pathname}</span> não existe ou foi movida. Que tal voltar para um lugar familiar?
          </p>
        </div>

        <Link to="/dashboard" className="inline-block animate-fade-in-up" style={{ animationDelay: "350ms" }}>
          <Button
            size="lg"
            className="gap-2 btn-shimmer text-white border-0 shadow-lg shadow-primary/30 hover-lift rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Link>

        <p className="mt-8 text-[11px] text-muted-foreground animate-fade-in" style={{ animationDelay: "500ms" }}>
          © 2026 GESTÃO ÓTICAS H2K · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};

export default NotFound;