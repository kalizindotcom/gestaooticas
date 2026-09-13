// Definições centrais — snake_case alinhado às colunas persistidas

export interface FinancialEntry {
  id: string;
  company_id: string;
  store_id?: string;
  type: 'receivable' | 'payable' | 'in' | 'out';
  description?: string;
  amount: number;
  due_date: string;
  payment_date?: string;
  payment_method?: string;
  payment_note?: string;
  paid_amount?: number;
  original_amount?: number;
  interest_amount?: number;
  fine_amount?: number;
  discount_amount?: number;
  net_amount?: number;
  card_fee_percent?: number;
  card_fee_amount?: number;
  anticipated_at?: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  settled_by?: string;
  settled_by_name?: string;
  settled_at?: string;
  last_action_by_name?: string;
  installment_group_id?: string;
  installment_number?: number;
  installment_total?: number;
  approval_status?: 'approved' | 'pending_approval' | 'rejected' | 'pending';
  approved_by?: string;
  approved_at?: string;
  approval_note?: string;
  reversed_entry_id?: string;
  reversal_reason?: string;
  recurrence_source_id?: string;
  is_recurring?: boolean;
  recurrence_config?: Record<string, unknown> | null;
  status: 'paid' | 'partially_paid' | 'pending' | 'overdue' | 'cancelled';
  category_id?: string;
  category?: string; // categoria textual (usada pelo DRE como fallback)
  cost_center?: string;
  tags?: string[];
  supplier_customer_name?: string;
  customer_id?: string;
  origin_table?: string;
  origin_id?: string;
  is_reconciled?: boolean;
  audit_log?: {
    created_by?: string | null;
    created_by_name?: string | null;
    created_at?: string | null;
    changes: Array<{ changed_by?: string; changed_by_name?: string; changed_at?: string; fields?: string[] }>;
  };
  created_at: string;
  updated_at?: string;
}

export interface Company {
  id: string;
  name: string;
  trade_name?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  status?: 'active' | 'inactive';
  primary_color?: string;
  secondary_color?: string;
  logo?: string;
  created_at?: string;
}

export interface Store {
  id: string;
  name: string;
  code?: string;
  company_id?: string;
  address?: string;
  phone?: string;
  manager?: string;
  hours?: string;
  city?: string;
  state?: string;
  status?: 'active' | 'inactive';
  created_at?: string;
}

export interface ProductStock {
  id: string;
  product_id: string;
  store_id: string;
  quantity: number;
  reserved_quantity?: number;
  min_quantity?: number;
  max_quantity?: number;
  location?: string;
  updated_at?: string;
  created_at?: string;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  category?: string;
  category_id?: string;
  brand?: string;
  brand_id?: string;
  product_type?: string;
  unit?: string;
  price: number;
  promotional_price?: number;
  /** Só é preenchido quando o usuário possui products.view_cost. */
  cost?: number;
  sku?: string;
  barcode?: string;
  description?: string;
  supplier_name?: string;
  image_url?: string;
  status?: 'active' | 'inactive';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  product_stock?: ProductStock[];
  product_images?: ProductImage[];
}

export interface ProductImage {
  id: string;
  company_id: string;
  product_id: string;
  image_url: string;
  alt_text?: string;
  is_primary?: boolean;
  sort_order?: number;
  created_at?: string;
}

export interface ProductCategory {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  color?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductBrand {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductMovement {
  id: string;
  product_id: string;
  store_id: string;
  type: 'in' | 'out' | 'sale' | 'os' | 'transfer' | 'adjustment' | 'return' | 'loss' | 'edit';
  quantity: number;
  quantity_before?: number;
  quantity_after?: number;
  unit_cost?: number;
  document_number?: string;
  supplier_name?: string;
  reason?: string;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  user_id?: string;
  product_name?: string;
  store_name?: string;
  user_name?: string;
  date: string;
  created_at?: string;
}

export interface ProductAudit {
  id: string;
  company_id: string;
  product_id: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  company_id?: string;
  store_id?: string;
  customer_id?: string;
  customer_name?: string;
  customerCpf?: string;
  seller_id?: string;
  date: string;
  total: number;
  status?: 'completed' | 'pending' | 'cancelled';
  payment_method?: string;
  items?: Array<{ product: string; qty: number; price: number; total: number }>;
}

export interface ServiceOrder {
  id: string;
  companyId?: string;
  storeId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  technicianId?: string;
  technicianName?: string;
  date: string;
  deliveryDate?: string;
  estimatedDeadline?: string;
  total: number;
  paidAmount?: number;
  balance?: number;
  paymentMethod?: string;
  financialStatus?: 'paid' | 'partially_paid' | 'pending';
  status: 'opened' | 'analyzing' | 'waiting_approval' | 'in_production' | 'waiting_lab' | 'waiting_part' | 'waiting_client' | 'ready' | 'delivered' | 'cancelled' | 'overdue';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  serviceType?: string;
  description?: string;
  product?: string;
  productId?: string;
  productQuantity?: number;
  lens?: string;
  frame?: string;
  lab?: string;
  provider?: string;
  internalNotes?: string;
  prescription?: any;
  timeline?: Array<{ date: string; action: string; user: string; status?: string }>;
}
