import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Calendar, Users, ShoppingCart, DollarSign, TrendingUp, UserPlus,
  Target, Clock, BarChart3, ArrowRight
} from "lucide-react";
import { KPICard } from "@/components/shared/KPICard";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { useAppointments, useSales, useCustomers } from "@/hooks/useLocalData";
import { format, isSameDay, parseISO } from "date-fns";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";
import { FinancialInfoTip } from "@/components/financial/FinancialInfoTip";

const appointmentStatusMap: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendado', color: 'bg-blue-500' },
  confirmed: { label: 'Confirmado', color: 'bg-emerald-500' },
  waiting: { label: 'Aguardando', color: 'bg-amber-500' },
  in_progress: { label: 'Em Atendimento', color: 'bg-purple-500' },
  completed: { label: 'Concluído', color: 'bg-emerald-600' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500' },
  no_show: { label: 'Faltou', color: 'bg-gray-500' },
  rescheduled: { label: 'Reagendado', color: 'bg-orange-500' },
};

export default function Dashboard() {
  const { data: appointments = [], isLoading: appointmentsLoading } = useAppointments();
  const { data: sales = [], isLoading: salesLoading } = useSales();
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const stats = useMemo(() => {
    const totalSales = sales.length;
    const revenue = sales.reduce((acc, sale) => acc + (sale.total || 0), 0);
    const avgTicket = totalSales > 0 ? revenue / totalSales : 0;
    const newCustomers = customers.length;
    const totalAppointments = appointments.length;
    const conversion = totalAppointments > 0 ? (totalSales / totalAppointments) * 100 : 0;

    return { totalSales, revenue, avgTicket, newCustomers, totalAppointments, conversion };
  }, [sales, customers, appointments]);

  const todayAppointments = useMemo(() => {
    const today = new Date();
    return appointments
      .filter(a => a.date && isSameDay(parseISO(a.date), today))
      .slice(0, 5);
  }, [appointments]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(a => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });

    return [
      { name: 'Confirmados', value: counts['confirmed'] || 0, color: 'hsl(142 71% 45%)' },
      { name: 'Agendados', value: counts['scheduled'] || 0, color: 'hsl(var(--primary))' },
      { name: 'Cancelados', value: counts['cancelled'] || 0, color: 'hsl(0 72% 51%)' },
      { name: 'Aguardando', value: counts['waiting'] || 0, color: 'hsl(38 92% 50%)' },
    ];
  }, [appointments]);

  const totalPie = pieData.reduce((a, d) => a + d.value, 0);

  const chartData = useMemo(() => {
    const months: Record<string, number> = {};
    sales.forEach(sale => {
      if (!sale.date) return;
      try {
        const month = format(parseISO(sale.date), 'MMM');
        months[month] = (months[month] || 0) + (sale.total || 0);
      } catch (e) {
        console.error('Error formatting sale date:', sale.date, e);
      }
    });

    const labels = Object.keys(months).length > 0 ? Object.keys(months) : ['Jan', 'Fev', 'Mar', 'Abr'];
    return labels.map(m => ({
      month: m,
      revenue: months[m] || 0,
      target: (months[m] || 1000) * 1.2
    }));
  }, [sales]);

  const isLoading = appointmentsLoading || salesLoading || customersLoading;

  if (isLoading) {
    return <LoadingSpinner message="Carregando dashboard..." />;
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="animate-fade-in-up">
        <PageHeader
          title="Dashboard"
          description="Visão geral do desempenho das suas óticas"
          badge={
            <Badge variant="secondary" className="text-[10px] font-bold gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Tempo real
            </Badge>
          }
        />
      </div>

      <FinancialInfoTip className="px-3 py-2.5" title="Dica do painel">Acompanhe vendas, faturamento e agendamentos em conjunto para identificar rapidamente mudanças no desempenho das óticas.</FinancialInfoTip>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {([
          { title: 'Agendamentos', value: stats.totalAppointments, change: 12, icon: Calendar },
          { title: 'Novos Clientes', value: stats.newCustomers, change: 8, icon: UserPlus },
          { title: 'Vendas', value: stats.totalSales, change: 5, icon: ShoppingCart },
          { title: 'Faturamento', value: stats.revenue, change: 15, icon: DollarSign, format: 'currency' as const },
          { title: 'Ticket Médio', value: stats.avgTicket, change: -3, icon: TrendingUp, format: 'currency' as const },
          { title: 'Conversão', value: stats.conversion, change: 2, icon: Target, format: 'percent' as const },
        ]).map((kpi, i) => (
          <div
            key={kpi.title}
            className="animate-fade-in-up"
            style={{ animationDelay: `${150 + i * 60}ms` }}
          >
            <KPICard {...kpi} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          <Card className="premium-shadow border-border/60 hover-lift overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-bold font-heading">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 grid place-items-center shadow-md shadow-primary/20">
                    <BarChart3 className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="truncate">Faturamento vs Meta</span>
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] font-bold">Mensal</Badge>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 pt-2">
              <ResponsiveContainer width="100%" height={260} minWidth={0}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`}
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px', boxShadow: '0 10px 30px -10px hsl(var(--primary) / 0.3)' }}
                  />
                  <Area type="monotone" dataKey="revenue" name="Faturamento" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revGrad)" />
                  <Area type="monotone" dataKey="target" name="Meta" stroke="hsl(265 70% 60%)" strokeWidth={1.5} strokeDasharray="6 4" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Appointments Pie */}
        <div className="animate-fade-in-up" style={{ animationDelay: '450ms' }}>
          <Card className="premium-shadow border-border/60 hover-lift h-full">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-bold font-heading flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 grid place-items-center shadow-md shadow-violet-500/30">
                  <Calendar className="h-3.5 w-3.5 text-white" />
                </div>
                Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col items-center pt-2">
              <div className="relative w-full max-w-[200px]">
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-heading font-black tabular-nums">{totalPie}</span>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 mt-5 w-full">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs group cursor-pointer hover:bg-muted/40 -mx-1 px-1.5 py-1 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm shrink-0 shadow-sm" style={{ backgroundColor: d.color }} />
                      <span className="text-muted-foreground font-medium">{d.name}</span>
                    </div>
                    <span className="font-bold tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Store Ranking */}
        <div className="animate-fade-in-up" style={{ animationDelay: '550ms' }}>
          <Card className="premium-shadow border-border/60 hover-lift h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-heading flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center shadow-md shadow-emerald-500/30">
                    <TrendingUp className="h-3.5 w-3.5 text-white" />
                  </div>
                  Ranking por Loja
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[11px] font-bold text-primary hover:text-primary">
                  <Link to="/reports">Ver todos <ArrowRight className="h-3 w-3" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground text-center py-10 italic">
                  Agregando dados de lojas...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Next Appointments */}
        <div className="animate-fade-in-up" style={{ animationDelay: '650ms' }}>
          <Card className="premium-shadow border-border/60 hover-lift h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-heading flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 grid place-items-center shadow-md shadow-rose-500/30">
                    <Clock className="h-3.5 w-3.5 text-white" />
                  </div>
                  Próximos Agendamentos
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] font-bold">Hoje</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todayAppointments.map((apt, i) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 hover-lift transition-all cursor-pointer group animate-fade-in-up"
                    style={{ animationDelay: `${700 + i * 50}ms` }}
                  >
                    <div className="text-center min-w-[44px] p-1 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <p className="text-sm font-heading font-bold text-primary tabular-nums">{apt.time}</p>
                    </div>
                    <div className="h-8 w-px bg-border rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate group-hover:text-primary transition-colors">
                        {apt.customer_name || apt.customerName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {apt.type} · {apt.professional_name || apt.professional}
                      </p>
                    </div>
                    <StatusBadge status={apt.status} statusMap={appointmentStatusMap} />
                  </div>
                ))}
                {todayAppointments.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-xs italic">
                    Nenhum agendamento para hoje
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
