import { Crown, Building2, Store, Users, Shield, Activity, Settings as SettingsIcon, Zap, Eye, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { useProfiles } from '@/hooks/useLocalData';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

const auditLogs: Array<{ id: string; user: string; action: string; time: string; type: string }> = [];

const typeStyles: Record<string, { bg: string; icon: any; color: string }> = {
  create: { bg: 'bg-emerald-500/15', color: 'text-emerald-600', icon: Building2 },
  update: { bg: 'bg-blue-500/15', color: 'text-blue-600', icon: Eye },
  security: { bg: 'bg-amber-500/15', color: 'text-amber-600', icon: Shield },
};

const modules = [
  { name: 'Dashboard' },
  { name: 'Agendamentos' },
  { name: 'Clientes' },
  { name: 'Vendas' },
  { name: 'Financeiro' },
  { name: 'Produtos' },
  { name: 'Relatórios' },
  { name: 'Empresas' },
  { name: 'Lojas' },
  { name: 'Usuários' },
  { name: 'Permissões' },
  { name: 'Central Admin' },
];

export default function AdminCenter() {
  const navigate = useNavigate();
  const { companies, stores } = useGlobalFilter();
  const { data: profiles = [] } = useProfiles();
  const activeStores = (stores || []).filter(s => s.status === 'active').length;
  const activeUsers = profiles.filter((profile: any) => profile.status === 'active').length;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* PageHeader com badge Admin Master */}
      <div className="animate-fade-in-up flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 blur-md opacity-50" />
              <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center shadow-lg shadow-amber-500/30">
                <Crown className="h-4 w-4 text-white" strokeWidth={2.2} />
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Central Administrativa</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider backdrop-blur-sm">
              <ShieldCheck className="h-3 w-3" /> Admin Master
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-black tracking-tight">Painel Master</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
            Visão geral e controle master do sistema. Gerencie empresas, lojas, usuários e módulos.
          </p>
        </div>
      </div>

      <FinancialInfoTip className="px-3 py-2.5" title="Dica da administração">Use esta central para conferir a estrutura global, acessos e módulos ativos. Aplique alterações administrativas com atenção ao escopo da empresa e da loja.</FinancialInfoTip>

      {/* Quick Stats com gradient por cor */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <KPICard title="Empresas" value={companies.length} icon={Building2} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <KPICard title="Lojas Ativas" value={activeStores} icon={Store} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '220ms' }}>
          <KPICard title="Usuários Ativos" value={activeUsers} icon={Users} change={12} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '280ms' }}>
          <KPICard title="Módulos" value={modules.length} icon={Zap} />
        </div>
      </div>

      {/* Quick Actions com glass + hover-lift */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Nova Empresa', icon: Building2, desc: 'Cadastrar empresa', path: '/companies', gradient: 'from-blue-500 to-indigo-600' },
          { label: 'Nova Loja', icon: Store, desc: 'Adicionar unidade', path: '/stores', gradient: 'from-emerald-500 to-teal-600' },
          { label: 'Novo Usuário', icon: Users, desc: 'Criar acesso', path: '/users', gradient: 'from-violet-500 to-purple-600' },
          { label: 'Permissões', icon: Shield, desc: 'Gerenciar acessos', path: '/users', gradient: 'from-amber-500 to-orange-600' },
        ].map((action, i) => (
          <Card
            key={action.label}
            className="border-border/60 hover-lift cursor-pointer group relative overflow-hidden animate-fade-in-up"
            style={{ animationDelay: `${350 + i * 60}ms` }}
            onClick={() => navigate(action.path)}
          >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${action.gradient}`} style={{ mixBlendMode: 'soft-light' }} />
            <CardContent className="flex min-h-[72px] items-center gap-3 p-4 relative">
              <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 shadow-md bg-gradient-to-br ${action.gradient} group-hover:scale-110 transition-transform`}>
                <action.icon className="h-4 w-4 text-white" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">{action.label}</p>
                <p className="text-[10px] text-muted-foreground">{action.desc}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Audit Log */}
        <div className="animate-fade-in-up" style={{ animationDelay: '600ms' }}>
          <Card className="border-border/60 hover-lift h-full relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-heading flex items-center gap-2.5 tracking-tight">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-purple-600 grid place-items-center shadow-md shadow-primary/20">
                    <Activity className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
                  </div>
                  Log de Auditoria
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[11px] h-7 gap-1 text-primary hover:text-primary font-bold uppercase tracking-wider">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {auditLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma atividade de auditoria persistida ainda.</div>
                ) : auditLogs.map((log, i) => {
                  const style = typeStyles[log.type] || typeStyles.update;
                  const Icon = style.icon;
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-4 hover:bg-primary/5 transition-colors animate-fade-in-up"
                      style={{ animationDelay: `${650 + i * 50}ms` }}
                    >
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", style.bg)}>
                        <Icon className={cn("h-3.5 w-3.5", style.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs">
                          <span className="font-bold">{log.user}</span>{' '}
                          <span className="text-muted-foreground">{log.action}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{log.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modules */}
        <div className="animate-fade-in-up" style={{ animationDelay: '650ms' }}>
          <Card className="border-border/60 hover-lift h-full relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-heading flex items-center gap-2.5 tracking-tight">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 grid place-items-center shadow-md shadow-violet-500/20">
                    <SettingsIcon className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
                  </div>
                  Módulos do Sistema
                </CardTitle>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles className="h-3 w-3 mr-1" /> {modules.length} ativos
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {modules.map((mod, i) => (
                  <div
                    key={mod.name}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${700 + i * 30}ms` }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs font-bold truncate">{mod.name}</span>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Ativo</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
