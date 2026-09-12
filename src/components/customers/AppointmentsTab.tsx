import { useEffect, useState } from 'react';
import { AlertCircle, Calendar, Clock, Edit, MapPin, Plus, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEmployees } from '@/hooks/useLocalData';
import { formatDateTime, useCustomerAppointmentMutations, useCustomerAppointments } from '@/hooks/useCustomerData';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { PermissionGate } from '@/components/shared/PermissionGate';

interface AppointmentsTabProps {
  customer: any;
  autoOpenNew?: boolean;
}

const localDateIso = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialForm = (storeId = '') => ({
  storeId,
  professionalId: '',
  professionalName: '',
  date: localDateIso(),
  time: '08:00',
  type: 'consulta',
  status: 'scheduled',
  priority: 'medium',
  notes: '',
});

export function AppointmentsTab({ customer, autoOpenNew }: AppointmentsTabProps) {
  const { stores, selectedStoreIds } = useGlobalFilter();
  const { data: appointments = [], isLoading } = useCustomerAppointments(customer?.id);
  const { data: employees = [] } = useEmployees();
  const mutations = useCustomerAppointmentMutations(customer);

  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<any>(null);
  const [form, setForm] = useState<any>(initialForm(selectedStoreIds[0] || ''));

  useEffect(() => {
    if (autoOpenNew) setNewAppointmentOpen(true);
  }, [autoOpenNew]);

  const openCreate = () => {
    setEditingAppointment(null);
    setForm(initialForm(selectedStoreIds[0] || ''));
    setNewAppointmentOpen(true);
  };

  const openEdit = (appointment: any) => {
    setEditingAppointment(appointment);
    setForm({
      storeId: appointment.storeId || selectedStoreIds[0] || '',
      professionalId: appointment.professionalId || '',
      professionalName: appointment.professional || appointment.professional_name || '',
      date: appointment.date || localDateIso(),
      time: appointment.time || '08:00',
      type: appointment.type || 'consulta',
      status: appointment.status || 'scheduled',
      priority: appointment.priority || 'medium',
      notes: appointment.notes || '',
    });
    setNewAppointmentOpen(true);
  };

  const handleSave = async () => {
    if (!form.storeId) {
      toast.error('Selecione a loja do agendamento.');
      return;
    }
    if (!form.date || !form.time) {
      toast.error('Informe data e horário.');
      return;
    }
    try {
      await mutations.save.mutateAsync({ id: editingAppointment?.id, data: form });
      toast.success(editingAppointment ? 'Agendamento atualizado!' : 'Agendamento criado com sucesso!');
      setNewAppointmentOpen(false);
      setEditingAppointment(null);
    } catch (error: any) {
      toast.error('Erro ao salvar agendamento: ' + (error.message || 'verifique os dados.'));
    }
  };

  const handleDelete = async () => {
    try {
      await mutations.remove.mutateAsync(selectedForDelete.id);
      toast.success('Agendamento excluido com sucesso!');
      setDeleteConfirmOpen(false);
      setSelectedForDelete(null);
    } catch (error: any) {
      toast.error('Erro ao excluir agendamento: ' + (error.message || 'tente novamente.'));
    }
  };

  const handleStatus = async (appointment: any, status: string) => {
    try {
      await mutations.save.mutateAsync({ id: appointment.id, data: { ...appointment, storeId: appointment.storeId, professionalName: appointment.professional, status } });
      toast.success('Status atualizado.');
    } catch (error: any) {
      toast.error('Erro ao atualizar status: ' + (error.message || 'tente novamente.'));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-muted/40 p-4 rounded-2xl border border-border/70">
        <div>
          <h3 className="font-bold text-foreground">Horários agendados</h3>
          <p className="text-xs text-muted-foreground">Histórico e próximos agendamentos do cliente</p>
        </div>
        <PermissionGate module="appointments" action="create">
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo Agendamento
          </Button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isLoading && [1, 2].map(row => <div key={`appointment-skeleton-${row}`} className="h-48 animate-pulse rounded-xl bg-muted" />)}
        {appointments.map((apt: any) => (
          <div key={apt.id} className="bg-card border border-border/70 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${apt.status === 'scheduled' || apt.status === 'confirmed' ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground'}`}>
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground capitalize">{apt.type || 'Atendimento'}</p>
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 uppercase tracking-widest"><Clock className="h-3 w-3" /> {formatDateTime(apt.date)} as {apt.time}</p>
                </div>
              </div>
              <StatusBadge status={apt.status} variant="dot" />
            </div>
            <div className="space-y-3 pt-4 border-t border-border/50">
              <Line icon={User} value={apt.professional} />
              <Line icon={MapPin} value={apt.storeName || 'Loja não informada'} />
              {apt.notes && <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-lg">{apt.notes}</p>}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <PermissionGate module="appointments" action="edit"><Button variant="outline" className="h-9 gap-2 text-xs" onClick={() => openEdit(apt)}><Edit className="h-3.5 w-3.5" /> Editar</Button></PermissionGate>
              <PermissionGate module="appointments" action="edit"><Button variant="outline" className="h-9 gap-2 border-emerald-500/30 text-xs text-emerald-600" onClick={() => handleStatus(apt, apt.status === 'completed' ? 'scheduled' : 'completed')}>{apt.status === 'completed' ? 'Reabrir' : 'Concluir'}</Button></PermissionGate>
              <PermissionGate module="appointments" action="edit"><Button variant="outline" className="h-9 gap-2 border-red-500/30 text-xs text-red-600" onClick={() => handleStatus(apt, 'cancelled')}>Cancelar</Button></PermissionGate>
              <PermissionGate module="appointments" action="delete"><Button variant="ghost" className="h-9 text-xs text-red-500 hover:bg-red-500/10" onClick={() => { setSelectedForDelete(apt); setDeleteConfirmOpen(true); }}><Trash2 className="h-4 w-4" /></Button></PermissionGate>
            </div>
          </div>
        ))}
        {!isLoading && appointments.length === 0 && (
          <div className="col-span-2 h-40 flex flex-col items-center justify-center text-muted-foreground bg-muted/40 rounded-2xl border-2 border-dashed border-border/70">
            <Calendar className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm font-medium">Nenhum agendamento encontrado.</p>
          </div>
        )}
      </div>

      <Dialog open={newAppointmentOpen} onOpenChange={setNewAppointmentOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-hidden rounded-2xl border border-border/70 bg-background p-0">
          <div className="border-b border-border/60 bg-card p-5"><DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle></div>
          <div className="max-h-[calc(90vh-10rem)] space-y-4 overflow-y-auto bg-background p-5">
            <SelectField label="Serviço / procedimento" value={form.type} onChange={(v: string) => setForm({ ...form, type: v })} options={[{ id: 'consulta', name: 'Consulta' }, { id: 'exame', name: 'Exame de vista' }, { id: 'ajuste', name: 'Ajuste de óculos' }, { id: 'retirada', name: 'Retirada' }]} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Data" type="date" value={form.date} onChange={(v: string) => setForm({ ...form, date: v })} /><Field label="Horário" type="time" value={form.time} onChange={(v: string) => setForm({ ...form, time: v })} /></div>
            <SelectField label="Profissional" value={form.professionalId || form.professionalName || 'none'} onChange={(v: string) => { const employee = employees.find((e: any) => e.id === v); setForm({ ...form, professionalId: employee?.id || '', professionalName: employee?.name || (v === 'none' ? '' : v) }); }} options={[{ id: 'none', name: 'Não informado' }, ...employees.map((e: any) => ({ id: e.id, name: e.name }))]} />
            <SelectField label="Unidade / Loja" value={form.storeId} onChange={(v: string) => setForm({ ...form, storeId: v })} options={stores.filter((s: any) => selectedStoreIds.length === 0 || selectedStoreIds.includes(s.id)).map((s: any) => ({ id: s.id, name: s.name }))} />
            {editingAppointment && <SelectField label="Status" value={form.status} onChange={(v: string) => setForm({ ...form, status: v })} options={[{ id: 'scheduled', name: 'Agendado' }, { id: 'confirmed', name: 'Confirmado' }, { id: 'completed', name: 'Concluído' }, { id: 'cancelled', name: 'Cancelado' }, { id: 'no_show', name: 'Faltou' }]} />}
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-border/60 bg-card/95 p-5 backdrop-blur"><Button variant="ghost" onClick={() => setNewAppointmentOpen(false)}>Cancelar</Button><Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave} disabled={mutations.save.isPending}>{mutations.save.isPending ? 'Salvando...' : 'Salvar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="h-5 w-5" /> Confirmar exclusão</DialogTitle></DialogHeader>
          <div className="py-4 text-muted-foreground">Tem certeza que deseja excluir este agendamento?</div>
          <DialogFooter><Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={handleDelete} disabled={mutations.remove.isPending}>Excluir permanentemente</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Line({ icon: Icon, value }: any) {
  return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{value || '-'}</span></div>;
}

function Field({ label, type = 'text', value, onChange }: any) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={e => onChange(e.target.value)} /></div>;
}

function SelectField({ label, value, onChange, options }: any) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{options.map((option: any) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>;
}
