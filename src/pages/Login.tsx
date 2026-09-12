import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  Shield,
  Sparkles,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BrandMark } from '@/components/shared/BrandMark';

/* -----------------------------------------------------------------------
 *  DESIGN TOKENS — pequenas partículas locais para deixar o código legível.
 * --------------------------------------------------------------------- */
const HERO_QUOTES = [
  "Visão que conecta pessoas",
  "Gestão que ilumina resultados",
  "Cada cliente, uma história",
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  /* monta a página com pequeno delay p/ animar entrada */
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  /* redireciona se já estiver logado */
  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  /* rotaciona o subtítulo do hero */
  useEffect(() => {
    const t = setInterval(
      () => setQuoteIdx((i) => (i + 1) % HERO_QUOTES.length),
      4500,
    );
    return () => clearInterval(t);
  }, []);

  /* validação leve pra dar feedback imediato */
  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    [email],
  );
  const passwordValid = password.length >= 6;
  const formValid = emailValid && passwordValid;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // O gerenciador de senhas pode preencher os campos sem disparar o onChange do React.
    // Ler o FormData no submit mantém o login funcional nesses casos.
    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get("email") || email).trim();
    const submittedPassword = String(formData.get("password") || password);
    const submittedEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail);
    const submittedPasswordValid = submittedPassword.length >= 6;

    if (!submittedEmailValid || !submittedPasswordValid) {
      toast.error("Preencha e-mail e senha corretamente.");
      return;
    }

    setEmail(submittedEmail);
    setPassword(submittedPassword);
    setLoading(true);
    try {
      const { error } = await login(submittedEmail, submittedPassword);
      if (error) {
        toast.error(
          error.message.includes("Invalid login credentials")
            ? "E-mail ou senha inválidos."
            : "Erro ao entrar: " + error.message,
        );
      } else {
        toast.success("Bem-vindo de volta!", {
          description: "Entrando no painel…",
        });
        navigate("/dashboard");
      }
    } catch {
      toast.error("Ocorreu um erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-svh w-full overflow-hidden bg-background text-foreground">
      {/* ============================================================
          BACKGROUND GLOBAL — gradiente sutil + grid
          ============================================================ */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.12), transparent 70%)",
        }}
      />

      {/* ============================================================
          LAYOUT PRINCIPAL — split responsivo
          ============================================================ */}
      <div className="relative grid min-h-svh w-full lg:grid-cols-[1.1fr_1fr]">
        {/* ============================================================
            COLUNA ESQUERDA — HERO VISUAL (some em telas < lg)
            ============================================================ */}
        <aside className="relative hidden overflow-hidden lg:block">
          {/* gradiente base */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, hsl(18 35% 6%) 0%, hsl(20 24% 11%) 50%, hsl(12 72% 22%) 100%)",
            }}
          />
          {/* blobs de cor flutuantes */}
          <div className="absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-primary/30 blur-3xl animate-blob" />
          <div
            className="absolute -bottom-40 -right-20 h-[520px] w-[520px] rounded-full blur-3xl animate-blob-2"
            style={{ background: "hsl(30 88% 45% / 0.35)" }}
          />
          <div
            className="absolute top-1/3 right-1/4 h-[360px] w-[360px] rounded-full blur-3xl animate-blob-3"
            style={{ background: "hsl(12 81% 52% / 0.25)" }}
          />
          {/* grid sutil */}
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
          {/* textura grain */}
          <div className="absolute inset-0 grain" />

          {/* partículas orbitando o logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-0 w-0">
              <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-white/60 blur-[1px] animate-orbit" />
              <span
                className="absolute -left-1.5 -top-1.5 h-2 w-2 rounded-full bg-white/80 animate-orbit-reverse"
                style={{ animationDelay: "-4s" }}
              />
              <span
                className="absolute -left-1 -top-1 h-1.5 w-1.5 rounded-full bg-orange-300 animate-orbit"
                style={{ animationDelay: "-8s" }}
              />
            </div>
          </div>

          {/* conteúdo do hero */}
          <div
            className={`relative z-10 flex h-full flex-col justify-between p-12 text-white transition-all duration-1000 ${
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            {/* topo: logo + tag */}
            <div className="flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-11 w-11 overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-1.5 shadow-lg shadow-primary/25 backdrop-blur animate-pulse-glow">
                    <BrandMark variant="icon" className="h-full w-full" alt="Símbolo do cacto" priority />
                  </div>
                </div>
                <div>
                  <p className="font-heading text-lg font-bold leading-none tracking-tight">
                    GESTÃO ÓTICAS H2K
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-white/40">
                    Sertão ótica & Nordestina
                  </p>
                </div>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white/70 backdrop-blur md:inline-flex">
                <Shield className="h-3 w-3" /> Sessão segura
              </span>
            </div>

            {/* centro: copy */}
            <div className="max-w-md space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur animate-fade-in">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Plataforma premium para óticas
              </div>

              <h1 className="font-heading text-5xl font-bold leading-[1.05] tracking-tight">
                A gestão da sua ótica,{" "}
                <span
                  className="text-gradient bg-clip-text text-transparent"
                  style={{ WebkitTextFillColor: "transparent" }}
                >
                  reimaginada.
                </span>
              </h1>

              <p className="text-lg leading-relaxed text-white/70">
                Clientes, vendas, ordens de serviço e financeiro em um só lugar —
                com a clareza que o seu negócio merece.
              </p>

              {/* quote rotativa */}
              <div className="relative h-7 overflow-hidden">
                {HERO_QUOTES.map((q, i) => (
                  <p
                    key={q}
                    className={`absolute inset-0 font-heading text-sm font-medium italic text-white/60 transition-all duration-700 ${
                      i === quoteIdx
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-2"
                    }`}
                  >
                    “{q}”
                  </p>
                ))}
              </div>

              {/* bullets */}
              <ul className="space-y-2.5 text-sm text-white/70">
                {[
                  "Multi-empresa e multi-loja",
                  "Conciliação bancária automática",
                  "Insights com IA no dashboard",
                ].map((b) => (
                  <li
                    key={b}
                    className="flex items-center gap-2.5 animate-fade-in"
                    style={{ animationDelay: `${200 + 100 * b.length}ms` }}
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* rodapé: copyright + status */}
            <div className="flex items-center justify-between text-xs text-white/40">
              <span>© 2026 GESTÃO ÓTICAS H2K</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Todos os sistemas operacionais
              </span>
            </div>
          </div>
        </aside>

        {/* ============================================================
            COLUNA DIREITA — FORMULÁRIO
            ============================================================ */}
        <main className="relative flex items-center justify-center px-5 py-10 sm:px-8 sm:py-14">
          <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-8">
            <ThemeToggle compact />
          </div>

          {/* glow decorativo atrás do card (mobile) */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-30 blur-3xl lg:hidden"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--primary) / 0.6), transparent 70%)",
            }}
          />

          <div
            className={`w-full max-w-[420px] transition-all duration-1000 ${
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            {/* logo mobile (some em lg+) */}
            <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden animate-fade-in">
              <div className="h-10 w-10 overflow-hidden rounded-2xl border border-primary/20 bg-card/95 p-1.5 shadow-lg shadow-primary/20">
                <BrandMark variant="icon" className="h-full w-full" alt="Símbolo do cacto" priority />
              </div>
              <div>
                <p className="font-heading text-base font-bold leading-none">
                  GESTÃO ÓTICAS H2K
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Sertão ótica & Nordestina
                </p>
              </div>
            </div>

            {/* card do form */}
            <div className="glass border-gradient rounded-3xl p-7 shadow-2xl shadow-primary/5 sm:p-9 animate-scale-in">
              <div className="mb-7 space-y-1.5">
                <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                  Entrar na conta
                </h2>
                <p className="text-sm text-muted-foreground">
                  Acesse o painel para continuar.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* EMAIL */}
                <div className="space-y-1.5 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
                  <label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    E-mail
                  </label>
                  <div className="focus-ring group relative flex items-center rounded-xl border border-input bg-background/60 transition-all focus-ring">
                    <Mail
                      className={`pointer-events-none absolute left-3.5 h-4 w-4 transition-colors ${
                        email
                          ? "text-primary"
                          : "text-muted-foreground/60 group-focus-within:text-primary"
                      }`}
                    />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="h-12 border-0 bg-transparent pl-10 pr-10 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {emailValid && (
                      <span className="pointer-events-none absolute right-3 grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 animate-scale-in">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </div>

                {/* SENHA */}
                <div className="space-y-1.5 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Senha
                    </label>
                    <Link
                      to="/forgot-password"
                      className="group inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      Esqueceu a senha?
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                  <div className="focus-ring group relative flex items-center rounded-xl border border-input bg-background/60 transition-all">
                    <Lock
                      className={`pointer-events-none absolute left-3.5 h-4 w-4 transition-colors ${
                        password
                          ? "text-primary"
                          : "text-muted-foreground/60 group-focus-within:text-primary"
                      }`}
                    />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="h-12 border-0 bg-transparent pl-10 pr-12 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      className="absolute right-2 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground/70 transition-all hover:bg-muted hover:text-foreground active:scale-95"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* SUBMIT */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`group relative mt-2 inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover-lift disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 animate-fade-in-up ${
                    formValid
                      ? "btn-shimmer shadow-primary/30 hover:shadow-primary/50"
                      : "bg-primary"
                  }`}
                  style={{ animationDelay: "280ms" }}
                >
                  {/* sheen */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  {loading ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-90"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                        />
                      </svg>
                      Entrando…
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>


            </div>

            {/* rodapé fora do card */}
            <p className="mt-5 text-center text-[11px] text-muted-foreground animate-fade-in" style={{ animationDelay: "500ms" }}>
              © 2026 GESTÃO ÓTICAS H2K · Todos os direitos reservados
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}