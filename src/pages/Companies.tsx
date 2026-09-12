import { useState, useMemo } from 'react';
import { Plus, Building2, Phone, Mail, MapPin, Search, Filter, Store as StoreIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { KPICard } from '@/components/shared/KPICard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCompanies, type Company } from '@/hooks/useCompanies';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { CompanyFormModal } from '@/components/companies/CompanyFormModal';
import { CompanyDetailModal } from '@/components/companies/CompanyDetailModal';
import { DeleteCompanyDialog } from '@/components/companies/DeleteCompanyDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

export default function Companies() {
  const { companies: companiesList, loading: companiesLoading, saveCompany, deleteCompany, toggleStatus } = useCompanies();
  const { stores: storesList, loading: storesLoading, selectedCompanyId, setSelectedCompanyId } = useGlobalFilter();

  const isLoading = companiesLoading || storesLoading;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteCompanyObj, setDeleteCompanyObj] = useState<Company | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    return companiesList.filter(c => {
      const matchSearch = !search || 
        c.tradeName.toLowerCase().includes(search.toLowerCase()) || 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.cnpj.includes(search);
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [companiesList, search, statusFilter]);

  const activeCount = companiesList.filter(c => c.status === 'active').length;
  const totalStores = (storesList || []).length;
  const activeFilterCount = [search.trim(), statusFilter !== 'all' ? statusFilter : ''].filter(Boolean).length;
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); };

  const handleSave = async (company: Company) => {
    const success = await saveCompany(company);
    if (success) {
      setFormOpen(false);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingCompany(null);
    setFormOpen(true);
  };

  const handleToggleStatus = async (company: Company) => {
    const success = await toggleStatus(company.id, company.status);
    if (success) {
      const newStatus = company.status === 'active' ? 'inativa' : 'ativa';
      toast.success(`${company.tradeName} ${newStatus} com sucesso!`);
    }
  };

  const handleDelete = (company: Company) => {
    setDeleteCompanyObj(company);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCompanyObj) return;
    const success = await deleteCompany(deleteCompanyObj.id);
    if (success) {
      toast.success(`${deleteCompanyObj.tradeName} excluída com sucesso!`);
      setDeleteOpen(false);
      setDeleteCompanyObj(null);
    }
  };

  const handleCardClick = (company: Company) => {
    setDetailCompany(company);
    setDetailOpen(true);
  };

  if (isLoading) {
    return <LoadingSpinner message="Carregando empresas..." />;
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <PageHeader
          title="Empresas"
          description="Gerencie as empresas cadastradas no sistema"
          actions={
            <Button
              size="lg"
              className="w-full gap-2 btn-shimmer text-white border-0 shadow-lg shadow-primary/30 hover-lift rounded-xl sm:w-auto"
              onClick={handleNew}
            >
              <Plus className="h-4 w-4" />
              Nova Empresa
            </Button>
          }
        />
      </div>

      <FinancialInfoTip className="px-3 py-2.5" title="Dica de empresas">Mantenha cada empresa vinculada às suas lojas para que filtros, permissões e indicadores sejam calculados no escopo correto.</FinancialInfoTip>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <KPICard title="Total de Empresas" value={companiesList.length} icon={Building2} />
        <KPICard title="Ativas" value={activeCount} icon={Building2} />
        <KPICard title="Inativas" value={companiesList.length - activeCount} icon={Building2} />
        <KPICard title="Total de Lojas" value={totalStores} icon={StoreIcon} />
      </div>

      {/* Filters */}
      <div className="space-y-2 sm:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="h-11 pl-9" />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setMobileFiltersOpen(true)} className="h-11 flex-1 justify-center gap-2 border-primary/30 bg-primary/[0.04]"><Filter className="h-4 w-4 text-primary" /><span>Filtros</span>{activeFilterCount > 0 && <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground hover:bg-primary">{activeFilterCount}</Badge>}</Button>
          {activeFilterCount > 0 && <Button type="button" variant="ghost" onClick={clearFilters} className="h-11 px-3 text-xs text-muted-foreground">Limpar</Button>}
        </div>
      </div>
      <div className="hidden gap-3 sm:flex">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, razão social ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[160px]"><Filter className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativas</SelectItem><SelectItem value="inactive">Inativas</SelectItem></SelectContent></Select>
      </div>

      {/* List */}
      {companiesList.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa cadastrada"
          description="Comece cadastrando sua primeira empresa para usar o sistema"
          action={
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Empresa
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma empresa encontrada</p>
          <p className="text-sm mt-1">Ajuste os filtros ou cadastre uma nova empresa.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map(company => {
            const companyStores = (storesList || []).filter(s => s.company_id === company.id);
            return (
              <Card 
                key={company.id} 
                className={`premium-shadow border-border/60 hover:border-primary/20 hover:premium-shadow-md transition-all cursor-pointer group overflow-hidden ${selectedCompanyId === company.id ? 'ring-2 ring-primary ring-offset-2' : ''}`} 
                onClick={() => {
                  setSelectedCompanyId(company.id);
                  toast.success(`Empresa ${company.tradeName} selecionada!`);
                }}
              >
                <CardContent className="p-0">
                  <div className="h-1.5 bg-gradient-to-r from-primary via-orange-500 to-primary" />
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                        <Building2 className="h-7 w-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex min-w-0 items-start justify-between gap-2 mb-1">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <h3 className="min-w-0 break-words text-lg font-heading font-bold leading-tight">{company.tradeName}</h3>
                            <StatusBadge status={company.status} />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {selectedCompanyId === company.id && (
                              <Badge variant="default" className="text-[10px] bg-primary text-white border-0">Ativa</Badge>
                            )}
                            <Button variant="ghost" size="icon" aria-label={`Abrir detalhes de ${company.tradeName}`} className="h-11 w-11 shrink-0 opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary sm:h-8 sm:w-8" onClick={(e) => { e.stopPropagation(); handleCardClick(company); }}>
                              <Search className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="break-words text-xs text-muted-foreground">{company.name}</p>

                        <div className="mt-3 min-w-0 space-y-1.5 text-xs text-muted-foreground">
                          <div className="flex min-w-0 items-start gap-2"><MapPin className="h-3 w-3 shrink-0" />{company.city}/{company.state}</div>
                          <div className="flex min-w-0 items-start gap-2"><Phone className="h-3 w-3 shrink-0" />{company.phone}</div>
                          <div className="flex min-w-0 items-start gap-2"><Mail className="h-3 w-3 shrink-0" />{company.email}</div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-[10px] text-muted-foreground">Identidade laranja global</span>
                          <span className="ml-auto break-all text-right text-[10px] font-mono text-muted-foreground/60">{company.cnpj}</span>
                        </div>

                        <div className="mt-5 pt-4 border-t border-border/40">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold">{companyStores.length} loja{companyStores.length !== 1 ? 's' : ''} vinculada{companyStores.length !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="space-y-2">
                            {companyStores.map(s => (
                              <div key={s.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-muted/30 p-2 text-xs">
                                <span className="min-w-0 break-words font-medium">{s.name}</span>
                                <StatusBadge status={s.status} variant="dot" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl border-border/80 bg-background p-0 sm:hidden">
          <DialogHeader className="border-b border-border/70 bg-card px-4 py-4 text-left"><DialogTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4 text-primary" /> Filtrar empresas</DialogTitle><DialogDescription className="mt-1 text-xs">Escolha o status para refinar a lista.</DialogDescription></DialogHeader>
          <div className="space-y-2 p-4"><span className="text-sm font-semibold">Status</span><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="active">Ativas</SelectItem><SelectItem value="inactive">Inativas</SelectItem></SelectContent></Select></div>
          <div className="flex gap-2 border-t border-border/70 bg-card p-3"><Button type="button" variant="ghost" onClick={clearFilters} className="flex-1">Limpar</Button><Button type="button" onClick={() => setMobileFiltersOpen(false)} className="flex-1">Aplicar filtros</Button></div>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <CompanyFormModal 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        company={editingCompany} 
        onSave={handleSave} 
        isLoading={companiesLoading}
      />
      <CompanyDetailModal 
        open={detailOpen} 
        onOpenChange={setDetailOpen} 
        company={detailCompany} 
        stores={(storesList || []).map(s => ({ ...s, companyId: s.company_id } as any))} 
        onEdit={handleEdit} 
        onToggleStatus={handleToggleStatus} 
        onDelete={handleDelete} 
      />
      <DeleteCompanyDialog 
        open={deleteOpen} 
        onOpenChange={setDeleteOpen} 
        company={deleteCompanyObj} 
        stores={(storesList || []).map(s => ({ ...s, companyId: s.company_id } as any))} 
        onConfirm={confirmDelete} 
      />
    </div>
  );
}
