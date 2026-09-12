import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import bcrypt from 'bcryptjs';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(projectRoot, 'data');
const databasePath = path.join(dataDir, 'otica-nordestina.sqlite');
const backupDir = path.join(dataDir, 'backups');
const SCHEMA_VERSION = '20';

let SQL: SqlJsStatic;
let database: Database;

const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, trade_name TEXT, cnpj TEXT UNIQUE, email TEXT, phone TEXT,
  city TEXT, state TEXT, status TEXT DEFAULT 'active', primary_color TEXT DEFAULT '#1e3a5f',
  secondary_color TEXT DEFAULT '#3b6fa0', logo_url TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL, code TEXT, address TEXT, phone TEXT,
  manager TEXT, hours TEXT, status TEXT DEFAULT 'active', city TEXT, state TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, is_system INTEGER DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, module TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY, role_id TEXT NOT NULL, permission_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, role TEXT DEFAULT 'user', role_id TEXT, avatar_url TEXT,
  companies TEXT DEFAULT '[]', stores TEXT DEFAULT '[]', status TEXT DEFAULT 'active', last_access TEXT,
  password_hash TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_permissions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, permission_id TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(user_id, permission_id)
);
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT,
  cpf TEXT, role TEXT, hire_date TEXT, commission REAL DEFAULT 0, status TEXT DEFAULT 'active', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT,
  whatsapp TEXT, cpf TEXT, rg TEXT, marital_status TEXT, birth_date TEXT, status TEXT DEFAULT 'active', tags TEXT DEFAULT '[]',
  notes TEXT, address_street TEXT, address_number TEXT, address_neighborhood TEXT, address_city TEXT, address_state TEXT,
  address_zip_code TEXT, address_reference TEXT, last_visit TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS laboratories (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT, status TEXT DEFAULT 'active', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS professionals (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT, specialty TEXT,
  status TEXT DEFAULT 'active', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, customer_id TEXT, professional_id TEXT,
  professional_name TEXT, guest_name TEXT, date TEXT NOT NULL, time TEXT NOT NULL, type TEXT, status TEXT DEFAULT 'scheduled',
  priority TEXT DEFAULT 'medium', notes TEXT, origin TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT, brand TEXT, price REAL DEFAULT 0,
  cost REAL DEFAULT 0, sku TEXT, barcode TEXT, description TEXT, image_url TEXT, created_by TEXT,
  ncm TEXT, cest TEXT, tax_origin TEXT, commercial_unit TEXT DEFAULT 'UN', taxable_unit TEXT DEFAULT 'UN',
  default_cfop TEXT, default_cst TEXT, default_csosn TEXT, tax_notes TEXT,
  status TEXT DEFAULT 'active', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_stock (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL, store_id TEXT NOT NULL, quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0, min_quantity INTEGER DEFAULT 0, max_quantity INTEGER,
  location TEXT, updated_at TEXT, created_at TEXT NOT NULL,
  UNIQUE(product_id, store_id)
);
CREATE TABLE IF NOT EXISTS product_movements (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL, store_id TEXT NOT NULL, type TEXT, quantity INTEGER NOT NULL,
  quantity_before INTEGER, quantity_after INTEGER, unit_cost REAL, document_number TEXT, supplier_name TEXT,
  reason TEXT, reference_type TEXT, reference_id TEXT, description TEXT, user_id TEXT, product_name TEXT,
  store_name TEXT, user_name TEXT, date TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  color TEXT, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT,
  UNIQUE(company_id, name)
);
CREATE TABLE IF NOT EXISTS product_brands (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT,
  UNIQUE(company_id, name)
);
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, product_id TEXT NOT NULL, image_url TEXT NOT NULL,
  alt_text TEXT, is_primary INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_audits (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, product_id TEXT NOT NULL, action TEXT NOT NULL,
  field_name TEXT, old_value TEXT, new_value TEXT, user_id TEXT, user_name TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, customer_id TEXT, seller_id TEXT, date TEXT NOT NULL,
  total REAL DEFAULT 0, discount REAL DEFAULT 0, installments INTEGER, service_order_id TEXT, notes TEXT,
  status TEXT DEFAULT 'completed', payment_method TEXT, customer_name TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY, sale_id TEXT NOT NULL, product_id TEXT, product_name TEXT, quantity INTEGER DEFAULT 1,
  unit_price REAL DEFAULT 0, total_price REAL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS service_orders (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, customer_id TEXT, technician_id TEXT, date TEXT NOT NULL,
  delivery_date TEXT, estimated_deadline TEXT, total REAL DEFAULT 0, paid_amount REAL DEFAULT 0, balance REAL DEFAULT 0,
  payment_method TEXT, financial_status TEXT DEFAULT 'pending', status TEXT DEFAULT 'opened', priority TEXT DEFAULT 'medium',
  service_type TEXT, description TEXT, product_name TEXT, lens_name TEXT, frame_name TEXT, lab_id TEXT, lab_name TEXT,
  provider_name TEXT, internal_notes TEXT, od_sph TEXT, od_cyl TEXT, od_axis TEXT, od_add TEXT, oe_sph TEXT, oe_cyl TEXT,
  oe_axis TEXT, oe_add TEXT, pupillary_distance TEXT, largest_diagonal TEXT, vertical_height TEXT, frame_size TEXT,
      bridge_size TEXT, frame_and_bridge TEXT, optical_center_height TEXT,        od_far TEXT, od_near TEXT, oe_far TEXT, oe_near TEXT,
    prescription_date TEXT, prescription_valid_until TEXT, prescription_professional_id TEXT, prescription_id TEXT,
    product_id TEXT, product_quantity INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS service_order_timeline (
  id TEXT PRIMARY KEY, service_order_id TEXT NOT NULL, action TEXT NOT NULL, user_name TEXT, user_id TEXT, status TEXT,
  date TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, customer_id TEXT NOT NULL,
  professional_id TEXT, professional_name TEXT, issue_date TEXT NOT NULL, valid_until TEXT,
  status TEXT DEFAULT 'active', notes TEXT,
  od_sph TEXT, od_cyl TEXT, od_axis TEXT, od_add TEXT,
  oe_sph TEXT, oe_cyl TEXT, oe_axis TEXT, oe_add TEXT,
  pupillary_distance TEXT, largest_diagonal TEXT, vertical_height TEXT,
  frame_size TEXT, bridge_size TEXT, frame_and_bridge TEXT, optical_center_height TEXT,
  od_far TEXT, od_near TEXT, oe_far TEXT, oe_near TEXT,
  created_at TEXT NOT NULL, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_company_customer ON prescriptions(company_id, customer_id);
CREATE TABLE IF NOT EXISTS cash_registers (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, user_id TEXT, opened_at TEXT NOT NULL,
  closed_at TEXT, opening_balance REAL DEFAULT 0, expected_balance REAL, actual_balance REAL, difference REAL,
  status TEXT DEFAULT 'open', notes TEXT, closed_by TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cash_register_movements (
  id TEXT PRIMARY KEY, cash_register_id TEXT NOT NULL, type TEXT NOT NULL, amount REAL DEFAULT 0, description TEXT,
  payment_method TEXT, reference_id TEXT, reference_table TEXT, created_by TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS financial_entries (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT, cashier_id TEXT, type TEXT, description TEXT NOT NULL,
  amount REAL DEFAULT 0, due_date TEXT, payment_date TEXT, status TEXT DEFAULT 'pending', category TEXT, category_id TEXT,
  payment_method TEXT, payment_note TEXT, origin_table TEXT, origin_id TEXT, supplier_customer_name TEXT, customer_id TEXT, cost_center TEXT,
  tags TEXT DEFAULT '[]', is_reconciled INTEGER DEFAULT 0, audit_log TEXT, recurrence_config TEXT, is_recurring INTEGER DEFAULT 0,
  created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS financial_entry_audits (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT, customer_id TEXT, entry_id TEXT NOT NULL,
  carne_id TEXT, action TEXT NOT NULL, snapshot TEXT NOT NULL, user_id TEXT, user_name TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fixed_costs (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  amount REAL DEFAULT 0, frequency TEXT DEFAULT 'monthly', interval INTEGER DEFAULT 1, valid_from TEXT NOT NULL,
  valid_until TEXT, status TEXT DEFAULT 'active', payment_count INTEGER DEFAULT 0, last_paid_at TEXT, next_due_date TEXT,
  payment_method TEXT, category_id TEXT, cost_center TEXT, notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS fixed_cost_payments (
  id TEXT PRIMARY KEY, fixed_cost_id TEXT NOT NULL, company_id TEXT NOT NULL, store_id TEXT NOT NULL, amount REAL DEFAULT 0,
  payment_date TEXT NOT NULL, payment_method TEXT, note TEXT, financial_entry_id TEXT, created_by TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_entry_audits_customer ON financial_entry_audits(company_id, customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_company_store ON fixed_costs(company_id, store_id, status);
CREATE INDEX IF NOT EXISTS idx_fixed_cost_payments_cost ON fixed_cost_payments(fixed_cost_id, payment_date);
CREATE TABLE IF NOT EXISTS financial_budgets (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, category_id TEXT, cost_center TEXT,
  reference_month TEXT NOT NULL, limit_amount REAL DEFAULT 0, warning_percent REAL DEFAULT 80, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS financial_installment_groups (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT, description TEXT NOT NULL, total_amount REAL DEFAULT 0,
  installment_count INTEGER DEFAULT 1, interval_days INTEGER DEFAULT 30, first_due_date TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS financial_approvals (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT, entry_id TEXT NOT NULL, status TEXT DEFAULT 'pending',
  requested_by TEXT, requested_at TEXT NOT NULL, approved_by TEXT, approved_at TEXT, note TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS financial_transfers (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, from_store_id TEXT, to_store_id TEXT, from_cash_register_id TEXT, to_cash_register_id TEXT,
  from_bank_account_id TEXT, to_bank_account_id TEXT, amount REAL DEFAULT 0, transfer_date TEXT NOT NULL, status TEXT DEFAULT 'completed',
  note TEXT, created_by TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS financial_card_settlements (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT, entry_id TEXT, sale_id TEXT, card_brand TEXT,
  installment_number INTEGER DEFAULT 1, installment_total INTEGER DEFAULT 1, gross_amount REAL DEFAULT 0, fee_percent REAL DEFAULT 0,
  fee_amount REAL DEFAULT 0, net_amount REAL DEFAULT 0, expected_date TEXT, settled_date TEXT, status TEXT DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS financial_daily_closings (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, closing_date TEXT NOT NULL, total_in REAL DEFAULT 0,
  total_out REAL DEFAULT 0, cash_difference REAL DEFAULT 0, pending_count INTEGER DEFAULT 0, unreconciled_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'closed', notes TEXT, closed_by TEXT, created_at TEXT NOT NULL, UNIQUE(company_id, store_id, closing_date)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, bank_name TEXT NOT NULL, bank_code TEXT, agency TEXT, account_number TEXT NOT NULL,
  account_type TEXT, initial_balance REAL DEFAULT 0, current_balance REAL DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id TEXT PRIMARY KEY, bank_account_id TEXT NOT NULL, period_start TEXT, period_end TEXT, initial_balance_bank REAL DEFAULT 0,
  initial_balance_system REAL DEFAULT 0, final_balance_bank REAL DEFAULT 0, final_balance_system REAL DEFAULT 0,
  total_transactions INTEGER DEFAULT 0, matched_auto INTEGER DEFAULT 0, matched_manual INTEGER DEFAULT 0, pending INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress', reconciled_by TEXT, reconciled_at TEXT, notes TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY, bank_account_id TEXT NOT NULL, reconciliation_id TEXT, transaction_date TEXT, description TEXT,
  amount REAL DEFAULT 0, type TEXT, balance_after REAL, is_reconciled INTEGER DEFAULT 0, matched_entry_id TEXT,
  match_confidence REAL, reconciled_by TEXT, reconciled_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS financial_categories (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT NOT NULL, parent_id TEXT, type TEXT NOT NULL,
  cost_center TEXT, icon TEXT, color TEXT, is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fiscal_configs (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, environment TEXT DEFAULT 'homologacao',
  provider TEXT, cnpj TEXT, tax_regime TEXT, state_registration TEXT, municipal_registration TEXT,
  nfce_series TEXT DEFAULT '1', nfe_series TEXT DEFAULT '1', nfse_series TEXT DEFAULT '1',
  certificate_ref TEXT, certificate_expires_at TEXT, csc_token_ref TEXT, is_active INTEGER DEFAULT 1,
  updated_by TEXT, updated_by_name TEXT, created_at TEXT NOT NULL, updated_at TEXT,
  UNIQUE(company_id, store_id)
);
CREATE TABLE IF NOT EXISTS fiscal_documents (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, type TEXT NOT NULL,
  operation TEXT NOT NULL, environment TEXT DEFAULT 'homologacao', series TEXT, number TEXT,
  status TEXT DEFAULT 'draft', customer_id TEXT, customer_name TEXT, customer_document TEXT,
  origin_table TEXT, origin_id TEXT, total REAL DEFAULT 0, discount REAL DEFAULT 0, notes TEXT,
  payload_hash TEXT, access_key TEXT, protocol TEXT, xml_url TEXT, pdf_url TEXT, error_code TEXT, error_message TEXT,
  idempotency_key TEXT NOT NULL UNIQUE, issued_at TEXT, authorized_at TEXT, cancelled_at TEXT,
  created_by TEXT, created_by_name TEXT, created_at TEXT NOT NULL, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS fiscal_document_items (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, product_id TEXT, product_name TEXT NOT NULL,
  sku TEXT, barcode TEXT, ncm TEXT, cest TEXT, cfop TEXT, cst TEXT, csosn TEXT,
  quantity INTEGER DEFAULT 1, unit_price REAL DEFAULT 0, total_price REAL DEFAULT 0, tax_json TEXT DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fiscal_events (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, event_type TEXT NOT NULL, status TEXT DEFAULT 'pending',
  protocol TEXT, justification TEXT, response_code TEXT, response_message TEXT, payload_hash TEXT,
  created_by TEXT, created_by_name TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fiscal_audits (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, document_id TEXT,
  action TEXT NOT NULL, snapshot TEXT NOT NULL, user_id TEXT, user_name TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fiscal_xml_imports (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, store_id TEXT NOT NULL, access_key TEXT,
  supplier_name TEXT, issue_date TEXT, total REAL DEFAULT 0, status TEXT DEFAULT 'pending',
  xml_url TEXT, raw_hash TEXT, imported_by TEXT, imported_by_name TEXT, created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_stores_company ON stores(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_store ON customers(company_id, store_id);
CREATE INDEX IF NOT EXISTS idx_sales_company_store ON sales(company_id, store_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_company_store ON financial_entries(company_id, store_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_company_customer ON financial_entries(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_financial_entry_audits_entry ON financial_entry_audits(entry_id, created_at);
CREATE INDEX IF NOT EXISTS idx_product_categories_company ON product_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_product_brands_company ON product_brands(company_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_audits_product ON product_audits(company_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_product_store ON product_movements(product_id, store_id, date);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_company_store ON fiscal_documents(company_id, store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status ON fiscal_documents(company_id, store_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_origin ON fiscal_documents(origin_table, origin_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_items_document ON fiscal_document_items(document_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_events_document ON fiscal_events(document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fiscal_audits_document ON fiscal_audits(document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fiscal_xml_imports_company_store ON fiscal_xml_imports(company_id, store_id, created_at);
`;

const jsonColumns = new Set(['companies', 'stores', 'tags', 'audit_log', 'recurrence_config', 'metadata', 'phones_json', 'emails_json', 'references_json']);
const booleanColumns = new Set(['is_system', 'is_active', 'is_reconciled', 'is_recurring']);

export async function initDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });
  SQL = await initSqlJs({ locateFile: (file) => path.join(path.dirname(require.resolve('sql.js')), file) });
  const existing = fs.existsSync(databasePath) ? new Uint8Array(fs.readFileSync(databasePath)) : undefined;
  if (existing) createStartupBackup();
  database = existing ? new SQL.Database(existing) : new SQL.Database();
  database.run(schema);
  ensureColumn('products', 'barcode', 'TEXT');
  ensureColumn('products', 'created_by', 'TEXT');
  ensureColumn('products', 'ncm', 'TEXT');
  ensureColumn('products', 'cest', 'TEXT');
  ensureColumn('products', 'tax_origin', 'TEXT');
  ensureColumn('products', 'commercial_unit', "TEXT DEFAULT 'UN'");
  ensureColumn('products', 'taxable_unit', "TEXT DEFAULT 'UN'");
  ensureColumn('products', 'default_cfop', 'TEXT');
  ensureColumn('products', 'default_cst', 'TEXT');
  ensureColumn('products', 'default_csosn', 'TEXT');
  ensureColumn('products', 'tax_notes', 'TEXT');
  ensureColumn('products', 'unit', "TEXT DEFAULT 'un'");
  ensureColumn('products', 'product_type', "TEXT DEFAULT 'product'");
  ensureColumn('products', 'supplier_name', 'TEXT');
  ensureColumn('products', 'min_stock', 'INTEGER DEFAULT 0');
  ensureColumn('products', 'max_stock', 'INTEGER');
  ensureColumn('products', 'promotional_price', 'REAL');
  ensureColumn('products', 'updated_at', 'TEXT');
  ensureColumn('products', 'updated_by', 'TEXT');
  ensureColumn('products', 'updated_by_name', 'TEXT');
  ensureColumn('product_stock', 'reserved_quantity', 'INTEGER DEFAULT 0');
  ensureColumn('product_stock', 'min_quantity', 'INTEGER DEFAULT 0');
  ensureColumn('product_stock', 'max_quantity', 'INTEGER');
  ensureColumn('product_stock', 'location', 'TEXT');
  ensureColumn('product_stock', 'updated_at', 'TEXT');
  ensureColumn('product_movements', 'quantity_before', 'INTEGER');
  ensureColumn('product_movements', 'quantity_after', 'INTEGER');
  ensureColumn('product_movements', 'unit_cost', 'REAL');
  ensureColumn('product_movements', 'document_number', 'TEXT');
  ensureColumn('product_movements', 'supplier_name', 'TEXT');
  ensureColumn('product_movements', 'reason', 'TEXT');
  ensureColumn('product_movements', 'reference_type', 'TEXT');
  ensureColumn('product_movements', 'reference_id', 'TEXT');
  ensureColumn('product_movements', 'reserved_before', 'INTEGER DEFAULT 0');
  ensureColumn('product_movements', 'reserved_after', 'INTEGER DEFAULT 0');
  ensureColumn('service_orders', 'product_id', 'TEXT');
  ensureColumn('service_orders', 'product_quantity', 'INTEGER DEFAULT 1');
  database.run('CREATE INDEX IF NOT EXISTS idx_service_orders_product ON service_orders(product_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_financial_entries_due_status ON financial_entries(company_id, store_id, due_date, status)');
  database.run('CREATE INDEX IF NOT EXISTS idx_financial_entries_origin ON financial_entries(origin_table, origin_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_financial_budgets_period ON financial_budgets(company_id, store_id, reference_month)');
  database.run('CREATE INDEX IF NOT EXISTS idx_financial_approvals_entry ON financial_approvals(entry_id, status)');
  database.run('CREATE INDEX IF NOT EXISTS idx_financial_transfers_company ON financial_transfers(company_id, transfer_date)');
  database.run('CREATE INDEX IF NOT EXISTS idx_financial_card_settlements_expected ON financial_card_settlements(company_id, store_id, expected_date, status)');
  seedProductTaxonomy();
  ensureColumn('sales', 'discount', 'REAL DEFAULT 0');
  ensureColumn('sales', 'installments', 'INTEGER');
  ensureColumn('sales', 'service_order_id', 'TEXT');
  ensureColumn('sales', 'notes', 'TEXT');
  ensureColumn('service_orders', 'prescription_date', 'TEXT');
  ensureColumn('service_orders', 'prescription_valid_until', 'TEXT');
  ensureColumn('service_orders', 'prescription_professional_id', 'TEXT');
  ensureColumn('service_orders', 'prescription_id', 'TEXT');
  ensureColumn('customers', 'customer_type', "TEXT DEFAULT 'individual'");
  ensureColumn('customers', 'nickname', 'TEXT');
  ensureColumn('customers', 'legal_name', 'TEXT');
  ensureColumn('customers', 'cnpj', 'TEXT');
  ensureColumn('customers', 'state_registration', 'TEXT');
  ensureColumn('customers', 'gender', 'TEXT');
  ensureColumn('customers', 'father_name', 'TEXT');
  ensureColumn('customers', 'mother_name', 'TEXT');
  ensureColumn('customers', 'responsible_name', 'TEXT');
  ensureColumn('customers', 'responsible_relationship', 'TEXT');
  ensureColumn('customers', 'profession', 'TEXT');
  ensureColumn('customers', 'education', 'TEXT');
  ensureColumn('customers', 'origin', 'TEXT');
  ensureColumn('customers', 'external_code', 'TEXT');
  ensureColumn('customers', 'discount_percent', 'REAL');
  ensureColumn('customers', 'family_income', 'REAL');
  ensureColumn('customers', 'insurance', 'TEXT');
  ensureColumn('customers', 'preferred_seller_id', 'TEXT');
  ensureColumn('customers', 'address_complement', 'TEXT');
  ensureColumn('customers', 'phones_json', "TEXT DEFAULT '[]'");
  ensureColumn('customers', 'emails_json', "TEXT DEFAULT '[]'");
  ensureColumn('customers', 'references_json', "TEXT DEFAULT '[]'");
  ensureColumn('financial_entries', 'created_by_name', 'TEXT');
  ensureColumn('financial_entries', 'updated_by', 'TEXT');
  ensureColumn('financial_entries', 'updated_by_name', 'TEXT');
  ensureColumn('financial_entries', 'settled_by', 'TEXT');
  ensureColumn('financial_entries', 'settled_by_name', 'TEXT');
  ensureColumn('financial_entries', 'settled_at', 'TEXT');
  ensureColumn('financial_entries', 'paid_amount', 'REAL DEFAULT 0');
  ensureColumn('financial_entries', 'payment_note', 'TEXT');
  ensureColumn('financial_entries', 'original_amount', 'REAL');
  ensureColumn('financial_entries', 'interest_amount', 'REAL DEFAULT 0');
  ensureColumn('financial_entries', 'fine_amount', 'REAL DEFAULT 0');
  ensureColumn('financial_entries', 'discount_amount', 'REAL DEFAULT 0');
  ensureColumn('financial_entries', 'net_amount', 'REAL');
  ensureColumn('financial_entries', 'card_fee_percent', 'REAL DEFAULT 0');
  ensureColumn('financial_entries', 'card_fee_amount', 'REAL DEFAULT 0');
  ensureColumn('financial_entries', 'anticipated_at', 'TEXT');
  ensureColumn('financial_entries', 'installment_group_id', 'TEXT');
  ensureColumn('financial_entries', 'installment_number', 'INTEGER');
  ensureColumn('financial_entries', 'installment_total', 'INTEGER');
  ensureColumn('financial_entries', 'approval_status', "TEXT DEFAULT 'approved'");
  ensureColumn('financial_entries', 'approved_by', 'TEXT');
  ensureColumn('financial_entries', 'approved_at', 'TEXT');
  ensureColumn('financial_entries', 'approval_note', 'TEXT');
  ensureColumn('financial_entries', 'reversed_entry_id', 'TEXT');
  ensureColumn('financial_entries', 'reversal_reason', 'TEXT');
  ensureColumn('financial_entries', 'recurrence_source_id', 'TEXT');
  ensureColumn('fixed_costs', 'supplier_name', 'TEXT');
  ensureColumn('fixed_costs', 'contract_number', 'TEXT');
  ensureColumn('fixed_costs', 'annual_adjustment_percent', 'REAL DEFAULT 0');
  ensureColumn('fixed_costs', 'last_adjustment_at', 'TEXT');
  ensureColumn('fixed_costs', 'responsible_name', 'TEXT');
  ensureColumn('fixed_costs', 'renewal_date', 'TEXT');
  ensureColumn('fixed_costs', 'document_url', 'TEXT');
  ensureColumn('financial_card_settlements', 'bank_transaction_id', 'TEXT');
  ensureColumn('financial_card_settlements', 'created_by', 'TEXT');
  ensureColumn('financial_card_settlements', 'created_by_name', 'TEXT');
  ensureColumn('financial_card_settlements', 'settled_by', 'TEXT');
  ensureColumn('financial_card_settlements', 'settled_by_name', 'TEXT');
  ensureColumn('cash_registers', 'opened_by_name', 'TEXT');
  ensureColumn('cash_registers', 'closed_by_name', 'TEXT');
  ensureColumn('cash_register_movements', 'created_by_name', 'TEXT');
  ensureColumn('financial_transfers', 'created_by_name', 'TEXT');
  ensureColumn('financial_daily_closings', 'closed_by_name', 'TEXT');
  ensureColumn('financial_approvals', 'requested_by_name', 'TEXT');
  ensureColumn('financial_approvals', 'approved_by_name', 'TEXT');
  ensureColumn('bank_reconciliations', 'created_by', 'TEXT');
  ensureColumn('bank_reconciliations', 'created_by_name', 'TEXT');
  ensureColumn('bank_transactions', 'created_by', 'TEXT');
  ensureColumn('bank_transactions', 'created_by_name', 'TEXT');
  ensureColumn('fixed_costs', 'updated_by', 'TEXT');
  ensureColumn('fixed_costs', 'updated_by_name', 'TEXT');
  ensureColumn('fixed_cost_payments', 'created_by_name', 'TEXT');
  ensureColumn('bank_reconciliations', 'reconciled_by_name', 'TEXT');
  ensureColumn('bank_transactions', 'reconciled_by_name', 'TEXT');
  database.run('CREATE INDEX IF NOT EXISTS idx_financial_entries_installments ON financial_entries(installment_group_id, installment_number)');
  database.run("UPDATE financial_entries SET paid_amount = amount WHERE status = 'paid' AND COALESCE(paid_amount, 0) = 0");
  database.run("UPDATE financial_entries SET original_amount = amount WHERE original_amount IS NULL");
  database.run("UPDATE financial_entries SET net_amount = amount WHERE net_amount IS NULL");
  database.run("UPDATE financial_entries SET payment_date = NULL, paid_amount = 0, updated_at = ? WHERE origin_table = 'sales' AND status = 'cancelled'", [now()]);
  seedRoles();
  seedPermissions();
  seedFinancialCategories();
  await seedDefaultAdmin();
  execute('INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)', ['schema_version', SCHEMA_VERSION, now()]);
  persistDatabase();
  return database;
}

function ensureColumn(table: string, column: string, definition: string) {
  const columns = database.exec(`PRAGMA table_info(${table})`)[0]?.values ?? [];
  const exists = columns.some((row) => String(row[1]) === column);
  if (!exists) database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

const permissionSeeds: Array<[string, string, string]> = [
  ['perm-dashboard-view', 'dashboard', 'view'], ['perm-dashboard-generate-insights', 'dashboard', 'generate_insights'],
  ['perm-appointments-view', 'appointments', 'view'], ['perm-appointments-create', 'appointments', 'create'], ['perm-appointments-edit', 'appointments', 'edit'], ['perm-appointments-delete', 'appointments', 'delete'],
  ['perm-customers-view', 'customers', 'view'], ['perm-customers-create', 'customers', 'create'], ['perm-customers-edit', 'customers', 'edit'], ['perm-customers-delete', 'customers', 'delete'], ['perm-customers-export', 'customers', 'export'], ['perm-customers-print', 'customers', 'print'],
  ['perm-products-view', 'products', 'view'], ['perm-products-create', 'products', 'create'], ['perm-products-edit', 'products', 'edit'], ['perm-products-delete', 'products', 'delete'], ['perm-products-delete-permanently', 'products', 'delete_permanently'],
  ['perm-products-view-cost', 'products', 'view_cost'], ['perm-products-manage-cost', 'products', 'manage_cost'], ['perm-products-view-prices', 'products', 'view_prices'], ['perm-products-manage-prices', 'products', 'manage_prices'],
  ['perm-products-manage-categories', 'products', 'manage_categories'], ['perm-products-manage-photos', 'products', 'manage_photos'],
  ['perm-products-view-stock', 'products', 'view_stock'], ['perm-products-manage-stock', 'products', 'manage_stock'],
  ['perm-products-view-stock-history', 'products', 'view_stock_history'], ['perm-products-view-sales-history', 'products', 'view_sales_history'],
  ['perm-products-view-os-history', 'products', 'view_os_history'], ['perm-products-manage-product-tax', 'products', 'manage_product_tax'], ['perm-products-import', 'products', 'import'],
  ['perm-products-export', 'products', 'export'], ['perm-products-view-audit', 'products', 'view_audit'],
  ['perm-sales-view', 'sales', 'view'], ['perm-sales-create', 'sales', 'create'], ['perm-sales-edit', 'sales', 'edit'], ['perm-sales-delete', 'sales', 'delete'],
  ['perm-service-orders-view', 'service_orders', 'view'], ['perm-service-orders-create', 'service_orders', 'create'], ['perm-service-orders-edit', 'service_orders', 'edit'], ['perm-service-orders-delete', 'service_orders', 'delete'], ['perm-service-orders-print', 'service_orders', 'print'],
  ['perm-financial-view', 'financial', 'view'], ['perm-financial-create', 'financial', 'create'], ['perm-financial-edit', 'financial', 'edit'], ['perm-financial-delete', 'financial', 'delete'], ['perm-financial-delete-installment', 'financial', 'delete_installment'], ['perm-financial-delete-credit-book', 'financial', 'delete_credit_book'], ['perm-financial-export', 'financial', 'export'], ['perm-financial-manage-fixed-costs', 'financial', 'manage_fixed_costs'], ['perm-financial-settle', 'financial', 'settle'], ['perm-financial-reverse', 'financial', 'reverse'], ['perm-financial-reconcile', 'financial', 'reconcile'], ['perm-financial-close-cash', 'financial', 'close_cash'], ['perm-financial-manage-budgets', 'financial', 'manage_budgets'], ['perm-financial-manage-transfers', 'financial', 'manage_transfers'], ['perm-financial-approve', 'financial', 'approve'], ['perm-financial-view-margin', 'financial', 'view_margin'], ['perm-financial-reopen-closing', 'financial', 'reopen_closing'],
  ['perm-financial-view-statement', 'financial', 'view_statement'], ['perm-financial-view-receivable', 'financial', 'view_receivable'], ['perm-financial-view-payable', 'financial', 'view_payable'], ['perm-financial-view-fixed-costs', 'financial', 'view_fixed_costs'], ['perm-financial-view-cashier', 'financial', 'view_cashier'], ['perm-financial-view-performance', 'financial', 'view_performance'], ['perm-financial-view-reconciliation', 'financial', 'view_reconciliation'], ['perm-financial-view-operations', 'financial', 'view_operations'],
  ['perm-financial-create-entry', 'financial', 'create_entry'], ['perm-financial-edit-entry', 'financial', 'edit_entry'], ['perm-financial-delete-entry', 'financial', 'delete_entry'], ['perm-financial-settle-entry', 'financial', 'settle_entry'], ['perm-financial-reverse-entry', 'financial', 'reverse_entry'], ['perm-financial-cancel-entry', 'financial', 'cancel_entry'], ['perm-financial-export-statement', 'financial', 'export_statement'], ['perm-financial-print-statement', 'financial', 'print_statement'], ['perm-financial-open-cash', 'financial', 'open_cash'], ['perm-financial-cash-movement', 'financial', 'cash_movement'], ['perm-financial-view-cash-history', 'financial', 'view_cash_history'],
  ['perm-financial-manage-card-settlements', 'financial', 'manage_card_settlements'], ['perm-financial-manage-bank-accounts', 'financial', 'manage_bank_accounts'], ['perm-financial-import-bank-statement', 'financial', 'import_bank_statement'], ['perm-financial-match-reconciliation', 'financial', 'match_reconciliation'], ['perm-financial-complete-reconciliation', 'financial', 'complete_reconciliation'], ['perm-financial-generate-recurring', 'financial', 'generate_recurring'], ['perm-financial-create-installments', 'financial', 'create_installments'], ['perm-financial-manage-installments', 'financial', 'manage_installments'], ['perm-financial-view-audit', 'financial', 'view_audit'], ['perm-financial-manage-categories', 'financial', 'manage_categories'],
  ['perm-fiscal-view', 'fiscal', 'view'], ['perm-fiscal-create', 'fiscal', 'create'], ['perm-fiscal-edit', 'fiscal', 'edit'], ['perm-fiscal-delete', 'fiscal', 'delete'], ['perm-fiscal-emit', 'fiscal', 'emit'], ['perm-fiscal-cancel', 'fiscal', 'cancel'], ['perm-fiscal-correct', 'fiscal', 'correct'], ['perm-fiscal-inutilize', 'fiscal', 'inutilize'], ['perm-fiscal-resend', 'fiscal', 'resend'], ['perm-fiscal-view-xml', 'fiscal', 'view_xml'], ['perm-fiscal-download-xml', 'fiscal', 'download_xml'], ['perm-fiscal-print', 'fiscal', 'print'], ['perm-fiscal-configure', 'fiscal', 'configure'], ['perm-fiscal-manage-credentials', 'fiscal', 'manage_credentials'], ['perm-fiscal-view-tax-details', 'fiscal', 'view_tax_details'], ['perm-fiscal-view-protocol', 'fiscal', 'view_protocol'], ['perm-fiscal-create-manual', 'fiscal', 'create_manual'], ['perm-fiscal-manage-series', 'fiscal', 'manage_series'], ['perm-fiscal-export', 'fiscal', 'export'], ['perm-fiscal-import', 'fiscal', 'import'], ['perm-fiscal-view-audit', 'fiscal', 'view_audit'],
  ['perm-reports-view', 'reports', 'view'], ['perm-reports-export', 'reports', 'export'],
  ['perm-users-view', 'users', 'view'], ['perm-users-create', 'users', 'create'], ['perm-users-edit', 'users', 'edit'], ['perm-users-delete', 'users', 'delete'], ['perm-users-manage-roles', 'users', 'manage_roles'],
  ['perm-settings-view', 'settings', 'view'], ['perm-settings-edit', 'settings', 'edit'],
  ['perm-companies-view', 'companies', 'view'], ['perm-companies-create', 'companies', 'create'], ['perm-companies-edit', 'companies', 'edit'], ['perm-companies-delete', 'companies', 'delete'],
  ['perm-stores-view', 'stores', 'view'], ['perm-stores-create', 'stores', 'create'], ['perm-stores-edit', 'stores', 'edit'], ['perm-stores-delete', 'stores', 'delete'],
  ['perm-admin-center-view', 'admin_center', 'view'], ['perm-admin-center-edit', 'admin_center', 'edit'],
];
const adminPermissionKeys = permissionSeeds.map(([id]) => id);
const productManagerPermissionKeys = permissionSeeds.filter(([id]) => id.startsWith('perm-products-')).map(([id]) => id);
const productOperatorPermissionKeys = ['perm-products-view', 'perm-products-view-prices', 'perm-products-view-stock'];
const productViewerPermissionKeys = ['perm-products-view', 'perm-products-view-prices'];
  const managerPermissionKeys = ['perm-dashboard-view', 'perm-dashboard-generate-insights', 'perm-appointments-view', 'perm-appointments-create', 'perm-appointments-edit', 'perm-appointments-delete', 'perm-customers-view', 'perm-customers-create', 'perm-customers-edit', 'perm-customers-delete', 'perm-customers-export', 'perm-customers-print', ...productManagerPermissionKeys, 'perm-sales-view', 'perm-sales-create', 'perm-sales-edit', 'perm-sales-delete', 'perm-service-orders-view', 'perm-service-orders-create', 'perm-service-orders-edit', 'perm-service-orders-delete', 'perm-service-orders-print', 'perm-financial-view', 'perm-financial-create', 'perm-financial-edit', 'perm-financial-export', 'perm-financial-manage-fixed-costs', 'perm-financial-settle', 'perm-financial-reconcile', 'perm-financial-close-cash', 'perm-financial-manage-budgets', 'perm-financial-manage-transfers', 'perm-financial-approve', 'perm-financial-view-margin', 'perm-financial-reopen-closing', 'perm-reports-view', 'perm-reports-export', 'perm-users-view', 'perm-companies-view', 'perm-stores-view'];
const operatorPermissionKeys = ['perm-dashboard-view', 'perm-appointments-view', 'perm-appointments-create', 'perm-appointments-edit', 'perm-customers-view', 'perm-customers-create', 'perm-customers-edit', 'perm-customers-export', 'perm-customers-print', ...productOperatorPermissionKeys, 'perm-sales-view', 'perm-sales-create', 'perm-service-orders-view', 'perm-service-orders-create', 'perm-service-orders-edit', 'perm-service-orders-print'];
const viewerPermissionKeys = ['perm-dashboard-view', 'perm-appointments-view', 'perm-customers-view', 'perm-customers-print', ...productViewerPermissionKeys, 'perm-sales-view', 'perm-service-orders-view', 'perm-service-orders-print', 'perm-reports-view'];
const financialViewPermissionKeys = ['perm-financial-view-statement', 'perm-financial-view-receivable', 'perm-financial-view-payable', 'perm-financial-view-fixed-costs', 'perm-financial-view-cashier', 'perm-financial-view-performance', 'perm-financial-view-reconciliation', 'perm-financial-view-operations'];
  const financialManagerPermissionKeys = [...financialViewPermissionKeys, 'perm-financial-create-entry', 'perm-financial-edit-entry', 'perm-financial-settle-entry', 'perm-financial-cancel-entry', 'perm-financial-export-statement', 'perm-financial-print-statement', 'perm-financial-open-cash', 'perm-financial-cash-movement', 'perm-financial-view-cash-history', 'perm-financial-manage-card-settlements', 'perm-financial-manage-bank-accounts', 'perm-financial-import-bank-statement', 'perm-financial-match-reconciliation', 'perm-financial-complete-reconciliation', 'perm-financial-generate-recurring', 'perm-financial-create-installments', 'perm-financial-manage-installments', 'perm-financial-manage-categories'];
  const fiscalOperatorPermissionKeys = ['perm-fiscal-view', 'perm-fiscal-emit', 'perm-fiscal-print', 'perm-fiscal-view-protocol'];
  const fiscalManagerPermissionKeys = [...fiscalOperatorPermissionKeys, 'perm-fiscal-create', 'perm-fiscal-edit', 'perm-fiscal-resend', 'perm-fiscal-view-xml', 'perm-fiscal-download-xml', 'perm-fiscal-view-tax-details', 'perm-fiscal-export', 'perm-fiscal-view-audit'];
const rolePermissionKeys: Record<string, string[]> = {
  admin_master: adminPermissionKeys,
  admin: adminPermissionKeys,
  manager: [...managerPermissionKeys, ...financialManagerPermissionKeys, ...fiscalManagerPermissionKeys],
  seller: [...operatorPermissionKeys, ...fiscalOperatorPermissionKeys],
  optometrist: [...operatorPermissionKeys, ...fiscalOperatorPermissionKeys],
  technician: [...operatorPermissionKeys, ...fiscalOperatorPermissionKeys],
  receptionist: [...operatorPermissionKeys, ...fiscalOperatorPermissionKeys],
  financial: ['perm-dashboard-view', 'perm-financial-view', 'perm-financial-create', 'perm-financial-edit', 'perm-financial-export', 'perm-financial-manage-fixed-costs', 'perm-financial-settle', 'perm-financial-reconcile', 'perm-financial-close-cash', 'perm-financial-manage-budgets', 'perm-financial-manage-transfers', 'perm-financial-approve', 'perm-financial-view-margin', 'perm-reports-view', 'perm-reports-export', ...financialManagerPermissionKeys, 'perm-financial-manage-fixed-costs', 'perm-financial-settle', 'perm-financial-reverse', 'perm-financial-close-cash', 'perm-financial-reopen-closing', ...fiscalManagerPermissionKeys],
  user: [...viewerPermissionKeys, 'perm-fiscal-view', 'perm-fiscal-print'],
};
type DefaultFinancialCategory = {
  key: string;
  name: string;
  type: 'income' | 'expense';
  costCenter: string;
  color: string;
};

const defaultFinancialCategories: DefaultFinancialCategory[] = [
  { key: 'vendas', name: 'Vendas', type: 'income', costCenter: 'Receitas', color: '#10b981' },
  { key: 'recebimentos', name: 'Recebimentos', type: 'income', costCenter: 'Receitas', color: '#14b8a6' },
  { key: 'aporte', name: 'Aporte de Capital', type: 'income', costCenter: 'Financeiro', color: '#3b82f6' },
  { key: 'outras-receitas', name: 'Outras Receitas', type: 'income', costCenter: 'Receitas', color: '#8b5cf6' },
  { key: 'fornecedores', name: 'Fornecedores', type: 'expense', costCenter: 'CMV', color: '#ef4444' },
  { key: 'aluguel', name: 'Aluguel e Condomínio', type: 'expense', costCenter: 'Operacional', color: '#f97316' },
  { key: 'folha', name: 'Folha de Pagamento', type: 'expense', costCenter: 'Pessoal', color: '#eab308' },
  { key: 'impostos', name: 'Impostos e Taxas', type: 'expense', costCenter: 'Tributário', color: '#f59e0b' },
  { key: 'manutencao', name: 'Manutenção e Reparos', type: 'expense', costCenter: 'Operacional', color: '#06b6d4' },
  { key: 'marketing', name: 'Marketing e Publicidade', type: 'expense', costCenter: 'Comercial', color: '#ec4899' },
  { key: 'outras-despesas', name: 'Outras Despesas', type: 'expense', costCenter: 'Operacional', color: '#64748b' },
];

export function ensureDefaultFinancialCategories(companyId: string) {
  if (!companyId) return;
  for (const category of defaultFinancialCategories) {
    execute(
      'INSERT OR IGNORE INTO financial_categories (id, company_id, name, type, cost_center, color, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
      [`financial-${companyId}-${category.key}`, companyId, category.name, category.type, category.costCenter, category.color, now()],
    );
  }
}

function seedFinancialCategories() {
  for (const company of selectRows('SELECT id FROM companies')) ensureDefaultFinancialCategories(String(company.id));
}

function seedPermissions() {
  for (const [id, module, action] of permissionSeeds) {
    execute('INSERT OR IGNORE INTO permissions (id, name, slug, module, action, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, `${module}.${action}`, id, module, action, now()]);
  }
  for (const [roleName, permissionIds] of Object.entries(rolePermissionKeys)) {
    const role = selectRows('SELECT id FROM roles WHERE name = ? LIMIT 1', [roleName])[0];
    if (!role) continue;
    for (const permissionId of permissionIds) {
      execute('INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)', [randomUUID(), role.id, permissionId, now()]);
    }
  }
}

export function getDatabase() {
  if (!database) throw new Error('Banco local ainda não foi inicializado.');
  return database;
}

export function newId() {
  return randomUUID();
}

function seedProductTaxonomy() {
  const products = selectRows('SELECT DISTINCT company_id, category, brand FROM products');
  const timestamp = now();
  for (const product of products) {
    const companyId = String(product.company_id || '');
    const category = String(product.category || '').trim();
    const brand = String(product.brand || '').trim();
    if (companyId && category) {
      execute('INSERT OR IGNORE INTO product_categories (id, company_id, name, is_active, created_at) VALUES (?, ?, ?, 1, ?)', [newId(), companyId, category, timestamp]);
    }
    if (companyId && brand) {
      execute('INSERT OR IGNORE INTO product_brands (id, company_id, name, is_active, created_at) VALUES (?, ?, ?, 1, ?)', [newId(), companyId, brand, timestamp]);
    }
  }
}

export function now() {
  return new Date().toISOString();
}

function createStartupBackup() {
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    fs.copyFileSync(databasePath, path.join(backupDir, `otica-nordestina-pre-start-${stamp}.sqlite`));
    const backups = fs.readdirSync(backupDir).filter((name) => name.endsWith('.sqlite')).sort();
    for (const old of backups.slice(0, Math.max(0, backups.length - 10))) fs.rmSync(path.join(backupDir, old), { force: true });
  } catch (error) {
    console.warn('Não foi possível criar backup de inicialização:', error);
  }
}

export function persistDatabase() {
  if (!database) return;
  const binary = database.export();
  const tempPath = `${databasePath}.tmp`;
  fs.writeFileSync(tempPath, Buffer.from(binary));
  try {
    fs.renameSync(tempPath, databasePath);
  } catch {
    fs.copyFileSync(tempPath, databasePath);
    fs.rmSync(tempPath, { force: true });
  }
}

export function createDatabaseBackup(label = 'manual') {
  persistDatabase();
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-');
  const target = path.join(backupDir, `otica-nordestina-${safeLabel}-${stamp}.sqlite`);
  fs.copyFileSync(databasePath, target);
  return target;
}

export function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function tableColumns(table: string) {
  const rows = selectRows(`PRAGMA table_info(${quoteIdentifier(table)})`);
  return new Set(rows.map((row) => String(row.name)));
}

export function selectRows(sql: string, params: unknown[] = []) {
  const statement = getDatabase().prepare(sql, params as any[]);
  const rows: Record<string, unknown>[] = [];
  while (statement.step()) rows.push(statement.getAsObject() as Record<string, unknown>);
  statement.free();
  return rows;
}

export function execute(sql: string, params: unknown[] = []) {
  getDatabase().run(sql, params as any[]);
}

export function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function serializeValue(column: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (jsonColumns.has(column) && value !== null && typeof value !== 'string') return JSON.stringify(value);
  if (booleanColumns.has(column) && typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export function deserializeRow(row: Record<string, unknown>) {
  const output = { ...row } as Record<string, unknown>;
  for (const column of jsonColumns) {
    if (typeof output[column] === 'string') {
      try { output[column] = JSON.parse(output[column] as string); } catch { /* valor legado inválido permanece string */ }
    }
  }
  for (const column of booleanColumns) {
    if (column in output && output[column] !== null) output[column] = Boolean(output[column]);
  }
  return output;
}

async function seedDefaultAdmin() {
  if (process.env.LOCAL_SEED_ADMIN === 'false') return;
  if (selectRows('SELECT id FROM profiles LIMIT 1').length > 0) return;
  const email = process.env.LOCAL_ADMIN_EMAIL || 'admin@admin.com';
  const password = process.env.LOCAL_ADMIN_PASSWORD || 'kaliel123';
  const role = selectRows('SELECT id FROM roles WHERE name = ?', ['admin_master'])[0];
  execute(
    'INSERT INTO profiles (id, name, email, role, role_id, companies, stores, status, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [newId(), 'Administrador Local', email, 'admin_master', role?.id || null, '[]', '[]', 'active', await bcrypt.hash(password, 10), now()],
  );
  console.log(`Usuário local inicial: ${email}`);
}

function seedRoles() {
  const roles = [
    ['r-admin-master', 'admin_master', 'Administrador Master', 1],
    ['r-admin', 'admin', 'Administrador', 1],
    ['r-manager', 'manager', 'Gerente', 1],
    ['r-seller', 'seller', 'Vendedor', 1],
    ['r-optometrist', 'optometrist', 'Optometrista', 1],
    ['r-technician', 'technician', 'Técnico', 1],
    ['r-receptionist', 'receptionist', 'Recepcionista', 1],
    ['r-financial', 'financial', 'Financeiro', 1],
    ['r-user', 'user', 'Usuário Comum', 1],
  ];
  for (const [id, name, description, isSystem] of roles) {
    execute(
      'INSERT OR IGNORE INTO roles (id, name, description, is_system, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, name, description, isSystem, now()],
    );
  }
}

export function getDatabasePath() {
  return databasePath;
}
