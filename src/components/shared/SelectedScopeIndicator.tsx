import { Building2, CheckCircle2, ChevronDown, Store } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';

const storeIndependentRoutes = ['/companies', '/stores', '/users', '/admin', '/settings', '/profile'];

function isStoreIndependentPath(pathname: string) {
  return storeIndependentRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function SelectedScopeIndicator() {
  const { selectedCompanyId, selectedStoreIds, companies, stores, setSelectedStoreIds } = useGlobalFilter();
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  const scopedStores = selectedCompanyId
    ? stores.filter((store) => String(store.company_id || store.companyId || '') === String(selectedCompanyId))
    : stores;
  const validSelectedStoreIds = selectedStoreIds.filter((storeId) => scopedStores.some((store) => String(store.id) === String(storeId)));
  const selectedStore = validSelectedStoreIds.length === 1
    ? stores.find((store) => String(store.id) === String(validSelectedStoreIds[0]))
    : undefined;
  const storeLabel = validSelectedStoreIds.length === 0
    ? 'Nenhuma loja selecionada'
    : validSelectedStoreIds.length === 1
      ? selectedStore?.name || 'Loja selecionada'
      : validSelectedStoreIds.length === scopedStores.length && scopedStores.length > 0
        ? `Todas as lojas (${validSelectedStoreIds.length})`
        : `${validSelectedStoreIds.length} lojas selecionadas`;

  return (
    <div
      aria-live="polite"
      aria-label={`Escopo selecionado: ${selectedCompany?.name || 'todas as empresas'}; ${storeLabel}`}
      className="flex min-h-9 w-full max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-primary/20 bg-primary/[0.035] px-3 py-1.5 text-[11px] shadow-sm"
    >
      <span className="flex min-w-0 items-center gap-1.5 font-medium text-muted-foreground">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Empresa</span>
        <strong className="max-w-[min(42vw,280px)] truncate text-foreground">{selectedCompany?.name || 'Todas as empresas'}</strong>
      </span>
      <span className="hidden h-4 w-px bg-border sm:block" />
      <span className="flex min-w-0 items-center gap-1.5 font-medium text-muted-foreground">
        <Store className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Loja</span>
        <strong className="max-w-[min(52vw,360px)] truncate text-foreground">{storeLabel}</strong>
      </span>
      {validSelectedStoreIds.length === 0 && scopedStores.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto h-7 gap-1.5 border-primary/30 px-2.5 text-[10px] font-bold text-primary">
              Escolher loja <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Visualizar loja</p><p className="mt-1 text-xs text-muted-foreground">Escolha uma unidade para liberar os dados da página.</p></div>
            <DropdownMenuSeparator />
            {scopedStores.map((store) => <DropdownMenuItem key={store.id} onSelect={() => setSelectedStoreIds([store.id])} className="gap-2.5 py-2.5"><Store className="h-3.5 w-3.5 text-primary" /><span className="min-w-0 flex-1 truncate font-semibold">{store.name}</span><CheckCircle2 className="ml-auto h-3.5 w-3.5 text-muted-foreground" /></DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {validSelectedStoreIds.length === 0 && scopedStores.length === 0 && <Badge variant="outline" className="ml-auto border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Nenhuma loja cadastrada</Badge>}
    </div>
  );
}

export function StoreSelectionGate({ children }: { children: React.ReactNode }) {
  const { loading, selectedStoreIds, selectedCompanyId, stores, companies, setSelectedStoreIds } = useGlobalFilter();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const scopedStores = selectedCompanyId
    ? stores.filter((store) => String(store.company_id || store.companyId || '') === String(selectedCompanyId))
    : stores;
  const validSelectedStoreIds = selectedStoreIds.filter((storeId) => scopedStores.some((store) => String(store.id) === String(storeId)));

  if (loading || validSelectedStoreIds.length > 0 || isStoreIndependentPath(pathname)) return <>{children}</>;

  return (
    <Card className="border-amber-300/70 bg-amber-50/60 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/20">
      <CardContent className="flex flex-col items-center gap-4 px-5 py-12 text-center sm:px-8">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300"><Store className="h-6 w-6" /></div>
        <div className="max-w-lg"><h1 className="text-lg font-bold text-foreground">Escolha uma loja para visualizar</h1><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Nenhuma loja está selecionada. Para proteger o escopo dos dados, as informações de {companies.find((company) => company.id === selectedCompanyId)?.name || 'sua empresa'} ficam ocultas até você escolher uma unidade.</p></div>
        {scopedStores.length > 0 ? <DropdownMenu><DropdownMenuTrigger asChild><Button className="h-9 gap-2"><Store className="h-4 w-4" /> Selecionar uma loja <ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="center" className="w-72">{scopedStores.map((store) => <DropdownMenuItem key={store.id} onSelect={() => setSelectedStoreIds([store.id])} className="gap-3 py-3"><Store className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{store.name}</strong><span className="text-[11px] text-muted-foreground">{store.city || 'Cidade não informada'}{store.code ? ` · ${store.code}` : ''}</span></span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : <Button variant="outline" className="h-9 gap-2" onClick={() => navigate('/stores')}><Store className="h-4 w-4" /> Cadastrar uma loja</Button>}
      </CardContent>
    </Card>
  );
}
