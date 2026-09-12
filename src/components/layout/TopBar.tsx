import { Search, ChevronDown, LogOut, Building2, Store, CalendarDays, CheckCircle2, Sparkles, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { NotificationCenter } from '@/components/layout/NotificationCenter';

const periods = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Este ano' },
];

export function TopBar() {
  const {
    selectedCompanyId, setSelectedCompanyId,
    selectedStoreIds, setSelectedStoreIds,
    period, setPeriod,
    companies: displayCompanies,
    stores: displayStores
  } = useGlobalFilter();
  const { user, logout } = useAuth();

  const currentCompany = displayCompanies.find(c => c.id === selectedCompanyId) as any;
  const companyStores = displayStores.filter(s => ((s as any).company_id || (s as any).companyId) === selectedCompanyId);

  const toggleStore = (storeId: string) => {
    setSelectedStoreIds(
      selectedStoreIds.includes(storeId)
        ? selectedStoreIds.filter(id => id !== storeId)
        : [...selectedStoreIds, storeId]
    );
  };

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 animate-fade-in sm:h-16">
      <div className="flex h-full min-w-0 items-center gap-1 px-2 sm:gap-1.5 sm:px-4 lg:px-6">
        <SidebarTrigger aria-label="Abrir menu" className="-ml-1 h-9 w-9 shrink-0 text-muted-foreground transition-all hover:bg-muted hover:text-foreground" />

        <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

        {/* Company Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Empresa: ${currentCompany?.tradeName || 'Todas as empresas'}`}
              title={currentCompany?.tradeName || 'Todas as empresas'}
              className="h-11 min-w-11 gap-2 border border-border/40 bg-background/40 px-2 text-xs font-semibold transition-all hover:bg-accent hover-lift sm:h-9 sm:px-3"
            >
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline max-w-[140px] truncate">
                {currentCompany?.tradeName || 'Todas empresas'}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 glass border-gradient">
            <div className="px-3 py-2 border-b border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                Empresa
              </p>
            </div>
            <DropdownMenuItem
              onClick={() => { setSelectedCompanyId(null); setSelectedStoreIds(displayStores.map(s => s.id)); }}
              className="text-xs font-semibold"
            >
              <Sparkles className="h-3.5 w-3.5 mr-2 text-primary" />
              Todas as empresas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {displayCompanies.map(c => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => { setSelectedCompanyId(c.id); setSelectedStoreIds(displayStores.filter(s => ((s as any).company_id || (s as any).companyId) === c.id).map(s => s.id)); }}
                className="text-xs gap-2.5"
              >
                <div className="h-3 w-3 rounded-full shrink-0 bg-primary ring-2 ring-background shadow-sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{(c as any).tradeName || c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(c as any).city}/{(c as any).state}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Store Multi-Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Lojas selecionadas: ${selectedStoreIds.length}`}
              title={`${selectedStoreIds.length} loja(s) selecionada(s)`}
              className="h-11 min-w-11 gap-1.5 border border-border/40 bg-background/40 px-2 text-xs transition-all hover:bg-accent hover-lift sm:h-9 sm:px-3"
            >
              <Store className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline font-semibold">
                {selectedStoreIds.length === 0
                  ? '0 lojas'
                  : selectedStoreIds.length === companyStores.length && companyStores.length > 0
                    ? 'Todas as Lojas'
                    : selectedStoreIds.length === 1
                      ? displayStores.find(s => s.id === selectedStoreIds[0])?.name?.split(' - ')[1] || displayStores.find(s => s.id === selectedStoreIds[0])?.name
                      : `${selectedStoreIds.length} lojas`}
              </span>
              <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full bg-primary/15 text-primary border-0 ml-0.5">
                {selectedStoreIds.length}
              </Badge>
              <ChevronDown className="h-3 w-3 opacity-50 ml-0.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0 glass border-gradient shadow-xl">
            <div className="p-3 border-b border-border/60 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                  Selecionar Unidades
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 hover:bg-primary/10 hover:text-primary transition-colors font-semibold"
                    onClick={() => setSelectedStoreIds(companyStores.map(s => s.id))}
                  >
                    Todas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 hover:bg-destructive/10 hover:text-destructive transition-colors font-semibold"
                    onClick={() => setSelectedStoreIds([])}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-2 space-y-0.5 max-h-72 overflow-y-auto custom-scrollbar">
              {companyStores.map(store => (
                <div key={store.id} className="flex items-center gap-1 group">
                  <label className="flex-1 flex items-center gap-3 text-xs cursor-pointer hover:bg-accent/60 p-2.5 rounded-lg transition-colors">
                    <Checkbox
                      checked={selectedStoreIds.includes(store.id)}
                      onCheckedChange={() => toggleStore(store.id)}
                      className="border-primary/40"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{store.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {store.city} • {store.code}
                      </p>
                    </div>
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 opacity-100 md:h-8 md:w-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10"
                    onClick={() => setSelectedStoreIds([store.id])}
                    title="Selecionar apenas esta"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Period Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Período: ${periods.find(p => p.value === period)?.label}`}
              title={periods.find(p => p.value === period)?.label}
              className="h-11 min-w-11 gap-1.5 border border-border/40 bg-background/40 px-2 text-xs transition-all hover:bg-accent hover-lift sm:h-9 sm:px-3"
            >
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <span className="hidden md:inline font-semibold">
                {periods.find(p => p.value === period)?.label}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 glass border-gradient">
            <div className="px-3 py-2 border-b border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                Período
              </p>
            </div>
            {periods.map(p => (
              <DropdownMenuItem
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`text-xs font-medium ${period === p.value ? 'bg-primary/10 text-primary' : ''}`}
              >
                {p.label}
                {period === p.value && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative hidden md:block group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar..."
            className="h-9 w-52 lg:w-64 pl-9 pr-12 text-xs bg-muted/40 border border-border/40 rounded-xl focus-visible:bg-muted/80 focus-visible:border-primary/40 focus-visible:ring-0 transition-all"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>

        <ThemeToggle compact />

        {/* Notifications */}
        <NotificationCenter />

        <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-9 px-2 hover:bg-accent hover-lift">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-orange-700 blur-sm opacity-50" />
                <div className="relative h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-orange-700 grid place-items-center text-white text-[10px] font-bold shadow-md">
                  {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                </div>
              </div>
              <span className="text-xs font-bold hidden lg:block">
                {user?.name?.split(' ')[0]}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50 hidden lg:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 glass border-gradient">
            <div className="px-3 py-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-orange-700 blur-sm opacity-50" />
                  <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-orange-700 grid place-items-center text-white text-[11px] font-bold">
                    {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs font-medium">Meu Perfil</DropdownMenuItem>
            <DropdownMenuItem className="text-xs font-medium">Configurações</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-xs text-destructive focus:text-destructive font-semibold"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}