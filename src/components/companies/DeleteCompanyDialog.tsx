import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { Company } from '@/hooks/useCompanies';

interface StoreRef {
  id: string;
  companyId?: string;
  company_id?: string;
  [key: string]: any;
}

interface DeleteCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  stores: StoreRef[];
  onConfirm: () => void;
}

export function DeleteCompanyDialog({ open, onOpenChange, company, stores, onConfirm }: DeleteCompanyDialogProps) {
  if (!company) return null;
  const linkedStores = stores.filter(s => (s.companyId ?? s.company_id) === company.id);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{company.tradeName}</strong>?
            {linkedStores.length > 0 && (
              <span className="block mt-2 text-destructive font-medium">
                ⚠ Esta empresa possui {linkedStores.length} loja{linkedStores.length > 1 ? 's' : ''} vinculada{linkedStores.length > 1 ? 's' : ''}.
                As lojas também serão removidas.
              </span>
            )}
            <span className="block mt-2">Esta ação não poderá ser desfeita.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}