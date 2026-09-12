import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CircleDollarSign,
  Contact,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { useEmployees, useStores } from '@/hooks/useLocalData';
import { cn } from '@/lib/utils';

type CustomerType = 'individual' | 'company';
type ContactKind = 'phones' | 'emails' | 'references';

type ContactRow = {
  id: string;
  value: string;
  label: string;
};

type CustomerFormState = {
  customer_type: CustomerType;
  store_id: string;
  name: string;
  nickname: string;
  legal_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  cpf: string;
  rg: string;
  cnpj: string;
  state_registration: string;
  birth_date: string;
  gender: string;
  marital_status: string;
  father_name: string;
  mother_name: string;
  responsible_name: string;
  responsible_relationship: string;
  profession: string;
  education: string;
  origin: string;
  external_code: string;
  discount_percent: string;
  family_income: string;
  insurance: string;
  preferred_seller_id: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_zip_code: string;
  address_reference: string;
  phones: ContactRow[];
  emails: ContactRow[];
  references: ContactRow[];
  tags: string[];
  notes: string;
};

interface CustomerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (data: any) => void;
  isLoading?: boolean;
  initialData?: any | null;
  mode?: 'create' | 'edit';
}

const inputClass = 'h-10 rounded-lg bg-background/60 border-border/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 transition-all';
const selectClass = 'h-10 rounded-lg bg-background/60 border-border/70 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all';

const formSections = [
  { id: 'identificacao', label: 'Identificação', shortLabel: 'Perfil', icon: Contact },
  { id: 'conexao', label: 'Contatos', shortLabel: 'Contatos', icon: Phone },
  { id: 'localizacao', label: 'Endereço', shortLabel: 'Endereço', icon: MapPin },
  { id: 'relacionamento', label: 'Relacionamento', shortLabel: 'Família', icon: UsersRound },
  { id: 'comercial', label: 'Comercial', shortLabel: 'Comercial', icon: CircleDollarSign },
  { id: 'registro', label: 'Observações', shortLabel: 'Notas', icon: ArrowUpRight },
] as const;
type FormSectionId = typeof formSections[number]['id'];

const newContact = (label: string): ContactRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  value: '',
  label,
});

function parseNumberInput(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const valueWithDecimal = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized;
  const parsed = Number(valueWithDecimal);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDisplayNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return String(value).replace('.', ',');
}

function parseContactRows(value: unknown, fallbackLabel: string): ContactRow[] {
  if (Array.isArray(value)) {
    const rows = value
      .map((row: any) => ({
        id: String(row?.id || `${Date.now()}-${Math.random()}`),
        value: String(row?.value || row?.number || row?.email || row?.name || ''),
        label: String(row?.label || row?.type || fallbackLabel),
      }))
      .filter(row => row.value.trim());
    return rows.length ? rows : [newContact(fallbackLabel)];
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      return parseContactRows(JSON.parse(value), fallbackLabel);
    } catch {
      return [{ ...newContact(fallbackLabel), value }];
    }
  }

  return [newContact(fallbackLabel)];
}

function parseTags(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : value.split(',').map(v => v.trim()).filter(Boolean);
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
  }
  return [];
}

function createInitialForm(initialData?: any | null): CustomerFormState {
  const address = initialData?.address || {};
  const customerType = (initialData?.customer_type || initialData?.customerType || (initialData?.cnpj ? 'company' : 'individual')) as CustomerType;
  return {
    customer_type: customerType === 'company' ? 'company' : 'individual',
    store_id: initialData?.store_id || initialData?.storeId || '',
    name: initialData?.name || '',
    nickname: initialData?.nickname || '',
    legal_name: initialData?.legal_name || initialData?.legalName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    whatsapp: initialData?.whatsapp || '',
    cpf: initialData?.cpf || '',
    rg: initialData?.rg || '',
    cnpj: initialData?.cnpj || '',
    state_registration: initialData?.state_registration || initialData?.stateRegistration || '',
    birth_date: initialData?.birth_date || initialData?.birthDate || '',
    gender: initialData?.gender || 'not_informed',
    marital_status: initialData?.marital_status || initialData?.maritalStatus || 'solteiro',
    father_name: initialData?.father_name || initialData?.fatherName || '',
    mother_name: initialData?.mother_name || initialData?.motherName || '',
    responsible_name: initialData?.responsible_name || initialData?.responsibleName || '',
    responsible_relationship: initialData?.responsible_relationship || initialData?.responsibleRelationship || '',
    profession: initialData?.profession || '',
    education: initialData?.education || '',
    origin: initialData?.origin || '',
    external_code: initialData?.external_code || initialData?.externalCode || '',
    discount_percent: toDisplayNumber(initialData?.discount_percent ?? initialData?.discountPercent),
    family_income: toDisplayNumber(initialData?.family_income ?? initialData?.familyIncome),
    insurance: initialData?.insurance || '',
    preferred_seller_id: initialData?.preferred_seller_id || initialData?.preferredSellerId || 'none',
    address_street: initialData?.address_street || address.street || '',
    address_number: initialData?.address_number || address.number || '',
    address_complement: initialData?.address_complement || address.complement || '',
    address_neighborhood: initialData?.address_neighborhood || address.neighborhood || '',
    address_city: initialData?.address_city || address.city || '',
    address_state: initialData?.address_state || address.state || '',
    address_zip_code: initialData?.address_zip_code || address.zipCode || '',
    address_reference: initialData?.address_reference || address.reference || '',
    phones: parseContactRows(initialData?.phones_json ?? initialData?.phones, 'Telefone'),
    emails: parseContactRows(initialData?.emails_json ?? initialData?.emails, 'E-mail'),
    references: parseContactRows(initialData?.references_json ?? initialData?.references, 'Referência'),
    tags: parseTags(initialData?.tags),
    notes: initialData?.notes || '',
  };
}

function SectionHeading({ icon: Icon, eyebrow, title, description }: { icon: any; eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-primary/80">{eyebrow}</p>
        <h3 className="mt-0.5 text-sm font-heading font-black tracking-tight text-foreground">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] font-bold text-foreground/80">{label}{required ? ' *' : ''}</Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function CustomerFormModal({ open, onOpenChange, onSave, isLoading, initialData, mode = 'create' }: CustomerFormModalProps) {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  const storesQuery = useStores();
  const employeesQuery = useEmployees();
  const [formData, setFormData] = useState<CustomerFormState>(() => createInitialForm(initialData));
  const [tagInput, setTagInput] = useState('');
  const [activeSection, setActiveSection] = useState<FormSectionId>('identificacao');
  const scrollRef = useRef<HTMLDivElement>(null);

  const stores = storesQuery.data || [];
  const employees = employeesQuery.data || [];
  const companyId = initialData?.company_id || initialData?.companyId || selectedCompanyId;
  const activeStoreId = formData.store_id || selectedStoreIds[0] || '';

  useEffect(() => {
    if (open) {
      setFormData(createInitialForm(initialData));
      setTagInput('');
      setActiveSection('identificacao');
    }
  }, [open, initialData?.id]);

  useEffect(() => {
    if (!open) return;
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    const sections = Array.from(scrollContainer.querySelectorAll<HTMLElement>('[data-customer-section]'));
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const sectionId = visible?.target.getAttribute('data-customer-section') as FormSectionId | null;
        if (sectionId) setActiveSection(sectionId);
      },
      { root: scrollContainer, rootMargin: '-12% 0px -68% 0px', threshold: [0, 0.1, 0.5] },
    );
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [open]);

  const scrollToSection = (sectionId: FormSectionId) => {
    const section = scrollRef.current?.querySelector<HTMLElement>(`[data-customer-section="${sectionId}"]`);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(sectionId);
  };

  const selectedStoreName = useMemo(
    () => stores.find(store => store.id === activeStoreId)?.name || 'Selecione a loja',
    [stores, activeStoreId],
  );

  const update = <K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) => {
    setFormData(previous => ({ ...previous, [key]: value }));
  };

  const updateContact = (kind: ContactKind, id: string, value: Partial<ContactRow>) => {
    setFormData(previous => ({
      ...previous,
      [kind]: previous[kind].map(row => row.id === id ? { ...row, ...value } : row),
    }));
  };

  const addContact = (kind: ContactKind, label: string) => {
    setFormData(previous => ({ ...previous, [kind]: [...previous[kind], newContact(label)] }));
  };

  const removeContact = (kind: ContactKind, id: string) => {
    setFormData(previous => {
      const remaining = previous[kind].filter(row => row.id !== id);
      return { ...previous, [kind]: remaining.length ? remaining : [newContact(kind === 'phones' ? 'Telefone' : kind === 'emails' ? 'E-mail' : 'Referência')] };
    });
  };

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const nextTag = tagInput.trim();
    if (!nextTag || formData.tags.includes(nextTag)) return;
    update('tags', [...formData.tags, nextTag]);
    setTagInput('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = formData.name.trim();
    const storeId = formData.store_id || initialData?.store_id || selectedStoreIds[0] || '';

    if (!name) {
      toast.error('O nome do cliente é obrigatório.');
      return;
    }
    if (!companyId || !storeId) {
      toast.error('Selecione uma empresa e uma loja para cadastrar o cliente.');
      return;
    }

    const cleanContacts = (rows: ContactRow[]) => rows
      .filter(row => row.value.trim())
      .map(({ id: _id, ...row }) => ({ value: row.value.trim(), label: row.label.trim() || 'Contato' }));

    const payload = {
      ...formData,
      name,
      company_id: companyId,
      store_id: storeId,
      status: initialData?.status || 'active',
      birth_date: formData.birth_date || null,
      discount_percent: parseNumberInput(formData.discount_percent),
      family_income: parseNumberInput(formData.family_income),
      preferred_seller_id: formData.preferred_seller_id === 'none' ? null : formData.preferred_seller_id,
      phones_json: JSON.stringify(cleanContacts(formData.phones)),
      emails_json: JSON.stringify(cleanContacts(formData.emails)),
      references_json: JSON.stringify(cleanContacts(formData.references)),
      created_at: initialData?.created_at || new Date().toISOString(),
      last_visit: initialData?.last_visit || null,
    };

    delete (payload as any).phones;
    delete (payload as any).emails;
    delete (payload as any).references;

    onSave?.(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-6xl max-h-[94vh] p-0 overflow-hidden bg-background border-border/70 rounded-3xl shadow-2xl">
        <form onSubmit={handleSubmit} className="flex max-h-[94vh] flex-col">
          <div className="shrink-0 border-b border-border/70 bg-card px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {formData.customer_type === 'company' ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-heading font-black tracking-tight text-foreground sm:text-xl">
                    {mode === 'edit' ? 'Editar cliente' : 'Novo cliente'}
                  </DialogTitle>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-primary/60" /> Ficha protegida</span>
                    <span className="text-border">•</span>
                    <span>{formData.customer_type === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-muted/50 p-1">
                <button
                  type="button"
                  onClick={() => update('customer_type', 'individual')}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-3 text-[10px] font-black uppercase tracking-wider transition-all',
                    formData.customer_type === 'individual'
                      ? 'bg-background text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <UserRound className="h-3 w-3" /> PF
                </button>
                <button
                  type="button"
                  onClick={() => update('customer_type', 'company')}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-3 text-[10px] font-black uppercase tracking-wider transition-all',
                    formData.customer_type === 'company'
                      ? 'bg-background text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Building2 className="h-3 w-3" /> PJ
                </button>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-muted/20 px-3 py-4 sm:px-5 sm:py-5">
            <nav aria-label="Navegação do cadastro" className="sticky top-0 z-20 -mx-3 -mt-4 mb-4 border-b border-border/70 bg-background/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:-mt-5 sm:px-5">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="mr-1 shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Ir para</span>
                {formSections.map(({ id, label, shortLabel: navLabel, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => scrollToSection(id)} aria-current={activeSection === id ? 'step' : undefined} className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold transition-all active:scale-[0.97]', activeSection === id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary')}>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="sm:hidden">{navLabel}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </nav>
            <div className="mx-auto grid max-w-5xl gap-4">
              <section data-customer-section="identificacao" className="scroll-mt-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <SectionHeading icon={Contact} eyebrow="01 · Identificação" title="Quem é este cliente?" description="Dados essenciais para localizar e reconhecer o cadastro em qualquer módulo." />
                <div className="grid gap-3 md:grid-cols-12">
                  <div className="md:col-span-8"><Field label={formData.customer_type === 'company' ? 'Nome fantasia' : 'Nome completo'} required><Input required value={formData.name} onChange={event => update('name', event.target.value)} placeholder={formData.customer_type === 'company' ? 'Ex.: Sertão Ótica' : 'Ex.: Maria Fernanda Oliveira'} className={inputClass} /></Field></div>
                  <div className="md:col-span-4"><Field label={formData.customer_type === 'company' ? 'Razão social' : 'Como prefere ser chamado'}><Input value={formData.customer_type === 'company' ? formData.legal_name : formData.nickname} onChange={event => update(formData.customer_type === 'company' ? 'legal_name' : 'nickname', event.target.value)} placeholder={formData.customer_type === 'company' ? 'Razão social registrada' : 'Nome ou apelido'} className={inputClass} /></Field></div>
                  <div className="md:col-span-4"><Field label={formData.customer_type === 'company' ? 'CNPJ' : 'CPF'}><Input value={formData.customer_type === 'company' ? formData.cnpj : formData.cpf} onChange={event => update(formData.customer_type === 'company' ? 'cnpj' : 'cpf', event.target.value)} placeholder={formData.customer_type === 'company' ? '00.000.000/0000-00' : '000.000.000-00'} className={inputClass} /></Field></div>
                  <div className="md:col-span-4"><Field label={formData.customer_type === 'company' ? 'Inscrição estadual' : 'RG'}><Input value={formData.customer_type === 'company' ? formData.state_registration : formData.rg} onChange={event => update(formData.customer_type === 'company' ? 'state_registration' : 'rg', event.target.value)} placeholder={formData.customer_type === 'company' ? 'Opcional' : '00.000.000-0'} className={inputClass} /></Field></div>
                  <div className="md:col-span-4"><Field label="Loja de relacionamento" hint={selectedStoreName}><Select value={activeStoreId || 'none'} onValueChange={value => update('store_id', value === 'none' ? '' : value)}><SelectTrigger className={selectClass}><SelectValue placeholder="Selecione a loja" /></SelectTrigger><SelectContent className="rounded-xl border-border/70"><SelectItem value="none">Selecione a loja</SelectItem>{stores.map(store => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select></Field></div>
                  {formData.customer_type === 'individual' && <><div className="md:col-span-4"><Field label="Data de nascimento"><Input type="date" value={formData.birth_date} onChange={event => update('birth_date', event.target.value)} className={inputClass} /></Field></div><div className="md:col-span-4"><Field label="Gênero"><Select value={formData.gender} onValueChange={value => update('gender', value)}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-border/70"><SelectItem value="not_informed">Não informado</SelectItem><SelectItem value="female">Feminino</SelectItem><SelectItem value="male">Masculino</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></Field></div><div className="md:col-span-4"><Field label="Estado civil"><Select value={formData.marital_status} onValueChange={value => update('marital_status', value)}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-border/70"><SelectItem value="solteiro">Solteiro(a)</SelectItem><SelectItem value="casado">Casado(a)</SelectItem><SelectItem value="divorciado">Divorciado(a)</SelectItem><SelectItem value="viuvo">Viúvo(a)</SelectItem><SelectItem value="uniao_estavel">União estável</SelectItem></SelectContent></Select></Field></div></>}
                </div>
              </section>

              <section data-customer-section="conexao" className="scroll-mt-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <SectionHeading icon={Phone} eyebrow="02 · Conexão" title="Canais de contato" description="Mantenha telefone, WhatsApp e e-mail disponíveis para a equipe." />
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Telefone principal"><Input value={formData.phone} onChange={event => update('phone', event.target.value)} placeholder="(00) 0000-0000" className={inputClass} /></Field>
                  <Field label="WhatsApp"><Input value={formData.whatsapp} onChange={event => update('whatsapp', event.target.value)} placeholder="(00) 90000-0000" className={cn(inputClass, 'focus-visible:border-emerald-500')} /></Field>
                  <Field label="E-mail principal"><Input type="email" value={formData.email} onChange={event => update('email', event.target.value)} placeholder="cliente@email.com" className={inputClass} /></Field>
                </div>
                <div className="mt-4 grid gap-4 border-t border-border/60 pt-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-muted/30 p-3.5">
                    <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black text-foreground">Outros telefones</p><p className="text-[11px] text-muted-foreground">Inclua contatos alternativos.</p></div><Button type="button" variant="outline" size="sm" onClick={() => addContact('phones', 'Telefone')} className="h-8 gap-1.5 rounded-lg border-primary/25 text-primary hover:bg-primary/10"><Plus className="h-3.5 w-3.5" /> Adicionar</Button></div>
                    <div className="space-y-2">{formData.phones.map(row => <div key={row.id} className="flex gap-2"><Input value={row.value} onChange={event => updateContact('phones', row.id, { value: event.target.value })} placeholder="(00) 00000-0000" className="h-10 rounded-xl bg-background/70" /><Input value={row.label} onChange={event => updateContact('phones', row.id, { label: event.target.value })} placeholder="Tipo" className="h-10 w-28 rounded-xl bg-background/70" /><Button type="button" variant="ghost" size="icon" onClick={() => removeContact('phones', row.id)} className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></div>)}</div>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3.5">
                    <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black text-foreground">Outros e-mails</p><p className="text-[11px] text-muted-foreground">Centralize e-mails de contato.</p></div><Button type="button" variant="outline" size="sm" onClick={() => addContact('emails', 'E-mail')} className="h-8 gap-1.5 rounded-lg border-primary/25 text-primary hover:bg-primary/10"><Plus className="h-3.5 w-3.5" /> Adicionar</Button></div>
                    <div className="space-y-2">{formData.emails.map(row => <div key={row.id} className="flex gap-2"><Input type="email" value={row.value} onChange={event => updateContact('emails', row.id, { value: event.target.value })} placeholder="contato@email.com" className="h-10 flex-1 rounded-xl bg-background/70" /><Input value={row.label} onChange={event => updateContact('emails', row.id, { label: event.target.value })} placeholder="Tipo" className="h-10 w-28 rounded-xl bg-background/70" /><Button type="button" variant="ghost" size="icon" onClick={() => removeContact('emails', row.id)} className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></div>)}</div>
                  </div>
                </div>
              </section>

              <section data-customer-section="localizacao" className="scroll-mt-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <SectionHeading icon={MapPin} eyebrow="03 · Localização" title="Endereço principal" description="Informações de entrega, contato e atendimento da ficha." />
                <div className="grid gap-3 md:grid-cols-12">
                  <div className="md:col-span-3"><Field label="CEP"><Input value={formData.address_zip_code} onChange={event => update('address_zip_code', event.target.value)} placeholder="00000-000" className={inputClass} /></Field></div>
                  <div className="md:col-span-7"><Field label="Rua / Avenida"><Input value={formData.address_street} onChange={event => update('address_street', event.target.value)} placeholder="Nome da rua" className={inputClass} /></Field></div>
                  <div className="md:col-span-2"><Field label="Número"><Input value={formData.address_number} onChange={event => update('address_number', event.target.value)} placeholder="S/N" className={inputClass} /></Field></div>
                  <div className="md:col-span-5"><Field label="Complemento"><Input value={formData.address_complement} onChange={event => update('address_complement', event.target.value)} placeholder="Apartamento, sala..." className={inputClass} /></Field></div>
                  <div className="md:col-span-4"><Field label="Bairro"><Input value={formData.address_neighborhood} onChange={event => update('address_neighborhood', event.target.value)} placeholder="Bairro" className={inputClass} /></Field></div>
                  <div className="md:col-span-3"><Field label="Cidade"><Input value={formData.address_city} onChange={event => update('address_city', event.target.value)} placeholder="Cidade" className={inputClass} /></Field></div>
                  <div className="md:col-span-2"><Field label="UF"><Input maxLength={2} value={formData.address_state} onChange={event => update('address_state', event.target.value.toUpperCase())} placeholder="PE" className={cn(inputClass, 'uppercase')} /></Field></div>
                  <div className="md:col-span-10"><Field label="Ponto de referência"><Input value={formData.address_reference} onChange={event => update('address_reference', event.target.value)} placeholder="Ex.: próximo à praça principal" className={inputClass} /></Field></div>
                </div>
              </section>

              <section data-customer-section="relacionamento" className="scroll-mt-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <SectionHeading icon={UsersRound} eyebrow="04 · Relacionamento" title="Família e contexto" description="Dados que ajudam a equipe a oferecer um atendimento mais próximo." />
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Nome do pai"><Input value={formData.father_name} onChange={event => update('father_name', event.target.value)} placeholder="Nome completo" className={inputClass} /></Field>
                  <Field label="Nome da mãe"><Input value={formData.mother_name} onChange={event => update('mother_name', event.target.value)} placeholder="Nome completo" className={inputClass} /></Field>
                  <Field label="Responsável financeiro"><Input value={formData.responsible_name} onChange={event => update('responsible_name', event.target.value)} placeholder="Nome do responsável" className={inputClass} /></Field>
                  <Field label="Grau de parentesco"><Input value={formData.responsible_relationship} onChange={event => update('responsible_relationship', event.target.value)} placeholder="Ex.: mãe, cônjuge" className={inputClass} /></Field>
                  <Field label="Profissão"><div className="relative"><BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={formData.profession} onChange={event => update('profession', event.target.value)} placeholder="Profissão" className={cn(inputClass, 'pl-9')} /></div></Field>
                  <Field label="Escolaridade"><div className="relative"><GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={formData.education} onChange={event => update('education', event.target.value)} placeholder="Escolaridade" className={cn(inputClass, 'pl-9')} /></div></Field>
                  <Field label="Origem do cliente"><Select value={formData.origin || 'none'} onValueChange={value => update('origin', value === 'none' ? '' : value)}><SelectTrigger className={selectClass}><SelectValue placeholder="Selecione a origem" /></SelectTrigger><SelectContent className="rounded-xl border-border/70"><SelectItem value="none">Não informado</SelectItem><SelectItem value="indicacao">Indicação</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="google">Google</SelectItem><SelectItem value="loja">Visita à loja</SelectItem><SelectItem value="retorno">Cliente antigo</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></Field>
                  <Field label="Código externo"><Input value={formData.external_code} onChange={event => update('external_code', event.target.value)} placeholder="ERP, legado ou convênio" className={inputClass} /></Field>
                </div>
              </section>

              <section data-customer-section="comercial" className="scroll-mt-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <SectionHeading icon={CircleDollarSign} eyebrow="05 · Comercial" title="Condições e preferências" description="Personalize a operação sem perder o histórico do cliente." />
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Renda familiar"><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span><Input inputMode="decimal" value={formData.family_income} onChange={event => update('family_income', event.target.value)} placeholder="0,00" className={cn(inputClass, 'pl-9')} /></div></Field>
                  <Field label="Acréscimo / desconto"><div className="relative"><Input inputMode="decimal" value={formData.discount_percent} onChange={event => update('discount_percent', event.target.value)} placeholder="Ex.: -5 ou 10" className={cn(inputClass, 'pr-10')} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span></div></Field>
                  <Field label="Convênio / plano"><div className="relative"><ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={formData.insurance} onChange={event => update('insurance', event.target.value)} placeholder="Nenhum convênio" className={cn(inputClass, 'pl-9')} /></div></Field>
                  <Field label="Vendedor preferencial"><Select value={formData.preferred_seller_id} onValueChange={value => update('preferred_seller_id', value)}><SelectTrigger className={selectClass}><SelectValue placeholder="Nenhum vendedor" /></SelectTrigger><SelectContent className="rounded-xl border-border/70"><SelectItem value="none">Nenhum vendedor</SelectItem>{employees.map(employee => <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>)}</SelectContent></Select></Field>
                </div>
                <div className="mt-4 grid gap-4 border-t border-border/60 pt-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-muted/30 p-3.5">
                    <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black text-foreground">Referências</p><p className="text-[11px] text-muted-foreground">Pessoas que podem ser contatadas.</p></div><Button type="button" variant="outline" size="sm" onClick={() => addContact('references', 'Referência')} className="h-8 gap-1.5 rounded-lg border-primary/25 text-primary hover:bg-primary/10"><Plus className="h-3.5 w-3.5" /> Adicionar</Button></div>
                    <div className="space-y-2">{formData.references.map(row => <div key={row.id} className="flex gap-2"><Input value={row.value} onChange={event => updateContact('references', row.id, { value: event.target.value })} placeholder="Nome e contato" className="flex-1 rounded-xl bg-background/70" /><Input value={row.label} onChange={event => updateContact('references', row.id, { label: event.target.value })} placeholder="Relação" className="h-10 w-28 rounded-xl bg-background/70" /><Button type="button" variant="ghost" size="icon" onClick={() => removeContact('references', row.id)} className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></div>)}</div>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3.5">
                    <div className="mb-3 flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /><div><p className="text-xs font-black text-foreground">Tags de segmentação</p><p className="text-[11px] text-muted-foreground">Pressione Enter para adicionar.</p></div></div>
                    <Input value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={handleTagKeyDown} placeholder="Ex.: progressivo, VIP, família" className="h-10 rounded-xl bg-background/70" />
                    <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">{formData.tags.map(tag => <Badge key={tag} className="gap-1 rounded-lg border-primary/20 bg-primary/10 text-[10px] font-bold text-primary hover:bg-primary/15">{tag}<button type="button" onClick={() => update('tags', formData.tags.filter(item => item !== tag))} aria-label={`Remover tag ${tag}`}><X className="h-3 w-3" /></button></Badge>)}{formData.tags.length === 0 && <span className="text-[11px] text-muted-foreground">Nenhuma tag adicionada.</span>}</div>
                  </div>
                </div>
              </section>

              <section data-customer-section="registro" className="scroll-mt-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <SectionHeading icon={ArrowUpRight} eyebrow="06 · Registro" title="Observações da equipe" description="Anote preferências, restrições, contexto ou informações importantes." />
                <Textarea value={formData.notes} onChange={event => update('notes', event.target.value)} placeholder="Ex.: prefere armações discretas, precisa de contato antes da entrega..." className="min-h-24 resize-y rounded-xl bg-background/60 border-border/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15" />
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border/70 bg-card px-3 py-2.5 sm:px-5">
            <div className="flex w-full items-center justify-between gap-3">
              <p className="hidden text-[10px] text-muted-foreground sm:block"><span className="font-bold text-primary">Dica:</span> complete os dados que ajudam sua equipe no atendimento.</p>
              <div className="ml-auto flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-9 rounded-lg px-4 text-xs font-bold">Cancelar</Button><Button type="submit" disabled={isLoading} className="h-9 gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"><Check className="h-3.5 w-3.5" />{isLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</> : mode === 'edit' ? 'Salvar alterações' : 'Salvar cliente'}</Button></div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
