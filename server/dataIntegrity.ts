export type IntegritySeverity = 'critical' | 'warning';

export type IntegrityIssue = {
  code: string;
  severity: IntegritySeverity;
  table: string;
  row_id: string | null;
  message: string;
};

export type IntegrityReport = {
  checked_at: string;
  ok: boolean;
  counts: {
    tables: number;
    rows: number;
    issues: number;
    critical: number;
    warning: number;
  };
  issues: IntegrityIssue[];
};

type Row = Record<string, unknown>;
type DataSet = Record<string, readonly Row[]>;

function text(value: unknown) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function indexById(rows: readonly Row[]) {
  return new Map(rows.map((row) => [text(row.id), row]).filter(([id]) => Boolean(id)) as Array<[string, Row]>);
}

function key(row: Row) {
  return text(row.id);
}

export function analyzeDataIntegrity(data: DataSet, checkedAt = new Date().toISOString()): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  const indexes = Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, indexById(rows)])) as Record<string, Map<string, Row>>;
  const rowCount = Object.values(data).reduce((total, rows) => total + rows.length, 0);

  const add = (code: string, severity: IntegritySeverity, table: string, row: Row, message: string) => {
    issues.push({ code, severity, table, row_id: key(row), message });
  };

  const requireReference = (table: string, rows: readonly Row[], column: string, referencedTable: string, label: string) => {
    const target = indexes[referencedTable] || new Map<string, Row>();
    for (const row of rows) {
      const reference = text(row[column]);
      if (reference && !target.has(reference)) add('missing_reference', 'critical', table, row, `${label} ${reference} não existe em ${referencedTable}.`);
    }
  };

  const requireCompanyAndStore = (table: string, rows: readonly Row[]) => {
    const companies = indexes.companies || new Map<string, Row>();
    const stores = indexes.stores || new Map<string, Row>();
    for (const row of rows) {
      const companyId = text(row.company_id);
      const storeId = text(row.store_id);
      if (companyId && !companies.has(companyId)) add('missing_company', 'critical', table, row, `Empresa ${companyId} não existe.`);
      if (storeId && !stores.has(storeId)) add('missing_store', 'critical', table, row, `Loja ${storeId} não existe.`);
      const store = storeId ? stores.get(storeId) : undefined;
      if (companyId && store && text(store.company_id) !== companyId) {
        add('company_store_mismatch', 'critical', table, row, `A loja ${storeId} pertence a outra empresa.`);
      }
    }
  };

  const tablesWithCompanyAndStore = [
    'employees', 'customers', 'appointments', 'product_stock', 'product_movements', 'sales', 'service_orders',
    'prescriptions', 'cash_registers', 'fixed_costs', 'fixed_cost_payments', 'financial_budgets', 'financial_installment_groups', 'financial_approvals', 'financial_card_settlements', 'financial_daily_closings',
    'fiscal_configs', 'fiscal_documents', 'fiscal_audits', 'fiscal_xml_imports',
  ];
  for (const table of tablesWithCompanyAndStore) requireCompanyAndStore(table, data[table] || []);

  const companyOnly = ['laboratories', 'professionals', 'products', 'product_categories', 'product_brands', 'product_images', 'product_audits', 'bank_accounts', 'financial_categories'];
  for (const table of companyOnly) requireReference(table, data[table] || [], 'company_id', 'companies', 'Empresa');

  requireReference('stores', data.stores || [], 'company_id', 'companies', 'Empresa');
  requireReference('profiles', data.profiles || [], 'role_id', 'roles', 'Perfil de acesso');
  requireReference('role_permissions', data.role_permissions || [], 'role_id', 'roles', 'Perfil de acesso');
  requireReference('role_permissions', data.role_permissions || [], 'permission_id', 'permissions', 'Permissão');
  requireReference('user_permissions', data.user_permissions || [], 'user_id', 'profiles', 'Usuário');
  requireReference('user_permissions', data.user_permissions || [], 'permission_id', 'permissions', 'Permissão');
  requireReference('appointments', data.appointments || [], 'professional_id', 'professionals', 'Profissional');
  requireReference('sales', data.sales || [], 'seller_id', 'employees', 'Vendedor');
  requireReference('sales', data.sales || [], 'service_order_id', 'service_orders', 'O.S.');
  requireReference('service_orders', data.service_orders || [], 'technician_id', 'employees', 'Técnico');
  requireReference('service_orders', data.service_orders || [], 'lab_id', 'laboratories', 'Laboratório');
  requireReference('service_orders', data.service_orders || [], 'prescription_id', 'prescriptions', 'Receita');
  requireReference('service_orders', data.service_orders || [], 'product_id', 'products', 'Produto');
  requireReference('prescriptions', data.prescriptions || [], 'professional_id', 'professionals', 'Profissional');
  requireReference('product_stock', data['product_stock'] || [], 'product_id', 'products', 'Produto');
  requireReference('product_movements', data['product_movements'] || [], 'product_id', 'products', 'Produto');
  requireReference('product_movements', data['product_movements'] || [], 'store_id', 'stores', 'Loja');
  requireReference('product_images', data['product_images'] || [], 'product_id', 'products', 'Produto');
  requireReference('product_audits', data['product_audits'] || [], 'product_id', 'products', 'Produto');
  requireReference('sale_items', data.sale_items || [], 'sale_id', 'sales', 'Venda');
  requireReference('sale_items', data.sale_items || [], 'product_id', 'products', 'Produto');
  requireReference('service_order_timeline', data.service_order_timeline || [], 'service_order_id', 'service_orders', 'O.S.');
  requireReference('cash_register_movements', data.cash_register_movements || [], 'cash_register_id', 'cash_registers', 'Caixa');
  requireReference('fixed_cost_payments', data.fixed_cost_payments || [], 'fixed_cost_id', 'fixed_costs', 'Custo fixo');
  requireReference('financial_entry_audits', data.financial_entry_audits || [], 'entry_id', 'financial_entries', 'Lançamento');
  requireReference('financial_approvals', data.financial_approvals || [], 'entry_id', 'financial_entries', 'Lançamento');
  requireReference('financial_card_settlements', data.financial_card_settlements || [], 'entry_id', 'financial_entries', 'Lançamento');
  requireReference('financial_card_settlements', data.financial_card_settlements || [], 'sale_id', 'sales', 'Venda');
  requireReference('financial_entries', data.financial_entries || [], 'category_id', 'financial_categories', 'Categoria financeira');
  requireReference('financial_entries', data.financial_entries || [], 'customer_id', 'customers', 'Cliente');
  requireReference('financial_entries', data.financial_entries || [], 'installment_group_id', 'financial_installment_groups', 'Grupo de parcelas');
  requireReference('financial_transfers', data.financial_transfers || [], 'from_cash_register_id', 'cash_registers', 'Caixa de origem');
  requireReference('financial_transfers', data.financial_transfers || [], 'to_cash_register_id', 'cash_registers', 'Caixa de destino');
  requireReference('bank_reconciliations', data.bank_reconciliations || [], 'bank_account_id', 'bank_accounts', 'Conta bancária');
  requireReference('bank_transactions', data.bank_transactions || [], 'bank_account_id', 'bank_accounts', 'Conta bancária');
  requireReference('bank_transactions', data.bank_transactions || [], 'reconciliation_id', 'bank_reconciliations', 'Conciliação');
  requireReference('fiscal_document_items', data.fiscal_document_items || [], 'document_id', 'fiscal_documents', 'Documento fiscal');
  requireReference('fiscal_events', data.fiscal_events || [], 'document_id', 'fiscal_documents', 'Documento fiscal');
  requireReference('fiscal_audits', data.fiscal_audits || [], 'document_id', 'fiscal_documents', 'Documento fiscal');

  const customerIndex = indexes.customers || new Map<string, Row>();
  const customerLinks: Array<[string, readonly Row[], string]> = [
    ['appointments', data.appointments || [], 'Agendamento'],
    ['sales', data.sales || [], 'Venda'],
    ['service_orders', data.service_orders || [], 'O.S.'],
    ['prescriptions', data.prescriptions || [], 'Receita'],
  ];
  for (const [table, rows, label] of customerLinks) {
    for (const row of rows) {
      const customerId = text(row.customer_id);
      if (!customerId) continue;
      const customer = customerIndex.get(customerId);
      if (!customer) {
        add('missing_customer', 'critical', table, row, `${label} aponta para o cliente ${customerId}, que não existe.`);
        continue;
      }
      const companyId = text(row.company_id);
      const storeId = text(row.store_id);
      if (companyId && text(customer.company_id) !== companyId) add('customer_company_mismatch', 'critical', table, row, `${label} e cliente pertencem a empresas diferentes.`);
      if (storeId && text(customer.store_id) !== storeId) add('customer_store_mismatch', 'warning', table, row, `${label} e cliente estão vinculados a lojas diferentes.`);
    }
  }

  const productIndex = indexes.products || new Map<string, Row>();
  for (const row of data.products || []) {
    const companyId = text(row.company_id);
    if (!companyId) add('missing_company', 'critical', 'products', row, 'Produto sem empresa vinculada.');
  }
  for (const row of data.product_stock || []) {
    const product = productIndex.get(text(row.product_id) || '');
    if (product && text(row.company_id) && text(product.company_id) !== text(row.company_id)) add('product_company_mismatch', 'critical', 'product_stock', row, 'Estoque e produto pertencem a empresas diferentes.');
  }

  for (const row of data.product_stock || []) {
    if (Number(row.quantity || 0) < 0 || Number(row.reserved_quantity || 0) < 0) add('negative_stock', 'warning', 'product_stock', row, 'Estoque ou reservado possui valor negativo.');
    if (Number(row.reserved_quantity || 0) > Number(row.quantity || 0)) add('reserved_exceeds_stock', 'warning', 'product_stock', row, 'Quantidade reservada é maior que o estoque disponível.');
  }

  const uniqueCodes = new Map<string, Row>();
  for (const row of data.fiscal_documents || []) {
    const idempotencyKey = text(row.idempotency_key);
    if (!idempotencyKey) add('missing_idempotency_key', 'critical', 'fiscal_documents', row, 'Documento fiscal sem chave de idempotência.');
    else if (uniqueCodes.has(idempotencyKey)) add('duplicate_idempotency_key', 'critical', 'fiscal_documents', row, `Chave de idempotência duplicada: ${idempotencyKey}.`);
    else uniqueCodes.set(idempotencyKey, row);
  }

  const critical = issues.filter((issue) => issue.severity === 'critical').length;
  const warning = issues.length - critical;
  return {
    checked_at: checkedAt,
    ok: critical === 0,
    counts: { tables: Object.keys(data).length, rows: rowCount, issues: issues.length, critical, warning },
    issues,
  };
}
