type ApiError = { message: string; code?: string } | null;

type ApiResult<T> = {
  data: T | null;
  error: ApiError;
  meta?: { total?: number };
};

type AuthSession = {
  access_token: string;
  token_type: string;
  user: Record<string, unknown>;
};

export type QueryOperation = 'select' | 'insert' | 'update' | 'delete';

export type FiscalType = 'NFC-e' | 'NF-e' | 'NFS-e';
export type FiscalStatus = 'draft' | 'validation_pending' | 'queued' | 'processing' | 'simulation' | 'authorized' | 'rejected' | 'communication_failed' | 'denied' | 'cancelled' | 'inutilized' | 'contingency';
export type FiscalConfig = {
  id?: string;
  company_id: string;
  store_id: string;
  environment: 'homologacao' | 'producao';
  provider: string;
  tax_regime?: string | null;
  cnpj?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  nfce_series: string;
  nfe_series: string;
  nfse_series: string;
  certificate_expires_at?: string | null;
  is_active?: boolean | number;
  updated_by?: string | null;
  updated_by_name?: string | null;
  created_at?: string;
  updated_at?: string | null;
};
export type FiscalItem = {
  id?: string;
  product_id?: string | null;
  product_name: string;
  sku?: string | null;
  barcode?: string | null;
  ncm?: string | null;
  cest?: string | null;
  cfop?: string | null;
  cst?: string | null;
  csosn?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_json?: Record<string, unknown>;
};
export type FiscalDocument = {
  id: string;
  company_id: string;
  store_id: string;
  type: FiscalType;
  operation: 'sale' | 'service' | 'entry' | 'return' | 'remittance' | 'manual';
  environment: 'homologacao' | 'producao';
  series: string;
  number?: string | null;
  status: FiscalStatus;
  customer_id?: string | null;
  customer_name: string;
  customer_document?: string | null;
  origin_table?: string | null;
  origin_id?: string | null;
  total: number;
  discount: number;
  notes?: string | null;
  access_key?: string | null;
  protocol?: string | null;
  xml_url?: string | null;
  pdf_url?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  idempotency_key: string;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at?: string | null;
};
export type FiscalDetail = { document: FiscalDocument; items: FiscalItem[]; events: Array<Record<string, unknown>>; audits: Array<Record<string, unknown>> };
export type FiscalDocumentInput = {
  company_id: string;
  store_id: string;
  type: FiscalType;
  operation?: FiscalDocument['operation'];
  environment?: FiscalDocument['environment'];
  series?: string;
  customer_id?: string | null;
  customer_name: string;
  customer_document?: string | null;
  origin_table?: string | null;
  origin_id?: string | null;
  total: number;
  discount?: number;
  notes?: string | null;
  idempotency_key?: string;
  items?: FiscalItem[];
  manual?: boolean;
};

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');
const SESSION_KEY = 'otica-local-session';

function getSessionFromStorage(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as AuthSession : null;
  } catch {
    return null;
  }
}

function saveSession(session: AuthSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const session = getSessionFromStorage();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);

  try {
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const payload = await response.json().catch(() => ({ data: null, error: { message: response.statusText } }));
    if (!response.ok) return { data: null, error: payload.error || { message: `Erro ${response.status}` } };
    const totalHeader = response.headers.get('X-Total-Count');
    return {
      data: payload.data ?? null,
      error: payload.error ?? null,
      meta: totalHeader !== null ? { total: Number(totalHeader) || 0 } : undefined,
    };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : 'Não foi possível conectar ao servidor local.' } };
  }
}

class LocalQuery<T = any> implements PromiseLike<ApiResult<T>> {
  private operation: QueryOperation = 'select';
  private selectColumns = '*';
  private filters: Array<{ operator: 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'contains'; field: string; value: unknown }> = [];
  private orderBy?: { field: string; ascending: boolean };
  private rowLimit?: number;
  private rowOffset?: number;
  private returnSingle = false;
  private allowEmptySingle = false;
  private upsertMode = false;
  private conflictColumn?: string;
  private payload: unknown;

  constructor(private readonly table: string) {}

  select(columns = '*') {
    this.selectColumns = columns;
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ operator: 'eq', field, value });
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push({ operator: 'neq', field, value });
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push({ operator: 'in', field, value: values });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ operator: 'gte', field, value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ operator: 'lte', field, value });
    return this;
  }

  contains(field: string, value: unknown) {
    this.filters.push({ operator: 'contains', field, value });
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { field, ascending: options.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  offset(value: number) {
    this.rowOffset = value;
    return this;
  }

  single() {
    this.returnSingle = true;
    return this;
  }

  maybeSingle() {
    this.returnSingle = true;
    this.allowEmptySingle = true;
    return this;
  }

  insert(data: unknown) {
    this.operation = 'insert';
    this.payload = data;
    return this;
  }

  upsert(data: unknown, options: { onConflict?: string } = {}) {
    this.operation = 'insert';
    this.payload = data;
    this.upsertMode = true;
    this.conflictColumn = options.onConflict;
    return this;
  }

  update(data: unknown) {
    this.operation = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  then<TResult1 = ApiResult<T>, TResult2 = never>(
    onfulfilled?: ((value: ApiResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private buildQuery() {
    const params = new URLSearchParams();
    params.set('select', this.selectColumns);
    if (this.returnSingle) params.set('single', '1');
    if (this.allowEmptySingle) params.set('maybeSingle', '1');
    if (this.rowLimit !== undefined) params.set('limit', String(this.rowLimit));
    if (this.rowOffset !== undefined) params.set('offset', String(this.rowOffset));
    if (this.orderBy) params.set('order', `${this.orderBy.field}.${this.orderBy.ascending ? 'asc' : 'desc'}`);
    for (const filter of this.filters) {
      const key = `${filter.operator}[${filter.field}]`;
      const value = filter.operator === 'in'
        ? (filter.value as unknown[]).map(String).join(',')
        : filter.operator === 'contains'
          ? JSON.stringify(filter.value)
          : String(filter.value ?? '');
      params.set(key, value);
    }
    return params.toString();
  }

  private async execute(): Promise<ApiResult<T>> {
    const query = this.buildQuery();
    if (this.operation === 'select') return request<T>(`/tables/${encodeURIComponent(this.table)}?${query}`);

    const body = JSON.stringify({
      data: this.payload,
      select: this.selectColumns,
      single: this.returnSingle,
      upsert: this.upsertMode,
      onConflict: this.conflictColumn,
    });
    if (this.operation === 'insert') return request<T>(`/tables/${encodeURIComponent(this.table)}`, { method: 'POST', body });
    if (this.operation === 'update') return request<T>(`/tables/${encodeURIComponent(this.table)}?${query}`, { method: 'PATCH', body });
    return request<T>(`/tables/${encodeURIComponent(this.table)}?${query}`, { method: 'DELETE' });
  }
}

const authListeners = new Set<(event: string, session: AuthSession | null) => void>();

const auth = {
  async getSession() {
    return { data: { session: getSessionFromStorage() }, error: null };
  },

  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
    authListeners.add(callback);
    window.setTimeout(() => callback('INITIAL_SESSION', getSessionFromStorage()), 0);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
  },

  async signInWithPassword(credentials: { email: string; password: string }) {
    const result = await request<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    if (result.data) {
      saveSession(result.data);
      authListeners.forEach((listener) => listener('SIGNED_IN', result.data));
    }
    return result;
  },

  async signUp(input: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
    const existingSession = getSessionFromStorage();
    const result = await request<AuthSession>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: input.email, password: input.password, name: input.options?.data?.name }),
    });
    // Cadastro pelo primeiro acesso cria a sessão; cadastro administrativo não troca o usuário atual.
    if (result.data && !existingSession) {
      saveSession(result.data);
      authListeners.forEach((listener) => listener('SIGNED_IN', result.data));
    }
    return result;
  },

  async signOut() {
    const result = await request<null>('/auth/logout', { method: 'POST' });
    saveSession(null);
    authListeners.forEach((listener) => listener('SIGNED_OUT', null));
    return result;
  },

  async getUser() {
    const session = getSessionFromStorage();
    return { data: { user: session?.user || null }, error: null };
  },

  async getPermissions() {
    return request<Array<{ module: string; action: string }>>('/auth/permissions');
  },

  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
    return request<{ token: string; expires_at: string } | null>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, redirectTo: options?.redirectTo }) });
  },

  async confirmPasswordReset(token: string, password: string) {
    return request<null>('/auth/reset-password/confirm', { method: 'POST', body: JSON.stringify({ token, password }) });
  },

  admin: {
    async createUser(attributes: Record<string, unknown>) {
      return request<Record<string, unknown>>('/admin/users', { method: 'POST', body: JSON.stringify(attributes) });
    },
    async updateUser(id: string, attributes: Record<string, unknown>) {
      return request<Record<string, unknown>>(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(attributes) });
    },
    async deleteUser(id: string) {
      return request<null>(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async getUserPermissions(id: string) {
      return request<string[]>(`/admin/users/${encodeURIComponent(id)}/permissions`);
    },
    async getAccessControl() {
      return request<{ roles: Array<Record<string, unknown>>; permissions: Array<Record<string, unknown>> }>('/admin/access-control');
    },
    async createRole(attributes: { name: string; description?: string; permission_ids?: string[] }) {
      return request<{ roles: Array<Record<string, unknown>>; permissions: Array<Record<string, unknown>> }>('/admin/roles', { method: 'POST', body: JSON.stringify(attributes) });
    },
    async updateRole(id: string, attributes: { name?: string; description?: string; permission_ids?: string[] }) {
      return request<{ roles: Array<Record<string, unknown>>; permissions: Array<Record<string, unknown>> }>(`/admin/roles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(attributes) });
    },
    async deleteRole(id: string) {
      return request<{ roles: Array<Record<string, unknown>>; permissions: Array<Record<string, unknown>> }>(`/admin/roles/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async createBackup(label = 'manual') {
      return request<{ name: string; created_at: string }>('/admin/backup', { method: 'POST', body: JSON.stringify({ label }) });
    },
    async updateUserById(id: string, attributes: { password?: string }) {
      return request<Record<string, unknown>>(`/auth/users/${encodeURIComponent(id)}/password`, { method: 'PATCH', body: JSON.stringify(attributes) });
    },
  },
};

const storage = {
  from(bucket: string) {
    return {
      async list(path: string, options: { limit?: number } = {}) {
        const params = new URLSearchParams({ path, limit: String(options.limit || 100) });
        return request<Array<Record<string, unknown>>>(`/storage/${encodeURIComponent(bucket)}/list?${params}`);
      },
      async upload(path: string, file: File, options: { upsert?: boolean; contentType?: string } = {}) {
        const form = new FormData();
        form.set('path', path);
        form.set('upsert', String(Boolean(options.upsert)));
        form.set('file', file, file.name);
        return request<Record<string, unknown>>(`/storage/${encodeURIComponent(bucket)}/upload`, { method: 'POST', body: form });
      },
      async createSignedUrl(path: string, _expiresIn: number) {
        return { data: { signedUrl: `${API_BASE}/storage/${encodeURIComponent(bucket)}/download?path=${encodeURIComponent(path)}` }, error: null };
      },
      async remove(paths: string[]) {
        return request<null>(`/storage/${encodeURIComponent(bucket)}`, { method: 'DELETE', body: JSON.stringify({ paths }) });
      },
    };
  },
};

const fiscal = {
  getConfig(companyId: string, storeId: string) {
    const params = new URLSearchParams({ company_id: companyId, store_id: storeId });
    return request<FiscalConfig | null>(`/operations/fiscal/config?${params.toString()}`);
  },
  saveConfig(config: FiscalConfig) {
    return request<FiscalConfig>('/operations/fiscal/config', { method: 'PUT', body: JSON.stringify(config) });
  },
  listDocuments(filters: { company_id?: string; store_id?: string; status?: FiscalStatus | 'all'; type?: FiscalType | 'all'; search?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '' && value !== 'all') params.set(key, String(value)); });
    return request<FiscalDocument[]>(`/operations/fiscal/documents?${params.toString()}`);
  },
  getDocument(id: string) {
    return request<FiscalDetail>(`/operations/fiscal/documents/${encodeURIComponent(id)}`);
  },
  createDocument(input: FiscalDocumentInput) {
    return request<FiscalDetail>('/operations/fiscal/documents', { method: 'POST', body: JSON.stringify(input) });
  },
  createFromSale(id: string, type: 'NF-e' | 'NFC-e' = 'NFC-e') {
    return request<FiscalDetail>(`/operations/fiscal/from-sales/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ type }) });
  },
  createFromServiceOrder(id: string) {
    return request<FiscalDetail>(`/operations/fiscal/from-service-orders/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ type: 'NFS-e' }) });
  },
  updateDocument(id: string, input: Partial<FiscalDocumentInput>) {
    return request<FiscalDetail>(`/operations/fiscal/documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  transmitDocument(id: string) {
    return request<FiscalDetail>(`/operations/fiscal/documents/${encodeURIComponent(id)}/transmit`, { method: 'POST', body: JSON.stringify({}) });
  },
  resendDocument(id: string) {
    return request<FiscalDetail>(`/operations/fiscal/documents/${encodeURIComponent(id)}/resend`, { method: 'POST', body: JSON.stringify({}) });
  },
  createEvent(id: string, event_type: 'cancel' | 'correction' | 'inutilization', justification: string) {
    return request<{ event: Record<string, unknown> }>(`/operations/fiscal/documents/${encodeURIComponent(id)}/events`, { method: 'POST', body: JSON.stringify({ event_type, justification }) });
  },
  deleteDocument(id: string) {
    return request<{ id: string; deleted_at: string }>(`/operations/fiscal/documents/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({}) });
  },
  listXmlImports(filters: { company_id?: string; store_id?: string } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return request<Array<Record<string, unknown>>>(`/operations/fiscal/xml-imports?${params.toString()}`);
  },
  previewXmlImport(input: { company_id: string; store_id: string; raw_xml: string }) {
    return request<{ import: Record<string, unknown>; duplicate: boolean; note?: string }>('/operations/fiscal/xml-imports/preview', { method: 'POST', body: JSON.stringify(input) });
  },
  confirmXmlImport(id: string) {
    return request<Record<string, unknown>>(`/operations/fiscal/xml-imports/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: JSON.stringify({}) });
  },
};

const functions = {
  invoke(name: string, options: { body?: unknown } = {}) {
    return request<Record<string, unknown>>(`/functions/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(options.body || {}) });
  },
};

const operations = {
  updateServiceOrderStatus(id: string, status: string) {
    return request<{ id: string; previous_status: string; status: string; changed: boolean; changed_by?: string; changed_at?: string; timeline_id?: string }>(`/operations/service-orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },
  deleteFinancialInstallment(id: string) {
    return request<{ deleted_count: number; entry_id: string; carne_id: string | null; customer_id: string; deleted_at: string }>(`/operations/financial/installments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  deleteFinancialCreditBook(id: string) {
    return request<{ deleted_count: number; carne_id: string; customer_id: string; deleted_at: string }>(`/operations/financial/credit-books/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  completeSale(sale: Record<string, unknown>, items: Array<Record<string, unknown>>) {
    return request<{ id: string; total: number; discount: number; status: string }>('/operations/sales', { method: 'POST', body: JSON.stringify({ sale, items }) });
  },
  cancelSale(id: string) {
    return request<{ id: string; status: string }>(`/operations/sales/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({}) });
  },
  createManualFinancialEntry(entry: Record<string, unknown>) {
    return request<Record<string, unknown>>('/operations/financial/manual-entry', { method: 'POST', body: JSON.stringify({ entry }) });
  },
  recordFixedCostPayment(fixedCostId: string, input: { amount: number; payment_date: string; payment_method?: string; note?: string }) {
    return request<{ payment: Record<string, unknown>; entry: Record<string, unknown> }>(`/operations/financial/fixed-costs/${encodeURIComponent(fixedCostId)}/payments`, { method: 'POST', body: JSON.stringify(input) });
  },
  adjustFixedCost(fixedCostId: string, percent: number) {
    return request<Record<string, unknown>>(`/operations/financial/fixed-costs/${encodeURIComponent(fixedCostId)}/adjust`, { method: 'POST', body: JSON.stringify({ percent }) });
  },
  settleFinancialEntry(input: { id: string; amount?: number; payment_date?: string; payment_method: string; payment_note?: string; interest_amount?: number; fine_amount?: number; discount_amount?: number }) {
    const { id, ...body } = input;
    return request<Record<string, unknown>>(`/operations/financial/${encodeURIComponent(id)}/settle`, { method: 'POST', body: JSON.stringify(body) });
  },
  matchBankTransaction(input: { transaction_id: string; entry_id: string; confidence: number }) {
    return request<{ transaction_id: string; entry_id: string; reconciled: boolean }>('/operations/financial/reconciliation/match', { method: 'POST', body: JSON.stringify(input) });
  },
  generateRecurringEntries(input: { company_id: string; as_of?: string }) {
    return request<{ generated_count: number; entries: Record<string, unknown>[] }>('/operations/financial/recurring/generate', { method: 'POST', body: JSON.stringify(input) });
  },
  createFinancialInstallments(input: Record<string, unknown>) {
    return request<{ installment_group_id: string; entries: Record<string, unknown>[] }>('/operations/financial/installments', { method: 'POST', body: JSON.stringify(input) });
  },
  updateFinancialApproval(id: string, input: { status: 'approved' | 'rejected' | 'pending'; note?: string }) {
    return request<Record<string, unknown>>(`/operations/financial/${encodeURIComponent(id)}/approval`, { method: 'POST', body: JSON.stringify(input) });
  },
  reverseFinancialEntry(id: string, reason: string) {
    return request<{ original_entry_id: string; reversal_entry_id: string; amount: number }>(`/operations/financial/${encodeURIComponent(id)}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) });
  },
  deleteFinancialEntry(id: string, reason: string) {
    return request<{ deleted_count: number; entry_id: string; deleted_at: string; reason: string }>(`/operations/financial/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
  },
  createFinancialTransfer(input: Record<string, unknown>) {
    return request<{ transfer_id: string; outgoing_entry_id: string; incoming_entry_id: string; amount: number }>('/operations/financial/transfers', { method: 'POST', body: JSON.stringify(input) });
  },
  settleCardSettlement(id: string, input: { settled_date?: string; actual_net_amount?: number; bank_transaction_id?: string }) {
    return request<{ settlement_id: string; status: string; actual_net_amount: number; difference: number; bank_transaction_id: string | null }>(`/operations/financial/card-settlements/${encodeURIComponent(id)}/settle`, { method: 'POST', body: JSON.stringify(input) });
  },
  closeFinancialDay(input: Record<string, unknown>) {
    return request<Record<string, unknown>>('/operations/financial/daily-closing', { method: 'POST', body: JSON.stringify(input) });
  },
  reopenFinancialDay(input: { company_id: string; store_id: string; closing_date: string; reason: string }) {
    return request<Record<string, unknown>>('/operations/financial/daily-closing', { method: 'POST', body: JSON.stringify({ ...input, reopen: true }) });
  },
  openCashRegister(input: { store_id: string; opening_balance: number; notes?: string }) {
    return request<Record<string, unknown>>('/operations/cash/registers/open', { method: 'POST', body: JSON.stringify(input) });
  },
  closeCashRegister(input: { id: string; actual_balance: number; notes?: string }) {
    return request<Record<string, unknown>>(`/operations/cash/registers/${encodeURIComponent(input.id)}/close`, { method: 'POST', body: JSON.stringify({ actual_balance: input.actual_balance, notes: input.notes }) });
  },
  createCashMovement(input: { cash_register_id: string; type: 'sale' | 'withdrawal' | 'reinforcement'; amount: number; description?: string; payment_method?: string; reference_id?: string; reference_table?: 'sales' | 'service_orders' }) {
    return request<Record<string, unknown>>('/operations/cash/movements', { method: 'POST', body: JSON.stringify(input) });
  },
  adjustProductStock(input: { product_id: string; store_id: string; operation: 'in' | 'out' | 'adjustment'; quantity?: number; target_quantity?: number; unit_cost?: number; document_number?: string; supplier_name?: string; reason?: string }) {
    return request<{ id: string; product_id: string; store_id: string; quantity: number; quantity_before: number; quantity_after: number; type: string }>('/operations/product-stock', { method: 'POST', body: JSON.stringify(input) });
  },
  transferProductStock(input: { product_id: string; source_store_id: string; target_store_id: string; quantity: number; description?: string }) {
    return request<{ product_id: string; quantity: number; source_store_id: string; target_store_id: string }>('/operations/product-stock/transfer', { method: 'POST', body: JSON.stringify(input) });
  },
  reserveProductStock(input: { product_id: string; store_id: string; operation: 'reserve' | 'release'; quantity: number; description?: string }) {
    return request<{ product_id: string; store_id: string; operation: string; quantity: number; reserved_before: number; reserved_after: number; available_after: number }>('/operations/product-stock/reservation', { method: 'POST', body: JSON.stringify(input) });
  },
};

const backupAdmin = {
  async getSettings() {
    return request<{ settings: Record<string, any>; drive: Record<string, any> }>('/admin/backups/settings');
  },
  async saveSettings(settings: Record<string, unknown>) {
    return request<Record<string, any>>('/admin/backups/settings', { method: 'PUT', body: JSON.stringify(settings) });
  },
  async listHistory(filters: { status?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
    return request<Record<string, any>[]>(`/admin/backups/history?${params.toString()}`);
  },
  async listEvents(jobId?: string) {
    const params = jobId ? `?job_id=${encodeURIComponent(jobId)}` : '';
    return request<Record<string, any>[]>(`/admin/backups/events${params}`);
  },
  async run(label = 'manual', sendToDrive = false) {
    return request<Record<string, any>>('/admin/backups/run', { method: 'POST', body: JSON.stringify({ label, send_to_drive: sendToDrive }) });
  },
  async download(id: string) {
    const session = getSessionFromStorage();
    const headers = new Headers();
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    const response = await fetch(`${API_BASE}/admin/backups/${encodeURIComponent(id)}/download`, { headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error?.message || 'Não foi possível baixar o backup.');
    }
    return response.blob();
  },
  async importFile(file: File) {
    const form = new FormData();
    form.set('file', file, file.name);
    return request<Record<string, any>>('/admin/backups/import', { method: 'POST', body: form });
  },
  async inspectFile(file: File) {
    const form = new FormData();
    form.set('file', file, file.name);
    return request<Record<string, any>>('/admin/backups/inspect', { method: 'POST', body: form });
  },
  async restore(id: string, confirmation: string) {
    return request<Record<string, any>>(`/admin/backups/${encodeURIComponent(id)}/restore`, { method: 'POST', body: JSON.stringify({ confirmation }) });
  },
  async connectDrive() {
    return request<{ url: string; redirect_uri: string }>('/admin/backups/drive/connect');
  },
  async testDrive() {
    return request<Record<string, any>>('/admin/backups/drive/test', { method: 'POST', body: JSON.stringify({}) });
  },
  async listDrive() {
    return request<Record<string, any>[]>('/admin/backups/drive/list');
  },
  async disconnectDrive() {
    return request<Record<string, any>>('/admin/backups/drive/disconnect', { method: 'POST', body: JSON.stringify({}) });
  },
  async importDrive(fileId: string) {
    return request<Record<string, any>>(`/admin/backups/drive/import/${encodeURIComponent(fileId)}`, { method: 'POST', body: JSON.stringify({}) });
  },
};

export const localApi = {
  from: <T = any>(table: string) => new LocalQuery<T>(table),
  auth,
  storage,
  functions,
  fiscal,
  operations,
  backupAdmin,
};

export { API_BASE, getSessionFromStorage, saveSession };
