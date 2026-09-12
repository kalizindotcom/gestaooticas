import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Building2, Phone, Mail, MapPin, Store, Pencil, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import type { Company } from '@/hooks/useCompanies';

interface StoreType {
  id: string;
  name: string;
  companyId?: string;
  company_id?: string;
  status: string;
  code?: string;
  manager?: string;
  hours?: string;
  [key: string]: any;
}

interface CompanyDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  stores: StoreType[];
  onEdit: (company: Company) => void;
  onToggleStatus: (company: Company) => void;
  onDelete: (company: Company) => void;
}

export function CompanyDetailModal({ open, onOpenChange, company, stores, onEdit, onToggleStatus, onDelete }: CompanyDetailModalProps) {
  if (!company) return null;

  const companyStores = stores.filter(s => (s.companyId ?? s.company_id) === company.id);
  const activeStores = companyStores.filter(s => s.status === 'active').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            {company.tradeName}
            <StatusBadge status={company.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Brand strip */}
          <div className="h-2 rounded-full bg-gradient-to-r from-primary via-orange-500 to-primary" />

          {/* Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Razão Social</p>
              <p className="font-medium">{company.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">CNPJ</p>
              <p className="font-mono font-medium">{company.cnpj}</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{company.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{company.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{company.city}/{company.state}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Identidade laranja global</span>
            </div>
          </div>

          {/* Stores */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                Lojas vinculadas ({companyStores.length})
              </h4>
              <span className="text-xs text-muted-foreground">{activeStores} ativa{activeStores !== 1 ? 's' : ''}</span>
            </div>
            {companyStores.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma loja vinculada.</p>
            ) : (
              <div className="space-y-2">
                {companyStores.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{[s.code, s.manager, s.hours].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <StatusBadge status={s.status} variant="dot" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => { onOpenChange(false); onEdit(company); }}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => onToggleStatus(company)}>
              {company.status === 'active' ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />}
              {company.status === 'active' ? 'Inativar' : 'Ativar'}
            </Button>
            <Button size="sm" variant="destructive" className="gap-2 ml-auto" onClick={() => { onOpenChange(false); onDelete(company); }}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}