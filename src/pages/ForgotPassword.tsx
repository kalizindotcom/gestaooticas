import { useEffect, useMemo, useState } from "react";
import { Mail, ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Link } from "react-router-dom";
import { localApi } from "@/lib/localApi";
import { toast } from "sonner";
import { BrandMark } from '@/components/shared/BrandMark';

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCompleted, setResetCompleted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    [email],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/login`;
      const { data, error } = await localApi.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      setResetToken(data?.token || '');
      setSent(true);
      toast.success(data?.token ? "Token local gerado. Defina a nova senha abaixo." : "Se existir conta para esse e-mail, enviaremos o link.");
    } catch (err: any) {
      // Por segurança, não revelar se o e-mail existe ou não
      setSent(true);
      toast.info("Se existir conta para esse e-mail, enviaremos o link.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação da senha não confere.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await localApi.auth.confirmPasswordReset(resetToken, newPassword);
      if (error) throw error;
      setResetCompleted(true);
      toast.success('Senha redefinida com sucesso.');
    } catch (err: any) {
      toast.error(err?.message || 'Token inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-svh w-full overflow-hidden bg-background text-foreground">
      {/* BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.12), transparent 70%)",
        }}
      />

      <div className="relative grid min-h-svh w-full lg:grid-cols-[1.1fr_1fr]">
        {/* COLUNA ESQUERDA — mesmo hero */}
        <aside className="relative hidden overflow-hidden lg:block">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, hsl(222 47% 6%) 0%, hsl(222 47% 11%) 50%, hsl(215 60% 14%) 100%)",
            }}
          />
          <div className="absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-primary/30 blur-3xl animate-blob" />
          <div
            className="absolute -bottom-40 -right-20 h-[520px] w-[520px] rounded-full blur-3xl animate-blob-2"
            style={{ background: "hsl(265 80% 55% / 0.35)" }}
          />
          <div
            className="absolute top-1/3 right-1/4 h-[360px] w-[360px] rounded-full blur-3xl animate-blob-3"
            style={{ background: "hsl(330 85% 60% / 0.25)" }}
          />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
          <div className="absolute inset-0 grain" />

          <div
            className={`relative z-10 flex h-full flex-col justify-between p-12 text-white transition-all duration-1000 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-center justify-between animate-fade-in">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 backdrop-blur transition-all hover:bg-white/10"
              >
                <ArrowLeft className="h-3 w-3" /> Voltar
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white/70 backdrop-blur">
                <ShieldCheck className="h-3 w-3" /> Recuperação segura
              </span>
            </div>

            <div className="max-w-md space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur animate-fade-in">
                <Mail className="h-3.5 w-3.5 text-cyan-300" />
                Vamos colocar tudo no lugar
              </div>

              <h1 className="font-heading text-5xl font-bold leading-[1.05] tracking-tight">
                Esqueceu a senha?
                <br />
                <span className="text-gradient" style={{ WebkitTextFillColor: "transparent" }}>
                  Sem stress.
                </span>
              </h1>

              <p className="text-lg leading-relaxed text-white/70">
                Informe o e-mail cadastrado e enviaremos um link mágico para você
                definir uma nova senha em poucos segundos.
              </p>

              <ul className="space-y-2.5 text-sm text-white/70">
                {[
                  "Link válido por 1 hora",
                  "Sem armazenamento da senha antiga",
                  "Notificação por e-mail",
                ].map((b) => (
                  <li
                    key={b}
                    className="flex items-center gap-2.5 animate-fade-in"
                    style={{ animationDelay: `${200 + 60 * b.length}ms` }}
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-white/40">
              © 2026 GESTÃO ÓTICAS H2K · Todos os direitos reservados
            </p>
          </div>
        </aside>

        {/* COLUNA DIREITA — FORMULÁRIO */}
        <main className="relative flex items-center justify-center px-5 py-10 sm:px-8 sm:py-14">
          <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-8">
            <ThemeToggle compact />
          </div>

          <div
            className={`w-full max-w-[420px] transition-all duration-1000 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {/* logo mobile */}
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

            <div className="glass border-gradient rounded-3xl p-7 shadow-2xl shadow-primary/5 sm:p-9 animate-scale-in">
              {!sent ? (
                <>
                  <div className="mb-7 space-y-1.5">
                    <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                      Recuperar acesso
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Vamos enviar um link para você voltar a entrar.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
                      <label
                        htmlFor="email"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        E-mail
                      </label>
                      <div className="focus-ring group relative flex items-center rounded-xl border border-input bg-background/60 transition-all">
                        <Mail
                          className={`pointer-events-none absolute left-3.5 h-4 w-4 transition-colors ${
                            email
                              ? "text-primary"
                              : "text-muted-foreground/60 group-focus-within:text-primary"
                          }`}
                        />
                        <Input
                          id="email"
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

                    <button
                      type="submit"
                      disabled={loading || !emailValid}
                      className={`group relative mt-2 inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover-lift disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 animate-fade-in-up ${
                        emailValid
                          ? "btn-shimmer shadow-primary/30 hover:shadow-primary/50"
                          : "bg-primary"
                      }`}
                      style={{ animationDelay: "200ms" }}
                    >
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
                          Enviando…
                        </>
                      ) : (
                        <>
                          Enviar link de recuperação
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="py-2 text-center animate-scale-in">
                  <div className="relative mx-auto mb-5 h-16 w-16">
                    <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/30" />
                    <span className="absolute inset-0 grid place-items-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
                      <Check className="h-8 w-8 text-emerald-600" strokeWidth={3} />
                    </span>
                  </div>
                  {resetCompleted ? (
                    <>
                      <h2 className="font-heading text-2xl font-bold tracking-tight">Senha redefinida</h2>
                      <p className="mt-2 text-sm text-muted-foreground">Sua senha foi atualizada. Você já pode voltar ao login.</p>
                    </>
                  ) : resetToken ? (
                    <form onSubmit={handleConfirmReset} className="space-y-4 text-left">
                      <div>
                        <h2 className="font-heading text-2xl font-bold tracking-tight">Defina sua nova senha</h2>
                        <p className="mt-2 text-sm text-muted-foreground">O ambiente local gerou um token de uso único válido por 1 hora.</p>
                      </div>
                      <div className="space-y-1.5"><label htmlFor="reset-token" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Token local</label><Input id="reset-token" value={resetToken} readOnly className="h-11 font-mono text-xs" /></div>
                      <div className="space-y-1.5"><label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nova senha</label><Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" className="h-11" /></div>
                      <div className="space-y-1.5"><label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar senha</label><Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className="h-11" /></div>
                      <button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-lg disabled:opacity-60">{loading ? 'Salvando…' : 'Definir nova senha'}</button>
                    </form>
                  ) : (
                    <>
                      <h2 className="font-heading text-2xl font-bold tracking-tight">Verifique seu e-mail</h2>
                      <p className="mt-2 text-sm text-muted-foreground">Se houver uma conta para <span className="font-semibold text-foreground">{email}</span>, o sistema disponibilizará a recuperação local.</p>
                      <p className="mt-4 text-xs text-muted-foreground">Se não houver token exibido, confirme o endereço informado ou procure o administrador do ambiente local.</p>
                    </>
                  )}
                </div>
              )}

              <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground/60">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>

              <Link
                to="/login"
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-input bg-background/40 text-sm font-semibold transition-all hover-lift hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Voltar ao login
              </Link>
            </div>

            <p className="mt-6 text-center text-[11px] text-muted-foreground animate-fade-in" style={{ animationDelay: "500ms" }}>
              Precisa de ajuda?{" "}
              <a
                href="mailto:suporte@oticanordestina.com.br"
                className="text-primary transition-colors hover:text-primary/80"
              >
                Fale com o suporte
              </a>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}