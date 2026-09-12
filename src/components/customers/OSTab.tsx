import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Calendar, CheckCircle, Clock, Edit, FileText, Plus, Save, Trash2, User, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEmployees, useLaboratories } from '@/hooks/useLocalData';
import { ServiceOrderForm, createServiceOrderForm, type ServiceOrderFormState } from '@/components/service-orders/ServiceOrderForm';
import { ServiceOrderCompletionDialog } from '@/components/service-orders/ServiceOrderCompletionDialog';
import { ServiceOrderViewer } from '@/components/service-orders/ServiceOrderViewer';
import { formatDateTime, formatMoney, useCreateOrUpdateCustomerServiceOrder, useCustomerServiceOrders, useDeleteCustomerServiceOrder } from '@/hooks/useCustomerData';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { localApi } from '@/lib/localApi';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { serviceOrderStatusLabel } from '@/lib/serviceOrderStatus';

interface OSTabProps {
  customer: any;
  autoOpenNew?: boolean;
}

const initialForm = (storeId = '', customerId = '') => createServiceOrderForm(storeId, customerId);

export function OSTab({ customer, autoOpenNew }: OSTabProps) {
  const { stores, companies, selectedStoreIds, selectedCompanyId } = useGlobalFilter();
  const { data: customerOS = [], isLoading } = useCustomerServiceOrders(customer?.id);
  const { data: employees = [] } = useEmployees();
  const { data: laboratories = [] } = useLaboratories();
  const queryClient = useQueryClient();
  const saveOrder = useCreateOrUpdateCustomerServiceOrder(customer);
  const deleteOrder = useDeleteCustomerServiceOrder(customer?.id);

  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [newOSOpen, setNewOSOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [completedOS, setCompletedOS] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ServiceOrderFormState>(initialForm(selectedStoreIds[0] || '', customer?.id || ''));

  useEffect(() => {
    if (autoOpenNew) setNewOSOpen(true);
  }, [autoOpenNew]);

  const filtered = customerOS.filter((os: any) => {
    const term = search.toLowerCase();
    return !term || String(os.id || '').toLowerCase().includes(term) || String(os.technicianName || '').toLowerCase().includes(term) || String(os.serviceType || '').toLowerCase().includes(term);
  });

  const openNew = () => {
    setEditingId(undefined);
    setForm(initialForm(selectedStoreIds[0] || '', customer?.id || ''));
    setNewOSOpen(true);
  };

  const openEdit = (order: any) => {
    setEditingId(order.id);
    setForm({
      ...initialForm(order.storeId || selectedStoreIds[0] || '', customer?.id || ''),
      storeId: order.storeId || selectedStoreIds[0] || '',
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
      technicianId: order.technicianId || '',
      productId: order.productId || order.product_id || '',
      productQuantity: Number(order.productQuantity || order.product_quantity || 1),
      product: order.product || '',
      lens: order.lens || '',
      labId: order.labId || '',
      total: String(order.total ?? ''),
      paidAmount: String(order.paidAmount ?? 0),
      paymentMethod: order.paymentMethod || order.payment_method || 'pix',
      paymentNote: order.paymentNote || '',
      description: order.description || '',
      internalNotes: order.internalNotes || order.internal_notes || '',
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
      leftEyeNear: order.prescription?.leftEyeNear || '',
    });
    setSelectedOS(null);
    setNewOSOpen(true);
  };

  const handleSave = async () => {
    const total = Number(form.total || 0);
    const paidAmount = Number(form.paidAmount || 0);
    if (!form.storeId) {
      toast.error('Selecione a loja da O.S.');
      return;
    }
    if (total < 0 || paidAmount < 0 || paidAmount > total) {
      toast.error('Confira os valores: o pagamento não pode superar o total.');
      return;
    }
    try {
      const savedOrder = await saveOrder.mutateAsync({ id: editingId, data: form });
      const store = stores.find((item: any) => item.id === form.storeId);
      const technician = employees.find((item: any) => item.id === form.technicianId);
      const laboratory = laboratories.find((item: any) => item.id === form.labId);
      const totalValue = Number(form.total || 0);
      const paidValue = Number(form.paidAmount || 0);
      const completedView = {
        ...savedOrder,
        ...form,
        id: savedOrder?.id || editingId || `OS-${Date.now()}`,
        companyId: savedOrder?.company_id || selectedCompanyId,
        productId: form.productId,
        productQuantity: form.productQuantity,
        storeName: store?.name || 'Loja não informada',
        customerName: customer?.name || 'Cliente não informado',
        customerPhone: customer?.phone || customer?.whatsapp || '',
        technicianName: technician?.name || '',
        lab: laboratory?.name || form.lab || '',
        deliveryDate: form.deliveryDate || form.estimatedDeadline || 'A definir',
        total: totalValue,
        paidAmount: paidValue,
        balance: Math.max(totalValue - paidValue, 0),
        prescription: { rightEye: form.rightEye, leftEye: form.leftEye, pupillaryDistance: form.pupillaryDistance, largestDiagonal: form.largestDiagonal, verticalHeight: form.verticalHeight, frameSize: form.frameSize, bridgeSize: form.bridgeSize, frameAndBridge: form.frameAndBridge, opticalCenterHeight: form.opticalCenterHeight, rightEyeFar: form.rightEyeFar, rightEyeNear: form.rightEyeNear, leftEyeFar: form.leftEyeFar, leftEyeNear: form.leftEyeNear },
      };
      toast.success(editingId ? 'O.S. atualizada com sucesso!' : 'O.S. criada com sucesso!');
      if (!editingId) setCompletedOS(completedView);
      setNewOSOpen(false);
      setEditingId(undefined);
      setForm(initialForm(selectedStoreIds[0] || '', customer?.id || ''));
    } catch (error: any) {
      toast.error('Erro ao salvar O.S.: ' + (error.message || 'verifique os dados.'));
    }
  };

  const handleDelete = async () => {
    if (!selectedOS?.id) return;
    try {
      await deleteOrder.mutateAsync(selectedOS.id);
      toast.success('O.S. excluida com sucesso!');
      setSelectedOS(null);
      setDeleteConfirmOpen(false);
    } catch (error: any) {
      toast.error('Erro ao excluir O.S.: ' + (error.message || 'tente novamente.'));
    }
  };

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
      await queryClient.invalidateQueries({ queryKey: ['customer-service-orders', customer?.id] });
      await queryClient.invalidateQueries({ queryKey: ['service_orders'] });
    } catch (error: any) {
      toast.error('Erro ao atualizar etapa: ' + (error.message || 'tente novamente.'));
    }
  };


  return (
    <div className="space-y-4">
      <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Input placeholder="Buscar O.S., técnico ou serviço..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10" />
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <PermissionGate module="service_orders" action="create">
          <Button className="h-11 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openNew}><Plus className="h-4 w-4" /> Abrir O.S.</Button>
        </PermissionGate>
      </div>

      <div className="space-y-2 sm:hidden">
        {filtered.map((os: any) => (
          <button key={os.id} type="button" onClick={() => setSelectedOS(os)} className="w-full rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm active:bg-muted/50">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-primary">#{String(os.id).slice(0, 8).toUpperCase()}</p><p className="mt-1 font-semibold text-foreground">{formatDateTime(os.date)}</p></div><StatusBadge status={os.status} variant="dot" /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs"><div><p className="text-muted-foreground">Serviço</p><p className="font-semibold capitalize break-words">{os.serviceType || '-'}</p></div><div><p className="text-muted-foreground">Prioridade</p><PriorityBadge priority={os.priority} /></div><div><p className="text-muted-foreground">Total</p><p className="font-bold text-primary">{formatMoney(os.total)}</p></div><div className="text-right"><span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70"><ArrowRight className="h-4 w-4" /></span></div></div>
          </button>
        ))}
        {isLoading && [1, 2, 3].map(row => <div key={`os-mobile-skeleton-${row}`} className="h-28 animate-pulse rounded-xl bg-muted" />)}
        {!isLoading && filtered.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma O.S. encontrada.</div>}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>O.S.</TableHead><TableHead>Abertura</TableHead><TableHead>Status</TableHead><TableHead>Prioridade</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Serviço</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((os: any) => (
              <TableRow key={os.id} className="hover:bg-muted/60 transition-colors cursor-pointer group" onClick={() => setSelectedOS(os)}>
                <TableCell className="font-mono font-bold text-foreground">#{String(os.id).slice(0, 8).toUpperCase()}</TableCell>
                <TableCell className="text-sm font-medium">{formatDateTime(os.date)}</TableCell>
                <TableCell><StatusBadge status={os.status} variant="dot" /></TableCell>
                <TableCell><PriorityBadge priority={os.priority} /></TableCell>
                <TableCell className="text-right font-bold text-foreground">{formatMoney(os.total)}</TableCell>
                <TableCell className="text-sm font-medium capitalize flex items-center gap-2"><Wrench className="h-3 w-3 text-muted-foreground" /> {os.serviceType || '-'}</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-10 w-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><ArrowRight className="h-4 w-4 text-muted-foreground" /></Button></TableCell>
              </TableRow>
            ))}
            {isLoading && [1, 2, 3].map(row => <TableRow key={`os-skeleton-${row}`}><TableCell colSpan={7} className="h-12"><div className="h-4 w-full animate-pulse rounded bg-muted" /></TableCell></TableRow>)}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Nenhuma O.S. encontrada.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <ServiceOrderViewer
        order={selectedOS}
        company={companies.find((company: any) => company.id === selectedOS?.companyId) || companies.find((company: any) => company.id === selectedCompanyId)}
        store={stores.find((store: any) => store.id === selectedOS?.storeId)}
        onOpenChange={(open) => !open && setSelectedOS(null)}
        onEdit={() => selectedOS && openEdit(selectedOS)}
        onDelete={() => setDeleteConfirmOpen(true)}
        onStatusChange={(status) => handleStatusUpdate(status, selectedOS)}
      />

      <Dialog open={newOSOpen} onOpenChange={(open) => {
        setNewOSOpen(open);
        if (!open) {
          setEditingId(undefined);
          setForm(initialForm(selectedStoreIds[0] || '', customer?.id || ''));
        }
      }}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-hidden rounded-2xl border border-border/70 bg-background p-0">
          <div className="border-b border-border/60 bg-card p-5"><DialogTitle>{editingId ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</DialogTitle></div>
          <div className="custom-scrollbar max-h-[calc(92vh-10rem)] overflow-y-auto p-4 sm:p-6">
            <ServiceOrderForm
              form={form}
              onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
              stores={stores}
              employees={employees}
              laboratories={laboratories}
              selectedCompanyId={selectedCompanyId}
              selectedStoreIds={selectedStoreIds}
              customer={customer}
              showCustomerSelector={false}
              editing={Boolean(editingId)}
            />
          </div>
          <DialogFooter className="sticky bottom-0 flex flex-col gap-2 border-t border-border/60 bg-card/95 p-3.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <Button variant="ghost" className="h-11 w-full sm:w-auto" onClick={() => setNewOSOpen(false)}><X className="mr-2 h-4 w-4" /> Cancelar</Button>
            <Button className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={handleSave} disabled={saveOrder.isPending}><Save className="mr-2 h-4 w-4" /> {saveOrder.isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Abrir Ordem de Serviço'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServiceOrderCompletionDialog
        open={!!completedOS}
        onOpenChange={(open) => !open && setCompletedOS(null)}
        os={completedOS}
        company={companies.find((company: any) => company.id === completedOS?.companyId) || companies.find((company: any) => company.id === selectedCompanyId)}
        store={stores.find((store: any) => store.id === completedOS?.storeId)}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="h-5 w-5" /> Confirmar exclusão</DialogTitle></DialogHeader>
          <div className="py-4 text-muted-foreground">Tem certeza que deseja excluir a O.S. <span className="font-bold text-foreground">#{selectedOS ? String(selectedOS.id).slice(0, 8).toUpperCase() : ''}</span>?</div>
          <DialogFooter><Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={handleDelete} disabled={deleteOrder.isPending}>Excluir permanentemente</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: any) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{options.map((option: any) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>;
}

function Field({ label, type = 'text', value, onChange }: any) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={e => onChange(e.target.value)} /></div>;
}

function Info({ icon: Icon, label, value, strong }: any) {
  return <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span><span className={`text-sm ${strong ? 'font-bold text-foreground' : 'font-semibold'}`}>{value}</span></div>;
}

function InfoText({ label, value }: any) {
  return <div><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p><p className="text-sm font-semibold text-foreground">{value || '-'}</p></div>;
}

function Block({ title, children }: any) {
  return <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm"><h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-4 mb-4 flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> {title}</h4><div className="grid grid-cols-2 gap-4">{children}</div></div>;
}

function PrescriptionView({ order }: any) {
  if (!order?.prescription) return null;
  const p = order.prescription;
  return <Block title="Receita e medidas"><InfoText label="OD Esf/Cil/Eixo/Add" value={`${p.rightEye?.sph || '-'} / ${p.rightEye?.cyl || '-'} / ${p.rightEye?.axis || '-'} / ${p.rightEye?.add || '-'}`} /><InfoText label="OE Esf/Cil/Eixo/Add" value={`${p.leftEye?.sph || '-'} / ${p.leftEye?.cyl || '-'} / ${p.leftEye?.axis || '-'} / ${p.leftEye?.add || '-'}`} /><InfoText label="Dist. Pupilar" value={p.pupillaryDistance} /><InfoText label="Altura vertical" value={p.verticalHeight} /><InfoText label="Aro/Ponte" value={`${p.frameSize || '-'}/${p.bridgeSize || '-'}`} /><InfoText label="Alt. Centro optico" value={p.opticalCenterHeight} /></Block>;
}

function PrescriptionForm({ form, setForm }: any) {
  const setEye = (eye: 'rightEye' | 'leftEye', key: string, value: string) => setForm({ ...form, [eye]: { ...form[eye], [key]: value } });
  return <div className="bg-muted/40 p-6 rounded-xl border border-border/70 space-y-6"><h4 className="section-title">Prescrição óptica e medidas</h4><div className="grid grid-cols-2 gap-6"><EyeFields title="Olho direito (OD)" eye={form.rightEye} onChange={(k: string, v: string) => setEye('rightEye', k, v)} /><EyeFields title="Olho esquerdo (OE)" eye={form.leftEye} onChange={(k: string, v: string) => setEye('leftEye', k, v)} /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Distância pupilar" value={form.pupillaryDistance} onChange={(v: string) => setForm({ ...form, pupillaryDistance: v })} /><Field label="Diagonal maior" value={form.largestDiagonal} onChange={(v: string) => setForm({ ...form, largestDiagonal: v })} /><Field label="Altura vertical" value={form.verticalHeight} onChange={(v: string) => setForm({ ...form, verticalHeight: v })} /><Field label="Alt. centro óptico" value={form.opticalCenterHeight} onChange={(v: string) => setForm({ ...form, opticalCenterHeight: v })} /><Field label="Aro" value={form.frameSize} onChange={(v: string) => setForm({ ...form, frameSize: v })} /><Field label="Ponte" value={form.bridgeSize} onChange={(v: string) => setForm({ ...form, bridgeSize: v })} /><Field label="Aro + ponte" value={form.frameAndBridge} onChange={(v: string) => setForm({ ...form, frameAndBridge: v })} /><Field label="OD/OE ACO" value={form.rightEyeFar} onChange={(v: string) => setForm({ ...form, rightEyeFar: v })} /></div></div>;
}

function EyeFields({ title, eye, onChange }: any) {
  return <div className="space-y-2"><p className="text-[10px] font-bold text-muted-foreground uppercase">{title}</p><div className="grid grid-cols-4 gap-2"><Input placeholder="ESF" value={eye.sph} onChange={e => onChange('sph', e.target.value)} /><Input placeholder="CIL" value={eye.cyl} onChange={e => onChange('cyl', e.target.value)} /><Input placeholder="EIXO" value={eye.axis} onChange={e => onChange('axis', e.target.value)} /><Input placeholder="ADD" value={eye.add} onChange={e => onChange('add', e.target.value)} /></div></div>;
}
