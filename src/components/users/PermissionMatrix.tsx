import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { usePermissions, type AccessControlPermission } from '@/hooks/useLocalData';
import { Loader2 } from 'lucide-react';

interface PermissionMatrixProps {
  selectedPermissions: string[];
  onChange: (permissionIds: string[]) => void;
  disabled?: boolean;
  permissions?: AccessControlPermission[];
}

export function PermissionMatrix({ selectedPermissions, onChange, disabled, permissions: providedPermissions }: PermissionMatrixProps) {
  const permissionsQuery = usePermissions();
  const permissions = providedPermissions ?? permissionsQuery.data ?? [];
  const isLoading = providedPermissions === undefined && permissionsQuery.isLoading;

  const moduleLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    appointments: 'Agendamentos',
    customers: 'Clientes',
    products: 'Produtos',
    sales: 'Vendas',
    service_orders: 'Ordens de Serviço',
    financial: 'Financeiro',
    reports: 'Relatórios',
    users: 'Usuários',
    settings: 'Configurações',
    companies: 'Empresas',
    stores: 'Lojas',
    admin_center: 'Centro de Admin',
    fiscal: 'Gestão Fiscal',
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Group permissions by module
  const modules = Array.from(new Set(permissions?.map(p => p.module) || []));
  const actions = ['view', 'create', 'edit', 'delete', 'delete_permanently', 'delete_installment', 'delete_credit_book', 'manage_fixed_costs', 'settle', 'reverse', 'reconcile', 'close_cash', 'manage_budgets', 'manage_transfers', 'approve', 'view_margin', 'export', 'print', 'generate_insights', 'manage_roles', 'view_cost', 'manage_cost', 'view_prices', 'manage_prices', 'manage_categories', 'manage_photos', 'view_stock', 'manage_stock', 'view_stock_history', 'view_sales_history', 'view_os_history', 'manage_product_tax', 'import', 'view_audit', 'view_statement', 'view_receivable', 'view_payable', 'view_fixed_costs', 'view_cashier', 'view_performance', 'view_reconciliation', 'view_operations', 'create_entry', 'edit_entry', 'delete_entry', 'settle_entry', 'reverse_entry', 'cancel_entry', 'export_statement', 'print_statement', 'open_cash', 'cash_movement', 'view_cash_history', 'manage_card_settlements', 'manage_bank_accounts', 'import_bank_statement', 'match_reconciliation', 'complete_reconciliation', 'generate_recurring', 'create_installments', 'manage_installments', 'emit', 'cancel', 'correct', 'inutilize', 'resend', 'view_xml', 'download_xml', 'configure', 'manage_credentials', 'view_tax_details', 'view_protocol', 'create_manual', 'manage_series'];
  const actionLabels: Record<string, string> = {
    view: 'Ver', create: 'Criar', edit: 'Editar', delete: 'Excluir', delete_permanently: 'Excluir permanentemente', delete_installment: 'Excluir parcela', delete_credit_book: 'Excluir carnê', manage_fixed_costs: 'Custos Fixos', settle: 'Baixar', reverse: 'Estornar', reconcile: 'Conciliar', close_cash: 'Fechar Caixa', manage_budgets: 'Orçamentos', manage_transfers: 'Transferências', approve: 'Aprovar', view_margin: 'Ver Margens', export: 'Exportar', print: 'Imprimir',
    generate_insights: 'Insights', manage_roles: 'Gerenciar Perfis', view_cost: 'Ver Custo', manage_cost: 'Editar Custo',
    view_prices: 'Ver Preços', manage_prices: 'Editar Preços', manage_categories: 'Categorias', manage_photos: 'Fotos',
    view_statement: 'Ver Extrato', view_receivable: 'Ver A Receber', view_payable: 'Ver A Pagar', view_fixed_costs: 'Ver Custos Fixos', view_cashier: 'Ver Caixas', view_performance: 'Ver DRE', view_reconciliation: 'Ver Conciliação', view_operations: 'Ver Operações',
    create_entry: 'Criar Lançamento', edit_entry: 'Editar Lançamento', delete_entry: 'Excluir Lançamento', settle_entry: 'Baixar Conta', reverse_entry: 'Estornar Conta', cancel_entry: 'Cancelar Lançamento', export_statement: 'Exportar Extrato', print_statement: 'Imprimir Extrato', open_cash: 'Abrir Caixa', cash_movement: 'Movimentar Caixa', view_cash_history: 'Histórico de Caixa', manage_card_settlements: 'Liquidações de Cartão', manage_bank_accounts: 'Contas Bancárias', import_bank_statement: 'Importar Extrato Bancário', match_reconciliation: 'Vincular Conciliação', complete_reconciliation: 'Concluir Conciliação', generate_recurring: 'Gerar Recorrências', create_installments: 'Criar Parcelamento', manage_installments: 'Gerenciar Parcelamentos',
    view_stock: 'Ver Estoque', manage_stock: 'Gerenciar Estoque', view_stock_history: 'Hist. Estoque',
    view_sales_history: 'Hist. Vendas', view_os_history: 'Hist. O.S.', manage_product_tax: 'Dados tributários de produtos', import: 'Importar', view_audit: 'Auditoria',
    emit: 'Emitir nota', cancel: 'Cancelar nota', correct: 'Corrigir nota', inutilize: 'Inutilizar numeração', resend: 'Reenviar nota', view_xml: 'Visualizar XML', download_xml: 'Baixar XML', configure: 'Configurar fiscal', manage_credentials: 'Gerenciar credenciais', view_tax_details: 'Ver impostos', view_protocol: 'Ver protocolo', create_manual: 'Criar nota manual', manage_series: 'Gerenciar séries',
  };

  const handleToggle = (permissionId: string) => {
    if (disabled) return;
    if (selectedPermissions.includes(permissionId)) {
      onChange(selectedPermissions.filter(id => id !== permissionId));
    } else {
      onChange([...selectedPermissions, permissionId]);
    }
  };

  const findPermission = (module: string, action: string) => permissions.find((permission) => (
    permission.module === module
    && (permission.action === action || permission.slug.endsWith(`.${action}`) || permission.slug.endsWith(`-${action}`))
  ));

  const isSelected = (module: string, action: string) => {
    const permission = findPermission(module, action);
    return permission ? selectedPermissions.includes(permission.id) : false;
  };

  const getPermId = (module: string, action: string) => findPermission(module, action)?.id;

  const handleSelectAll = () => {
    if (disabled) return;
    onChange(permissions.map(p => p.id));
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  return (
    <div className="space-y-4">
      {!disabled && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll} className="text-[10px] h-7 px-2">Selecionar Todas</Button>
          <Button variant="outline" size="sm" onClick={handleClearAll} className="text-[10px] h-7 px-2">Limpar Todas</Button>
        </div>
      )}
      <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[180px] text-xs font-bold uppercase">Módulo</TableHead>
            {actions.map(action => (
              <TableHead key={action} className="text-center text-xs font-bold uppercase">
                {actionLabels[action] || action}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {modules.map(module => (
            <TableRow key={module} className="hover:bg-muted/20">
              <TableCell className="font-medium text-xs font-heading">{moduleLabels[module] || module}</TableCell>
              {actions.map(action => {
                const permId = getPermId(module, action);
                return (
                  <TableCell key={action} className="text-center">
                    {permId && (
                      <Checkbox 
                        checked={isSelected(module, action)}
                        onCheckedChange={() => handleToggle(permId)}
                        disabled={disabled}
                      />
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
