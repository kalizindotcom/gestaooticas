import type { ReactNode } from 'react';
import { Eye, FileText, UserRound, Wallet, Wrench } from 'lucide-react';
import { CustomerSelector } from '@/components/shared/CustomerSelector';
import { useCustomerPrescriptions, prescriptionToServiceOrderPatch } from '@/hooks/usePrescriptionData';
import { SERVICE_ORDER_STATUS_OPTIONS } from '@/lib/serviceOrderStatus';
import { ProductPicker } from '@/components/products/ProductPicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

export interface EyePrescription {
  sph: string;
  cyl: string;
  axis: string;
  add: string;
}

export interface ServiceOrderFormState {
  customerId: string;
  storeId: string;
  serviceType: string;
  priority: string;
  status: string;
  date: string;
  deliveryDate: string;
  estimatedDeadline: string;
  dueDate: string;
  prescriptionDate: string;
  prescriptionValidUntil: string;
  prescriptionId: string;
  prescriptionProfessionalId: string;
  technicianId: string;
  productId: string;
  productQuantity: number;
  product: string;
  lens: string;
  labId: string;
  /** Compatibilidade com dados legados; a interface usa labId. */
  lab?: string;
  total: string;
  paidAmount: string;
  paymentMethod: string;
  paymentNote: string;
  description: string;
  internalNotes: string;
  rightEye: EyePrescription;
  leftEye: EyePrescription;
  pupillaryDistance: string;
  largestDiagonal: string;
  verticalHeight: string;
  frameSize: string;
  bridgeSize: string;
  frameAndBridge: string;
  opticalCenterHeight: string;
  rightEyeFar: string;
  rightEyeNear: string;
  leftEyeFar: string;
  leftEyeNear: string;
}

const emptyEye = (): EyePrescription => ({ sph: '', cyl: '', axis: '', add: '' });

export const createServiceOrderForm = (storeId = '', customerId = ''): ServiceOrderFormState => ({
  customerId,
  storeId,
  serviceType: 'montagem',
  priority: 'medium',
  status: 'opened',
  date: new Date().toISOString().slice(0, 10),
  deliveryDate: '',
  estimatedDeadline: '',
  dueDate: new Date().toISOString().slice(0, 10),
  prescriptionDate: '',
  prescriptionValidUntil: '',
  prescriptionId: '',
  prescriptionProfessionalId: '',
  technicianId: '',
  productId: '',
  productQuantity: 1,
  product: '',
  lens: '',
  labId: '',
  lab: '',
  total: '',
  paidAmount: '0',
  paymentMethod: 'pix',
  paymentNote: '',
  description: '',
  internalNotes: '',
  rightEye: emptyEye(),
  leftEye: emptyEye(),
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
  leftEyeNear: '',
});

interface ServiceOrderFormProps {
  form: ServiceOrderFormState;
  onChange: (patch: Partial<ServiceOrderFormState>) => void;
  stores: any[];
  customers?: any[];
  employees: any[];
  laboratories: any[];
  selectedCompanyId?: string;
  selectedStoreIds?: string[];
  customer?: any;
  showCustomerSelector?: boolean;
  editing?: boolean;
}

const serviceTypes = [
  { id: 'montagem', name: 'Montagem' },
  { id: 'ajuste', name: 'Ajuste' },
  { id: 'conserto', name: 'Conserto' },
  { id: 'limpeza', name: 'Limpeza' },
  { id: 'outro', name: 'Outro' },
];

const priorities = [
  { id: 'low', name: 'Baixa' },
  { id: 'medium', name: 'Média' },
  { id: 'high', name: 'Alta' },
  { id: 'urgent', name: 'Urgente' },
];

const statuses = SERVICE_ORDER_STATUS_OPTIONS.map(({ id, label }) => ({ id, name: label }));

const paymentMethods = [
  { id: 'pix', name: 'PIX' },
  { id: 'cash', name: 'Dinheiro' },
  { id: 'debit', name: 'Cartão de débito' },
  { id: 'credit', name: 'Cartão de crédito' },
  { id: 'transfer', name: 'Transferência' },
  { id: 'boleto', name: 'Boleto' },
  { id: 'crediario', name: 'Crediário' },
];

export function ServiceOrderForm({
  form,
  onChange,
  stores,
  customers = [],
  employees,
  laboratories,
  selectedCompanyId,
  selectedStoreIds = [],
  customer,
  showCustomerSelector = true,
  editing = false,
}: ServiceOrderFormProps) {
  const availableStores = stores.filter((store) => {
    const companyMatches = !selectedCompanyId || store.company_id === selectedCompanyId || store.companyId === selectedCompanyId;
    const selectionMatches = selectedStoreIds.length === 0 || selectedStoreIds.includes(store.id);
    return companyMatches && selectionMatches;
  });
  const prescriptionCustomerId = customer?.id || form.customerId;
  const { data: customerPrescriptions = [] } = useCustomerPrescriptions(prescriptionCustomerId);
  const availablePrescriptions = customerPrescriptions.filter((prescription: any) => prescription.status !== 'expired');

  const updateEye = (eye: 'rightEye' | 'leftEye', key: keyof EyePrescription, value: string) => {
    onChange({ [eye]: { ...form[eye], [key]: value } } as Partial<ServiceOrderFormState>);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm sm:p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Contexto da ordem</h3>
            <p className="text-xs text-muted-foreground">Defina a loja, o cliente e o prazo antes de registrar o serviço.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SelectField label="Loja" required value={form.storeId} onChange={(value) => onChange({ storeId: value })} options={availableStores.map((store) => ({ id: store.id, name: store.name }))} placeholder="Selecione a loja" />
          {showCustomerSelector ? (
            <div className="space-y-2">
              <Label>Cliente <span className="text-primary">*</span></Label>
              <CustomerSelector customers={customers} value={form.customerId} onValueChange={(value) => onChange({ customerId: value, prescriptionId: '' })} />
              <p className="text-[11px] text-muted-foreground">Busque por nome, documento ou telefone.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground">
                <UserRound className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{customer?.nickname || customer?.name || 'Cliente atual'}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Esta O.S. será vinculada ao cliente aberto.</p>
            </div>
          )}
          <SelectField label="Tipo de serviço" value={form.serviceType} onChange={(value) => onChange({ serviceType: value })} options={serviceTypes} />
          <SelectField label="Prioridade" value={form.priority} onChange={(value) => onChange({ priority: value })} options={priorities} />
          {editing && <SelectField label="Status" value={form.status} onChange={(value) => onChange({ status: value })} options={statuses} />}
          <DateField label="Previsão de entrega" value={form.estimatedDeadline || form.deliveryDate} onChange={(value) => onChange({ estimatedDeadline: value, deliveryDate: value })} />
          <DateField label="Vencimento financeiro" value={form.dueDate} onChange={(value) => onChange({ dueDate: value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <SectionCard icon={<Wrench className="h-4 w-4" />} title="Produto e execução" description="Organize os itens e responsáveis pelo serviço.">
            <div className="space-y-4">
              <ProductPicker
                productId={form.productId}
                productName={form.product}
                quantity={form.productQuantity}
                storeId={form.storeId}
                onChange={(patch) => onChange(patch)}
                onApplyPrice={(price, quantity) => onChange({ total: (price * quantity).toFixed(2) })}
              />
              <TextField label="Lentes" value={form.lens} onChange={(value) => onChange({ lens: value })} placeholder="Ex.: Varilux Comfort" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField label="Laboratório" value={form.labId || 'none'} onChange={(value) => onChange({ labId: value === 'none' ? '' : value })} options={[{ id: 'none', name: 'Próprio / não informado' }, ...laboratories.map((lab) => ({ id: lab.id, name: lab.name }))]} placeholder="Selecione" />
                <SelectField label="Técnico responsável" value={form.technicianId || 'none'} onChange={(value) => onChange({ technicianId: value === 'none' ? '' : value })} options={[{ id: 'none', name: 'Não atribuído' }, ...employees.map((employee) => ({ id: employee.id, name: employee.name }))]} placeholder="Selecione" />
              </div>
              <TextareaField label="Descrição do serviço" value={form.description} onChange={(value) => onChange({ description: value })} placeholder="Descreva o serviço, problema ou solicitação do cliente..." rows={4} />
              <TextareaField label="Notas internas" value={form.internalNotes} onChange={(value) => onChange({ internalNotes: value })} placeholder="Informações para a equipe da ótica..." rows={3} />
            </div>
          </SectionCard>

          <SectionCard icon={<Wallet className="h-4 w-4" />} title="Financeiro" description="Registre o total, o recebimento inicial e a condição de pagamento.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField label="Valor total (R$)" value={form.total} onChange={(value) => onChange({ total: value })} placeholder="0,00" min="0" step="0.01" />
              <NumberField label="Valor recebido (R$)" value={form.paidAmount} onChange={(value) => onChange({ paidAmount: value })} placeholder="0,00" min="0" step="0.01" />
            </div>
            <SelectField label="Forma de pagamento" value={form.paymentMethod || 'none'} onChange={(value) => onChange({ paymentMethod: value === 'none' ? '' : value })} options={[{ id: 'none', name: 'Não informado' }, ...paymentMethods]} placeholder="Selecione" />
            <TextareaField label="Comentário do pagamento" value={form.paymentNote} onChange={(value) => onChange({ paymentNote: value.slice(0, 300) })} placeholder="Ex.: entrada recebida no balcão..." rows={2} maxLength={300} />
            <p className="text-right text-[11px] text-muted-foreground">{form.paymentNote.length}/300</p>
          </SectionCard>
        </div>

        <SectionCard icon={<Eye className="h-4 w-4" />} title="Receita óptica" description="Preencha somente o que estiver disponível. Os dados ficam vinculados à O.S.">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <SelectField
              label="Usar receita cadastrada"
              value={form.prescriptionId || 'none'}
              onChange={(value) => {
                const prescription = availablePrescriptions.find((item: any) => item.id === value);
                onChange(prescription ? prescriptionToServiceOrderPatch(prescription) : { prescriptionId: '' });
              }}
              options={[{ id: 'none', name: prescriptionCustomerId ? (availablePrescriptions.length ? 'Preencher manualmente' : 'Nenhuma receita disponível') : 'Selecione o cliente primeiro' }, ...availablePrescriptions.map((prescription: any) => ({ id: prescription.id, name: `${prescription.issueDate?.split('-').reverse().join('/') || 'Sem data'} · ${prescription.professionalName || 'Profissional não informado'}` }))]}
              placeholder="Selecione uma receita"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">Ao escolher uma receita, os campos abaixo serão preenchidos automaticamente e poderão ser ajustados nesta O.S.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateField label="Emissão da receita" value={form.prescriptionDate} onChange={(value) => onChange({ prescriptionDate: value })} />
            <DateField label="Validade da receita" value={form.prescriptionValidUntil} onChange={(value) => onChange({ prescriptionValidUntil: value })} />
          </div>
          <Separator />
          <div className="space-y-4">
            <EyeFields title="Olho direito (OD)" eye={form.rightEye} onChange={(key, value) => updateEye('rightEye', key, value)} />
            <EyeFields title="Olho esquerdo (OE)" eye={form.leftEye} onChange={(key, value) => updateEye('leftEye', key, value)} />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <TextField label="Distância pupilar" value={form.pupillaryDistance} onChange={(value) => onChange({ pupillaryDistance: value })} placeholder="mm" />
            <TextField label="Diagonal maior" value={form.largestDiagonal} onChange={(value) => onChange({ largestDiagonal: value })} placeholder="mm" />
            <TextField label="Altura vertical" value={form.verticalHeight} onChange={(value) => onChange({ verticalHeight: value })} placeholder="mm" />
            <TextField label="Aro" value={form.frameSize} onChange={(value) => onChange({ frameSize: value })} placeholder="mm" />
            <TextField label="Ponte" value={form.bridgeSize} onChange={(value) => onChange({ bridgeSize: value })} placeholder="mm" />
            <TextField label="Aro + ponte" value={form.frameAndBridge} onChange={(value) => onChange({ frameAndBridge: value })} placeholder="mm" />
            <TextField label="Altura centro óptico" value={form.opticalCenterHeight} onChange={(value) => onChange({ opticalCenterHeight: value })} placeholder="mm" />
            <TextField label="OD longe" value={form.rightEyeFar} onChange={(value) => onChange({ rightEyeFar: value })} placeholder="mm" />
            <TextField label="OD perto" value={form.rightEyeNear} onChange={(value) => onChange({ rightEyeNear: value })} placeholder="mm" />
            <TextField label="OE longe" value={form.leftEyeFar} onChange={(value) => onChange({ leftEyeFar: value })} placeholder="mm" />
            <TextField label="OE perto" value={form.leftEyeNear} onChange={(value) => onChange({ leftEyeNear: value })} placeholder="mm" />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm sm:p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SelectField({ label, value, onChange, options, placeholder = 'Selecione', required = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }>; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label} {required && <span className="text-primary">*</span>}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

function NumberField({ label, value, onChange, placeholder, min, step }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; min?: string; step?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type="number" inputMode="decimal" min={min} step={step} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} /></div>;
}

function TextareaField({ label, value, onChange, placeholder, rows, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; rows: number; maxLength?: number }) {
  return <div className="space-y-2"><Label>{label}</Label><Textarea value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} maxLength={maxLength} /></div>;
}

function EyeFields({ title, eye, onChange }: { title: string; eye: EyePrescription; onChange: (key: keyof EyePrescription, value: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input aria-label={`${title} esférico`} placeholder="ESF" value={eye.sph || ''} onChange={(event) => onChange('sph', event.target.value)} />
        <Input aria-label={`${title} cilíndrico`} placeholder="CIL" value={eye.cyl || ''} onChange={(event) => onChange('cyl', event.target.value)} />
        <Input aria-label={`${title} eixo`} placeholder="EIXO" value={eye.axis || ''} onChange={(event) => onChange('axis', event.target.value)} />
        <Input aria-label={`${title} adição`} placeholder="ADD" value={eye.add || ''} onChange={(event) => onChange('add', event.target.value)} />
      </div>
    </div>
  );
}
