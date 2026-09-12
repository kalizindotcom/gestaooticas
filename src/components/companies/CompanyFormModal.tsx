import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Check, Loader2 } from 'lucide-react';
import type { Company } from '@/hooks/useCompanies';
import { toast } from 'sonner';
import { COMPANY_PALETTE } from '@/lib/branding';

interface CompanyFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
  onSave: (company: Company) => void;
  isLoading?: boolean;
}

const emptyCompany: Omit<Company, 'id'> = {
  name: '',
  tradeName: '',
  cnpj: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  status: 'active',
  ...COMPANY_PALETTE,
};

const STATUS_PRESETS = [
  { value: 'active', label: 'Ativo', color: '#10b981' },
  { value: 'inactive', label: 'Inativo', color: '#64748b' },
];

export function CompanyFormModal({ open, onOpenChange, company, onSave, isLoading }: CompanyFormModalProps) {
  const [form, setForm] = useState<Omit<Company, 'id'>>(emptyCompany);
  const isEdit = !!company;

  useEffect(() => {
    if (company) {
      const { id, ...rest } = company;
      setForm(rest);
    } else {
      setForm(emptyCompany);
    }
  }, [company, open]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.tradeName.trim() || !form.name.trim() || !form.cnpj.trim()) {
      toast.error('Preencha os campos obrigatórios: Razão Social, Nome Fantasia e CNPJ.');
      return;
    }
    const saved: Company = {
      id: company?.id || '',
      ...form,
      ...COMPANY_PALETTE,
    };
    onSave(saved);
    onOpenChange(false);
    toast.success(isEdit ? 'Empresa atualizada com sucesso!' : 'Empresa cadastrada com sucesso!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {isEdit ? 'Editar Empresa' : 'Nova Empresa'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tradeName">Nome Fantasia *</Label>
            <Input
              id="tradeName"
              value={form.tradeName}
              onChange={e => handleChange('tradeName', e.target.value)}
              placeholder="Ex: Visão Premium"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Razão Social *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="Ex: Ótica Visão Premium Ltda"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input
              id="cnpj"
              value={form.cnpj}
              onChange={e => handleChange('cnpj', e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="(00) 0000-0000"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="contato@empresa.com.br"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={form.city}
              onChange={e => handleChange('city', e.target.value)}
              placeholder="São Paulo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">UF</Label>
            <Input
              id="state"
              value={form.state}
              onChange={e => handleChange('state', e.target.value.toUpperCase())}
              placeholder="SP"
              maxLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={v => handleChange('status', v)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_PRESETS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-11 w-full sm:w-auto">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="min-h-11 w-full sm:w-auto">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {isEdit ? 'Salvar Alterações' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}