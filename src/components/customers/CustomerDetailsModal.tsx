import { useEffect, useRef, useState } from 'react';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { format, parseISO, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  MapPin, Phone, Mail, User, Calendar, ShoppingBag, Wrench, Receipt,
  Paperclip, MoreVertical, Edit3, PlusCircle, DollarSign, UserPlus, Contact, Trash2, History, MessageSquare, ArrowRight
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useLocalMutation } from '@/hooks/useLocalData';
import { useQueryClient } from '@tanstack/react-query';
import { formatMoney, useCustomerStats } from '@/hooks/useCustomerData';
import { CustomerFormModal } from './CustomerFormModal';

import { SalesTab } from './SalesTab';
import { OSTab } from './OSTab';
import { PrescriptionsTab } from './PrescriptionsTab';
import { CreditTab } from './CreditTab';
import { AttachmentsTab } from './AttachmentsTab';
import { FinancialStatusModal } from './FinancialStatusModal';
import { AppointmentsTab } from './AppointmentsTab';
import { HistoryTab } from './HistoryTab';

const HIDDEN_IMPORT_TAGS = new Set(['importado-sistema-anterior', 'origem-otica-nordestina-ltda', 'origem-sertao-otica-bdc']);
const visibleCustomerTags = (tags: string[] = []) => tags.filter(tag => !HIDDEN_IMPORT_TAGS.has(tag));

interface CustomerDetailsModalProps {
  customer: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
  autoAction?: string;
}

export function CustomerDetailsModal({ customer, open, onOpenChange, initialTab = 'overview', autoAction }: CustomerDetailsModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [financialModalOpen, setFinancialModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const mutation = useLocalMutation('customers', [['customers']]);
  const stats = useCustomerStats(customer);
  const autoActionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      autoActionRef.current = null;
      return;
    }
    setActiveTab(initialTab);
    if (autoAction) {
      const actionKey = `${customer?.id || ''}:${autoAction}`;
      if (autoActionRef.current !== actionKey) {
        autoActionRef.current = actionKey;
        handleAction(autoAction);
      }
    }
  }, [open, initialTab, autoAction, customer?.id]);

  if (!customer) return null;

  const customerName = String(customer.name || 'Cliente sem nome');
  const customerDocument = customer.customerType === 'company' ? customer.cnpj : customer.cpf;
  const customerDocumentLabel = customer.customerType === 'company' ? 'CNPJ' : 'CPF';
  const customerTypeLabel = customer.customerType === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física';
  const customerContact = customer.phone || customer.whatsapp || customer.email || 'Sem contato principal';
  const customerInitials = customerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() || 'CL';

  const handleAction = (action: string) => {
    if (action === "Nova Venda") {
      setActiveTab('sales');
    } else if (action === "Nova O.S.") {
      setActiveTab('os');
    } else if (action === "Novo Agendamento") {
      setActiveTab('appointments');
    } else if (action === "Enviar WhatsApp") {
      const phone = (customer.phone || customer.whatsapp || '').replace(/\D/g, '');
      if (!phone) {
        toast.error('Este cliente não possui telefone ou WhatsApp cadastrado.');
        return;
      }
      window.open(`https://wa.me/55${phone}`, '_blank');
      return;
    } else if (action === "Ver Histórico") {
      setActiveTab('history');
    } else if (action === "Gerar Relatório") {
      window.print();
      return;
    } else if (action === "Anexar Documento") {
      setActiveTab('attachments');
    }

    toast.success(`Iniciando: ${action} para ${customer.name}`);
  };

  const handleSaveEdit = async (data: any) => {
    if (!customer?.id) return;

    try {
      await mutation.mutateAsync({
        action: 'update',
        id: customer.id,
        data,
      });

      toast.success('Cliente atualizado', {
        description: 'As informações completas do cliente foram salvas com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditModalOpen(false);
    } catch (error) {
      toast.error('Erro', {
        description: 'Não foi possível atualizar o cliente.',
      });
    }
  };

  const handleDelete = async () => {
    if (!customer?.id) return;

    try {
      await mutation.mutateAsync({
        action: 'delete',
        id: customer.id
      });

      toast.success('Cliente excluído', {
        description: 'O cliente foi removido da base de dados.',
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditModalOpen(false);
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro', {
        description: 'Não foi possível excluir o cliente.',
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-[calc(100vw-1rem)] max-w-[1280px] flex-col overflow-hidden rounded-2xl border-border/70 bg-background p-0 sm:rounded-3xl">
          <div className="shrink-0 border-b border-border/70 bg-card/95 px-3 py-3 backdrop-blur sm:px-5">
            <div className="flex items-center justify-between gap-3 pr-7">
              <div className="flex min-w-0 items-center gap-3">
                <div className="group relative shrink-0">
                  <Avatar className="h-10 w-10 border-2 border-primary/25 shadow-sm sm:h-11 sm:w-11">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${customerName}`} />
                    <AvatarFallback className="bg-primary/10 text-xs font-black text-primary">{customerInitials}</AvatarFallback>
                  </Avatar>
                  <PermissionGate module="customers" action="edit"><button type="button" onClick={() => setEditModalOpen(true)} aria-label="Editar identificação do cliente" className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-md border-2 border-card bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity hover:bg-primary/90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover:opacity-100">
                    <Edit3 className="h-2.5 w-2.5" />
                  </button></PermissionGate>
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <DialogTitle className="max-w-[42vw] truncate text-lg font-heading font-black tracking-tight text-foreground sm:max-w-[520px] sm:text-xl">{customerName}</DialogTitle>
                    <StatusBadge status={customer.status} />
                    <Badge variant="outline" className="hidden h-5 rounded-md border-primary/25 px-1.5 text-[9px] font-bold text-primary sm:inline-flex">{customerTypeLabel}</Badge>
                  </div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                    <span className="truncate">{customerDocument ? `${customerDocumentLabel}: ${customerDocument}` : customerContact}</span>
                    {customerDocument && <><span className="text-border">•</span><span className="truncate">{customerContact}</span></>}
                    {visibleCustomerTags(customer.tags || []).slice(0, 2).map((tag: string) => <Badge key={tag} className="hidden h-4 rounded px-1.5 text-[8px] font-bold uppercase tracking-wide sm:inline-flex" variant="secondary">{tag}</Badge>)}
                    {visibleCustomerTags(customer.tags || []).length > 2 && <span className="hidden text-[9px] font-bold text-primary sm:inline">+{visibleCustomerTags(customer.tags || []).length - 2}</span>}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <PermissionGate module="customers" action="edit">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg border-border/70 px-2.5 text-[11px] font-bold hover:border-primary/40 hover:bg-primary/5 sm:px-3" onClick={() => setEditModalOpen(true)}>
                    <Edit3 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Editar</span>
                  </Button>
                </PermissionGate>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-8 gap-1.5 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 sm:px-3">
                      <PlusCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <PermissionGate module="sales" action="create"><DropdownMenuItem onClick={() => handleAction("Nova Venda")} className="cursor-pointer gap-2"><ShoppingBag className="h-4 w-4" /> Nova Venda</DropdownMenuItem></PermissionGate>
                    <PermissionGate module="service_orders" action="create"><DropdownMenuItem onClick={() => handleAction("Nova O.S.")} className="cursor-pointer gap-2 font-bold"><Wrench className="h-4 w-4" /> Abrir O.S.</DropdownMenuItem></PermissionGate>
                    <PermissionGate module="appointments" action="create"><DropdownMenuItem onClick={() => handleAction("Novo Agendamento")} className="cursor-pointer gap-2"><Calendar className="h-4 w-4" /> Agendar horário</DropdownMenuItem></PermissionGate>
                    <DropdownMenuSeparator />
                    <PermissionGate module="financial" action="view"><DropdownMenuItem onClick={() => setActiveTab('credit')} className="cursor-pointer gap-2"><DollarSign className="h-4 w-4" /> Abrir crediário</DropdownMenuItem></PermissionGate>
                    <DropdownMenuItem onClick={() => handleAction("Enviar WhatsApp")} className="cursor-pointer gap-2 font-bold text-emerald-600 focus:text-emerald-700"><MessageSquare className="h-4 w-4" /> Enviar WhatsApp</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Mais ações do cliente" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handleAction("Ver Histórico")} className="cursor-pointer gap-2 font-bold"><History className="h-4 w-4" /> Histórico completo</DropdownMenuItem>
                    <PermissionGate module="customers" action="print"><DropdownMenuItem onClick={() => handleAction("Gerar Relatório")} className="cursor-pointer gap-2"><Receipt className="h-4 w-4" /> Relatório individual</DropdownMenuItem></PermissionGate>
                    <DropdownMenuItem onClick={() => handleAction("Anexar Documento")} className="cursor-pointer gap-2"><Paperclip className="h-4 w-4" /> Anexar documento</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <PermissionGate module="customers" action="edit"><DropdownMenuItem onClick={() => setEditModalOpen(true)} className="cursor-pointer gap-2"><Edit3 className="h-4 w-4" /> Editar cliente</DropdownMenuItem></PermissionGate>
                    <PermissionGate module="customers" action="delete"><DropdownMenuItem onClick={() => setIsDeleting(true)} className="cursor-pointer gap-2 text-red-600 focus:bg-red-500/10 focus:text-red-600"><Trash2 className="h-4 w-4" /> Excluir registro</DropdownMenuItem></PermissionGate>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabsList className="no-scrollbar h-11 shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-border/70 bg-card px-3 sm:px-5">
              {[
                { value: 'overview', label: 'Visão geral' },
                { value: 'sales', label: 'Vendas' },
                { value: 'os', label: 'O.S.' },
                { value: 'appointments', label: 'Agendamentos' },
                { value: 'revenue', label: 'Receitas' },
                { value: 'credit', label: 'Crediário' },
                { value: 'history', label: 'Histórico' },
                { value: 'attachments', label: 'Anexos' },
              ].map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="h-8 shrink-0 rounded-lg px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:px-3.5">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
              <TabsContent value="overview" className="m-0 space-y-5 animate-in fade-in duration-300">
                  <div className="grid gap-3 sm:grid-cols-3">
                      {[
                          { label: 'Total Compras', value: stats.totalPurchases, icon: ShoppingBag, color: 'text-primary', bg: 'bg-primary/10' },
                          { label: 'Valor Total', value: formatMoney(stats.totalSpent), icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                          { label: 'O.S. Aberta', value: stats.openServiceOrders, icon: Wrench, color: 'text-primary', bg: 'bg-primary/10' },
                      ].map(card => (
                          <div key={card.label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:shadow-md">
                              <div className={`p-3 ${card.bg} rounded-xl ${card.color}`}><card.icon className="h-6 w-6" /></div>
                              <div>
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-0.5">{card.label}</p>
                                  <p className="text-xl font-bold text-foreground">{card.value}</p>
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="grid gap-5 lg:grid-cols-2">
                      <div className="space-y-4">
                          <div>
                              <h4 className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                                  <User className="h-3.5 w-3.5" /> Informações Pessoais
                              </h4>
                              <div className="bg-card rounded-xl p-4 border border-border/70 shadow-sm space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">{customer.customerType === 'company' ? 'CNPJ' : 'CPF'}</p>
                                          <p className="text-sm font-semibold text-foreground">{(customer.customerType === 'company' ? customer.cnpj : customer.cpf) || 'Não informado'}</p>
                                      </div>
                                      <div>
                                          <p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">{customer.customerType === 'company' ? 'Inscrição Estadual' : 'RG'}</p>
                                          <p className="text-sm font-semibold text-foreground">{(customer.customerType === 'company' ? customer.stateRegistration : customer.rg) || 'Não informado'}</p>
                                      </div>
                                      <div>
                                          <p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Nome preferido</p>
                                          <p className="text-sm font-semibold text-foreground">{customer.nickname || 'Mesmo do cadastro'}</p>
                                      </div>
                                      <div>
                                          <p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Data de nascimento</p>
                                          <p className="text-sm font-semibold text-foreground">
                                            {customer.birthDate
                                              ? (isValid(parseISO(customer.birthDate))
                                                  ? format(parseISO(customer.birthDate), 'dd/MM/yyyy')
                                                  : customer.birthDate)
                                              : 'Não informado'}
                                          </p>
                                      </div>
                                      <div>
                                          <p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Estado civil</p>
                                          <p className="text-sm font-semibold text-foreground capitalize">{customer.maritalStatus || 'Não informado'}</p>
                                      </div>
                                  </div>
                                  <div>
                                      <p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Observações</p>
                                      <p className="text-sm text-muted-foreground leading-relaxed">{customer.notes || 'Nenhuma observação registrada.'}</p>
                                  </div>
                              </div>
                          </div>

                          <div>
                              <h4 className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                                  <UserPlus className="h-3.5 w-3.5" /> Perfil e relacionamento
                              </h4>
                              <div className="bg-card rounded-xl p-4 border border-border/70 shadow-sm">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Tipo de cliente</p><p className="text-sm font-semibold text-foreground">{customer.customerType === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'}</p></div>
                                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Origem</p><p className="text-sm font-semibold text-foreground capitalize">{customer.origin || 'Não informado'}</p></div>
                                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Profissão</p><p className="text-sm font-semibold text-foreground">{customer.profession || 'Não informado'}</p></div>
                                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Convênio</p><p className="text-sm font-semibold text-foreground">{customer.insurance || 'Não informado'}</p></div>
                                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Responsável / grau</p><p className="text-sm font-semibold text-foreground">{customer.responsibleName || 'Não informado'}{customer.responsibleRelationship ? ` · ${customer.responsibleRelationship}` : ''}</p></div>
                                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Renda familiar</p><p className="text-sm font-semibold text-foreground">{customer.familyIncome ? formatMoney(customer.familyIncome) : 'Não informado'}</p></div>
                                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Acréscimo / desconto</p><p className="text-sm font-semibold text-foreground">{customer.discountPercent === null || customer.discountPercent === undefined ? 'Não informado' : `${customer.discountPercent > 0 ? '+' : ''}${customer.discountPercent}%`}</p></div>
                                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider mb-1">Vendedor preferencial</p><p className="text-sm font-semibold text-foreground">{customer.preferredSellerId || 'Não informado'}</p></div>
                                  </div>
                              </div>
                          </div>

                          <div>
                              <h4 className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                                  <MapPin className="h-3.5 w-3.5" /> Endereço Principal
                              </h4>
                              <div className="bg-card rounded-xl p-4 border border-border/70 shadow-sm">
                                  <p className="text-sm font-semibold text-foreground">{customer.address?.street || 'Rua não informada'}, {customer.address?.number || 'S/N'}</p>
                                  {customer.address?.complement && <p className="text-xs text-muted-foreground">{customer.address.complement}</p>}
                                  <p className="text-sm text-muted-foreground">{customer.address?.neighborhood || 'Bairro não informado'} - {customer.address?.city || 'Cidade não informada'}, {customer.address?.state || 'UF'}</p>
                                  <p className="text-xs text-muted-foreground/70 mt-2 font-mono">CEP: {customer.address?.zipCode || '00000-000'}</p>
                                  {customer.address?.reference && (
                                    <div className="mt-3 flex items-start gap-2 bg-muted/50 p-2 rounded-lg border border-border/50">
                                      <div className="p-1 bg-card rounded-md text-muted-foreground/70"><MapPin className="h-3 w-3" /></div>
                                      <div>
                                        <p className="text-[9px] font-bold uppercase text-muted-foreground/70 tracking-wider">Ponto de Referência</p>
                                        <p className="text-xs text-muted-foreground">{customer.address.reference}</p>
                                      </div>
                                    </div>
                                  )}
                              </div>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="space-y-2">
                              <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                                  <Phone className="h-3.5 w-3.5" /> Canais de contato
                              </h4>
                              <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                                  <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
                                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Contact className="h-4 w-4" /></div>
                                      <div><p className="text-xs font-black text-foreground">Fale com o cliente</p><p className="text-[10px] text-muted-foreground">Ações rápidas de contato</p></div>
                                  </div>
                                  <div className="divide-y divide-border/60">
                                      <div className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/40">
                                          <div className="flex min-w-0 items-center gap-3">
                                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Phone className="h-4 w-4" /></div>
                                              <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Telefone</p><p className="truncate text-sm font-semibold text-foreground">{customer.phone || 'Não informado'}</p></div>
                                          </div>
                                          <Button variant="outline" size="sm" aria-label="Ligar para o cliente" className="h-7 shrink-0 rounded-md px-2.5 text-[10px] font-bold text-primary hover:bg-primary/5" onClick={() => customer.phone && window.open(`tel:${customer.phone.replace(/\D/g, '')}`, '_self')} disabled={!customer.phone}>Ligar</Button>
                                      </div>
                                      <div className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/40">
                                          <div className="flex min-w-0 items-center gap-3">
                                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600"><MessageSquare className="h-4 w-4" /></div>
                                              <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">WhatsApp</p><p className="truncate text-sm font-semibold text-foreground">{customer.whatsapp || customer.phone || 'Não informado'}</p></div>
                                          </div>
                                          <Button variant="outline" size="sm" aria-label="Enviar WhatsApp para o cliente" className="h-7 shrink-0 rounded-md border-emerald-500/25 px-2.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/5" onClick={() => { const phone = (customer.whatsapp || customer.phone || '').replace(/\D/g, ''); if (phone) window.open(`https://wa.me/55${phone}`, '_blank'); }} disabled={!customer.whatsapp && !customer.phone}>WhatsApp</Button>
                                      </div>
                                      <div className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/40">
                                          <div className="flex min-w-0 items-center gap-3">
                                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground"><Mail className="h-4 w-4" /></div>
                                              <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">E-mail</p><p className="truncate text-sm font-semibold text-foreground">{customer.email || 'Não informado'}</p></div>
                                          </div>
                                          <Button variant="outline" size="sm" aria-label="Enviar e-mail para o cliente" className="h-7 shrink-0 rounded-md px-2.5 text-[10px] font-bold text-muted-foreground hover:bg-muted" onClick={() => customer.email && window.open(`mailto:${customer.email}`, '_self')} disabled={!customer.email}>Enviar</Button>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {(customer.phones?.length || customer.emails?.length || customer.references?.length) ? (
                            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                              <div className="mb-3 flex items-center gap-2"><Contact className="h-4 w-4 text-primary" /><p className="text-xs font-black text-foreground">Contatos adicionais</p></div>
                              <div className="space-y-2 text-xs text-muted-foreground">
                                {customer.phones?.slice(0, 3).map((item: any) => <div key={`phone-${item.value}-${item.label}`} className="flex justify-between gap-3"><span>{item.label || 'Telefone'}</span><span className="font-semibold text-foreground">{item.value}</span></div>)}
                                {customer.emails?.slice(0, 3).map((item: any) => <div key={`email-${item.value}-${item.label}`} className="flex justify-between gap-3"><span>{item.label || 'E-mail'}</span><span className="truncate font-semibold text-foreground">{item.value}</span></div>)}
                                {customer.references?.slice(0, 3).map((item: any) => <div key={`reference-${item.value}-${item.label}`} className="flex justify-between gap-3"><span>{item.label || 'Referência'}</span><span className="truncate font-semibold text-foreground">{item.value}</span></div>)}
                              </div>
                            </div>
                          ) : null}

                          <div className="overflow-hidden rounded-xl border border-border/70 border-t-2 border-t-primary/70 bg-card shadow-sm">
                              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-5">
                                  <div className="flex items-center gap-2.5">
                                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><DollarSign className="h-4 w-4" /></div>
                                      <div>
                                          <h4 className="text-xs font-black text-foreground">Resumo financeiro</h4>
                                          <p className="text-[10px] text-muted-foreground">Visão rápida do relacionamento</p>
                                      </div>
                                  </div>
                                  <Badge variant="outline" className={stats.overdueAmount > 0 ? "h-6 rounded-md border-red-500/25 bg-red-500/5 px-2 text-[9px] font-black text-red-600" : "h-6 rounded-md border-emerald-500/25 bg-emerald-500/5 px-2 text-[9px] font-black text-emerald-600"}>{stats.overdueAmount > 0 ? "VENCIDO" : "EM DIA"}</Badge>
                              </div>
                              <div className="grid grid-cols-2 divide-x divide-y divide-border/60">
                                  <div className="p-3.5 sm:p-4">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Crédito disponível</p>
                                      <p className="mt-1 text-base font-black tabular-nums text-foreground">{formatMoney(stats.creditAvailable)}</p>
                                  </div>
                                  <div className="p-3.5 text-right sm:p-4">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total gasto</p>
                                      <p className="mt-1 text-base font-black tabular-nums text-foreground">{formatMoney(stats.totalSpent)}</p>
                                  </div>
                                  <div className="p-3.5 sm:p-4">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Saldo devedor</p>
                                      <p className="mt-1 text-base font-black tabular-nums text-amber-600">{formatMoney(stats.balanceDue)}</p>
                                  </div>
                                  <div className="p-3.5 text-right sm:p-4">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Valor vencido</p>
                                      <p className="mt-1 text-base font-black tabular-nums text-red-600">{formatMoney(stats.overdueAmount)}</p>
                                  </div>
                              </div>
                              <div className="border-t border-border/60 p-3.5 sm:p-4">
                                      <PermissionGate module="financial" action="view"><Button variant="outline" className="h-9 w-full gap-2 rounded-lg border-primary/25 text-xs font-bold text-primary hover:bg-primary/5" onClick={() => setFinancialModalOpen(true)}>
                                      <Receipt className="h-3.5 w-3.5" /> Ver extrato completo
                                      </Button></PermissionGate>
                                  </div>
                              </div>
                          </div>
                      </div>
              </TabsContent>

              <TabsContent value="sales" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <SalesTab customer={customer} autoOpenNew={autoAction === 'Nova Venda'} />
              </TabsContent>

              <TabsContent value="os" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <OSTab customer={customer} autoOpenNew={autoAction === 'Nova O.S.'} />
              </TabsContent>

              <TabsContent value="appointments" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <AppointmentsTab customer={customer} autoOpenNew={autoAction === 'Novo Agendamento'} />
              </TabsContent>


              <TabsContent value="revenue" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <PrescriptionsTab customer={customer} />
              </TabsContent>

              <TabsContent value="credit" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <CreditTab customer={customer} />
              </TabsContent>

              <TabsContent value="history" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <HistoryTab customer={customer} />
              </TabsContent>

              <TabsContent value="attachments" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <AttachmentsTab customer={customer} />
              </TabsContent>
            </div>
          </Tabs>

        </DialogContent>
      </Dialog>


      <CustomerFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleSaveEdit}
        isLoading={mutation.isPending}
        initialData={customer}
        mode="edit"
      />
      <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-muted-foreground">
            Tem certeza que deseja excluir o registro de <strong>{customer.name}</strong>? Esta ação não pode ser desfeita e todos os históricos vinculados serão perdidos.
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsDeleting(false)}>Manter Cliente</Button>
            <Button variant="destructive" onClick={handleDelete} className="gap-2">
              <Trash2 className="h-4 w-4" /> Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FinancialStatusModal
        isOpen={financialModalOpen}
        onClose={() => setFinancialModalOpen(false)}
        customer={customer}
      />
    </>
  );
}
