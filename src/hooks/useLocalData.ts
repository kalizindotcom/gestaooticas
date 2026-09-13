import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localApi } from '@/lib/localApi';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';


// --- HELPERS ---
const transformCustomer = (c: any) => ({
  ...c,
  customerType: c.customer_type || 'individual',
  isActive: c.status !== 'inactive',
  nickname: c.nickname,
  legalName: c.legal_name,
  stateRegistration: c.state_registration,
  birthDate: c.birth_date,
  fatherName: c.father_name,
  motherName: c.mother_name,
  responsibleName: c.responsible_name,
  responsibleRelationship: c.responsible_relationship,
  familyIncome: c.family_income,
  discountPercent: c.discount_percent,
  preferredSellerId: c.preferred_seller_id,
  externalCode: c.external_code,
  companyId: c.company_id,
  storeId: c.store_id,
  lastVisit: c.last_visit,
  phones: c.phones_json || [],
  emails: c.emails_json || [],
  references: c.references_json || [],
  address: {
    street: c.address_street,
    number: c.address_number,
    complement: c.address_complement,
    neighborhood: c.address_neighborhood,
    city: c.address_city,
    state: c.address_state,
    zipCode: c.address_zip_code,
    reference: c.address_reference,
  }
});

const transformAppointment = (a: any) => ({
  ...a,
  customerId: a.customer_id,
  customerName: a.customer_name,
  companyId: a.company_id,
  storeId: a.store_id,
  storeName: a.store_name,
  professional: a.professional_name,
});

const transformSale = (s: any) => ({
  ...s,
  companyId: s.company_id,
  storeId: s.store_id,
  customerId: s.customer_id,
  customerName: s.customer_name,
  sellerId: s.seller_id,
  sellerName: s.seller_name,
  items: s.sale_items?.map((i: any) => ({
    product: i.product_name,
    qty: i.quantity,
    price: i.unit_price,
    total: i.total_price
  })) || []
});

const transformServiceOrder = (os: any) => ({
  ...os,
  companyId: os.company_id,
  storeId: os.store_id,
  customerId: os.customer_id,
  customerName: os.customers?.name || os.customer_name || '—',
  customerNickname: os.customers?.nickname || '',
  customerPhone: os.customers?.phone || os.customers?.whatsapp || os.customer_phone || '',
  customerDocument: os.customers?.cpf || os.customers?.cnpj || os.customer_cpf || '',
  customerDocumentLabel: os.customers?.cnpj ? 'CNPJ' : 'CPF',
  technicianId: os.technician_id,
  technicianName: os.employees?.name || '—',
  deliveryDate: os.delivery_date,
  estimatedDeadline: os.estimated_deadline,
  dueDate: os.due_date || os.financialEntry?.due_date || '',
  paidAmount: Number(os.paid_amount ?? os.financialEntry?.paid_amount ?? 0),
  balance: Number(os.balance ?? Math.max(Number(os.total || 0) - Number(os.paid_amount ?? os.financialEntry?.paid_amount ?? 0), 0)),
  financialStatus: os.financial_status || os.financialEntry?.status,
  paymentMethod: os.payment_method || os.financialEntry?.payment_method,
  paymentNote: os.payment_note || os.financialEntry?.payment_note || '',
  prescriptionDate: os.prescription_date,
  prescriptionValidUntil: os.prescription_valid_until,
  prescriptionId: os.prescription_id || '',
  prescriptionProfessionalId: os.prescription_professional_id,
  serviceType: os.service_type,
  productId: os.product_id || '',
  productQuantity: Number(os.product_quantity || 1),
  product: os.product_name || os.frame_name || '',
  lens: os.lens_name || '',
  labId: os.lab_id || '',
  lab: os.laboratories?.name || os.lab_name || '',
  internalNotes: os.internal_notes,
  prescription: {
    rightEye: { sph: os.od_sph, cyl: os.od_cyl, axis: os.od_axis, add: os.od_add },
    leftEye: { sph: os.oe_sph, cyl: os.oe_cyl, axis: os.oe_axis, add: os.oe_add },
    pupillaryDistance: os.pupillary_distance,
    largestDiagonal: os.largest_diagonal,
    verticalHeight: os.vertical_height,
    frameSize: os.frame_size,
    bridgeSize: os.bridge_size,
    frameAndBridge: os.frame_and_bridge,
    opticalCenterHeight: os.optical_center_height,
    rightEyeFar: os.od_far,
    rightEyeNear: os.od_near,
    leftEyeFar: os.oe_far,
    leftEyeNear: os.oe_near,
  },
  timeline: os.service_order_timeline?.map((t: any) => ({
    date: t.date,
    action: t.action,
    user: t.user_name,
    userId: t.user_id,
    status: t.status
  })) || []
});

// --- CUSTOMERS ---
export const useCustomers = () => {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  
  return useQuery({
    queryKey: ['customers', selectedCompanyId, selectedStoreIds],
    queryFn: async () => {
      let query = localApi.from('customers').select('*');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      if (selectedStoreIds.length > 0) query = query.in('store_id', selectedStoreIds);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(transformCustomer);
    },
    enabled: !!selectedCompanyId,
  });
};

// --- APPOINTMENTS ---
export const useAppointments = () => {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  
  return useQuery({
    queryKey: ['appointments', selectedCompanyId, selectedStoreIds],
    queryFn: async () => {

      let query = localApi.from('appointments').select('*, customers(name, nickname, phone, whatsapp, cpf, cnpj), stores(name)');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      if (selectedStoreIds.length > 0) query = query.in('store_id', selectedStoreIds);
      const { data, error } = await query;
      if (error) throw error;
      return data.map((a: any) => ({
        ...a,
        customerId: a.customer_id,
        customerName: a.customers?.name || a.guest_name || 'Visitante',
        customerNickname: a.customers?.nickname || '',
        phone: a.customers?.phone || a.customers?.whatsapp || '',
        customerDocument: a.customers?.cpf || a.customers?.cnpj || '',
        customerDocumentLabel: a.customers?.cnpj ? 'CNPJ' : 'CPF',
        companyId: a.company_id,
        storeId: a.store_id,
        storeName: a.stores?.name || '',
        professional: a.professional_name,
        time: a.time ? a.time.slice(0, 5) : a.time,
        isGuest: !a.customer_id,
      }));
    },
    enabled: !!selectedCompanyId,
  });
};

// --- SALES ---
export const useSales = (options?: { enabled?: boolean }) => {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();

  return useQuery({
    queryKey: ['sales', selectedCompanyId, selectedStoreIds],
    queryFn: async () => {
      let query = localApi.from('sales').select('*, sale_items(*), customers(name, nickname, cpf, cnpj, phone, whatsapp), stores(name), employees(name)');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      if (selectedStoreIds.length > 0) query = query.in('store_id', selectedStoreIds);
      const { data, error } = await query;
      if (error) throw error;
      return data.map((s: any) => ({
        ...s,
        companyId: s.company_id,
        storeId: s.store_id,
        customerId: s.customer_id,
        sellerId: s.seller_id,
        customerName: s.customers?.name || s.customer_name || 'Cliente avulso',
        customerNickname: s.customers?.nickname || '',
        customerDocument: s.customers?.cpf || s.customers?.cnpj || '',
        customerDocumentLabel: s.customers?.cnpj ? 'CNPJ' : 'CPF',
        customerPhone: s.customers?.phone || s.customers?.whatsapp || '',
        sellerName: s.employees?.name || '—',
        storeName: s.stores?.name || '—',
        paymentMethod: s.payment_method,
        items: s.sale_items?.map((i: any) => ({
          productId: i.product_id,
          product: i.product_name,
          qty: i.quantity,
          price: i.unit_price,
          total: i.total_price,
        })) || [],
      }));
    },
    enabled: !!selectedCompanyId && (options?.enabled ?? true),
  });
};

// --- SERVICE ORDERS ---
export const useServiceOrders = () => {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  
  return useQuery({
    queryKey: ['service_orders', selectedCompanyId, selectedStoreIds],
    queryFn: async () => {

      let query = localApi.from('service_orders').select('*, service_order_timeline(*), customers(name, nickname, phone, whatsapp, cpf, cnpj), employees(name), laboratories(name)');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      if (selectedStoreIds.length > 0) query = query.in('store_id', selectedStoreIds);
      const { data, error } = await query;
      if (error) throw error;
      const orderIds = (data || []).map((order: any) => order.id);
      const entriesRes = orderIds.length
        ? await localApi.from('financial_entries').select('origin_id, payment_method, payment_note, due_date, paid_amount, status').eq('origin_table', 'service_orders').in('origin_id', orderIds)
        : { data: [], error: null };
      if (entriesRes.error) throw entriesRes.error;
      const entryByOrderId = new Map((entriesRes.data || []).map((entry: any) => [entry.origin_id, entry]));
      return (data || []).map((order: any) => transformServiceOrder({ ...order, financialEntry: entryByOrderId.get(order.id) }));
    },
    enabled: !!selectedCompanyId,
  });
};

// --- PRODUCTS ---
export const useProducts = () => {
  const { selectedCompanyId } = useGlobalFilter();
  
  return useQuery({
    queryKey: ['products', selectedCompanyId],
    queryFn: async () => {
      let query = localApi.from('products').select('*, product_stock(*), product_images(*)');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompanyId,
  });
};

export const useProductsPage = (page: number, pageSize = 30, search = '') => {
  const { selectedCompanyId } = useGlobalFilter();
  return useQuery<{ rows: any[]; total: number }>({
    queryKey: ['products-page', selectedCompanyId, page, pageSize, search],
    queryFn: async () => {
      let query = localApi.from('products').select('*, product_stock(*), product_images(*)').eq('company_id', selectedCompanyId!).eq('status', 'active').order('name').limit(pageSize).offset(page * pageSize);
      if (search.trim()) query = query.contains('name', search.trim());
      const { data, error, meta } = await query;
      if (error) throw error;
      return { rows: data || [], total: meta?.total || 0 };
    },
    enabled: !!selectedCompanyId,
  });
};

// --- PRODUCT MOVEMENTS ---
export const useProductMovements = () => {
  const { selectedCompanyId } = useGlobalFilter();

  return useQuery({
    queryKey: ['product_movements', selectedCompanyId],
    queryFn: async () => {
      try {
        // product_movements has no company_id column — filter via os produtos da empresa.
        const { data: companyProducts, error: productsError } = await localApi
          .from('products')
          .select('id')
          .eq('company_id', selectedCompanyId!);
        if (productsError) throw productsError;
        const productIds = (companyProducts || []).map((product: any) => product.id).filter(Boolean);
        if (productIds.length === 0) return [];
        const { data, error } = await localApi
          .from('product_movements')
          .select('*')
          .in('product_id', productIds)
          .order('date', { ascending: false })
          .limit(200);
        if (error) {
          console.warn('product_movements query failed:', error.message);
          return [];
        }
        return (data || []).map((m: any) => ({
          ...m,
          productId: m.product_id,
          productName: m.product_name || '—',
          store: m.store_name || '—',
          user: m.user_name || m.user_id?.slice(0, 8) || '—',
          before: m.quantity_before,
          after: m.quantity_after,
          reservedBefore: m.reserved_before,
          reservedAfter: m.reserved_after,
          documentNumber: m.document_number,
          supplierName: m.supplier_name,
          reason: m.reason,
          date: m.date ? new Date(m.date).toLocaleString('pt-BR') : '—',
        }));
      } catch (e) {
        console.warn('product_movements exception:', e);
        return [];
      }
    },
    enabled: !!selectedCompanyId,
  });
};

export const useProductAudits = (productId?: string) => {
  const { selectedCompanyId } = useGlobalFilter();
  return useQuery({
    queryKey: ['product_audits', selectedCompanyId, productId],
    queryFn: async () => {
      if (!selectedCompanyId || !productId) return [];
      const { data, error } = await localApi.from('product_audits').select('*').eq('company_id', selectedCompanyId).eq('product_id', productId).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompanyId && !!productId,
  });
};

export const useProductCategories = () => {
  const { selectedCompanyId } = useGlobalFilter();
  return useQuery({
    queryKey: ['product_categories', selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await localApi.from('product_categories').select('*').eq('company_id', selectedCompanyId!).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompanyId,
  });
};

export const useProductBrands = () => {
  const { selectedCompanyId } = useGlobalFilter();
  return useQuery({
    queryKey: ['product_brands', selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await localApi.from('product_brands').select('*').eq('company_id', selectedCompanyId!).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompanyId,
  });
};

// --- FINANCIAL ENTRIES ---
export const useFinancialEntries = () => {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  
  return useQuery({
    queryKey: ['financial_entries', selectedCompanyId, selectedStoreIds],
    queryFn: async () => {
      let query = localApi.from('financial_entries').select('*');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      if (selectedStoreIds.length > 0) query = query.in('store_id', selectedStoreIds);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompanyId,
  });
};

// --- EMPLOYEES ---
export const useEmployees = () => {
  const { selectedCompanyId } = useGlobalFilter();

  return useQuery({
    queryKey: ['employees', selectedCompanyId],
    queryFn: async () => {
      let query = localApi.from('employees').select('*');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompanyId,
  });
};

// --- STORES ---
export const useStores = () => {
  const { selectedCompanyId } = useGlobalFilter();

  return useQuery({
    queryKey: ['stores', selectedCompanyId],
    queryFn: async () => {
      let query = localApi.from('stores').select('*');
      if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompanyId,
  });
};

// --- PROFILES (Users) ---
export const useProfiles = () => {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      try {
        const { data, error } = await localApi.from('profiles').select('*');
        if (error) {
          console.warn('Error fetching profiles:', error.message);
          return [];
        }
        return data || [];
      } catch (e) {
        return [];
      }
    },
  });
};

// --- PERMISSIONS ---
const DEFAULT_PERMISSIONS = [
  // Dashboard
  { id: 'p1', name: 'Dashboard Ver', slug: 'dashboard.view', module: 'dashboard', action: 'view' },
  { id: 'p2', name: 'Dashboard Insights', slug: 'dashboard.generate_insights', module: 'dashboard', action: 'generate_insights' },
  // Appointments
  { id: 'p3', name: 'Agendamentos Ver', slug: 'appointments.view', module: 'appointments', action: 'view' },
  { id: 'p4', name: 'Agendamentos Criar', slug: 'appointments.create', module: 'appointments', action: 'create' },
  { id: 'p5', name: 'Agendamentos Editar', slug: 'appointments.edit', module: 'appointments', action: 'edit' },
  { id: 'p6', name: 'Agendamentos Excluir', slug: 'appointments.delete', module: 'appointments', action: 'delete' },
  // Customers
  { id: 'p7', name: 'Clientes Ver', slug: 'customers.view', module: 'customers', action: 'view' },
  { id: 'p8', name: 'Clientes Criar', slug: 'customers.create', module: 'customers', action: 'create' },
  { id: 'p9', name: 'Clientes Editar', slug: 'customers.edit', module: 'customers', action: 'edit' },
  { id: 'p10', name: 'Clientes Excluir', slug: 'customers.delete', module: 'customers', action: 'delete' },
  { id: 'p10b', name: 'Clientes Exportar', slug: 'customers.export', module: 'customers', action: 'export' },
  { id: 'p10c', name: 'Clientes Imprimir', slug: 'customers.print', module: 'customers', action: 'print' },
  // Sales
  { id: 'p11', name: 'Vendas Ver', slug: 'sales.view', module: 'sales', action: 'view' },
  { id: 'p12', name: 'Vendas Criar', slug: 'sales.create', module: 'sales', action: 'create' },
  { id: 'p13', name: 'Vendas Editar', slug: 'sales.edit', module: 'sales', action: 'edit' },
  { id: 'p14', name: 'Vendas Excluir', slug: 'sales.delete', module: 'sales', action: 'delete' },
  { id: 'p15', name: 'Vendas Exportar', slug: 'sales.export', module: 'sales', action: 'export' },
  // Financial
  { id: 'p16', name: 'Financeiro Ver', slug: 'financial.view', module: 'financial', action: 'view' },
  { id: 'p17', name: 'Financeiro Criar', slug: 'financial.create', module: 'financial', action: 'create' },
  { id: 'p18', name: 'Financeiro Editar', slug: 'financial.edit', module: 'financial', action: 'edit' },
  { id: 'p19', name: 'Financeiro Excluir', slug: 'financial.delete', module: 'financial', action: 'delete' },
  { id: 'p20', name: 'Financeiro Exportar', slug: 'financial.export', module: 'financial', action: 'export' },
  { id: 'p20b', name: 'Custos Fixos Gerenciar', slug: 'financial.manage_fixed_costs', module: 'financial', action: 'manage_fixed_costs' },
  { id: 'p20c', name: 'Financeiro Baixar', slug: 'financial.settle', module: 'financial', action: 'settle' },
  { id: 'p20d', name: 'Financeiro Estornar', slug: 'financial.reverse', module: 'financial', action: 'reverse' },
  { id: 'p20e', name: 'Financeiro Conciliar', slug: 'financial.reconcile', module: 'financial', action: 'reconcile' },
  { id: 'p20f', name: 'Financeiro Fechar Caixa', slug: 'financial.close_cash', module: 'financial', action: 'close_cash' },
  { id: 'p20g', name: 'Financeiro Gerenciar Orçamentos', slug: 'financial.manage_budgets', module: 'financial', action: 'manage_budgets' },
  { id: 'p20h', name: 'Financeiro Gerenciar Transferências', slug: 'financial.manage_transfers', module: 'financial', action: 'manage_transfers' },
  { id: 'p20i', name: 'Financeiro Aprovar', slug: 'financial.approve', module: 'financial', action: 'approve' },
  { id: 'p20j', name: 'Financeiro Ver Margens', slug: 'financial.view_margin', module: 'financial', action: 'view_margin' },
  { id: 'p20k', name: 'Financeiro Reabrir Fechamento', slug: 'financial.reopen_closing', module: 'financial', action: 'reopen_closing' },
  { id: 'p20l', name: 'Financeiro Ver Extrato', slug: 'financial.view_statement', module: 'financial', action: 'view_statement' },
  { id: 'p20m', name: 'Financeiro Ver Contas a Receber', slug: 'financial.view_receivable', module: 'financial', action: 'view_receivable' },
  { id: 'p20n', name: 'Financeiro Ver Contas a Pagar', slug: 'financial.view_payable', module: 'financial', action: 'view_payable' },
  { id: 'p20o', name: 'Financeiro Ver Custos Fixos', slug: 'financial.view_fixed_costs', module: 'financial', action: 'view_fixed_costs' },
  { id: 'p20p', name: 'Financeiro Ver Caixas', slug: 'financial.view_cashier', module: 'financial', action: 'view_cashier' },
  { id: 'p20q', name: 'Financeiro Ver DRE e Performance', slug: 'financial.view_performance', module: 'financial', action: 'view_performance' },
  { id: 'p20r', name: 'Financeiro Ver Conciliação', slug: 'financial.view_reconciliation', module: 'financial', action: 'view_reconciliation' },
  { id: 'p20s', name: 'Financeiro Ver Operações', slug: 'financial.view_operations', module: 'financial', action: 'view_operations' },
  { id: 'p20t', name: 'Financeiro Criar Lançamento', slug: 'financial.create_entry', module: 'financial', action: 'create_entry' },
  { id: 'p20u', name: 'Financeiro Editar Lançamento', slug: 'financial.edit_entry', module: 'financial', action: 'edit_entry' },
  { id: 'p20v', name: 'Financeiro Excluir Lançamento', slug: 'financial.delete_entry', module: 'financial', action: 'delete_entry' },
  { id: 'p20w', name: 'Financeiro Baixar Conta', slug: 'financial.settle_entry', module: 'financial', action: 'settle_entry' },
  { id: 'p20x', name: 'Financeiro Estornar Conta', slug: 'financial.reverse_entry', module: 'financial', action: 'reverse_entry' },
  { id: 'p20an', name: 'Financeiro Cancelar Lançamento', slug: 'financial.cancel_entry', module: 'financial', action: 'cancel_entry' },
  { id: 'p20y', name: 'Financeiro Exportar Extrato', slug: 'financial.export_statement', module: 'financial', action: 'export_statement' },
  { id: 'p20z', name: 'Financeiro Imprimir Extrato', slug: 'financial.print_statement', module: 'financial', action: 'print_statement' },
  { id: 'p20aa', name: 'Financeiro Abrir Caixa', slug: 'financial.open_cash', module: 'financial', action: 'open_cash' },
  { id: 'p20ab', name: 'Financeiro Movimentar Caixa', slug: 'financial.cash_movement', module: 'financial', action: 'cash_movement' },
  { id: 'p20ac', name: 'Financeiro Ver Histórico de Caixa', slug: 'financial.view_cash_history', module: 'financial', action: 'view_cash_history' },
  { id: 'p20ad', name: 'Financeiro Gerenciar Liquidações de Cartão', slug: 'financial.manage_card_settlements', module: 'financial', action: 'manage_card_settlements' },
  { id: 'p20ae', name: 'Financeiro Gerenciar Contas Bancárias', slug: 'financial.manage_bank_accounts', module: 'financial', action: 'manage_bank_accounts' },
  { id: 'p20af', name: 'Financeiro Importar Extrato Bancário', slug: 'financial.import_bank_statement', module: 'financial', action: 'import_bank_statement' },
  { id: 'p20ag', name: 'Financeiro Vincular Conciliação', slug: 'financial.match_reconciliation', module: 'financial', action: 'match_reconciliation' },
  { id: 'p20ah', name: 'Financeiro Concluir Conciliação', slug: 'financial.complete_reconciliation', module: 'financial', action: 'complete_reconciliation' },
  { id: 'p20ai', name: 'Financeiro Gerar Recorrências', slug: 'financial.generate_recurring', module: 'financial', action: 'generate_recurring' },
  { id: 'p20aj', name: 'Financeiro Criar Parcelamento', slug: 'financial.create_installments', module: 'financial', action: 'create_installments' },
  { id: 'p20ak', name: 'Financeiro Gerenciar Parcelamentos', slug: 'financial.manage_installments', module: 'financial', action: 'manage_installments' },
  { id: 'p20al', name: 'Financeiro Ver Auditoria', slug: 'financial.view_audit', module: 'financial', action: 'view_audit' },
  { id: 'p20am', name: 'Financeiro Gerenciar Categorias', slug: 'financial.manage_categories', module: 'financial', action: 'manage_categories' },
  // Fiscal
  { id: 'p50', name: 'Fiscal Ver', slug: 'fiscal.view', module: 'fiscal', action: 'view' },
  { id: 'p51', name: 'Fiscal Criar', slug: 'fiscal.create', module: 'fiscal', action: 'create' },
  { id: 'p52', name: 'Fiscal Editar', slug: 'fiscal.edit', module: 'fiscal', action: 'edit' },
  { id: 'p53', name: 'Fiscal Excluir', slug: 'fiscal.delete', module: 'fiscal', action: 'delete' },
  { id: 'p54', name: 'Fiscal Emitir nota', slug: 'fiscal.emit', module: 'fiscal', action: 'emit' },
  { id: 'p55', name: 'Fiscal Cancelar nota', slug: 'fiscal.cancel', module: 'fiscal', action: 'cancel' },
  { id: 'p56', name: 'Fiscal Corrigir nota', slug: 'fiscal.correct', module: 'fiscal', action: 'correct' },
  { id: 'p57', name: 'Fiscal Inutilizar numeração', slug: 'fiscal.inutilize', module: 'fiscal', action: 'inutilize' },
  { id: 'p58', name: 'Fiscal Reenviar nota', slug: 'fiscal.resend', module: 'fiscal', action: 'resend' },
  { id: 'p59', name: 'Fiscal Visualizar XML', slug: 'fiscal.view_xml', module: 'fiscal', action: 'view_xml' },
  { id: 'p60', name: 'Fiscal Baixar XML', slug: 'fiscal.download_xml', module: 'fiscal', action: 'download_xml' },
  { id: 'p61', name: 'Fiscal Imprimir documento', slug: 'fiscal.print', module: 'fiscal', action: 'print' },
  { id: 'p62', name: 'Fiscal Configurar', slug: 'fiscal.configure', module: 'fiscal', action: 'configure' },
  { id: 'p63', name: 'Fiscal Gerenciar credenciais', slug: 'fiscal.manage_credentials', module: 'fiscal', action: 'manage_credentials' },
  { id: 'p64', name: 'Fiscal Ver impostos', slug: 'fiscal.view_tax_details', module: 'fiscal', action: 'view_tax_details' },
  { id: 'p65', name: 'Fiscal Ver protocolo', slug: 'fiscal.view_protocol', module: 'fiscal', action: 'view_protocol' },
  { id: 'p66', name: 'Fiscal Criar nota manual', slug: 'fiscal.create_manual', module: 'fiscal', action: 'create_manual' },
  { id: 'p67', name: 'Fiscal Gerenciar séries', slug: 'fiscal.manage_series', module: 'fiscal', action: 'manage_series' },
  { id: 'p68', name: 'Fiscal Exportar', slug: 'fiscal.export', module: 'fiscal', action: 'export' },
  { id: 'p69', name: 'Fiscal Importar', slug: 'fiscal.import', module: 'fiscal', action: 'import' },
  { id: 'p70', name: 'Fiscal Ver auditoria', slug: 'fiscal.view_audit', module: 'fiscal', action: 'view_audit' },
  // Products
  { id: 'p21', name: 'Produtos Ver', slug: 'products.view', module: 'products', action: 'view' },
  { id: 'p22', name: 'Produtos Criar', slug: 'products.create', module: 'products', action: 'create' },
  { id: 'p23', name: 'Produtos Editar', slug: 'products.edit', module: 'products', action: 'edit' },
  { id: 'p24', name: 'Produtos Excluir', slug: 'products.delete', module: 'products', action: 'delete' },
  { id: 'p24a', name: 'Produtos Excluir permanentemente', slug: 'products.delete_permanently', module: 'products', action: 'delete_permanently' },
  // Service Orders
  { id: 'p25', name: 'Ordens de Serviço Ver', slug: 'service_orders.view', module: 'service_orders', action: 'view' },
  { id: 'p26', name: 'Ordens de Serviço Criar', slug: 'service_orders.create', module: 'service_orders', action: 'create' },
  { id: 'p27', name: 'Ordens de Serviço Editar', slug: 'service_orders.edit', module: 'service_orders', action: 'edit' },
  { id: 'p28', name: 'Ordens de Serviço Excluir', slug: 'service_orders.delete', module: 'service_orders', action: 'delete' },
  { id: 'p29', name: 'Ordens de Serviço Imprimir', slug: 'service_orders.print', module: 'service_orders', action: 'print' },
  // Reports
  { id: 'p30', name: 'Relatórios Ver', slug: 'reports.view', module: 'reports', action: 'view' },
  { id: 'p31', name: 'Relatórios Exportar', slug: 'reports.export', module: 'reports', action: 'export' },
  // Users
  { id: 'p32', name: 'Usuários Ver', slug: 'users.view', module: 'users', action: 'view' },
  { id: 'p33', name: 'Usuários Criar', slug: 'users.create', module: 'users', action: 'create' },
  { id: 'p34', name: 'Usuários Editar', slug: 'users.edit', module: 'users', action: 'edit' },
  { id: 'p35', name: 'Usuários Excluir', slug: 'users.delete', module: 'users', action: 'delete' },
  { id: 'p36', name: 'Gerenciar Perfis', slug: 'users.manage_roles', module: 'users', action: 'manage_roles' },
  // Settings
  { id: 'p37', name: 'Configurações Ver', slug: 'settings.view', module: 'settings', action: 'view' },
  { id: 'p38', name: 'Configurações Editar', slug: 'settings.edit', module: 'settings', action: 'edit' },
  // Companies
  { id: 'p39', name: 'Empresas Ver', slug: 'companies.view', module: 'companies', action: 'view' },
  { id: 'p40', name: 'Empresas Criar', slug: 'companies.create', module: 'companies', action: 'create' },
  { id: 'p41', name: 'Empresas Editar', slug: 'companies.edit', module: 'companies', action: 'edit' },
  { id: 'p42', name: 'Empresas Excluir', slug: 'companies.delete', module: 'companies', action: 'delete' },
  // Stores
  { id: 'p43', name: 'Lojas Ver', slug: 'stores.view', module: 'stores', action: 'view' },
  { id: 'p44', name: 'Lojas Criar', slug: 'stores.create', module: 'stores', action: 'create' },
  { id: 'p45', name: 'Lojas Editar', slug: 'stores.edit', module: 'stores', action: 'edit' },
  { id: 'p46', name: 'Lojas Excluir', slug: 'stores.delete', module: 'stores', action: 'delete' },
  // Admin Center
  { id: 'p47', name: 'Centro de Admin Ver', slug: 'admin_center.view', module: 'admin_center', action: 'view' },
  { id: 'p48', name: 'Centro de Admin Editar', slug: 'admin_center.edit', module: 'admin_center', action: 'edit' },
];

export type AccessControlPermission = {
  id: string;
  name: string;
  slug: string;
  module: string;
  action: string;
  created_at?: string;
};

export type AccessControlRole = {
  id: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  created_at?: string;
  assigned_user_count?: number;
  role_permissions?: Array<{ permission_id: string }>;
};

export type AccessControlData = {
  roles: AccessControlRole[];
  permissions: AccessControlPermission[];
};

export const useAccessControl = () => {
  return useQuery({
    queryKey: ['access-control'],
    queryFn: async () => {
      const { data, error } = await localApi.auth.admin.getAccessControl();
      if (error) throw error;
      return (data || { roles: [], permissions: [] }) as AccessControlData;
    },
  });
};

export const usePermissions = () => {
  const query = useAccessControl();
  return { ...query, data: query.data?.permissions };
};

// --- ROLES ---
const DEFAULT_ROLES = [
  { id: 'r1', name: 'admin_master', description: 'Administrador Master', is_system: true, role_permissions: [] },
  { id: 'r2', name: 'admin', description: 'Administrador', is_system: true, role_permissions: [] },
  { id: 'r3', name: 'manager', description: 'Gerente', is_system: true, role_permissions: [] },
  { id: 'r4', name: 'seller', description: 'Vendedor', is_system: true, role_permissions: [] },
  { id: 'r5', name: 'optometrist', description: 'Optometrista', is_system: true, role_permissions: [] },
  { id: 'r6', name: 'technician', description: 'Técnico', is_system: true, role_permissions: [] },
  { id: 'r7', name: 'receptionist', description: 'Recepcionista', is_system: true, role_permissions: [] },
  { id: 'r8', name: 'financial', description: 'Financeiro', is_system: true, role_permissions: [] },
  { id: 'r9', name: 'user', description: 'Usuário Comum', is_system: true, role_permissions: [] },
];

export const useRoles = () => {
  const query = useAccessControl();
  return { ...query, data: query.data?.roles };
};

// --- USER PERMISSIONS ---
export const useUserPermissions = (userId?: string) => {
  return useQuery({
    queryKey: ['user_permissions', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const { data, error } = await localApi.from('user_permissions').select('*').eq('user_id', userId);
        if (error) {
          console.warn('Error fetching user permissions:', error.message);
          return [];
        }
        return data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!userId,
  });
};

// --- SEED PERMISSIONS ---
export const useSeedPermissions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // First, seed permissions
      const permissionsToInsert = DEFAULT_PERMISSIONS.map(({ id, ...rest }) => rest);
      const { data: permData, error: permError } = await localApi
        .from('permissions')
        .upsert(permissionsToInsert, { onConflict: 'slug' })
        .select();
      if (permError) throw permError;

      // Then, seed roles
      const rolesToInsert = DEFAULT_ROLES.map(({ id, role_permissions, ...rest }) => rest);
      const { data: roleData, error: roleError } = await localApi
        .from('roles')
        .upsert(rolesToInsert, { onConflict: 'name' })
        .select();
      if (roleError) throw roleError;

      // Finally, assign all permissions to admin_master
      const adminMasterRole = roleData?.find(r => r.name === 'admin_master');
      if (adminMasterRole && permData) {
        const rolePermissions = permData.map(p => ({
          role_id: adminMasterRole.id,
          permission_id: p.id
        }));

        // Delete existing and insert new
        await localApi.from('role_permissions').delete().eq('role_id', adminMasterRole.id);
        const { error: rpError } = await localApi.from('role_permissions').insert(rolePermissions);
        if (rpError) throw rpError;
      }

      return { permissions: permData, roles: roleData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
};

// --- PROFESSIONALS ---
export const useProfessionals = () => {
  const { selectedCompanyId } = useGlobalFilter();
  return useQuery({
    queryKey: ['professionals', selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await localApi
        .from('professionals')
        .select('*')
        .eq('company_id', selectedCompanyId!)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompanyId,
  });
};

// --- LABORATORIES ---
export const useLaboratories = () => {
  const { selectedCompanyId } = useGlobalFilter();
  return useQuery({
    queryKey: ['laboratories', selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await localApi
        .from('laboratories')
        .select('*')
        .eq('company_id', selectedCompanyId!)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompanyId,
  });
};

// --- GENERIC MUTATION HELPER ---
export const useLocalMutation = (table: string, keyToInvalidate: string[][]) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, id, data }: { action: 'insert' | 'update' | 'delete', id?: string, data?: any }) => {
      if (action === 'insert') {
        const { data: inserted, error } = await localApi.from(table).insert(data).select().single();
        if (error) throw error;
        return inserted;
      } else if (action === 'update' && id) {
        const { data: updated, error } = await localApi.from(table).update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated;
      } else if (action === 'delete' && id) {
        const { error } = await localApi.from(table).delete().eq('id', id);
        if (error) throw error;
        return true;
      }
    },
    onMutate: async ({ action, id, data }) => {
      // FIX Bug #7: capturar estado anterior para rollback no onError
      const previousData = new Map<string, unknown>();
      keyToInvalidate.forEach(key => {
        const keyStr = JSON.stringify(key);
        previousData.set(keyStr, queryClient.getQueryData(key));
        if (action === 'update' && id) {
          // Optimistic update: patch all matching query caches immediately
          queryClient.setQueriesData({ queryKey: key }, (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.map((item: any) => item.id === id ? { ...item, ...data } : item);
          });
        } else if (action === 'delete' && id) {
          // Optimistic delete: remove item from caches
          queryClient.setQueriesData({ queryKey: key }, (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.filter((item: any) => item.id !== id);
          });
        } else if (action === 'insert' && data) {
          // Optimistic insert: prepend new item (com id temporario negativo se nao tem)
          const tempId = `temp-${Date.now()}`;
          const optimisticItem = { id: tempId, ...data };
          queryClient.setQueriesData({ queryKey: key }, (old: any) => {
            if (!Array.isArray(old)) return old;
            return [optimisticItem, ...old];
          });
        }
      });
      return { previousData };
    },
    onError: (err, vars, context: any) => {
      // FIX Bug #7: rollback ao estado anterior se a mutation falhou
      if (context?.previousData) {
        context.previousData.forEach((data: any, keyStr: string) => {
          try {
            const key = JSON.parse(keyStr);
            queryClient.setQueryData(key, data);
          } catch (e) {
            // ignore parse errors
          }
        });
      }
      console.error(`[useLocalMutation] Falha em ${table}:`, err);
    },
    onSuccess: () => {
      keyToInvalidate.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
};
