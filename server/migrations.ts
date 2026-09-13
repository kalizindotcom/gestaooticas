import { createHash } from 'node:crypto';
import type { Database } from 'sql.js';

type MigrationColumn = {
  kind: 'column';
  table: string;
  column: string;
  definition: string;
};

type MigrationSql = {
  kind: 'sql';
  sql: string;
  bindNow?: boolean;
};

type MigrationOperation = MigrationColumn | MigrationSql;

export type Migration = {
  version: number;
  name: string;
  operations: readonly MigrationOperation[];
};

type MigrationRow = {
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
  execution_ms: number;
};

export type MigrationStatus = {
  currentVersion: number;
  targetVersion: number;
  applied: MigrationRow[];
};

type MigrationOptions = {
  migrations?: readonly Migration[];
  now?: () => string;
  legacyVersion?: number;
};

export const LEGACY_BASELINE_VERSION = 20;
export const CURRENT_SCHEMA_VERSION = 21;

const migrationTableSql = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    execution_ms INTEGER NOT NULL DEFAULT 0
  )
`;

const legacyOperations: readonly MigrationOperation[] = [
  { kind: 'column', table: 'products', column: 'barcode', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'created_by', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'ncm', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'cest', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'tax_origin', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'commercial_unit', definition: "TEXT DEFAULT 'UN'" },
  { kind: 'column', table: 'products', column: 'taxable_unit', definition: "TEXT DEFAULT 'UN'" },
  { kind: 'column', table: 'products', column: 'default_cfop', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'default_cst', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'default_csosn', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'tax_notes', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'unit', definition: "TEXT DEFAULT 'un'" },
  { kind: 'column', table: 'products', column: 'product_type', definition: "TEXT DEFAULT 'product'" },
  { kind: 'column', table: 'products', column: 'supplier_name', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'min_stock', definition: 'INTEGER DEFAULT 0' },
  { kind: 'column', table: 'products', column: 'max_stock', definition: 'INTEGER' },
  { kind: 'column', table: 'products', column: 'promotional_price', definition: 'REAL' },
  { kind: 'column', table: 'products', column: 'updated_at', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'updated_by', definition: 'TEXT' },
  { kind: 'column', table: 'products', column: 'updated_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'profiles', column: 'session_version', definition: 'INTEGER DEFAULT 1' },
  { kind: 'column', table: 'product_stock', column: 'reserved_quantity', definition: 'INTEGER DEFAULT 0' },
  { kind: 'column', table: 'product_stock', column: 'min_quantity', definition: 'INTEGER DEFAULT 0' },
  { kind: 'column', table: 'product_stock', column: 'max_quantity', definition: 'INTEGER' },
  { kind: 'column', table: 'product_stock', column: 'location', definition: 'TEXT' },
  { kind: 'column', table: 'product_stock', column: 'updated_at', definition: 'TEXT' },
  { kind: 'column', table: 'product_movements', column: 'quantity_before', definition: 'INTEGER' },
  { kind: 'column', table: 'product_movements', column: 'quantity_after', definition: 'INTEGER' },
  { kind: 'column', table: 'product_movements', column: 'unit_cost', definition: 'REAL' },
  { kind: 'column', table: 'product_movements', column: 'document_number', definition: 'TEXT' },
  { kind: 'column', table: 'product_movements', column: 'supplier_name', definition: 'TEXT' },
  { kind: 'column', table: 'product_movements', column: 'reason', definition: 'TEXT' },
  { kind: 'column', table: 'product_movements', column: 'reference_type', definition: 'TEXT' },
  { kind: 'column', table: 'product_movements', column: 'reference_id', definition: 'TEXT' },
  { kind: 'column', table: 'product_movements', column: 'reserved_before', definition: 'INTEGER DEFAULT 0' },
  { kind: 'column', table: 'product_movements', column: 'reserved_after', definition: 'INTEGER DEFAULT 0' },
  { kind: 'column', table: 'service_orders', column: 'product_id', definition: 'TEXT' },
  { kind: 'column', table: 'service_orders', column: 'product_quantity', definition: 'INTEGER DEFAULT 1' },
  { kind: 'column', table: 'sales', column: 'discount', definition: 'REAL DEFAULT 0' },
  { kind: 'column', table: 'sales', column: 'installments', definition: 'INTEGER' },
  { kind: 'column', table: 'sales', column: 'service_order_id', definition: 'TEXT' },
  { kind: 'column', table: 'sales', column: 'notes', definition: 'TEXT' },
  { kind: 'column', table: 'service_orders', column: 'prescription_date', definition: 'TEXT' },
  { kind: 'column', table: 'service_orders', column: 'prescription_valid_until', definition: 'TEXT' },
  { kind: 'column', table: 'service_orders', column: 'prescription_professional_id', definition: 'TEXT' },
  { kind: 'column', table: 'service_orders', column: 'prescription_id', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'customer_type', definition: "TEXT DEFAULT 'individual'" },
  { kind: 'column', table: 'customers', column: 'nickname', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'legal_name', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'cnpj', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'state_registration', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'gender', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'father_name', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'mother_name', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'responsible_name', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'responsible_relationship', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'profession', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'education', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'origin', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'external_code', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'discount_percent', definition: 'REAL' },
  { kind: 'column', table: 'customers', column: 'family_income', definition: 'REAL' },
  { kind: 'column', table: 'customers', column: 'insurance', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'preferred_seller_id', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'address_complement', definition: 'TEXT' },
  { kind: 'column', table: 'customers', column: 'phones_json', definition: "TEXT DEFAULT '[]'" },
  { kind: 'column', table: 'customers', column: 'emails_json', definition: "TEXT DEFAULT '[]'" },
  { kind: 'column', table: 'customers', column: 'references_json', definition: "TEXT DEFAULT '[]'" },
  { kind: 'column', table: 'financial_entries', column: 'created_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'updated_by', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'updated_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'settled_by', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'settled_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'settled_at', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'paid_amount', definition: 'REAL DEFAULT 0' },
  { kind: 'column', table: 'financial_entries', column: 'payment_note', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'original_amount', definition: 'REAL' },
  { kind: 'column', table: 'financial_entries', column: 'interest_amount', definition: 'REAL DEFAULT 0' },
  { kind: 'column', table: 'financial_entries', column: 'fine_amount', definition: 'REAL DEFAULT 0' },
  { kind: 'column', table: 'financial_entries', column: 'discount_amount', definition: 'REAL DEFAULT 0' },
  { kind: 'column', table: 'financial_entries', column: 'net_amount', definition: 'REAL' },
  { kind: 'column', table: 'financial_entries', column: 'card_fee_percent', definition: 'REAL DEFAULT 0' },
  { kind: 'column', table: 'financial_entries', column: 'card_fee_amount', definition: 'REAL DEFAULT 0' },
  { kind: 'column', table: 'financial_entries', column: 'anticipated_at', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'installment_group_id', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'installment_number', definition: 'INTEGER' },
  { kind: 'column', table: 'financial_entries', column: 'installment_total', definition: 'INTEGER' },
  { kind: 'column', table: 'financial_entries', column: 'approval_status', definition: "TEXT DEFAULT 'approved'" },
  { kind: 'column', table: 'financial_entries', column: 'approved_by', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'approved_at', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'approval_note', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'reversed_entry_id', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'reversal_reason', definition: 'TEXT' },
  { kind: 'column', table: 'financial_entries', column: 'recurrence_source_id', definition: 'TEXT' },
  { kind: 'column', table: 'fixed_costs', column: 'supplier_name', definition: 'TEXT' },
  { kind: 'column', table: 'fixed_costs', column: 'contract_number', definition: 'TEXT' },
  { kind: 'column', table: 'fixed_costs', column: 'annual_adjustment_percent', definition: 'REAL DEFAULT 0' },
  { kind: 'column', table: 'fixed_costs', column: 'last_adjustment_at', definition: 'TEXT' },
  { kind: 'column', table: 'fixed_costs', column: 'responsible_name', definition: 'TEXT' },
  { kind: 'column', table: 'fixed_costs', column: 'renewal_date', definition: 'TEXT' },
  { kind: 'column', table: 'fixed_costs', column: 'document_url', definition: 'TEXT' },
  { kind: 'column', table: 'financial_card_settlements', column: 'bank_transaction_id', definition: 'TEXT' },
  { kind: 'column', table: 'financial_card_settlements', column: 'created_by', definition: 'TEXT' },
  { kind: 'column', table: 'financial_card_settlements', column: 'created_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'financial_card_settlements', column: 'settled_by', definition: 'TEXT' },
  { kind: 'column', table: 'financial_card_settlements', column: 'settled_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'cash_registers', column: 'opened_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'cash_registers', column: 'closed_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'cash_register_movements', column: 'created_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'financial_transfers', column: 'created_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'financial_daily_closings', column: 'closed_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'financial_approvals', column: 'requested_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'financial_approvals', column: 'approved_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'bank_reconciliations', column: 'created_by', definition: 'TEXT' },
  { kind: 'column', table: 'bank_reconciliations', column: 'created_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'bank_transactions', column: 'created_by', definition: 'TEXT' },
  { kind: 'column', table: 'bank_transactions', column: 'created_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'fixed_costs', column: 'updated_by', definition: 'TEXT' },
  { kind: 'column', table: 'fixed_costs', column: 'updated_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'fixed_cost_payments', column: 'created_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'bank_reconciliations', column: 'reconciled_by_name', definition: 'TEXT' },
  { kind: 'column', table: 'bank_transactions', column: 'reconciled_by_name', definition: 'TEXT' },
  { kind: 'sql', sql: 'CREATE INDEX IF NOT EXISTS idx_service_orders_product ON service_orders(product_id)' },
  { kind: 'sql', sql: 'CREATE INDEX IF NOT EXISTS idx_financial_entries_due_status ON financial_entries(company_id, store_id, due_date, status)' },
  { kind: 'sql', sql: 'CREATE INDEX IF NOT EXISTS idx_financial_entries_origin ON financial_entries(origin_table, origin_id)' },
  { kind: 'sql', sql: 'CREATE INDEX IF NOT EXISTS idx_financial_budgets_period ON financial_budgets(company_id, store_id, reference_month)' },
  { kind: 'sql', sql: 'CREATE INDEX IF NOT EXISTS idx_financial_approvals_entry ON financial_approvals(entry_id, status)' },
  { kind: 'sql', sql: 'CREATE INDEX IF NOT EXISTS idx_financial_transfers_company ON financial_transfers(company_id, transfer_date)' },
  { kind: 'sql', sql: 'CREATE INDEX IF NOT EXISTS idx_financial_card_settlements_expected ON financial_card_settlements(company_id, store_id, expected_date, status)' },
  { kind: 'sql', sql: 'CREATE INDEX IF NOT EXISTS idx_financial_entries_installments ON financial_entries(installment_group_id, installment_number)' },
  { kind: 'sql', sql: "UPDATE financial_entries SET paid_amount = amount WHERE status = 'paid' AND COALESCE(paid_amount, 0) = 0" },
  { kind: 'sql', sql: 'UPDATE financial_entries SET original_amount = amount WHERE original_amount IS NULL' },
  { kind: 'sql', sql: 'UPDATE financial_entries SET net_amount = amount WHERE net_amount IS NULL' },
  { kind: 'sql', sql: "UPDATE financial_entries SET payment_date = NULL, paid_amount = 0, updated_at = ? WHERE origin_table = 'sales' AND status = 'cancelled'", bindNow: true },
];

export const migrations: readonly Migration[] = [
  { version: LEGACY_BASELINE_VERSION, name: 'legacy-schema-reconciliation-v20', operations: legacyOperations },
  {
    version: CURRENT_SCHEMA_VERSION,
    name: 'data-integrity-check-history-index',
    operations: [
      { kind: 'sql', sql: 'CREATE INDEX IF NOT EXISTS idx_data_integrity_checks_status_created ON data_integrity_checks(status, created_at)' },
    ],
  },
];

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function migrationError(message: string, code: string) {
  return Object.assign(new Error(message), { code });
}

export function migrationChecksum(migration: Migration) {
  const payload = JSON.stringify({ version: migration.version, name: migration.name, operations: migration.operations });
  return createHash('sha256').update(payload).digest('hex');
}

function readRows(database: Database, sql: string, params: Array<string | number> = []) {
  const statement = database.prepare(sql, params);
  const rows: Record<string, unknown>[] = [];
  while (statement.step()) rows.push(statement.getAsObject() as Record<string, unknown>);
  statement.free();
  return rows;
}

function ensureColumn(database: Database, operation: MigrationColumn) {
  const columns = readRows(database, `PRAGMA table_info(${quoteIdentifier(operation.table)})`);
  if (columns.some((row) => String(row.name) === operation.column)) return;
  database.run(`ALTER TABLE ${quoteIdentifier(operation.table)} ADD COLUMN ${quoteIdentifier(operation.column)} ${operation.definition}`);
}

function applyOperation(database: Database, operation: MigrationOperation, now: () => string) {
  if (operation.kind === 'column') {
    ensureColumn(database, operation);
    return;
  }
  database.run(operation.sql, operation.bindNow ? [now()] : undefined);
}

function readApplied(database: Database) {
  return readRows(database, 'SELECT version, name, checksum, applied_at, execution_ms FROM schema_migrations ORDER BY version')
    .map((row) => ({
      version: Number(row.version),
      name: String(row.name),
      checksum: String(row.checksum),
      applied_at: String(row.applied_at),
      execution_ms: Number(row.execution_ms || 0),
    }));
}

function readLegacyVersion(database: Database) {
  let rows: Record<string, unknown>[];
  try {
    rows = readRows(database, "SELECT value FROM app_meta WHERE key = 'schema_version' LIMIT 1");
  } catch {
    return 0;
  }
  const value = Number(rows[0]?.value || 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function recordMigration(database: Database, migration: Migration, checksum: string, appliedAt: string, executionMs: number) {
  database.run('INSERT INTO schema_migrations (version, name, checksum, applied_at, execution_ms) VALUES (?, ?, ?, ?, ?)', [migration.version, migration.name, checksum, appliedAt, executionMs]);
}

export function runMigrations(database: Database, options: MigrationOptions = {}): MigrationStatus {
  const migrationList = [...(options.migrations || migrations)].sort((a, b) => a.version - b.version);
  const now = options.now || (() => new Date().toISOString());
  database.run(migrationTableSql);
  const applied = readApplied(database);
  const appliedByVersion = new Map(applied.map((row) => [row.version, row]));
  const highestKnownVersion = migrationList.at(-1)?.version || 0;
  const legacyVersion = options.legacyVersion ?? readLegacyVersion(database);

  if (legacyVersion > highestKnownVersion) {
    throw migrationError(`Banco mais novo que esta versão da aplicação: ${legacyVersion} > ${highestKnownVersion}.`, 'DATABASE_SCHEMA_TOO_NEW');
  }

  for (const migration of migrationList) {
    const checksum = migrationChecksum(migration);
    const existing = appliedByVersion.get(migration.version);
    if (existing) {
      if (existing.name !== migration.name || existing.checksum !== checksum) {
        throw migrationError(`Checksum da migração ${migration.version} não confere. O código aplicado foi alterado.`, 'DATABASE_MIGRATION_CHECKSUM_MISMATCH');
      }
      continue;
    }
    const startedAt = Date.now();
    database.run('BEGIN');
    try {
      for (const operation of migration.operations) applyOperation(database, operation, now);
      const appliedAt = now();
      recordMigration(database, migration, checksum, appliedAt, Date.now() - startedAt);
      database.run('COMMIT');
      appliedByVersion.set(migration.version, { version: migration.version, name: migration.name, checksum, applied_at: appliedAt, execution_ms: Date.now() - startedAt });
    } catch (error) {
      try { database.run('ROLLBACK'); } catch { /* rollback best effort */ }
      const message = error instanceof Error ? error.message : String(error);
      throw migrationError(`Falha na migração ${migration.version} (${migration.name}): ${message}`, 'DATABASE_MIGRATION_FAILED');
    }
  }

  const finalApplied = [...appliedByVersion.values()].sort((a, b) => a.version - b.version);
  return { currentVersion: finalApplied.at(-1)?.version || 0, targetVersion: highestKnownVersion, applied: finalApplied };
}

export function getMigrationStatus(database: Database): MigrationStatus {
  database.run(migrationTableSql);
  const applied = readApplied(database);
  return {
    currentVersion: applied.at(-1)?.version || 0,
    targetVersion: migrations.at(-1)?.version || 0,
    applied,
  };
}
