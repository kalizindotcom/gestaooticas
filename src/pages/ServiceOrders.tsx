import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SERVICE_ORDER_STATUS_OPTIONS, serviceOrderStatusLabel } from '@/lib/serviceOrderStatus';
import { Plus, Search, Filter, LayoutGrid, List, KanbanSquare, MoreHorizontal, Calendar, User, DollarSign, FileText, Clock, Trash2, Edit, Copy, CheckCircle, Truck, Eye, Info, Save, X, RefreshCw, FlaskConical, Wrench } from 'lucide-react';
import { localApi } from '@/lib/localApi';
import { CustomerSelector } from '@/components/shared/CustomerSelector';
import { Button } from '@/components/ui/button';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { useServiceOrders, useCustomers, useEmployees, useLaboratories } from '@/hooks/useLocalData';
import { useCreateOrUpdateCustomerServiceOrder } from '@/hooks/useCustomerData';
import { ServiceOrderForm, createServiceOrderForm, type ServiceOrderFormState } from '@/components/service-orders/ServiceOrderForm';
import { ServiceOrderCompletionDialog } from '@/components/service-orders/ServiceOrderCompletionDialog';
import { ServiceOrderViewer } from '@/components/service-orders/ServiceOrderViewer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

export default function ServiceOrders() {
  const { data: serviceOrders = [], isLoading: ordersLoading, refetch: refetchOrders } = useServiceOrders();
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const { data: employees = [] } = useEmployees();
  const { data: laboratories = [] } = useLaboratories();
  const { selectedStoreIds, selectedCompanyId, stores, companies } = useGlobalFilter();

  const [view, setView] = useState<'table' | 'cards' | 'kanban'>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? 'cards' : 'table');
  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [openNew, setOpenNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingFiscal, setIsPreparingFiscal] = useState(false);
  const [completedOS, setCompletedOS] = useState<any>(null);
  const [confirmDeleteOS, setConfirmDeleteOS] = useState(false);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServiceOrderFormState>(createServiceOrderForm(selectedStoreIds[0] || ''));
  const selectedCustomer = customers.find((customer) => customer.id === formData.customerId);
  const saveOrder = useCreateOrUpdateCustomerServiceOrder(selectedCustomer);

  /*
  const [legacyFormData, setLegacyFormData] = useState({
    customerId: '',
    storeId: selectedStoreIds[0] || '',
    serviceType: 'montagem',
    priority: 'medium',
    deliveryDate: '',
    prescriptionDate: '',
    prescriptionValidUntil: '',
    product: '',
    lens: '',
    lab: '',
    total: '',
    technicianId: '',
    description: '',
    rightEye: { sph: '', cyl: '', axis: '', add: '' },
    leftEye: { sph: '', cyl: '', axis: '', add: '' },
    pupillaryDistance: '',
    largestDiagonal: '',
    verticalHeight: '',
    frameSize: '',
    bridgeSize: '',
    frameAndBridge: '',
    opticalCenterHeight: '',
    rightEyeFar: '',
    rightEyeNear: '',
    leftEyeFar: '',
    leftEyeNear: ''
  });
  */

  const isLoading = ordersLoading || customersLoading;

  if (isLoading) {
    return <LoadingSpinner message="Carregando ordens de serviço..." />;
  }

  const resetForm = () => {
    setFormData(createServiceOrderForm(selectedStoreIds[0] || ''));
  };

  const updateForm = (patch: Partial<ServiceOrderFormState>) => {
    setFormData((current) => ({ ...current, ...patch }));
  };

  const handleSave = async () => {
    if (!formData.customerId || !formData.storeId) {
      toast.error('Preencha os campos obrigatórios: cliente e loja.');
      return;
    }

    const total = Number(formData.total || 0);
    const paidAmount = Number(formData.paidAmount || 0);
    if (!Number.isFinite(total) || !Number.isFinite(paidAmount) || total < 0 || paidAmount < 0 || paidAmount > total) {
      toast.error('Confira os valores: o recebido não pode superar o total.');
      return;
    }

    setIsSaving(true);
    try {
      const savedOrder = await saveOrder.mutateAsync({ id: isEditing ? editingOrderId : undefined, data: formData });
      const savedId = savedOrder?.id || editingOrderId || `OS-${Date.now()}`;
      const store = stores.find((item: any) => item.id === formData.storeId);
      const technician = employees.find((item: any) => item.id === formData.technicianId);
      const laboratory = laboratories.find((item: any) => item.id === formData.labId);
      const totalValue = Number(formData.total || 0);
      const paidValue = Number(formData.paidAmount || 0);
      const completedView = {
        ...savedOrder,
        ...formData,
        id: savedId,
        companyId: savedOrder?.company_id || selectedCompanyId,
        productId: formData.productId,
        productQuantity: formData.productQuantity,
        storeName: store?.name || 'Loja não informada',
        customerName: selectedCustomer?.name || 'Cliente não informado',
        customerPhone: selectedCustomer?.phone || selectedCustomer?.whatsapp || '',
        technicianName: technician?.name || '',
        lab: laboratory?.name || formData.lab || '',
        serviceType: formData.serviceType,
        deliveryDate: formData.deliveryDate || formData.estimatedDeadline || 'A definir',
        total: totalValue,
        paidAmount: paidValue,
        balance: Math.max(totalValue - paidValue, 0),
        prescription: { rightEye: formData.rightEye, leftEye: formData.leftEye, pupillaryDistance: formData.pupillaryDistance, largestDiagonal: formData.largestDiagonal, verticalHeight: formData.verticalHeight, frameSize: formData.frameSize, bridgeSize: formData.bridgeSize, frameAndBridge: formData.frameAndBridge, opticalCenterHeight: formData.opticalCenterHeight, rightEyeFar: formData.rightEyeFar, rightEyeNear: formData.rightEyeNear, leftEyeFar: formData.leftEyeFar, leftEyeNear: formData.leftEyeNear },
      };
      toast.success(isEditing ? 'O.S. atualizada com sucesso!' : 'O.S. criada com sucesso!');
      await refetchOrders();
      if (!isEditing) setCompletedOS(completedView);
      setOpenNew(false);
      resetForm();
      setIsEditing(false);
      setEditingOrderId(undefined);
    } catch (error: any) {
      console.error('Erro ao salvar O.S.:', error);
      toast.error('Erro ao salvar ordem de serviço: ' + (error.message || 'verifique os dados.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (order = selectedOS) => {
    if (!order) return;
    setFormData({
      ...createServiceOrderForm(order.storeId || selectedStoreIds[0] || '', order.customerId || ''),
      serviceType: order.serviceType || 'montagem',
      priority: order.priority || 'medium',
      status: order.status || 'opened',
      date: order.date || new Date().toISOString().slice(0, 10),
      deliveryDate: order.deliveryDate || '',
      estimatedDeadline: order.estimatedDeadline || order.deliveryDate || '',
      dueDate: order.dueDate || order.deliveryDate || new Date().toISOString().slice(0, 10),
      prescriptionDate: order.prescriptionDate || '',
      prescriptionValidUntil: order.prescriptionValidUntil || '',
      prescriptionId: order.prescriptionId || '',
      prescriptionProfessionalId: order.prescriptionProfessionalId || '',
      productId: order.productId || order.product_id || '',
      productQuantity: Number(order.productQuantity || order.product_quantity || 1),
      product: order.product || order.product_name || '',
      lens: order.lens || order.lens_name || '',
      labId: order.labId || '',
      total: order.total?.toString() || '',
      paidAmount: order.paidAmount?.toString() || '0',
      paymentMethod: order.paymentMethod || order.payment_method || 'pix',
      paymentNote: order.paymentNote || '',
      technicianId: order.technicianId || '',
      internalNotes: order.internalNotes || '',
      description: order.description || '',
      rightEye: order.prescription?.rightEye || { sph: '', cyl: '', axis: '', add: '' },
      leftEye: order.prescription?.leftEye || { sph: '', cyl: '', axis: '', add: '' },
      pupillaryDistance: order.prescription?.pupillaryDistance || '',
      largestDiagonal: order.prescription?.largestDiagonal || '',
      verticalHeight: order.prescription?.verticalHeight || '',
      frameSize: order.prescription?.frameSize || '',
      bridgeSize: order.prescription?.bridgeSize || '',
      frameAndBridge: order.prescription?.frameAndBridge || '',
      opticalCenterHeight: order.prescription?.opticalCenterHeight || '',
      rightEyeFar: order.prescription?.rightEyeFar || '',
      rightEyeNear: order.prescription?.rightEyeNear || '',
      leftEyeFar: order.prescription?.leftEyeFar || '',
      leftEyeNear: order.prescription?.leftEyeNear || ''
    });
    setIsEditing(true);
    setEditingOrderId(order.id);
    setOpenNew(true);
    setSelectedOS(null);
  };

  const handlePrepareFiscal = async (order = selectedOS) => {
    if (!order) return;
    setIsPreparingFiscal(true);
    const result = await localApi.fiscal.createFromServiceOrder(String(order.id));
    setIsPreparingFiscal(false);
    if (result.error || !result.data) {
      toast.error(result.error?.message || 'Não foi possível preparar a NFS-e.');
      return;
    }
    toast.success('Rascunho de NFS-e criado e vinculado à O.S. Nenhum lançamento financeiro foi duplicado.');
  };

  const handleOpenNewChange = (open: boolean) => {
    setOpenNew(open);
    if (!open) {
      resetForm();
      setIsEditing(false);
      setEditingOrderId(undefined);
    }
  };

  const filteredOS = serviceOrders.filter(os => {
    const matchesStore = selectedStoreIds.includes(os.storeId);
    const matchesSearch = searchTerm === '' ||
      String(os.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(os.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(os.customerPhone || '').includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || os.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || os.priority === priorityFilter;

    return matchesStore && matchesSearch && matchesStatus && matchesPriority;
  });

  // Render form function
  const renderForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="store" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loja *</Label>
            <Select value={formData.storeId} onValueChange={(v) => setFormData({...formData, storeId: v})}>
              <SelectTrigger id="store" className="h-10">
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.filter(s => s.company_id === selectedCompanyId).map(store => (
                  <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente *</Label>
            <CustomerSelector
              customers={customers}
              value={formData.customerId}
              onValueChange={(v) => setFormData({...formData, customerId: v})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="serviceType" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de Serviço</Label>
            <Select value={formData.serviceType} onValueChange={(v) => setFormData({...formData, serviceType: v})}>
              <SelectTrigger id="serviceType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="montagem">Montagem</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
                <SelectItem value="conserto">Conserto</SelectItem>
                <SelectItem value="limpeza">Limpeza</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prioridade</Label>
            <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="deliveryDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Data de Entrega</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="deliveryDate"
                type="date"
                className="pl-9"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({...formData, deliveryDate: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="total" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Valor Total (R$)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="total"
                type="number"
                placeholder="0,00"
                className="pl-9"
                value={formData.total}
                onChange={(e) => setFormData({...formData, total: e.target.value})}
              />
            </div>
          </div>
        </div>

        <Separator className="my-2" />

        <div className="space-y-2">
          <Label htmlFor="product" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produto/Armação</Label>
          <Input
            id="product"
            placeholder="Ex: Ray-Ban RB2140"
            value={formData.product}
            onChange={(e) => setFormData({...formData, product: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lens" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lentes</Label>
          <Input
            id="lens"
            placeholder="Ex: Varilux Comfort"
            value={formData.lens}
            onChange={(e) => setFormData({...formData, lens: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lab" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Laboratório</Label>
            <Select value={formData.lab} onValueChange={(v) => setFormData({...formData, lab: v})}>
              <SelectTrigger id="lab">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {laboratories.map(lab => (
                  <SelectItem key={lab.id} value={lab.name}>{lab.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="technician" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Técnico</Label>
            <Select value={formData.technicianId} onValueChange={(v) => setFormData({...formData, technicianId: v})}>
              <SelectTrigger id="technician">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observações</Label>
          <Textarea
            id="description"
            placeholder="Observações adicionais sobre o serviço..."
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
          <h4 className="font-bold text-sm mb-4 flex items-center gap-2 text-primary">
            <Eye className="h-4 w-4" /> Receita Óptica
                    </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prescriptionDate" className="text-[10px] font-bold text-muted-foreground uppercase">Emissão da receita</Label>
              <Input id="prescriptionDate" type="date" value={formData.prescriptionDate} onChange={(e) => setFormData({...formData, prescriptionDate: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prescriptionValidUntil" className="text-[10px] font-bold text-muted-foreground uppercase">Validade da receita</Label>
              <Input id="prescriptionValidUntil" type="date" value={formData.prescriptionValidUntil} onChange={(e) => setFormData({...formData, prescriptionValidUntil: e.target.value})} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">Olho Direito (OD)</Label>
              <div className="grid grid-cols-4 gap-2">
                <Input placeholder="ESF" value={formData.rightEye.sph} onChange={(e) => setFormData({...formData, rightEye: {...formData.rightEye, sph: e.target.value}})} />
                <Input placeholder="CIL" value={formData.rightEye.cyl} onChange={(e) => setFormData({...formData, rightEye: {...formData.rightEye, cyl: e.target.value}})} />
                <Input placeholder="EIXO" value={formData.rightEye.axis} onChange={(e) => setFormData({...formData, rightEye: {...formData.rightEye, axis: e.target.value}})} />
                <Input placeholder="ADD" value={formData.rightEye.add} onChange={(e) => setFormData({...formData, rightEye: {...formData.rightEye, add: e.target.value}})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">Olho Esquerdo (OE)</Label>
              <div className="grid grid-cols-4 gap-2">
                <Input placeholder="ESF" value={formData.leftEye.sph} onChange={(e) => setFormData({...formData, leftEye: {...formData.leftEye, sph: e.target.value}})} />
                <Input placeholder="CIL" value={formData.leftEye.cyl} onChange={(e) => setFormData({...formData, leftEye: {...formData.leftEye, cyl: e.target.value}})} />
                <Input placeholder="EIXO" value={formData.leftEye.axis} onChange={(e) => setFormData({...formData, leftEye: {...formData.leftEye, axis: e.target.value}})} />
                <Input placeholder="ADD" value={formData.leftEye.add} onChange={(e) => setFormData({...formData, leftEye: {...formData.leftEye, add: e.target.value}})} />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">D. Pupilar</Label>
                <Input placeholder="mm" value={formData.pupillaryDistance} onChange={(e) => setFormData({...formData, pupillaryDistance: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Diag. Maior</Label>
                <Input placeholder="mm" value={formData.largestDiagonal} onChange={(e) => setFormData({...formData, largestDiagonal: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Alt. Vertical</Label>
                <Input placeholder="mm" value={formData.verticalHeight} onChange={(e) => setFormData({...formData, verticalHeight: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Aro</Label>
                <Input placeholder="mm" value={formData.frameSize} onChange={(e) => setFormData({...formData, frameSize: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Ponte</Label>
                <Input placeholder="mm" value={formData.bridgeSize} onChange={(e) => setFormData({...formData, bridgeSize: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Aro + Ponte</Label>
                <Input placeholder="mm" value={formData.frameAndBridge} onChange={(e) => setFormData({...formData, frameAndBridge: e.target.value})} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Show empty state if no service orders exist
  if (serviceOrders.length === 0) {
    return (
      <div className="space-y-6">
        <FinancialInfoTip className="px-3 py-2.5" title="Dica das O.S.">Crie a ordem com cliente, loja e prazo. Depois, avance as etapas para manter laboratório, produção e entrega sincronizados.</FinancialInfoTip>
        <EmptyState
          icon={FileText}
          title="Nenhuma ordem de serviço"
          description="Crie ordens de serviço para acompanhar trabalhos"
          action={
            <Button onClick={() => setOpenNew(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova OS
            </Button>
          }
        />
        <Dialog open={openNew} onOpenChange={handleOpenNewChange}>
          <DialogContent className="!flex max-h-[92vh] max-w-6xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-background p-0">
            <DialogHeader className="shrink-0 border-b border-border/70 bg-card px-4 py-3 sm:px-5">
              <DialogTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
                <Plus className="h-5 w-5 text-primary" />
                Nova Ordem de Serviço
              </DialogTitle>
            </DialogHeader>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <ServiceOrderForm form={formData} onChange={updateForm} stores={stores} customers={customers} employees={employees} laboratories={laboratories} selectedCompanyId={selectedCompanyId} selectedStoreIds={selectedStoreIds} editing={isEditing} />
            </div>
            <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-2 border-t border-border/70 bg-card/95 p-3.5 backdrop-blur sm:flex-row sm:justify-end sm:p-4">
              <Button variant="outline" onClick={() => setOpenNew(false)} className="h-9">
                <X className="mr-2 h-4 w-4" /> Cancelar
              </Button>
              <Button
                className="h-11 w-full gap-2 px-5 font-bold shadow-md shadow-primary/20 sm:h-9 sm:w-auto"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Gerar O.S.
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }


  const handleStatusUpdate = async (status: string, order = selectedOS) => {
    if (!order) return;
    try {
      const previousStatus = order.status || 'opened';
      const { data, error } = await localApi.operations.updateServiceOrderStatus(order.id, status);
      if (error) throw error;
      if (!data?.changed) {
        toast.info(`A O.S. já está em ${serviceOrderStatusLabel(status)}.`);
        return;
      }
      if (selectedOS?.id === order.id) setSelectedOS({ ...selectedOS, status, timeline: [...(Array.isArray(order.timeline) ? order.timeline : []), { action: `Status alterado de ${serviceOrderStatusLabel(previousStatus)} para ${serviceOrderStatusLabel(status)}`, status, user: data.changed_by || 'Usuário atual', date: data.changed_at || new Date().toISOString() }] });
      toast.success(`Etapa da O.S. atualizada para: ${serviceOrderStatusLabel(status)}.`);
      await refetchOrders();
    } catch (error: any) {
      console.error('Error updating service order status:', error);
      toast.error('Erro ao atualizar etapa: ' + (error.message || 'tente novamente.'));
    }
  };

  const handleDropStatus = async (status: string) => {
    if (!draggingOrderId) return;
    const order = serviceOrders.find((item) => item.id === draggingOrderId);
    setDraggingOrderId(null);
    setDragOverStatus(null);
    if (order) await handleStatusUpdate(status, order);
  };

  const handleDelete = async () => {
    if (!selectedOS) return;

    try {
      const { error } = await localApi
        .from('service_orders')
        .delete()
        .eq('id', selectedOS.id);

      if (error) throw error;

      toast.success(`O.S. ${selectedOS.id} excluída com sucesso!`);
      setSelectedOS(null);
      await refetchOrders();
    } catch (error: any) {
      console.error('Error deleting service order:', error);
      toast.error('Erro ao excluir ordem de serviço: ' + error.message);
    } finally {
      setConfirmDeleteOS(false);
    }
  };

  const stats = [
    { label: 'Abertas', value: filteredOS.filter(o => o.status === 'opened').length, color: 'text-slate-500', icon: FileText },
    { label: 'Em produção', value: filteredOS.filter(o => o.status === 'in_production').length, color: 'text-blue-500', icon: Wrench },
    { label: 'Prontas', value: filteredOS.filter(o => o.status === 'ready').length, color: 'text-emerald-500', icon: CheckCircle },
    { label: 'Atrasadas', value: filteredOS.filter(o => o.status === 'overdue').length, color: 'text-destructive', icon: Clock },
    { label: 'Aguardando laboratório', value: filteredOS.filter(o => o.status === 'waiting_lab').length, color: 'text-amber-500', icon: FlaskConical },
  ];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span><div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">Ordens de Serviço</h1><p className="text-xs text-muted-foreground sm:text-sm">Acompanhe produção, laboratório, prazos e entrega em um só lugar.</p></div></div>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center md:w-auto">
          <div className="relative min-w-0 w-full flex-1 sm:min-w-[220px] md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar O.S., cliente ou telefone..."
              className="h-11 border-border/70 bg-background/80 pl-9 text-sm focus-visible:ring-primary/20 sm:h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-11 w-full gap-2 border-border/70 px-3 sm:h-9 sm:w-auto", (statusFilter !== 'all' || priorityFilter !== 'all') && "border-primary/40 bg-primary/5 text-primary")}>
                <Filter className="h-4 w-4" /> Filtros
                {(statusFilter !== 'all' || priorityFilter !== 'all') && (
                  <span className="flex h-2 w-2 rounded-full bg-primary" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="max-h-[min(75vh,520px)] w-[calc(100vw-1rem)] max-w-[320px] overflow-y-auto p-4" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Filtros Avançados</h4>
                  <p className="text-sm text-muted-foreground">Refine sua busca por ordens de serviço.</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        {SERVICE_ORDER_STATUS_OPTIONS.map((status) => <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prioridade</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todas as prioridades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as prioridades</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button className="h-11 w-full gap-2 px-4 font-semibold shadow-md shadow-primary/20 sm:h-9 sm:w-auto" onClick={() => { resetForm(); setIsEditing(false); setEditingOrderId(undefined); setOpenNew(true); }}>
            <Plus className="h-4 w-4" /> Nova O.S.
          </Button>
        </div>
      </div>

      <FinancialInfoTip className="px-3 py-2.5" title="Dica das O.S.">Use os filtros para localizar rapidamente uma ordem e acompanhe cada etapa pelo modo Tabela, Cards ou Kanban.</FinancialInfoTip>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-5">
        {stats.map((stat) => {
          const StatIcon = stat.icon;
          return <Card key={stat.label} className="group border-border/70 bg-card/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
            <CardContent className="flex items-center justify-between p-3.5 sm:p-4">
              <div className="min-w-0"><p className="break-words text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</p><p className={cn("mt-1 text-2xl font-bold", stat.color)}>{stat.value}</p></div>
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted/60 transition-transform group-hover:scale-105", stat.color)}><StatIcon className="h-4 w-4" /></span>
            </CardContent>
          </Card>;
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><p className="px-2 text-xs font-semibold text-foreground">Acompanhamento das ordens</p><p className="px-2 text-[11px] text-muted-foreground">Escolha a visualização mais adequada para sua rotina.</p></div>
        <Tabs value={view} onValueChange={(v: any) => setView(v)}>
          <TabsList className="h-9 bg-muted/60 p-1">
            <TabsTrigger value="table" className="h-7 gap-1.5 px-3 text-xs"><List className="h-3.5 w-3.5" /> Tabela</TabsTrigger>
            <TabsTrigger value="cards" className="h-7 gap-1.5 px-3 text-xs"><LayoutGrid className="h-3.5 w-3.5" /> Cards</TabsTrigger>
            <TabsTrigger value="kanban" className="h-7 gap-1.5 px-3 text-xs"><KanbanSquare className="h-3.5 w-3.5" /> Kanban</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === 'table' && (
          <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y divide-border/50 md:hidden">
              {filteredOS.map((os) => (
                <div key={os.id} className={cn("flex min-w-0 items-center gap-3 p-4 transition-colors active:bg-primary/5", selectedOS?.id === os.id && "bg-primary/10") }>
                  <button type="button" onClick={() => setSelectedOS(os)} className="min-w-0 flex-1 text-left" aria-label={`Visualizar O.S. ${os.id}`}>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0"><p className="font-mono text-xs font-bold text-primary">#{String(os.id).slice(0, 8).toUpperCase()}</p><p className="mt-1 truncate text-sm font-bold text-foreground">{os.customerName || 'Cliente não informado'}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{os.customerPhone || 'Sem telefone'}</p></div>
                      <StatusBadge status={os.status} variant="pill" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs min-[380px]:grid-cols-3">
                      <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prioridade</p><PriorityBadge priority={os.priority} /></div>
                      <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prazo</p><p className="truncate font-semibold text-foreground">{os.deliveryDate || 'Sem prazo'}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p><p className="font-bold text-primary">R$ {Number(os.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                    </div>
                  </button>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações da O.S. ${os.id}`} className="h-9 w-9 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setSelectedOS(os)}><Eye className="mr-2 h-4 w-4" /> Visualizar</DropdownMenuItem><DropdownMenuItem onSelect={() => handleEdit(os)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem><DropdownMenuItem onSelect={() => { setSelectedOS(os); setConfirmDeleteOS(true); }} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[860px]">
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 text-[10px] uppercase tracking-wider">O.S.</TableHead>
                    <TableHead className="h-10 text-[10px] uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="h-10 text-[10px] uppercase tracking-wider">Status</TableHead>
                    <TableHead className="h-10 text-[10px] uppercase tracking-wider">Prioridade</TableHead>
                    <TableHead className="h-10 text-[10px] uppercase tracking-wider">Prazo</TableHead>
                    <TableHead className="h-10 text-right text-[10px] uppercase tracking-wider">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOS.map((os) => (
                    <TableRow key={os.id} onClick={() => setSelectedOS(os)} className={cn("group cursor-pointer transition-all border-l-2 active:scale-[0.998]", selectedOS?.id === os.id ? "bg-primary/10 border-l-primary shadow-sm" : "border-l-transparent hover:bg-muted/50")}>
                      <TableCell className={cn("font-mono text-xs font-bold transition-colors", selectedOS?.id === os.id ? "text-primary" : "text-muted-foreground group-hover:text-primary")}>#{String(os.id).slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell className="min-w-[190px]"><div className="font-medium text-foreground">{os.customerName || 'Cliente não informado'}</div><div className="text-xs text-muted-foreground">{os.customerPhone || 'Sem telefone'}</div></TableCell>
                      <TableCell><StatusBadge status={os.status} variant="dot" /></TableCell>
                      <TableCell><PriorityBadge priority={os.priority} /></TableCell>
                      <TableCell><div className="flex items-center gap-1.5 whitespace-nowrap text-xs"><Calendar className="h-3 w-3 text-muted-foreground" /> {os.deliveryDate || 'Sem prazo'}</div></TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">R$ {Number(os.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações da O.S. ${os.id}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setSelectedOS(os)}><Eye className="mr-2 h-4 w-4" /> Visualizar</DropdownMenuItem><DropdownMenuItem onSelect={() => handleEdit(os)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem><DropdownMenuItem onSelect={() => { setSelectedOS(os); setConfirmDeleteOS(true); }} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'cards' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOS.map((os) => (
            <Card key={os.id} onClick={() => setSelectedOS(os)} className={cn("group cursor-pointer border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:scale-[0.98]", selectedOS?.id === os.id && "border-primary bg-primary/5 ring-2 ring-primary/10")}>
              <CardContent className="space-y-3.5 p-4 sm:p-5">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold tracking-widest text-primary">#{String(os.id).slice(0, 8).toUpperCase()}</span>
                  <StatusBadge status={os.status} variant="pill" />
                </div>
                <div>
                  <h3 className="text-base font-bold transition-colors group-hover:text-primary">{os.customerName || 'Cliente não informado'}</h3>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground"><User className="h-3 w-3" /> {os.technicianName || 'Sem técnico'}</p>
                </div>
                <div className="flex flex-col gap-3 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Prazo</span>
                    <span className="font-medium flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {os.deliveryDate}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">Valor</span>
                    <span className="font-bold text-primary">R$ {Number(os.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === 'kanban' && (
        <div className="flex h-[calc(100vh-400px)] min-h-[500px] gap-4 overflow-x-auto pb-4">
          {SERVICE_ORDER_STATUS_OPTIONS.map(({ id: status, label }) => (
            <div key={status} onDragOver={(event) => { event.preventDefault(); setDragOverStatus(status); }} onDragLeave={() => setDragOverStatus((current) => current === status ? null : current)} onDrop={(event) => { event.preventDefault(); void handleDropStatus(status); }} className={cn("flex w-[280px] min-w-[280px] flex-col gap-3 rounded-2xl border border-border/60 p-3 transition-colors", dragOverStatus === status ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted/20")}>

              <div className="mb-2 flex items-center justify-between px-2">
                <h4 className="font-bold text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</h4>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{filteredOS.filter((o) => o.status === status).length}</span>
              </div>
              <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
                {filteredOS.filter((o) => o.status === status).map((os) => (
                  <Card key={os.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggingOrderId(os.id); }} onDragEnd={() => { setDraggingOrderId(null); setDragOverStatus(null); }} onClick={() => setSelectedOS(os)} className={cn("cursor-grab border-2 shadow-sm transition-all duration-200 active:cursor-grabbing active:scale-[0.98]", draggingOrderId === os.id && "opacity-60", selectedOS?.id === os.id ? "scale-[1.02] border-primary bg-primary/10 ring-2 ring-primary/10" : "border-transparent bg-card hover:border-primary/30 hover:shadow-md")}>
                    <CardContent className="space-y-3 p-3">
                      <div className="flex items-start justify-between gap-2"><span className="text-[10px] font-mono font-bold text-primary">#{String(os.id).slice(0, 8).toUpperCase()}</span><PriorityBadge priority={os.priority} /></div>
                      <p className="text-sm font-bold leading-tight">{os.customerName || 'Cliente não informado'}</p>
                      <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {os.deliveryDate || 'Sem prazo'}</span><span className="font-bold text-foreground">R$ {Number(os.total || 0).toLocaleString('pt-BR')}</span></div>
                      <div onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" className="h-8 w-full justify-between gap-2 text-xs"><span>Alterar etapa</span><span className="text-muted-foreground">{label}</span></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-64"><DropdownMenuLabel>Movimentar O.S.</DropdownMenuLabel><DropdownMenuSeparator />{SERVICE_ORDER_STATUS_OPTIONS.map((nextStatus) => <DropdownMenuItem key={nextStatus.id} disabled={nextStatus.id === status} onSelect={() => handleStatusUpdate(nextStatus.id, os)}>{nextStatus.label}{nextStatus.id === status ? ' (atual)' : ''}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredOS.filter((o) => o.status === status).length === 0 && <div className="rounded-lg border border-dashed border-border/70 px-3 py-8 text-center text-xs text-muted-foreground">Nenhuma O.S. nesta etapa.</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceOrderViewer
        order={selectedOS}
        company={companies.find((company: any) => company.id === selectedOS?.companyId) || companies.find((company: any) => company.id === selectedCompanyId)}
        store={stores.find((store: any) => store.id === selectedOS?.storeId)}
        onOpenChange={(open) => !open && setSelectedOS(null)}
        onEdit={() => handleEdit()}
        onDelete={() => setConfirmDeleteOS(true)}
        onStatusChange={(status) => handleStatusUpdate(status, selectedOS)}
        onPrepareFiscal={() => void handlePrepareFiscal(selectedOS)}
        isPreparingFiscal={isPreparingFiscal}
      />

      <Dialog open={openNew} onOpenChange={handleOpenNewChange}>
        <DialogContent className="!flex max-h-[92vh] max-w-6xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-background p-0">
          <DialogHeader className="shrink-0 border-b border-border/70 bg-card px-4 py-3 sm:px-5">
            <DialogTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
              {isEditing ? <Edit className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {isEditing ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
            </DialogTitle>
          </DialogHeader>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            <ServiceOrderForm form={formData} onChange={updateForm} stores={stores} customers={customers} employees={employees} laboratories={laboratories} selectedCompanyId={selectedCompanyId} selectedStoreIds={selectedStoreIds} editing={isEditing} />
          </div>

          <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-2 border-t border-border/70 bg-card/95 p-3.5 backdrop-blur sm:flex-row sm:justify-end sm:p-4">
            <Button variant="outline" className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => setOpenNew(false)}>
              <X className="h-4 w-4 mr-2" /> Cancelar
            </Button>
            <Button
              className="h-11 w-full gap-2 px-5 font-bold shadow-md shadow-primary/20 sm:h-9 sm:w-auto"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> {isEditing ? 'Salvar Alterações' : 'Gerar O.S.'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ServiceOrderCompletionDialog
        open={!!completedOS}
        onOpenChange={(open) => !open && setCompletedOS(null)}
        os={completedOS}
        company={companies.find((company: any) => company.id === completedOS?.companyId) || companies.find((company: any) => company.id === selectedCompanyId)}
        store={stores.find((store: any) => store.id === completedOS?.storeId)}
      />

          {/* Confirmação explícita para excluir a O.S. */}
      <AlertDialog open={confirmDeleteOS} onOpenChange={setConfirmDeleteOS}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta O.S.?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A ordem de serviço será removida permanentemente
              junto com seu histórico. Tem certeza de que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter O.S.</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
