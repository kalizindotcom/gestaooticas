import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Edit3, FileText, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { useProfessionals } from '@/hooks/useLocalData';
import { createPrescriptionForm, useCustomerPrescriptionMutations, useCustomerPrescriptions } from '@/hooks/usePrescriptionData';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const formatDate = (value?: string | null) => {
  if (!value) return 'Não informada';
  const parts = String(value).slice(0, 10).split('-');
  return parts.length === 3 ? parts.reverse().join('/') : String(value);
};

const hasPrescriptionValues = (prescription: any) => [
  prescription.rightEye?.sph,
  prescription.rightEye?.cyl,
  prescription.rightEye?.axis,
  prescription.rightEye?.add,
  prescription.leftEye?.sph,
  prescription.leftEye?.cyl,
  prescription.leftEye?.axis,
  prescription.leftEye?.add,
].some(Boolean);

export function PrescriptionsTab({ customer }: { customer: any }) {
  const { stores, selectedStoreIds, selectedCompanyId } = useGlobalFilter();
  const { data: prescriptions = [], isLoading } = useCustomerPrescriptions(customer?.id);
  const { data: professionals = [] } = useProfessionals();
  const mutations = useCustomerPrescriptionMutations(customer);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [form, setForm] = useState<any>(createPrescriptionForm(selectedStoreIds[0] || '', customer?.id || ''));

  const availableStores = stores.filter((store: any) => {
    const companyMatches = !selectedCompanyId || store.company_id === selectedCompanyId || store.companyId === selectedCompanyId;
    const selectionMatches = selectedStoreIds.length === 0 || selectedStoreIds.includes(store.id);
    return companyMatches && selectionMatches;
  });

  const currentPrescription = useMemo(() => prescriptions.find((item: any) => item.id === editingId), [prescriptions, editingId]);
  const activeCount = prescriptions.filter((item: any) => item.status !== 'expired').length;
  const latest = prescriptions[0];

  const reset = () => {
    setForm(createPrescriptionForm(selectedStoreIds[0] || availableStores[0]?.id || '', customer?.id || ''));
    setEditingId(undefined);
  };

  const openNew = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (prescription: any) => {
    setEditingId(prescription.id);
    setForm({
      ...createPrescriptionForm(prescription.storeId || selectedStoreIds[0] || '', customer?.id || ''),
      professionalId: prescription.professionalId || '',
      professionalName: prescription.professionalName === 'Não informado' ? '' : prescription.professionalName || '',
      issueDate: prescription.issueDate || '',
      validUntil: prescription.validUntil || '',
      notes: prescription.notes || '',
      rightEye: prescription.rightEye || { sph: '', cyl: '', axis: '', add: '' },
      leftEye: prescription.leftEye || { sph: '', cyl: '', axis: '', add: '' },
      pupillaryDistance: prescription.pupillaryDistance || '',
      largestDiagonal: prescription.largestDiagonal || '',
      verticalHeight: prescription.verticalHeight || '',
      frameSize: prescription.frameSize || '',
      bridgeSize: prescription.bridgeSize || '',
      frameAndBridge: prescription.frameAndBridge || '',
      opticalCenterHeight: prescription.opticalCenterHeight || '',
      rightEyeFar: prescription.rightEyeFar || '',
      rightEyeNear: prescription.rightEyeNear || '',
      leftEyeFar: prescription.leftEyeFar || '',
      leftEyeNear: prescription.leftEyeNear || '',
    });
    setOpen(true);
  };

  const update = (patch: Record<string, unknown>) => setForm((current: any) => ({ ...current, ...patch }));

  const handleSave = async () => {
    if (!form.storeId || !form.issueDate) {
      toast.error('Selecione a loja e informe a data de emissão.');
      return;
    }
    try {
      await mutations.save.mutateAsync({ id: editingId, data: form });
      toast.success(editingId ? 'Receita atualizada com sucesso.' : 'Receita cadastrada com sucesso.');
      setOpen(false);
      reset();
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível salvar a receita.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await mutations.remove.mutateAsync(deleteTarget.id);
      toast.success('Receita removida com sucesso.');
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível remover a receita.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Stethoscope className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-bold text-foreground">Receitas optométricas</h2>
            <p className="text-xs text-muted-foreground">Prescrições clínicas do cliente para consulta e reaproveitamento em uma O.S.</p>
          </div>
        </div>
        <PermissionGate module="customers" action="create">
          <Button onClick={openNew} className="h-9 gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Nova receita</Button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="Receitas cadastradas" value={prescriptions.length} />
        <Metric label="Receitas disponíveis" value={activeCount} />
        <Metric label="Última emissão" value={latest ? formatDate(latest.issueDate) : 'Nenhuma'} />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2"><div className="h-44 animate-pulse rounded-2xl bg-muted" /><div className="h-44 animate-pulse rounded-2xl bg-muted" /></div>
      ) : prescriptions.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-card shadow-sm"><CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center"><div className="rounded-2xl bg-primary/10 p-3 text-primary"><FileText className="h-6 w-6" /></div><div><h3 className="font-semibold text-foreground">Nenhuma receita optométrica cadastrada</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">Cadastre a receita do cliente uma vez e reaproveite os dados ao abrir novas ordens de serviço.</p></div><PermissionGate module="customers" action="create"><Button onClick={openNew} variant="outline" className="mt-2 gap-2"><Plus className="h-4 w-4" /> Cadastrar primeira receita</Button></PermissionGate></CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {prescriptions.map((prescription: any) => {
            const expired = prescription.status === 'expired';
            const store = stores.find((item: any) => item.id === prescription.storeId);
            return (
              <Card key={prescription.id} className="overflow-hidden border-border/70 bg-card shadow-sm">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-foreground">Receita de {formatDate(prescription.issueDate)}</h3><Badge variant="outline" className={expired ? 'border-red-500/30 bg-red-500/5 text-red-600' : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600'}>{expired ? 'Expirada' : 'Disponível'}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{prescription.professionalName || 'Profissional não informado'}{store?.name ? ` · ${store.name}` : ''}</p></div>
                    <div className="flex shrink-0 gap-1"><PermissionGate module="customers" action="edit"><Button variant="ghost" size="icon" aria-label="Editar receita" onClick={() => openEdit(prescription)}><Edit3 className="h-4 w-4" /></Button></PermissionGate><PermissionGate module="customers" action="delete"><Button variant="ghost" size="icon" aria-label="Excluir receita" className="text-red-600 hover:bg-red-500/10 hover:text-red-600" onClick={() => setDeleteTarget(prescription)}><Trash2 className="h-4 w-4" /></Button></PermissionGate></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs sm:grid-cols-4"><EyeValue label="OD ESF" value={prescription.rightEye?.sph} /><EyeValue label="OD CIL" value={prescription.rightEye?.cyl} /><EyeValue label="OE ESF" value={prescription.leftEye?.sph} /><EyeValue label="OE CIL" value={prescription.leftEye?.cyl} /></div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground"><span>Validade: <strong className="text-foreground">{formatDate(prescription.validUntil)}</strong></span><span>DP: <strong className="text-foreground">{prescription.pupillaryDistance || '—'}</strong></span><span>Medidas: <strong className="text-foreground">{hasPrescriptionValues(prescription) ? 'preenchidas' : 'não informadas'}</strong></span></div>
                  {prescription.notes && <p className="rounded-lg bg-muted/40 p-2.5 text-xs italic text-muted-foreground">{prescription.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-hidden rounded-2xl border-border/70 bg-background p-0">
          <DialogHeader className="border-b border-border/70 bg-card px-4 py-4 sm:px-6"><DialogTitle>{editingId ? 'Editar receita optométrica' : 'Nova receita optométrica'}</DialogTitle><p className="text-xs text-muted-foreground">Registre a receita clínica para reutilizar os dados em novas O.S.</p></DialogHeader>
          <div className="custom-scrollbar max-h-[calc(94vh-10rem)] overflow-y-auto p-4 sm:p-6">
            <div className="space-y-6">
              <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><div><h3 className="text-sm font-semibold text-foreground">Identificação da receita</h3><p className="text-xs text-muted-foreground">Informe a unidade, o profissional e a validade clínica.</p></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><SelectField label="Loja" value={form.storeId} onChange={(value) => update({ storeId: value })} options={availableStores.map((store: any) => ({ id: store.id, name: store.name }))} /><SelectField label="Optometrista / profissional" value={form.professionalId || 'none'} onChange={(value) => { const professional = professionals.find((item: any) => item.id === value); update({ professionalId: value === 'none' ? '' : value, professionalName: value === 'none' ? '' : professional?.name || '' }); }} options={[{ id: 'none', name: 'Não informado' }, ...professionals.map((item: any) => ({ id: item.id, name: item.name }))]} /><DateField label="Data de emissão" value={form.issueDate} onChange={(value) => update({ issueDate: value })} /><DateField label="Validade" value={form.validUntil} onChange={(value) => update({ validUntil: value })} /></div></section>
              <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><div><h3 className="text-sm font-semibold text-foreground">Grau da receita</h3><p className="text-xs text-muted-foreground">Preencha somente os campos presentes na receita do cliente.</p></div></div><div className="space-y-4"><EyeFields title="Olho direito (OD)" eye={form.rightEye} onChange={(key, value) => update({ rightEye: { ...form.rightEye, [key]: value } })} /><EyeFields title="Olho esquerdo (OE)" eye={form.leftEye} onChange={(key, value) => update({ leftEye: { ...form.leftEye, [key]: value } })} /></div></section>
              <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><div><h3 className="text-sm font-semibold text-foreground">Medidas e observações</h3><p className="text-xs text-muted-foreground">Esses dados poderão preencher automaticamente a receita técnica da O.S.</p></div></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3"><TextField label="Distância pupilar" value={form.pupillaryDistance} onChange={(value) => update({ pupillaryDistance: value })} placeholder="mm" /><TextField label="Diagonal maior" value={form.largestDiagonal} onChange={(value) => update({ largestDiagonal: value })} placeholder="mm" /><TextField label="Altura vertical" value={form.verticalHeight} onChange={(value) => update({ verticalHeight: value })} placeholder="mm" /><TextField label="Aro" value={form.frameSize} onChange={(value) => update({ frameSize: value })} placeholder="mm" /><TextField label="Ponte" value={form.bridgeSize} onChange={(value) => update({ bridgeSize: value })} placeholder="mm" /><TextField label="Aro + ponte" value={form.frameAndBridge} onChange={(value) => update({ frameAndBridge: value })} placeholder="mm" /><TextField label="Altura centro óptico" value={form.opticalCenterHeight} onChange={(value) => update({ opticalCenterHeight: value })} placeholder="mm" /><TextField label="OD longe" value={form.rightEyeFar} onChange={(value) => update({ rightEyeFar: value })} placeholder="mm" /><TextField label="OD perto" value={form.rightEyeNear} onChange={(value) => update({ rightEyeNear: value })} placeholder="mm" /><TextField label="OE longe" value={form.leftEyeFar} onChange={(value) => update({ leftEyeFar: value })} placeholder="mm" /><TextField label="OE perto" value={form.leftEyeNear} onChange={(value) => update({ leftEyeNear: value })} placeholder="mm" /></div><Separator className="my-5" /><div className="space-y-2"><Label>Observações clínicas</Label><Textarea value={form.notes} onChange={(event) => update({ notes: event.target.value.slice(0, 500) })} rows={3} maxLength={500} placeholder="Anote orientações, observações ou informações da receita..." /><p className="text-right text-[11px] text-muted-foreground">{form.notes.length}/500</p></div></section>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-border/70 bg-card/95 p-4 backdrop-blur sm:p-5"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={handleSave} disabled={mutations.save.isPending} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">{mutations.save.isPending ? 'Salvando...' : <><CheckCircle2 className="h-4 w-4" /> Salvar receita</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(value) => !value && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir receita?</AlertDialogTitle><AlertDialogDescription>Esta receita será removida do histórico do cliente e não poderá mais ser aplicada automaticamente em novas O.S.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir receita</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black text-foreground">{value}</p></div>;
}

function EyeValue({ label, value }: { label: string; value?: string }) {
  return <div><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm font-bold text-foreground">{value || '—'}</p></div>;
}

function EyeFields({ title, eye, onChange }: { title: string; eye: any; onChange: (key: string, value: string) => void }) {
  return <div className="space-y-2"><p className="text-xs font-semibold text-foreground">{title}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['sph', 'ESF'], ['cyl', 'CIL'], ['axis', 'EIXO'], ['add', 'ADD']].map(([key, placeholder]) => <Input key={key} aria-label={`${title} ${placeholder}`} placeholder={placeholder} value={eye?.[key] || ''} onChange={(event) => onChange(key, event.target.value)} />)}</div></div>;
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} /></div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }> }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value || undefined} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>;
}
