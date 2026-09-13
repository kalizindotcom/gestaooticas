import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  execute,
  getDatabase,
  initDatabase,
  newId,
  now,
  persistDatabase,
  quoteIdentifier,
  selectRows,
  serializeValue,
  tableColumns,
  deserializeRow,
  createDatabaseBackup,
  hashResetToken,
  ensureDefaultFinancialCategories,
} from './db.js';
import {
  createBackup,
  createGoogleOAuthUrl,
  disconnectGoogleDrive,
  downloadGoogleDriveBackup,
  getBackupDirectory,
  getBackupArchivePath,
  getBackupJob,
  getBackupSettings,
  getGoogleDriveConfigStatus,
  importBackupArchive,
  inspectArchive,
  listBackupEvents,
  listBackupJobs,
  listGoogleDriveBackups,
  restoreBackup,
  runBackupScheduler,
  saveBackupSettings,
  startBackupScheduler,
  testGoogleDrive,
  connectGoogleDrive,
} from './backupService.js';
import { resolveFiscalProvider } from './fiscalProvider.js';
import { canTransitionFiscalStatus, isProductionEnvironment } from './fiscalDomain.js';
import {
  allowInitialSignup,
  allowLocalResetToken,
  assertPasswordPolicy,
  authSecret,
  clientAddress,
  configuredCorsOrigin,
  isProduction,
  sessionTtlSeconds,
} from './securityConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3001);
const uploadsRoot = path.join(projectRoot, 'uploads');
const allowedUploadTypes = new Map([
  ['.jpg', new Set(['image/jpeg'])],
  ['.jpeg', new Set(['image/jpeg'])],
  ['.png', new Set(['image/png'])],
  ['.webp', new Set(['image/webp'])],
  ['.pdf', new Set(['application/pdf'])],
  ['.txt', new Set(['text/plain'])],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedMimes = allowedUploadTypes.get(extension);
    if (!allowedMimes || !allowedMimes.has(file.mimetype.toLowerCase())) {
      return callback(new Error('Tipo de arquivo não permitido. Envie JPG, PNG, WEBP, PDF ou TXT.'));
    }
    return callback(null, true);
  },
});
const backupUploadTypes = new Set(['application/gzip', 'application/x-gzip', 'application/octet-stream']);
const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      fs.mkdirSync(getBackupDirectory(), { recursive: true });
      callback(null, getBackupDirectory());
    },
    filename: (_request, file, callback) => callback(null, `incoming-${Date.now()}-${newId()}-${path.basename(file.originalname)}`),
  }),
  limits: { fileSize: 1024 * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (_request, file, callback) => {
    const lowerName = file.originalname.toLowerCase();
    if (!lowerName.endsWith('.tar.gz') || !backupUploadTypes.has(file.mimetype.toLowerCase())) {
      return callback(new Error('Envie um arquivo de backup .tar.gz válido.'));
    }
    return callback(null, true);
  },
});

const uploadRootResolved = path.resolve(uploadsRoot);
function isWithinUploads(candidate: string) {
  const resolved = path.resolve(candidate);
  return resolved === uploadRootResolved || resolved.startsWith(`${uploadRootResolved}${path.sep}`);
}

function isSafeRegularFile(candidate: string) {
  try {
    const stat = fs.lstatSync(candidate);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function isSafeDirectory(candidate: string) {
  try {
    const stat = fs.lstatSync(candidate);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function normalizeStoragePath(value: unknown) {
  const normalized = String(value || '').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/').filter(Boolean);
  if (!normalized || normalized.includes('\0') || segments.some((segment) => segment === '.' || segment === '..')) return null;
  return normalized;
}

function canAccessStoragePath(request: Request, bucket: string, relativePath: string, allowDirectory = false) {
  const authRequest = request as AuthenticatedRequest;
  if (isMaster(authRequest.profile)) return true;
  if (bucket !== 'customer-attachments') return false;
  const parts = relativePath.split('/').filter(Boolean);
  if ((!allowDirectory && parts.length < 3) || (allowDirectory && parts.length < 2)) return false;
  const [companyId, customerId] = parts;
  if (!profileCompanies(authRequest.profile).includes(companyId)) return false;
  const customer = selectRows('SELECT company_id FROM customers WHERE id = ? LIMIT 1', [customerId])[0];
  if (String(customer?.company_id || '') !== companyId) return false;
  const canonical = path.resolve(uploadsRoot, bucket, relativePath);
  return isWithinUploads(canonical);
}

function forbiddenStorage(response: Response) {
  return response.status(403).json({ data: null, error: { message: 'Acesso ao anexo não autorizado.' } });
}

const allowedTables = new Set([
  'companies', 'stores', 'roles', 'permissions', 'role_permissions', 'profiles', 'user_permissions',
  'employees', 'customers', 'laboratories', 'professionals', 'appointments', 'products', 'product_stock',
  'product_movements', 'product_categories', 'product_brands', 'product_images', 'product_audits',
  'sales', 'sale_items', 'service_orders', 'service_order_timeline', 'cash_registers',
  'cash_register_movements', 'financial_entries', 'financial_entry_audits', 'fixed_costs', 'fixed_cost_payments', 'bank_accounts', 'bank_reconciliations', 'bank_transactions',
  'financial_categories', 'financial_budgets', 'financial_installment_groups', 'financial_approvals', 'financial_transfers', 'financial_card_settlements', 'financial_daily_closings', 'prescriptions',
]);

interface AuthenticatedRequest extends Request {
  userId?: string;
  profile?: Record<string, unknown>;
}

interface QueryFilters {
  eq: Record<string, string>;
  neq: Record<string, string>;
  in: Record<string, string[]>;
  gte: Record<string, string>;
  lte: Record<string, string>;
  contains: Record<string, unknown>;
}

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: (origin, callback) => callback(null, configuredCorsOrigin(origin)), credentials: true }));
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

type RateLimitBucket = { count: number; resetAt: number };
const rateLimitBuckets = new Map<string, RateLimitBucket>();

function authRateLimit(name: string, maximum: number, windowMs: number) {
  return (request: Request, response: Response, next: NextFunction) => {
    const key = `${name}:${clientAddress(request)}`;
    const currentTime = Date.now();
    const bucket = rateLimitBuckets.get(key);
    if (!bucket || bucket.resetAt <= currentTime) {
      rateLimitBuckets.set(key, { count: 1, resetAt: currentTime + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > maximum) {
      response.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - currentTime) / 1000)));
      return response.status(429).json({ data: null, error: { message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', code: 'RATE_LIMITED' } });
    }
    return next();
  };
}

function readCookie(request: Request, name: string) {
  const header = String(request.headers.cookie || '');
  const value = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : undefined;
}

function setSessionCookie(response: Response, token: string) {
  const secure = isProduction ? '; Secure' : '';
  response.setHeader('Set-Cookie', `otica_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${sessionTtlSeconds}; SameSite=Lax${secure}`);
}

function clearSessionCookie(response: Response) {
  const secure = isProduction ? '; Secure' : '';
  response.setHeader('Set-Cookie', `otica_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`);
}

const healthResponse = { ok: true, database: 'sqlite' } as const;
app.get('/health', (_request, response) => response.json(healthResponse));
app.get('/api/health', (_request, response) => response.json(healthResponse));

function readQueryValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return value === undefined ? '' : String(value);
}

function parseJsonValue(value: string) {
  try { return JSON.parse(value); } catch { return value; }
}

function parseFilters(query: Request['query']): QueryFilters {
  const filters: QueryFilters = { eq: {}, neq: {}, in: {}, gte: {}, lte: {}, contains: {} };
  for (const [key, rawValue] of Object.entries(query)) {
    const match = /^(eq|neq|in|gte|lte|contains)\[(.+)\]$/.exec(key);
    if (!match) continue;
    const [, operator, field] = match;
    const value = readQueryValue(rawValue);
    if (operator === 'in') filters.in[field] = value.split(',').filter(Boolean).map(decodeURIComponent);
    else if (operator === 'contains') filters.contains[field] = parseJsonValue(decodeURIComponent(value));
    else filters[operator as 'eq' | 'neq' | 'gte' | 'lte'][field] = decodeURIComponent(value);
  }
  return filters;
}

function normalizeDatabaseValue(field: string, value: unknown) {
  if (typeof value !== 'string') return value;
  if (['is_system', 'is_active', 'is_reconciled', 'is_recurring'].includes(field)) return value === 'true' || value === '1';
  if (['companies', 'stores', 'tags', 'audit_log', 'recurrence_config'].includes(field)) return parseJsonValue(value);
  return value;
}

function matchesFilters(row: Record<string, unknown>, filters: QueryFilters) {
  const get = (field: string) => normalizeDatabaseValue(field, row[field]);
  for (const [field, value] of Object.entries(filters.eq)) {
    const expected = normalizeDatabaseValue(field, value);
    if (String(get(field) ?? '') !== String(expected ?? '')) return false;
  }
  for (const [field, value] of Object.entries(filters.neq)) {
    if (String(get(field) ?? '') === String(normalizeDatabaseValue(field, value) ?? '')) return false;
  }
  for (const [field, values] of Object.entries(filters.in)) {
    if (!values.some((value) => String(get(field) ?? '') === String(normalizeDatabaseValue(field, value) ?? ''))) return false;
  }
  for (const [field, value] of Object.entries(filters.gte)) {
    if (String(get(field) ?? '') < String(value)) return false;
  }
  for (const [field, value] of Object.entries(filters.lte)) {
    if (String(get(field) ?? '') > String(value)) return false;
  }
  for (const [field, expected] of Object.entries(filters.contains)) {
    const actual = get(field);
    const expectedValues = Array.isArray(expected) ? expected : [expected];
    const actualValues = Array.isArray(actual) ? actual : [actual];
    if (!expectedValues.every((item) => actualValues.some((candidate) => String(candidate) === String(item)))) return false;
  }
  return true;
}

function cashBalanceFromMovements(movements: Array<{ type?: unknown; amount?: unknown }>) {
  return movements.reduce((sum, movement) => {
    const type = String(movement.type || '');
    const amount = Number(movement.amount || 0);
    if (['opening', 'sale', 'reinforcement', 'transfer_in'].includes(type)) return sum + amount;
    if (['withdrawal', 'transfer_out'].includes(type)) return sum - amount;
    return sum;
  }, 0);
}

function parseOrder(query: Request['query']) {
  const raw = readQueryValue(query.order);
  if (!raw) return undefined;
  const [field, direction = 'asc'] = raw.split('.');
  return { field, direction: direction.toLowerCase() === 'desc' ? 'desc' : 'asc' as 'asc' | 'desc' };
}

function parseSelect(select: string) {
  const fields: string[] = [];
  let current = '';
  let depth = 0;
  for (const character of select || '*') {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      if (current.trim()) fields.push(current.trim());
      current = '';
    } else current += character;
  }
  if (current.trim()) fields.push(current.trim());
  return fields;
}

function safeTable(table: string) {
  if (!allowedTables.has(table)) throw new Error(`Tabela não permitida: ${table}`);
  return quoteIdentifier(table);
}

function parseAuditLog(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null; } catch { return null; }
}

function actorName(userId: unknown) {
  if (!userId) return 'Sistema';
  const profile = profileById(String(userId));
  return String(profile?.name || profile?.email || `Usuário não identificado (${String(userId).slice(0, 8)})`);
}

function addProductAudit(product: Record<string, unknown>, action: string, changes: Record<string, { oldValue: unknown; newValue: unknown }> = {}, request?: AuthenticatedRequest, timestamp = now()) {
  if (!product?.id || !product?.company_id) return;
  const userId = request?.userId || null;
  const userName = actorName(userId);
  Object.entries(changes).forEach(([fieldName, change]) => {
    if (String(change.oldValue ?? '') === String(change.newValue ?? '')) return;
    execute('INSERT INTO product_audits (id, company_id, product_id, action, field_name, old_value, new_value, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), product.company_id, product.id, action, fieldName, change.oldValue == null ? null : String(change.oldValue), change.newValue == null ? null : String(change.newValue), userId, userName, timestamp]);
  });
  if (Object.keys(changes).length === 0) execute('INSERT INTO product_audits (id, company_id, product_id, action, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId(), product.company_id, product.id, action, userId, userName, timestamp]);
}
function cleanRow(row: Record<string, unknown>) {
  const output = deserializeRow(row);
  delete output.password_hash;
  delete output.session_version;
  return output;
}

function relationRows(table: string, row: Record<string, unknown>, select: string) {
  const selected = parseSelect(select);
  const wants = (name: string) => selected.some((field) => field.startsWith(name + '(') || field === '*');
  const output = { ...row } as Record<string, unknown>;

  if (table === 'appointments' && wants('customers')) {
    const customer = row.customer_id ? selectRows('SELECT name, phone FROM customers WHERE id = ?', [row.customer_id])[0] : undefined;
    output.customers = customer ? cleanRow(customer) : null;
  }
  if (table === 'appointments' && wants('stores')) {
    const store = row.store_id ? selectRows('SELECT name FROM stores WHERE id = ?', [row.store_id])[0] : undefined;
    output.stores = store ? cleanRow(store) : null;
  }
  if (table === 'sales' && wants('customers')) {
    const customer = row.customer_id ? selectRows('SELECT name FROM customers WHERE id = ?', [row.customer_id])[0] : undefined;
    output.customers = customer ? cleanRow(customer) : null;
  }
  if (table === 'sales' && wants('stores')) {
    const store = row.store_id ? selectRows('SELECT name FROM stores WHERE id = ?', [row.store_id])[0] : undefined;
    output.stores = store ? cleanRow(store) : null;
  }
  if (table === 'sales' && wants('employees')) {
    const employee = row.seller_id ? selectRows('SELECT name FROM employees WHERE id = ?', [row.seller_id])[0] : undefined;
    output.employees = employee ? cleanRow(employee) : null;
  }
  if (table === 'sales' && wants('sale_items')) {
    output.sale_items = selectRows('SELECT * FROM sale_items WHERE sale_id = ?', [row.id]).map(cleanRow);
  }
  if (table === 'service_orders' && wants('service_order_timeline')) {
    output.service_order_timeline = selectRows('SELECT * FROM service_order_timeline WHERE service_order_id = ? ORDER BY date ASC', [row.id]).map(cleanRow);
  }
  if (table === 'service_orders' && wants('customers')) {
    const customer = row.customer_id ? selectRows('SELECT name, phone FROM customers WHERE id = ?', [row.customer_id])[0] : undefined;
    output.customers = customer ? cleanRow(customer) : null;
  }
  if (table === 'service_orders' && wants('employees')) {
    const employee = row.technician_id ? selectRows('SELECT name FROM employees WHERE id = ?', [row.technician_id])[0] : undefined;
    output.employees = employee ? cleanRow(employee) : null;
  }
  if (table === 'products' && wants('product_stock')) {
    output.product_stock = selectRows('SELECT * FROM product_stock WHERE product_id = ?', [row.id]).map(cleanRow);
  }
  if (table === 'products' && wants('product_images')) {
    output.product_images = selectRows('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC, created_at ASC', [row.id]).map(cleanRow);
  }
  if (table === 'roles' && wants('role_permissions')) {
    output.role_permissions = selectRows('SELECT permission_id FROM role_permissions WHERE role_id = ?', [row.id]).map(cleanRow);
  }
  if (table === 'financial_entries') {
    output.created_by_name = row.created_by_name || actorName(row.created_by);
    output.updated_by_name = row.updated_by_name || actorName(row.updated_by);
    output.settled_by_name = row.settled_by_name || actorName(row.settled_by);
    const audit = parseAuditLog(row.audit_log);
    const changes = Array.isArray(audit?.changes) ? audit.changes : [];
    const lastChange = changes.length ? changes[changes.length - 1] as Record<string, unknown> : undefined;
    output.last_action_by_name = lastChange?.changed_by_name || (lastChange?.changed_by ? actorName(lastChange.changed_by) : output.created_by_name);
  }
  if (table === 'cash_registers') {
    output.opened_by_name = row.opened_by_name || actorName(row.user_id);
    output.closed_by_name = row.closed_by_name || actorName(row.closed_by);
  }
  if (table === 'cash_register_movements') output.created_by_name = row.created_by_name || actorName(row.created_by);
  if (table === 'financial_transfers') output.created_by_name = row.created_by_name || actorName(row.created_by);
  if (table === 'fixed_costs') {
    output.created_by_name = row.created_by_name || actorName(row.created_by);
    output.updated_by_name = row.updated_by_name || actorName(row.updated_by);
  }
  if (table === 'fixed_cost_payments') output.created_by_name = row.created_by_name || actorName(row.created_by);
  if (table === 'financial_approvals') {
    output.requested_by_name = row.requested_by_name || actorName(row.requested_by);
    output.approved_by_name = row.approved_by_name || actorName(row.approved_by);
  }
  if (table === 'financial_card_settlements') {
    output.created_by_name = row.created_by_name || actorName(row.created_by);
    output.settled_by_name = row.settled_by_name || actorName(row.settled_by);
  }
  if (table === 'bank_reconciliations') output.reconciled_by_name = row.reconciled_by_name || actorName(row.reconciled_by);
  if (table === 'bank_transactions') output.reconciled_by_name = row.reconciled_by_name || actorName(row.reconciled_by);
  return cleanRow(output);
}

function sanitizeProductRow(row: Record<string, unknown>, profile?: Record<string, unknown>) {
  const sanitized = { ...row };
  if (!hasModulePermission(profile, 'products', 'view_cost')) delete sanitized.cost;
  if (!hasModulePermission(profile, 'products', 'view_stock')) delete sanitized.product_stock;
  return sanitized;
}

function canViewFinancialEntry(profile: Record<string, unknown> | undefined, row: Record<string, unknown>) {
  if (isMaster(profile)) return true;
  const type = String(row.type || '');
  if (type === 'receivable' || type === 'in') return hasAnyModulePermission(profile, 'financial', ['view_statement', 'view_receivable']);
  if (type === 'payable' || type === 'out') return hasAnyModulePermission(profile, 'financial', ['view_statement', 'view_payable']);
  return hasAnyModulePermission(profile, 'financial', ['view_statement', 'view_operations']);
}

function getRows(table: string, query: Request['query'], profile?: Record<string, unknown>) {
  const tableName = safeTable(table);
  const columns = tableColumns(table);
  const filters = parseFilters(query);
  const rawRows = selectRows(`SELECT * FROM ${tableName}`);
  let rows = rawRows.filter((row) => {
    const normalized = deserializeRow(row);
    if (table === 'financial_entries' && !canViewFinancialEntry(profile, normalized)) return false;
    return matchesFilters(normalized, filters);
  });
  const order = parseOrder(query);
  if (order && columns.has(order.field)) {
    rows = rows.sort((a, b) => {
      const left = a[order.field];
      const right = b[order.field];
      const result = String(left ?? '').localeCompare(String(right ?? ''), 'pt-BR', { numeric: true });
      return order.direction === 'desc' ? -result : result;
    });
  }
  const select = readQueryValue(query.select) || '*';
  return rows.map((row) => relationRows(table, row, select));
}

function getUserFromToken(request: Request) {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : readCookie(request, 'otica_session');
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, authSecret) as { sub?: string; sv?: number };
    if (!payload.sub) return undefined;
    const profile = profileById(String(payload.sub));
    if (!profile || Number(profile.session_version || 1) !== Number(payload.sv || 0)) return undefined;
    return payload.sub;
  } catch {
    return undefined;
  }
}

function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const userId = getUserFromToken(request);
  if (!userId) return response.status(401).json({ data: null, error: { message: 'Sessão expirada. Faça login novamente.', code: '401' } });
  const profile = profileById(userId);
  if (!profile || profile.status !== 'active') {
    return response.status(401).json({ data: null, error: { message: 'Usuário inativo ou inexistente.', code: '401' } });
  }
  request.userId = userId;
  request.profile = profile;
  return next();
}

function issueSession(profile: Record<string, unknown>) {
  const user = cleanRow(profile);
  const token = issueToken(profile);
  return { access_token: isProduction ? '' : token, token_type: 'bearer', user, session_cookie: isProduction, session_id: `${String(profile.id)}:${Date.now()}` };
}

function issueToken(profile: Record<string, unknown>) {
  return jwt.sign({ sub: String(profile.id), sv: Number(profile.session_version || 1) }, authSecret, { expiresIn: sessionTtlSeconds });
}

function revokeSessions(profileId: string) {
  execute('UPDATE profiles SET session_version = COALESCE(session_version, 1) + 1 WHERE id = ?', [profileId]);
}

function profileById(id: string) {
  return selectRows('SELECT * FROM profiles WHERE id = ?', [id])[0];
}

function profileForAuth(profile: Record<string, unknown>) {
  const result = cleanRow(profile);
  delete result.last_access;
  return result;
}

function isMaster(profile?: Record<string, unknown>) {
  const role = String(profile?.role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  const roleId = String(profile?.role_id || '').trim().toLowerCase();
  return role === 'admin_master' || roleId === 'r-admin-master' || roleId === 'admin_master';
}

function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function profileCompanies(profile?: Record<string, unknown>) {
  return jsonArray(profile?.companies);
}

function profileStores(profile?: Record<string, unknown>) {
  return jsonArray(profile?.stores);
}

function relatedScope(table: string, row: Record<string, unknown>) {
  if (row.company_id || row.store_id) return { companyId: row.company_id as string | undefined, storeId: row.store_id as string | undefined };
  if (table === 'product_stock' || table === 'product_movements') {
    const product = selectRows('SELECT company_id FROM products WHERE id = ? LIMIT 1', [row.product_id])[0];
    return { companyId: product?.company_id as string | undefined, storeId: row.store_id as string | undefined };
  }
  if (table === 'product_images' || table === 'product_audits') {
    const product = selectRows('SELECT company_id FROM products WHERE id = ? LIMIT 1', [row.product_id])[0];
    return { companyId: row.company_id || product?.company_id as string | undefined, storeId: undefined };
  }
  if (table === 'sale_items') {
    const sale = selectRows('SELECT company_id, store_id FROM sales WHERE id = ? LIMIT 1', [row.sale_id])[0];
    return { companyId: sale?.company_id as string | undefined, storeId: sale?.store_id as string | undefined };
  }
  if (table === 'service_order_timeline') {
    const order = selectRows('SELECT company_id, store_id FROM service_orders WHERE id = ? LIMIT 1', [row.service_order_id])[0];
    return { companyId: order?.company_id as string | undefined, storeId: order?.store_id as string | undefined };
  }
  if (table === 'cash_register_movements') {
    const register = selectRows('SELECT company_id, store_id FROM cash_registers WHERE id = ? LIMIT 1', [row.cash_register_id])[0];
    return { companyId: register?.company_id as string | undefined, storeId: register?.store_id as string | undefined };
  }
  if (table === 'bank_transactions' || table === 'bank_reconciliations') {
    const account = selectRows('SELECT company_id FROM bank_accounts WHERE id = ? LIMIT 1', [row.bank_account_id])[0];
    return { companyId: account?.company_id as string | undefined, storeId: undefined };
  }
  return { companyId: undefined, storeId: undefined };
}

function rowInScope(table: string, row: Record<string, unknown>, profile?: Record<string, unknown>) {
  if (isMaster(profile)) return true;
  if (!profile) return false;

  if (table === 'companies') return profileCompanies(profile).includes(String(row.id));
  if (table === 'profiles') {
    if (String(row.id) === String(profile.id)) return true;
    const ownCompanies = profileCompanies(profile);
    const ownStores = profileStores(profile);
    const targetCompanies = jsonArray(row.companies);
    const targetStores = jsonArray(row.stores);
    return targetCompanies.some((companyId) => ownCompanies.includes(companyId))
      || targetStores.some((storeId) => ownStores.includes(storeId));
  }
  if (['roles', 'permissions', 'role_permissions', 'user_permissions'].includes(table)) return false;

  const scope = relatedScope(table, row);
  const companies = profileCompanies(profile);
  const stores = profileStores(profile);
  if (!scope.companyId || !companies.includes(String(scope.companyId))) return false;
  if (!scope.storeId) return true;
  return stores.length === 0 || stores.includes(String(scope.storeId));
}

const tableModules: Record<string, string> = {
  companies: 'companies', stores: 'stores', profiles: 'users', user_permissions: 'users',
  roles: 'users', permissions: 'users', role_permissions: 'users', employees: 'users',
  laboratories: 'users', professionals: 'users', customers: 'customers', appointments: 'appointments',
  sales: 'sales', sale_items: 'sales', products: 'products', product_stock: 'products', product_movements: 'products',
  product_categories: 'products', product_brands: 'products', product_images: 'products', product_audits: 'products',
  service_orders: 'service_orders', service_order_timeline: 'service_orders', cash_registers: 'financial',
  cash_register_movements: 'financial', financial_entries: 'financial', fixed_costs: 'financial', fixed_cost_payments: 'financial', bank_accounts: 'financial',
  bank_reconciliations: 'financial', bank_transactions: 'financial', financial_entry_audits: 'financial', financial_categories: 'financial', financial_budgets: 'financial', financial_installment_groups: 'financial', financial_approvals: 'financial', financial_transfers: 'financial', financial_card_settlements: 'financial', financial_daily_closings: 'financial',
  prescriptions: 'customers',
};

function operationPermission(operation: 'select' | 'insert' | 'update' | 'delete') {
  return operation === 'select' ? 'view' : operation === 'insert' ? 'create' : operation === 'update' ? 'edit' : 'delete';
}

function hasModulePermission(profile: Record<string, unknown> | undefined, module: string, action: string) {
  if (isMaster(profile)) return true;
  if (!profile) return false;
  const custom = selectRows(
    'SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = ? AND p.module = ? AND p.action = ? LIMIT 1',
    [profile.id, module, action],
  );
  if (custom.length > 0) return true;
  const roleId = String(profile.role_id || selectRows('SELECT id FROM roles WHERE name = ? LIMIT 1', [profile.role])[0]?.id || '');
  if (roleId) {
    const rolePermission = selectRows(
      'SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ? AND p.module = ? AND p.action = ? LIMIT 1',
      [roleId, module, action],
    );
    if (rolePermission.length > 0) return true;
  }
  return false;
}

function hasAnyModulePermission(profile: Record<string, unknown> | undefined, module: string, actions: string[]) {
  return actions.some(action => hasModulePermission(profile, module, action));
}

function hasPermission(profile: Record<string, unknown> | undefined, table: string, operation: 'select' | 'insert' | 'update' | 'delete') {
  if (isMaster(profile)) return true;
  const module = tableModules[table];
  return Boolean(module && hasModulePermission(profile, module, operationPermission(operation)));
}

function canAccessTable(request: AuthenticatedRequest, table: string, operation: 'select' | 'insert' | 'update' | 'delete') {
  if (table === 'financial_entry_audits') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_audit') : false;
  if (table === 'financial_daily_closings') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_cash_history') : hasModulePermission(request.profile, 'financial', 'close_cash');
  if (table === 'financial_budgets') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_operations') : hasModulePermission(request.profile, 'financial', 'manage_budgets');
  if (table === 'financial_approvals') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_operations') : hasModulePermission(request.profile, 'financial', 'approve');
  if (table === 'financial_transfers') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_operations') : hasModulePermission(request.profile, 'financial', 'manage_transfers');
  if (table === 'financial_card_settlements') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_reconciliation') : hasModulePermission(request.profile, 'financial', 'manage_card_settlements');
  if (table === 'financial_entries') return operation === 'select' ? hasAnyModulePermission(request.profile, 'financial', ['view_statement', 'view_receivable', 'view_payable', 'view_operations']) : hasModulePermission(request.profile, 'financial', operation === 'insert' ? 'create_entry' : operation === 'update' ? 'edit_entry' : 'delete_entry');
  if (table === 'financial_installment_groups') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_receivable') : hasModulePermission(request.profile, 'financial', 'manage_installments');
  if (table === 'bank_accounts' || table === 'bank_reconciliations' || table === 'bank_transactions') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_reconciliation') : hasModulePermission(request.profile, 'financial', 'manage_bank_accounts');
  if (table === 'financial_categories') return operation === 'select' ? hasAnyModulePermission(request.profile, 'financial', ['view_statement', 'view_receivable', 'view_payable', 'view_fixed_costs', 'view_cashier', 'view_performance', 'view_reconciliation', 'view_operations']) : hasModulePermission(request.profile, 'financial', 'manage_categories');
  if (table === 'cash_registers') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_cashier') : hasModulePermission(request.profile, 'financial', operation === 'insert' ? 'open_cash' : 'close_cash');
  if (table === 'cash_register_movements') return operation === 'select' ? hasModulePermission(request.profile, 'financial', 'view_cash_history') : hasModulePermission(request.profile, 'financial', 'cash_movement');
  if (table === 'product_stock') return operation === 'select'
    ? hasModulePermission(request.profile, 'products', 'view_stock')
    : hasModulePermission(request.profile, 'products', 'manage_stock');
  if (table === 'product_movements') return operation === 'select'
    ? hasModulePermission(request.profile, 'products', 'view_stock_history')
    : hasModulePermission(request.profile, 'products', 'manage_stock');
  if (table === 'product_categories' || table === 'product_brands') return operation === 'select'
    ? hasModulePermission(request.profile, 'products', 'view')
    : hasModulePermission(request.profile, 'products', 'manage_categories');
  if (table === 'product_images') return operation === 'select'
    ? hasModulePermission(request.profile, 'products', 'view')
    : hasModulePermission(request.profile, 'products', 'manage_photos');
  if (table === 'product_audits') return operation === 'select'
    ? hasModulePermission(request.profile, 'products', 'view_audit')
    : false;
  if (table === 'fixed_costs' || table === 'fixed_cost_payments') return operation === 'select'
    ? hasModulePermission(request.profile, 'financial', 'view_fixed_costs')
    : hasModulePermission(request.profile, 'financial', 'manage_fixed_costs');
  return hasPermission(request.profile, table, operation);
}

function scopeInput(table: string, row: Record<string, unknown>, profile?: Record<string, unknown>) {
  if (isMaster(profile)) return true;
  if (!profile || !rowInScope(table, row, profile)) return false;
  return true;
}

function errorPayload(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const isUnique = /unique|constraint failed/i.test(message);
  return { message: isUnique ? 'Registro duplicado.' : message, code: isUnique ? '23505' : 'LOCAL_DB_ERROR' };
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, database: 'sqlite', timestamp: now() });
});


if (process.env.NODE_ENV !== 'production') {
  app.get('/', (_request, response) => {
    response.type('text').send('API local ativa. Abra http://localhost:8080/ para acessar o sistema.');
  });
}

app.post('/api/auth/signup', authRateLimit('signup', 5, 15 * 60 * 1000), async (request, response) => {
  try {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const password = String(request.body?.password || '');
    const name = String(request.body?.name || email.split('@')[0] || 'Novo Usuário').trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return response.status(400).json({ data: null, error: { message: 'Informe um e-mail válido.', code: '400' } });
    try { assertPasswordPolicy(password); } catch (error) { return response.status(400).json({ data: null, error: errorPayload(error) }); }

    const firstUser = selectRows('SELECT id FROM profiles LIMIT 1').length === 0;
    if (isProduction && firstUser && !allowInitialSignup) {
      return response.status(403).json({ data: null, error: { message: 'O cadastro inicial está desativado. Configure o administrador pelo ambiente do servidor.', code: 'INITIAL_SIGNUP_DISABLED' } });
    }
    if (!firstUser) {
      const requesterId = getUserFromToken(request);
      const requester = requesterId ? profileById(requesterId) : undefined;
      if (!requester || !isMaster(requester)) {
        return response.status(403).json({ data: null, error: { message: 'Somente o administrador master pode criar usuários.', code: '403' } });
      }
    }
    const role = firstUser ? 'admin_master' : 'user';
    const roleRow = selectRows('SELECT id FROM roles WHERE name = ?', [role])[0];
    const id = newId();
    execute(
      'INSERT INTO profiles (id, name, email, role, role_id, companies, stores, status, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, role, roleRow?.id || null, '[]', '[]', 'active', await bcrypt.hash(password, 10), now()],
    );
    persistDatabase();
    const profile = profileById(id) || {};
    if (isProduction) setSessionCookie(response, issueToken(profile));
    const session = issueSession(profile);
    return response.status(201).json({ data: session, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/auth/login', authRateLimit('login', 10, 15 * 60 * 1000), async (request, response) => {
  const email = String(request.body?.email || '').trim().toLowerCase();
  const password = String(request.body?.password || '');
  const profile = selectRows('SELECT * FROM profiles WHERE lower(email) = ? AND status = \'active\' LIMIT 1', [email])[0];
  if (!profile || !(await bcrypt.compare(password, String(profile.password_hash || '')))) {
    return response.status(401).json({ data: null, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
  }
  execute('UPDATE profiles SET last_access = ? WHERE id = ?', [now(), profile.id]);
  persistDatabase();
  const authenticatedProfile = { ...profile, session_version: profile.session_version || 1 };
  if (isProduction) setSessionCookie(response, issueToken(authenticatedProfile));
  return response.json({ data: issueSession(authenticatedProfile), error: null });
});

app.post('/api/auth/logout', requireAuth, (request: AuthenticatedRequest, response) => {
  revokeSessions(String(request.userId));
  persistDatabase();
  clearSessionCookie(response);
  return response.json({ data: null, error: null });
});
app.post('/api/auth/reset-password', authRateLimit('reset-request', 5, 15 * 60 * 1000), (request, response) => {
  if (!allowLocalResetToken) return response.status(503).json({ data: null, error: { message: 'A recuperação de senha ainda não está configurada para produção.', code: 'RESET_NOT_CONFIGURED' } });
  const email = String(request.body?.email || '').trim().toLowerCase();
  const profile = selectRows('SELECT id FROM profiles WHERE lower(email) = ? AND status = ? LIMIT 1', [email, 'active'])[0];
  // O sistema permanece discreto quando o e-mail não existe. Em operação local, o token é devolvido para a própria tela em vez de depender de SMTP.
  if (!profile) return response.json({ data: null, error: null });
  const token = newId();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  execute('DELETE FROM password_reset_tokens WHERE profile_id = ? AND used_at IS NULL', [profile.id]);
  execute('INSERT INTO password_reset_tokens (id, profile_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', [newId(), profile.id, hashResetToken(token), expiresAt, now()]);
  persistDatabase();
  return response.json({ data: { token, expires_at: expiresAt }, error: null });
});
app.post('/api/auth/reset-password/confirm', authRateLimit('reset-confirm', 5, 15 * 60 * 1000), async (request, response) => {
  try {
    const token = String(request.body?.token || '').trim();
    const password = String(request.body?.password || '');
    try { assertPasswordPolicy(password); } catch (error) { return response.status(400).json({ data: null, error: errorPayload(error) }); }
    if (!token) return response.status(400).json({ data: null, error: { message: 'Token obrigatório.' } });
    const reset = selectRows('SELECT id, profile_id, expires_at FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL LIMIT 1', [hashResetToken(token)])[0];
    if (!reset || new Date(String(reset.expires_at)).getTime() <= Date.now()) return response.status(400).json({ data: null, error: { message: 'Token inválido ou expirado.' } });
    execute('UPDATE profiles SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), reset.profile_id]);
    revokeSessions(String(reset.profile_id));
    execute('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?', [now(), reset.id]);
    persistDatabase();
    return response.json({ data: null, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});
app.patch('/api/auth/users/:id/password', requireAuth, async (request: AuthenticatedRequest, response) => {
  try {
    const targetId = String(request.params.id);
    if (!isMaster(request.profile) && targetId !== String(request.userId)) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para alterar esta senha.', code: '403' } });
    }
    const password = String(request.body?.password || '');
    try { assertPasswordPolicy(password); } catch (error) { return response.status(400).json({ data: null, error: errorPayload(error) }); }
    const targetProfile = profileById(targetId);
    if (!targetProfile) return response.status(404).json({ data: null, error: { message: 'Usuário não encontrado.', code: '404' } });
    execute('UPDATE profiles SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), targetId]);
    revokeSessions(targetId);
    persistDatabase();
    const updatedProfile = profileForAuth(profileById(targetId) || {});
    if (String(request.userId) === targetId) setSessionCookie(response, issueToken({ ...updatedProfile, session_version: Number(profileById(targetId)?.session_version || 1) }));
    return response.json({ data: updatedProfile, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/admin/backup', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!isMaster(request.profile)) return response.status(403).json({ data: null, error: { message: 'Somente o administrador master pode gerar backup.', code: '403' } });
  try {
    const backupPath = createDatabaseBackup(String(request.body?.label || 'manual'));
    return response.json({ data: { name: path.basename(backupPath), created_at: now() }, error: null });
  } catch (error) {
    return response.status(500).json({ data: null, error: errorPayload(error) });
  }
});

function requireBackupMaster(request: AuthenticatedRequest, response: Response) {
  if (!isMaster(request.profile)) {
    response.status(403).json({ data: null, error: { message: 'Somente o administrador master pode gerenciar backups.', code: '403' } });
    return false;
  }
  return true;
}

function backupRedirectUri(request: Request) {
  return process.env.GOOGLE_DRIVE_REDIRECT_URI || `${request.protocol}://${request.get('host')}/api/admin/backups/drive/callback`;
}

app.get('/api/admin/backups/settings', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  return response.json({ data: { settings: getBackupSettings(), drive: getGoogleDriveConfigStatus(backupRedirectUri(request)) }, error: null });
});

app.put('/api/admin/backups/settings', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  try {
    return response.json({ data: saveBackupSettings(request.body || {}), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.get('/api/admin/backups/history', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  const result = listBackupJobs({ status: String(request.query.status || 'all'), limit: Number(request.query.limit || 50), offset: Number(request.query.offset || 0) });
  response.setHeader('X-Total-Count', String(result.total));
  return response.json({ data: result.rows, error: null });
});

app.get('/api/admin/backups/events', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  return response.json({ data: listBackupEvents(request.query.job_id ? String(request.query.job_id) : undefined, Number(request.query.limit || 200)), error: null });
});

app.post('/api/admin/backups/run', requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  try {
    const job = await createBackup({ type: 'manual', label: String(request.body?.label || 'manual'), createdBy: request.userId, redirectUri: backupRedirectUri(request), forceDrive: Boolean(request.body?.send_to_drive) });
    return response.status(201).json({ data: job, error: null });
  } catch (error) {
    return response.status(500).json({ data: null, error: errorPayload(error) });
  }
});

app.get('/api/admin/backups/:id/download', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  const archivePath = getBackupArchivePath(String(request.params.id));
  if (!archivePath) return response.status(404).json({ data: null, error: { message: 'Arquivo de backup não está disponível localmente.' } });
  return response.download(archivePath, path.basename(archivePath));
});

app.post('/api/admin/backups/import', requireAuth, backupUpload.single('file'), async (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  try {
    const importedPath = request.file?.path;
    if (!importedPath) return response.status(400).json({ data: null, error: { message: 'Selecione um arquivo .tar.gz de backup.' } });
    const job = await importBackupArchive(importedPath, request.userId);
    return response.status(201).json({ data: job, error: null });
  } catch (error) {
    if (request.file?.path) fs.rmSync(request.file.path, { force: true });
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/admin/backups/inspect', requireAuth, backupUpload.single('file'), async (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  try {
    const archivePath = request.file?.path;
    if (!archivePath) return response.status(400).json({ data: null, error: { message: 'Selecione um arquivo de backup.' } });
    const inspected = await inspectArchive(archivePath);
    return response.json({ data: inspected, error: null });
  } catch (error) {
    if (request.file?.path) fs.rmSync(request.file.path, { force: true });
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/admin/backups/:id/restore', requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  try {
    const result = await restoreBackup(String(request.params.id), String(request.body?.confirmation || ''));
    return response.json({ data: result, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.get('/api/admin/backups/drive/connect', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  try {
    return response.json({ data: { url: createGoogleOAuthUrl(backupRedirectUri(request)), redirect_uri: backupRedirectUri(request) }, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.get('/api/admin/backups/drive/callback', async (request: Request, response: Response) => {
  try {
    if (request.query.error) throw new Error(`Autorização Google recusada: ${String(request.query.error)}`);
    await connectGoogleDrive(String(request.query.code || ''), String(request.query.state || ''), backupRedirectUri(request));
    return response.type('html').send('<!doctype html><html><body><script>window.opener?.postMessage({type:"google-drive-connected"},"*");window.close();</script><p>Google Drive conectado. Você pode fechar esta janela.</p></body></html>');
  } catch (error) {
    return response.status(400).type('html').send(`<h1>Falha ao conectar Google Drive</h1><p>${String(error instanceof Error ? error.message : error).replaceAll('<', '&lt;')}</p>`);
  }
});

app.post('/api/admin/backups/drive/test', requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  try {
    return response.json({ data: await testGoogleDrive(backupRedirectUri(request)), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.get('/api/admin/backups/drive/list', requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  try {
    return response.json({ data: await listGoogleDriveBackups(backupRedirectUri(request)), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/admin/backups/drive/disconnect', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  return response.json({ data: disconnectGoogleDrive(), error: null });
});

app.post('/api/admin/backups/drive/import/:fileId', requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  if (!requireBackupMaster(request, response)) return;
  try {
    const archivePath = await downloadGoogleDriveBackup(String(request.params.fileId), backupRedirectUri(request));
    const job = await importBackupArchive(archivePath, request.userId);
    return response.status(201).json({ data: job, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});


app.get('/api/auth/permissions', requireAuth, (request: AuthenticatedRequest, response) => {
  const profile = request.profile || {};
  let permissionRows: Record<string, unknown>[] = [];
  if (isMaster(profile)) {
    permissionRows = selectRows('SELECT module, action FROM permissions');
  } else {
    const roleId = String(profile.role_id || selectRows('SELECT id FROM roles WHERE name = ? LIMIT 1', [profile.role])[0]?.id || '');
    const permissionIds = new Set<string>();
    if (roleId) {
      for (const row of selectRows('SELECT permission_id FROM role_permissions WHERE role_id = ?', [roleId])) permissionIds.add(String(row.permission_id));
    }
    for (const row of selectRows('SELECT permission_id FROM user_permissions WHERE user_id = ?', [profile.id])) permissionIds.add(String(row.permission_id));
    if (permissionIds.size > 0) {
      const placeholders = Array.from(permissionIds, () => '?').join(', ');
      permissionRows = selectRows(`SELECT module, action FROM permissions WHERE id IN (${placeholders})`, Array.from(permissionIds));
    }
  }
  return response.json({ data: permissionRows.map((row) => ({ module: row.module, action: row.action })), error: null });
});

function canManageUsers(request: AuthenticatedRequest, operation: 'create' | 'edit' | 'delete') {
  return isMaster(request.profile) || hasPermission(request.profile, 'users', operation);
}

function canViewRoles(request: AuthenticatedRequest) {
  return isMaster(request.profile) || hasModulePermission(request.profile, 'users', 'view');
}

function canManageRoles(request: AuthenticatedRequest) {
  return isMaster(request.profile) || hasModulePermission(request.profile, 'users', 'manage_roles');
}

function normalizeRoleName(value: unknown) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  if (!normalized) throw Object.assign(new Error('Informe um nome válido para o perfil.'), { statusCode: 400 });
  return normalized;
}

function permissionIdsForRole(roleId: string) {
  return selectRows('SELECT permission_id FROM role_permissions WHERE role_id = ? ORDER BY permission_id', [roleId])
    .map((row) => String(row.permission_id));
}

function accessControlPayload() {
  const permissionRows = selectRows('SELECT * FROM permissions ORDER BY module COLLATE NOCASE, action COLLATE NOCASE, name COLLATE NOCASE');
  const roles = selectRows(
    `SELECT r.*, COUNT(DISTINCT p.id) AS assigned_user_count
       FROM roles r
       LEFT JOIN profiles p ON p.role_id = r.id OR (p.role_id IS NULL AND p.role = r.name)
      GROUP BY r.id
      ORDER BY r.is_system DESC, r.name COLLATE NOCASE`,
  );
  return {
    permissions: permissionRows.map(cleanRow),
    roles: roles.map((role) => ({
      ...cleanRow(role),
      assigned_user_count: Number(role.assigned_user_count || 0),
      role_permissions: permissionIdsForRole(String(role.id)).map((permission_id) => ({ permission_id })),
    })),
  };
}

function normalizeUserScope(value: unknown) {
  return Array.isArray(value) ? Array.from(new Set(value.map(String).filter(Boolean))) : [];
}

function validateUserScope(request: AuthenticatedRequest, companies: string[], stores: string[]) {
  if (isMaster(request.profile)) return;
  const ownCompanies = profileCompanies(request.profile);
  const ownStores = profileStores(request.profile);
  if (companies.some((companyId) => !ownCompanies.includes(companyId)) || stores.some((storeId) => ownStores.length > 0 && !ownStores.includes(storeId))) {
    throw Object.assign(new Error('O escopo informado está fora do seu acesso.'), { statusCode: 403 });
  }
  const invalidStore = stores.some((storeId) => {
    const store = selectRows('SELECT company_id FROM stores WHERE id = ? LIMIT 1', [storeId])[0];
    return !store || !companies.includes(String(store.company_id));
  });
  if (invalidStore) throw Object.assign(new Error('Toda loja deve pertencer a uma empresa selecionada.'), { statusCode: 400 });
}

function normalizeUserRole(roleIdValue: unknown, roleValue: unknown) {
  const roleId = String(roleIdValue || '').trim();
  const roleName = String(roleValue || '').trim();
  const role = roleId
    ? selectRows('SELECT id, name FROM roles WHERE id = ? LIMIT 1', [roleId])[0]
    : selectRows('SELECT id, name FROM roles WHERE name = ? LIMIT 1', [roleName || 'user'])[0];
  if (!role) throw Object.assign(new Error('Papel de usuário inválido.'), { statusCode: 400 });
  return { id: String(role.id), name: String(role.name) };
}

function validateRoleAssignment(request: AuthenticatedRequest, roleId: string) {
  if (isMaster(request.profile)) return;
  const permissions = selectRows(
    'SELECT p.module, p.action FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?',
    [roleId],
  );
  if (permissions.some((permission) => !hasModulePermission(request.profile, String(permission.module), String(permission.action)))) {
    throw Object.assign(new Error('Não é permitido atribuir um perfil com permissões superiores às suas.'), { statusCode: 403 });
  }
}

function normalizePermissionIds(request: AuthenticatedRequest, value: unknown) {
  const permissionIds = normalizeUserScope(value);
  if (isMaster(request.profile) || permissionIds.length === 0) return permissionIds;
  const rows = selectRows(`SELECT id, module, action FROM permissions WHERE id IN (${permissionIds.map(() => '?').join(', ')})`, permissionIds);
  if (rows.length !== permissionIds.length || rows.some((row) => !hasModulePermission(request.profile, String(row.module), String(row.action)))) {
    throw Object.assign(new Error('Não é permitido atribuir uma permissão superior à sua.'), { statusCode: 403 });
  }
  return permissionIds;
}

function replaceUserPermissions(userId: string, permissionIds: string[]) {
  execute('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
  for (const permissionId of permissionIds) {
    execute('INSERT OR IGNORE INTO user_permissions (id, user_id, permission_id, created_at) VALUES (?, ?, ?, ?)', [newId(), userId, permissionId, now()]);
  }
}

function normalizeRolePermissionIds(value: unknown) {
  const ids = normalizeUserScope(value);
  if (ids.length === 0) return ids;
  const rows = selectRows(`SELECT id FROM permissions WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
  if (rows.length !== ids.length) throw Object.assign(new Error('Uma ou mais permissões selecionadas não existem.'), { statusCode: 400 });
  return ids;
}

app.get('/api/admin/access-control', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!canViewRoles(request)) return response.status(403).json({ data: null, error: { message: 'Sem permissão para consultar perfis de acesso.', code: '403' } });
  return response.json({ data: accessControlPayload(), error: null });
});

app.post('/api/admin/roles', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  try {
    if (!canManageRoles(request)) return response.status(403).json({ data: null, error: { message: 'Sem permissão para criar perfis de acesso.', code: '403' } });
    const name = normalizeRoleName(request.body?.name);
    const description = String(request.body?.description || '').trim().slice(0, 200);
    const permissionIds = normalizeRolePermissionIds(request.body?.permission_ids);
    if (selectRows('SELECT id FROM roles WHERE name = ? LIMIT 1', [name]).length > 0) {
      return response.status(409).json({ data: null, error: { message: 'Já existe um perfil com este nome.', code: '409' } });
    }
    const roleId = newId();
    getDatabase().run('BEGIN');
    try {
      execute('INSERT INTO roles (id, name, description, is_system, created_at) VALUES (?, ?, ?, ?, ?)', [roleId, name, description || null, 0, now()]);
      for (const permissionId of permissionIds) {
        execute('INSERT INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)', [newId(), roleId, permissionId, now()]);
      }
      getDatabase().run('COMMIT');
      persistDatabase();
    } catch (error) {
      getDatabase().run('ROLLBACK');
      throw error;
    }
    return response.status(201).json({ data: accessControlPayload(), error: null });
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

app.patch('/api/admin/roles/:id', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  try {
    if (!canManageRoles(request)) return response.status(403).json({ data: null, error: { message: 'Sem permissão para editar perfis de acesso.', code: '403' } });
    const roleId = String(request.params.id);
    const current = selectRows('SELECT * FROM roles WHERE id = ? LIMIT 1', [roleId])[0];
    if (!current) return response.status(404).json({ data: null, error: { message: 'Perfil de acesso não encontrado.', code: '404' } });
    const name = current.is_system ? String(current.name) : normalizeRoleName(request.body?.name ?? current.name);
    const description = String(request.body?.description ?? current.description ?? '').trim().slice(0, 200);
    const permissionIds = request.body?.permission_ids === undefined
      ? permissionIdsForRole(roleId)
      : normalizeRolePermissionIds(request.body.permission_ids);
    const duplicate = selectRows('SELECT id FROM roles WHERE name = ? AND id <> ? LIMIT 1', [name, roleId])[0];
    if (duplicate) return response.status(409).json({ data: null, error: { message: 'Já existe um perfil com este nome.', code: '409' } });

    getDatabase().run('BEGIN');
    try {
      execute('UPDATE roles SET name = ?, description = ? WHERE id = ?', [name, description || null, roleId]);
      execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
      for (const permissionId of permissionIds) {
        execute('INSERT INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)', [newId(), roleId, permissionId, now()]);
      }
      getDatabase().run('COMMIT');
      persistDatabase();
    } catch (error) {
      getDatabase().run('ROLLBACK');
      throw error;
    }
    return response.json({ data: accessControlPayload(), error: null });
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

app.delete('/api/admin/roles/:id', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  try {
    if (!canManageRoles(request)) return response.status(403).json({ data: null, error: { message: 'Sem permissão para excluir perfis de acesso.', code: '403' } });
    const roleId = String(request.params.id);
    const current = selectRows('SELECT * FROM roles WHERE id = ? LIMIT 1', [roleId])[0];
    if (!current) return response.status(404).json({ data: null, error: { message: 'Perfil de acesso não encontrado.', code: '404' } });
    if (current.is_system) return response.status(400).json({ data: null, error: { message: 'Perfis de sistema não podem ser excluídos.', code: '400' } });
    const assignedUsers = selectRows('SELECT id FROM profiles WHERE role_id = ? OR (role_id IS NULL AND role = ?) LIMIT 1', [roleId, current.name]);
    if (assignedUsers.length > 0) return response.status(409).json({ data: null, error: { message: 'Não é possível excluir um perfil em uso. Reatribua os usuários antes de excluir.', code: 'ROLE_IN_USE' } });

    getDatabase().run('BEGIN');
    try {
      execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
      execute('DELETE FROM roles WHERE id = ?', [roleId]);
      getDatabase().run('COMMIT');
      persistDatabase();
    } catch (error) {
      getDatabase().run('ROLLBACK');
      throw error;
    }
    return response.json({ data: accessControlPayload(), error: null });
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/admin/users', requireAuth, async (request: AuthenticatedRequest, response) => {
  try {
    if (!canManageUsers(request, 'create')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para criar usuários.', code: '403' } });
    const email = String(request.body?.email || '').trim().toLowerCase();
    const name = String(request.body?.name || '').trim();
    const password = String(request.body?.password || '');
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || !name) return response.status(400).json({ data: null, error: { message: 'Nome e e-mail válido são obrigatórios.' } });
    assertPasswordPolicy(password);
    if (selectRows('SELECT id FROM profiles WHERE lower(email) = ? LIMIT 1', [email]).length > 0) return response.status(409).json({ data: null, error: { message: 'Já existe um usuário com este e-mail.' } });
    if ((request.body?.role_id !== undefined || request.body?.role !== undefined || request.body?.permissions !== undefined) && !canManageRoles(request)) {
      return response.status(403).json({ data: null, error: { message: 'Somente usuários com permissão de gerenciar perfis podem definir papéis ou permissões.', code: 'ROLE_PERMISSION_REQUIRED' } });
    }
    const role = normalizeUserRole(request.body?.role_id, request.body?.role);
    if (role.name === 'admin_master' && !isMaster(request.profile)) return response.status(403).json({ data: null, error: { message: 'Somente o administrador master pode criar outro master.' } });
    validateRoleAssignment(request, role.id);
    const companies = normalizeUserScope(request.body?.companies);
    const stores = normalizeUserScope(request.body?.stores);
    validateUserScope(request, companies, stores);
    const permissionIds = normalizePermissionIds(request, request.body?.permissions);
    const id = newId();
    execute('INSERT INTO profiles (id, name, email, role, role_id, companies, stores, status, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, name, email, role.name, role.id, JSON.stringify(companies), JSON.stringify(stores), request.body?.status === 'inactive' ? 'inactive' : 'active', await bcrypt.hash(password, 10), now()]);
    replaceUserPermissions(id, permissionIds);
    persistDatabase();
    return response.status(201).json({ data: profileForAuth(profileById(id) || {}), error: null });
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

app.get('/api/admin/users/:id/permissions', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!canManageUsers(request, 'edit')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para consultar permissões de usuários.', code: '403' } });
  const targetId = String(request.params.id);
  const current = profileById(targetId);
  if (!current || !rowInScope('profiles', current, request.profile)) return response.status(403).json({ data: null, error: { message: 'Usuário fora do seu escopo.', code: '403' } });
  const rows = selectRows('SELECT permission_id FROM user_permissions WHERE user_id = ?', [targetId]);
  return response.json({ data: rows.map((row) => String(row.permission_id)), error: null });
});

app.patch('/api/admin/users/:id', requireAuth, async (request: AuthenticatedRequest, response) => {
  try {
    if (!canManageUsers(request, 'edit')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para editar usuários.', code: '403' } });
    const targetId = String(request.params.id);
    const current = profileById(targetId);
    if (!current || !rowInScope('profiles', current, request.profile)) return response.status(403).json({ data: null, error: { message: 'Usuário fora do seu escopo.', code: '403' } });
    if ((request.body?.role_id !== undefined || request.body?.role !== undefined || request.body?.permissions !== undefined) && !canManageRoles(request)) {
      return response.status(403).json({ data: null, error: { message: 'Somente usuários com permissão de gerenciar perfis podem alterar papéis ou permissões.', code: 'ROLE_PERMISSION_REQUIRED' } });
    }
    if (String(request.userId) === targetId && request.body?.status === 'inactive') {
      return response.status(400).json({ data: null, error: { message: 'Não é permitido desativar o próprio usuário.', code: 'SELF_DEACTIVATION_FORBIDDEN' } });
    }
    const role = normalizeUserRole(request.body?.role_id || current.role_id, request.body?.role || current.role);
    if (role.name === 'admin_master' && !isMaster(request.profile)) return response.status(403).json({ data: null, error: { message: 'Somente o master pode atribuir esse papel.' } });
    validateRoleAssignment(request, role.id);
    const companies = request.body?.companies === undefined ? jsonArray(current.companies) : normalizeUserScope(request.body.companies);
    const stores = request.body?.stores === undefined ? jsonArray(current.stores) : normalizeUserScope(request.body.stores);
    validateUserScope(request, companies, stores);
    const email = String(request.body?.email ?? current.email).trim().toLowerCase();
    const name = String(request.body?.name ?? current.name ?? '').trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || !name) return response.status(400).json({ data: null, error: { message: 'Nome e e-mail válido são obrigatórios.' } });
    const duplicate = selectRows('SELECT id FROM profiles WHERE lower(email) = ? AND id <> ? LIMIT 1', [email, targetId])[0];
    if (duplicate) return response.status(409).json({ data: null, error: { message: 'Já existe um usuário com este e-mail.' } });
    execute('UPDATE profiles SET name = ?, email = ?, role = ?, role_id = ?, companies = ?, stores = ?, status = ? WHERE id = ?', [name, email, role.name, role.id, JSON.stringify(companies), JSON.stringify(stores), request.body?.status === 'inactive' ? 'inactive' : (request.body?.status === 'active' ? 'active' : current.status || 'active'), targetId]);
    if (request.body?.permissions !== undefined) replaceUserPermissions(targetId, normalizePermissionIds(request, request.body.permissions));
    if (request.body?.password) {
      if (!isMaster(request.profile) && String(request.userId) !== targetId) return response.status(403).json({ data: null, error: { message: 'Somente o master ou o próprio usuário pode alterar esta senha.' } });
      try { assertPasswordPolicy(String(request.body.password)); } catch (error) { return response.status(400).json({ data: null, error: errorPayload(error) }); }
      execute('UPDATE profiles SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(request.body.password), 10), targetId]);
    }
    if (request.body?.password || request.body?.status !== undefined || request.body?.role !== undefined || request.body?.role_id !== undefined || request.body?.permissions !== undefined) revokeSessions(targetId);
    persistDatabase();
    const updatedProfile = profileById(targetId) || {};
    if (String(request.userId) === targetId && (request.body?.password || request.body?.role !== undefined || request.body?.role_id !== undefined || request.body?.permissions !== undefined)) {
      setSessionCookie(response, issueToken(updatedProfile));
    }
    return response.json({ data: profileForAuth(updatedProfile), error: null });
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

app.delete('/api/admin/users/:id', requireAuth, (request: AuthenticatedRequest, response) => {
  try {
    if (!canManageUsers(request, 'delete')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para excluir usuários.', code: '403' } });
    const targetId = String(request.params.id);
    if (targetId === String(request.userId)) return response.status(400).json({ data: null, error: { message: 'Não é permitido excluir o próprio usuário.' } });
    const current = profileById(targetId);
    if (!current || !rowInScope('profiles', current, request.profile)) return response.status(403).json({ data: null, error: { message: 'Usuário fora do seu escopo.', code: '403' } });
    execute('DELETE FROM user_permissions WHERE user_id = ?', [targetId]);
    execute('DELETE FROM profiles WHERE id = ?', [targetId]);
    persistDatabase();
    return response.json({ data: null, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/sales', requireAuth, (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    if (!canAccessTable(request, 'sales', 'insert')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para registrar vendas.', code: '403' } });
    const saleData = request.body?.sale || {};
    const rawItems = Array.isArray(request.body?.items) ? request.body.items : [];
    const companyId = String(saleData.company_id || '');
    const storeId = String(saleData.store_id || '');
    const customerId = saleData.customer_id ? String(saleData.customer_id) : null;
    if (!companyId || !storeId || rawItems.length === 0) return response.status(400).json({ data: null, error: { message: 'Empresa, loja e itens são obrigatórios.' } });
    const store = selectRows('SELECT id, name, company_id FROM stores WHERE id = ? LIMIT 1', [storeId])[0];
    if (!store || String(store.company_id) !== companyId) return response.status(400).json({ data: null, error: { message: 'Loja inválida para a empresa informada.' } });
    if (!rowInScope('sales', { company_id: companyId, store_id: storeId }, request.profile)) return response.status(403).json({ data: null, error: { message: 'Venda fora do seu escopo.', code: '403' } });
    const customer = customerId ? selectRows('SELECT id, name, company_id FROM customers WHERE id = ? LIMIT 1', [customerId])[0] : undefined;
    if (customerId && (!customer || String(customer.company_id) !== companyId)) return response.status(400).json({ data: null, error: { message: 'Cliente inválido para a empresa informada.' } });
    const guestName = saleData.guest_name ? String(saleData.guest_name).trim().slice(0, 160) : null;
    const serviceOrderId = saleData.service_order_id ? String(saleData.service_order_id) : null;
    if (!customerId && !guestName) return response.status(400).json({ data: null, error: { message: 'Informe o nome do cliente avulso.' } });
    if (!customerId && serviceOrderId) return response.status(400).json({ data: null, error: { message: 'Cliente avulso não pode ser vinculado a uma O.S.' } });
    const items: Array<{ productId: string | null; productName: string; quantity: number; unitPrice: number; manual: boolean }> = [];
    for (const rawItem of rawItems) {
      const isManual = Boolean(rawItem?.manual);
      const quantity = Number(rawItem?.quantity ?? rawItem?.qty);
      if (!Number.isInteger(quantity) || quantity <= 0) return response.status(400).json({ data: null, error: { message: 'Quantidade de item inválida.' } });
      if (isManual) {
        const productName = String(rawItem?.product_name || rawItem?.name || '').trim().slice(0, 160);
        const unitPrice = Number(rawItem?.unit_price ?? rawItem?.price);
        if (!productName) return response.status(400).json({ data: null, error: { message: 'Informe a descrição do item manual.' } });
        if (!Number.isFinite(unitPrice) || unitPrice < 0) return response.status(400).json({ data: null, error: { message: 'Preço do item manual inválido.' } });
        items.push({ productId: null, productName, quantity, unitPrice, manual: true });
        continue;
      }
      const productId = String(rawItem?.product_id || rawItem?.id || '');
      if (!productId) return response.status(400).json({ data: null, error: { message: 'Produto inválido.' } });
      const product = selectRows('SELECT id, name, company_id, price FROM products WHERE id = ? LIMIT 1', [productId])[0];
      if (!product || String(product.company_id) !== companyId) return response.status(400).json({ data: null, error: { message: 'Produto inválido para a empresa informada.' } });
      const stock = selectRows('SELECT id, quantity, reserved_quantity FROM product_stock WHERE product_id = ? AND store_id = ? LIMIT 1', [productId, storeId])[0];
      const physicalStock = Number(stock?.quantity || 0);
      const reservedStock = Number(stock?.reserved_quantity || 0);
      const availableStock = Math.max(physicalStock - reservedStock, 0);
      if (!stock || availableStock < quantity) return response.status(409).json({ data: null, error: { message: `Estoque disponível insuficiente para ${product.name}. Disponível: ${availableStock}.`, code: 'INSUFFICIENT_AVAILABLE_STOCK' } });
      const unitPrice = Number(rawItem?.unit_price ?? rawItem?.price ?? product.price ?? 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return response.status(400).json({ data: null, error: { message: 'Preço de item inválido.' } });
      items.push({ productId, productName: String(product.name || ''), quantity, unitPrice, manual: false });
    }
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discount = Math.min(Math.max(Number(saleData.discount || 0), 0), subtotal);
    const total = Number((subtotal - discount).toFixed(2));
    if (total > 10000 && request.body?.sale?.confirm_high_value !== true) return response.status(400).json({ data: null, error: { message: 'Venda com valor alto exige confirmação adicional.' } });
    const saleId = newId();
    const saleDate = String(saleData.date || now()).slice(0, 30);
    const paymentMethod = saleData.payment_method ? String(saleData.payment_method) : null;
    const paymentMethodKey = String(paymentMethod || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isCashPayment = ['cash', 'dinheiro', 'especie'].includes(paymentMethodKey);
    const paymentNote = saleData.payment_note ? String(saleData.payment_note).slice(0, 500) : null;
    const isReceivable = ['credit', 'installments', 'crediario'].includes(paymentMethodKey);
    const cashRegister = isCashPayment ? selectRows("SELECT * FROM cash_registers WHERE company_id = ? AND store_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1", [companyId, storeId])[0] : null;
    if (isCashPayment && !cashRegister) return response.status(409).json({ data: null, error: { message: 'Abra o caixa da loja antes de registrar uma venda em dinheiro.', code: 'OPEN_CASH_REGISTER_REQUIRED' } });
    const financialDueDate = String(saleData.due_date || saleDate).slice(0, 30);
    const customerName = customer?.name ? String(customer.name) : null;
    const displayCustomerName = customerName || guestName || 'Cliente avulso';
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('INSERT INTO sales (id, company_id, store_id, customer_id, seller_id, date, total, discount, installments, service_order_id, notes, status, payment_method, customer_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [saleId, companyId, storeId, customerId, saleData.seller_id ? String(saleData.seller_id) : null, saleDate, total, discount, saleData.installments ? Number(saleData.installments) : null, serviceOrderId, saleData.notes ? String(saleData.notes) : null, 'completed', paymentMethod, displayCustomerName, now()]);
    for (const item of items) {
      execute('INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [newId(), saleId, item.productId, item.productName, item.quantity, item.unitPrice, Number((item.quantity * item.unitPrice).toFixed(2)), now()]);
      if (item.manual || !item.productId) continue;
      const stockBefore = Number(selectRows('SELECT quantity FROM product_stock WHERE product_id = ? AND store_id = ? LIMIT 1', [item.productId, storeId])[0]?.quantity || 0);
      const stockAfter = stockBefore - item.quantity;
      execute('UPDATE product_stock SET quantity = ? WHERE product_id = ? AND store_id = ?', [stockAfter, item.productId, storeId]);
      execute('INSERT INTO product_movements (id, product_id, store_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, description, user_id, product_name, store_name, user_name, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), item.productId, storeId, 'sale', -item.quantity, stockBefore, stockAfter, 'sales', saleId, `Venda ${saleId.slice(0, 8)}`, request.userId, item.productName, store.name, actorName(request.userId), saleDate, now()]);
    }
    const financialEntryId = newId();
    const cardFeePercent = Number(Number(saleData.card_fee_percent || 0).toFixed(2));
    const cardFeeAmount = Number(Number(saleData.card_fee_amount || (total * cardFeePercent / 100)).toFixed(2));
    const financialNetAmount = Number(Math.max(total - cardFeeAmount, 0).toFixed(2));
    const anticipatedAt = saleData.anticipated_at ? String(saleData.anticipated_at).slice(0, 30) : null;
    const financialEntry = {
      id: financialEntryId,
      company_id: companyId,
      store_id: storeId,
      type: isReceivable ? 'receivable' : 'in',
      description: `Venda #${saleId.slice(0, 8)} - ${displayCustomerName}`,
      amount: total,
      due_date: financialDueDate,
      payment_date: isReceivable ? null : now(),
      paid_amount: isReceivable ? 0 : total,
      status: isReceivable ? 'pending' : 'paid',
      category: 'Venda',
      payment_method: paymentMethod,
      payment_note: paymentNote,
      origin_table: 'sales',
      origin_id: saleId,
      supplier_customer_name: displayCustomerName,
      customer_id: customerId,
      tags: '[]',
      is_reconciled: 0,
      original_amount: total,
      net_amount: financialNetAmount,
      card_fee_percent: cardFeePercent,
      card_fee_amount: cardFeeAmount,
      anticipated_at: anticipatedAt,
      created_by: request.userId,
      created_by_name: actorName(request.userId),
      created_at: now(),
      updated_at: now(),
    };
    const financialColumns = Object.keys(financialEntry).filter((column) => tableColumns('financial_entries').has(column));
    execute(`INSERT INTO financial_entries (${financialColumns.map(quoteIdentifier).join(', ')}) VALUES (${financialColumns.map(() => '?').join(', ')})`, financialColumns.map((column) => serializeValue(column, (financialEntry as Record<string, unknown>)[column])));
    if (isCashPayment && cashRegister) execute('INSERT INTO cash_register_movements (id, cash_register_id, type, amount, description, payment_method, reference_id, reference_table, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), cashRegister.id, 'sale', Number(total.toFixed(2)), `Venda ${saleId.slice(0, 8)} · ${displayCustomerName}`, 'cash', saleId, 'sales', request.userId, actorName(request.userId), now()]);
    if (isReceivable && paymentMethodKey === 'credit') {
      const installmentTotal = Math.min(120, Math.max(1, Math.floor(Number(saleData.installments || 1))));
      const grossCents = Math.round(total * 100);
      const feeCents = Math.round(cardFeeAmount * 100);
      const grossBaseCents = Math.floor(grossCents / installmentTotal);
      const grossRemainder = grossCents - grossBaseCents * installmentTotal;
      const feeBaseCents = Math.floor(feeCents / installmentTotal);
      const feeRemainder = feeCents - feeBaseCents * installmentTotal;
      for (let installmentNumber = 1; installmentNumber <= installmentTotal; installmentNumber += 1) {
        const gross = (grossBaseCents + (installmentNumber === installmentTotal ? grossRemainder : 0)) / 100;
        const fee = (feeBaseCents + (installmentNumber === installmentTotal ? feeRemainder : 0)) / 100;
        const net = Number(Math.max(gross - fee, 0).toFixed(2));
        const expectedDate = addPeriod(financialDueDate, 'monthly', installmentNumber - 1) || financialDueDate;
        const settlementTimestamp = now();
        const settlementId = newId();
        execute('INSERT INTO financial_card_settlements (id, company_id, store_id, entry_id, sale_id, card_brand, installment_number, installment_total, gross_amount, fee_percent, fee_amount, net_amount, expected_date, status, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [settlementId, companyId, storeId, financialEntryId, saleId, saleData.card_brand ? String(saleData.card_brand).slice(0, 60) : null, installmentNumber, installmentTotal, gross, cardFeePercent, fee, net, expectedDate, 'pending', request.userId, actorName(request.userId), settlementTimestamp, settlementTimestamp]);
      }
    }
    if (customerId) execute('UPDATE customers SET last_visit = ? WHERE id = ?', [now(), customerId]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: { id: saleId, total, discount, status: 'completed' }, error: null });
  } catch (error) {
    if (transactionStarted) {
      try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ }
    }
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/sales/:id/cancel', requireAuth, (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    if (!canAccessTable(request, 'sales', 'update') || !hasModulePermission(request.profile, 'financial', 'cancel_entry')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para cancelar vendas e seus efeitos financeiros.', code: '403' } });
    const saleId = String(request.params.id);
    const sale = selectRows('SELECT * FROM sales WHERE id = ? LIMIT 1', [saleId])[0];
    if (!sale) return response.status(404).json({ data: null, error: { message: 'Venda não encontrada.' } });
    if (!rowInScope('sales', sale, request.profile)) return response.status(403).json({ data: null, error: { message: 'Venda fora do seu escopo.', code: '403' } });
    if (sale.status === 'cancelled') return response.json({ data: { id: saleId, status: 'cancelled' }, error: null });
    const items = selectRows('SELECT product_id, product_name, quantity FROM sale_items WHERE sale_id = ?', [saleId]);
    getDatabase().run('BEGIN');
    transactionStarted = true;
    for (const item of items) {
      if (!item.product_id) continue;
      const stock = selectRows('SELECT id FROM product_stock WHERE product_id = ? AND store_id = ? LIMIT 1', [item.product_id, sale.store_id])[0];
      if (stock) execute('UPDATE product_stock SET quantity = quantity + ? WHERE id = ?', [Number(item.quantity || 0), stock.id]);
      else execute('INSERT INTO product_stock (id, product_id, store_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)', [newId(), item.product_id, sale.store_id, Number(item.quantity || 0), now()]);
      execute('INSERT INTO product_movements (id, product_id, store_id, type, quantity, description, user_id, product_name, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), item.product_id, sale.store_id, 'sale_cancelled', Number(item.quantity || 0), `Cancelamento ${saleId.slice(0, 8)}`, request.userId, item.product_name, now(), now()]);
    }
    execute('UPDATE sales SET status = ? WHERE id = ?', ['cancelled', saleId]);
    const cancellationTimestamp = now();
    execute('UPDATE financial_entries SET status = ?, payment_date = ?, paid_amount = ?, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE origin_table = ? AND origin_id = ? AND status <> ?', ['cancelled', null, 0, request.userId, actorName(request.userId), cancellationTimestamp, 'sales', saleId, 'cancelled']);
    const cancelledEntries = selectRows("SELECT * FROM financial_entries WHERE origin_table = 'sales' AND origin_id = ?", [saleId]);
    cancelledEntries.forEach(entry => addFinancialAudit(entry, 'sale_cancelled', { sale_id: saleId, cancelled_at: cancellationTimestamp }, request, cancellationTimestamp));
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: { id: saleId, status: 'cancelled' }, error: null });
  } catch (error) {
    if (transactionStarted) {
      try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ }
    }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/:id/settle', requireAuth, (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'settle_entry')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para baixar lançamentos financeiros.', code: '403' } });
    }
    const entryId = String(request.params.id || '');
    const current = selectRows('SELECT * FROM financial_entries WHERE id = ? LIMIT 1', [entryId])[0];
    if (!current) return response.status(404).json({ data: null, error: { message: 'Lançamento financeiro não encontrado.', code: '404' } });
    if (!rowInScope('financial_entries', current, request.profile)) {
      return response.status(403).json({ data: null, error: { message: 'Lançamento fora do seu escopo.', code: '403' } });
    }
    if (!['receivable', 'payable'].includes(String(current.type))) {
      return response.status(400).json({ data: null, error: { message: 'Somente contas a receber ou a pagar podem ser baixadas por esta operação.', code: 'INVALID_FINANCIAL_TYPE' } });
    }
    if (String(current.status) === 'cancelled') {
      return response.status(409).json({ data: null, error: { message: 'Lançamentos cancelados não podem ser baixados.', code: 'CANCELLED_ENTRY' } });
    }
    if (String(current.approval_status || 'approved') === 'pending_approval' || String(current.approval_status || '') === 'rejected') {
      return response.status(409).json({ data: null, error: { message: 'Aprove o lançamento antes de realizar a baixa.', code: 'PENDING_APPROVAL' } });
    }
    const totalAmount = Number(Number(current.amount || 0).toFixed(2));
    const alreadyPaid = Math.min(Math.max(Number(current.paid_amount || (current.status === 'paid' ? totalAmount : 0)), 0), totalAmount);
    const remaining = Number(Math.max(totalAmount - alreadyPaid, 0).toFixed(2));
    const requestedAmount = request.body?.amount === undefined ? remaining : Number(request.body.amount);
    const paymentDate = String(request.body?.payment_date || now()).slice(0, 40);
    const paymentMethod = String(request.body?.payment_method || '').trim().slice(0, 60);
    const paymentNote = request.body?.payment_note ? String(request.body.payment_note).trim().slice(0, 500) : null;
    const interestAmount = Number(Number(request.body?.interest_amount || 0).toFixed(2));
    const fineAmount = Number(Number(request.body?.fine_amount || 0).toFixed(2));
    const discountAmount = Number(Number(request.body?.discount_amount || 0).toFixed(2));
    const previousInterestAmount = Number(current.interest_amount || 0);
    const previousFineAmount = Number(current.fine_amount || 0);
    const previousDiscountAmount = Number(current.discount_amount || 0);
    if ([interestAmount, fineAmount, discountAmount, previousInterestAmount, previousFineAmount, previousDiscountAmount].some(value => !Number.isFinite(value) || value < 0)) return response.status(400).json({ data: null, error: { message: 'Juros, multa e desconto devem ser valores positivos.', code: 'INVALID_ADJUSTMENTS' } });
    const accumulatedInterestAmount = Number((previousInterestAmount + interestAmount).toFixed(2));
    const accumulatedFineAmount = Number((previousFineAmount + fineAmount).toFixed(2));
    const accumulatedDiscountAmount = Number((previousDiscountAmount + discountAmount).toFixed(2));
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > remaining + 0.001) {
      return response.status(400).json({ data: null, error: { message: `Informe um valor entre R$ 0,01 e R$ ${remaining.toFixed(2)}.`, code: 'INVALID_SETTLEMENT_AMOUNT' } });
    }
    if (!paymentMethod || Number.isNaN(new Date(paymentDate).getTime())) {
      return response.status(400).json({ data: null, error: { message: 'Data e forma de pagamento são obrigatórias.', code: 'INVALID_SETTLEMENT' } });
    }
    const nextPaid = Number(Math.min(totalAmount, alreadyPaid + requestedAmount).toFixed(2));
    const paymentNetAmount = Number(Math.max(requestedAmount + interestAmount + fineAmount - discountAmount, 0).toFixed(2));
    const accumulatedNetAmount = Number(Math.max(totalAmount + accumulatedInterestAmount + accumulatedFineAmount - accumulatedDiscountAmount, 0).toFixed(2));
    const nextStatus = nextPaid >= totalAmount ? 'paid' : 'partially_paid';
    const timestamp = now();
    let auditLog: Record<string, unknown> = { created_by: current.created_by || null, created_at: current.created_at || null, changes: [] };
    try {
      const parsed = typeof current.audit_log === 'string' ? JSON.parse(current.audit_log) : current.audit_log;
      if (parsed && typeof parsed === 'object') auditLog = parsed as Record<string, unknown>;
    } catch { /* histórico legado inválido: preserva a baixa com um novo log válido */ }
    const changes = Array.isArray(auditLog.changes) ? auditLog.changes : [];
    changes.push({ action: 'settlement', amount: requestedAmount, net_amount: paymentNetAmount, interest_amount: interestAmount, fine_amount: fineAmount, discount_amount: discountAmount, accumulated_interest_amount: accumulatedInterestAmount, accumulated_fine_amount: accumulatedFineAmount, accumulated_discount_amount: accumulatedDiscountAmount, accumulated_net_amount: accumulatedNetAmount, paid_amount_before: alreadyPaid, paid_amount_after: nextPaid, status: nextStatus, payment_method: paymentMethod, payment_date: paymentDate, changed_by: request.userId || null, changed_by_name: String(request.profile?.name || request.profile?.email || 'Usuário atual'), changed_at: timestamp });
    auditLog.changes = changes;

    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('UPDATE financial_entries SET paid_amount = ?, status = ?, payment_date = ?, payment_method = ?, payment_note = ?, interest_amount = ?, fine_amount = ?, discount_amount = ?, net_amount = ?, audit_log = ?, settled_by = ?, settled_by_name = ?, settled_at = ?, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE id = ?', [nextPaid, nextStatus, paymentDate, paymentMethod, paymentNote, accumulatedInterestAmount, accumulatedFineAmount, accumulatedDiscountAmount, accumulatedNetAmount, JSON.stringify(auditLog), request.userId, String(request.profile?.name || request.profile?.email || 'Usuário atual'), timestamp, request.userId, String(request.profile?.name || request.profile?.email || 'Usuário atual'), timestamp, entryId]);

    if (String(current.origin_table) === 'service_orders' && current.origin_id) {
      const paidRow = selectRows("SELECT COALESCE(SUM(paid_amount), 0) AS paid_amount FROM financial_entries WHERE origin_table = 'service_orders' AND origin_id = ? AND status <> 'cancelled'", [current.origin_id])[0];
      const order = selectRows('SELECT total FROM service_orders WHERE id = ? LIMIT 1', [current.origin_id])[0];
      const orderTotal = Number(order?.total || totalAmount);
      const orderPaid = Number(Math.min(Math.max(Number(paidRow?.paid_amount || nextPaid), 0), orderTotal).toFixed(2));
      const orderStatus = orderPaid >= orderTotal ? 'paid' : orderPaid > 0 ? 'partially_paid' : 'pending';
      execute('UPDATE service_orders SET paid_amount = ?, balance = ?, financial_status = ? WHERE id = ?', [orderPaid, Number(Math.max(orderTotal - orderPaid, 0).toFixed(2)), orderStatus, current.origin_id]);
    }

    const snapshot = { ...current, paid_amount: nextPaid, status: nextStatus, payment_date: paymentDate, payment_method: paymentMethod, payment_note: paymentNote, interest_amount: accumulatedInterestAmount, fine_amount: accumulatedFineAmount, discount_amount: accumulatedDiscountAmount, net_amount: accumulatedNetAmount, settled_by: request.userId, settled_by_name: String(request.profile?.name || request.profile?.email || 'Usuário atual'), settled_at: timestamp, updated_by: request.userId, updated_by_name: String(request.profile?.name || request.profile?.email || 'Usuário atual'), updated_at: timestamp };
    execute('INSERT INTO financial_entry_audits (id, company_id, store_id, customer_id, entry_id, carne_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), current.company_id, current.store_id || null, current.customer_id || null, entryId, current.origin_table === 'credit_book' ? current.origin_id : null, nextStatus === 'paid' ? 'settled' : 'partially_settled', JSON.stringify(snapshot), request.userId || null, request.profile?.name || request.profile?.email || 'Usuário atual', timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    const updated = selectRows('SELECT * FROM financial_entries WHERE id = ? LIMIT 1', [entryId])[0];
    return response.json({ data: deserializeRow(updated), error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

function addFinancialAudit(entry: Record<string, unknown>, action: string, snapshot: Record<string, unknown>, request: AuthenticatedRequest, timestamp = now()) {
  execute('INSERT INTO financial_entry_audits (id, company_id, store_id, customer_id, entry_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), entry.company_id, entry.store_id || null, entry.customer_id || null, String(entry.id), action, JSON.stringify(snapshot), request.userId || null, request.profile?.name || request.profile?.email || 'Usuário atual', timestamp]);
}

function parseRecurrenceConfig(value: unknown) {
  if (!value) return {} as Record<string, unknown>;
  if (typeof value === 'object') return value as Record<string, unknown>;
  try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}

function addPeriod(dateValue: string, frequency: string, intervalValue: unknown) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const interval = Math.max(1, Math.floor(Number(intervalValue || 1)));
  if (frequency === 'daily') date.setDate(date.getDate() + interval);
  else if (frequency === 'weekly') date.setDate(date.getDate() + interval * 7);
  else if (frequency === 'yearly') date.setFullYear(date.getFullYear() + interval);
  else date.setMonth(date.getMonth() + interval);
  return date.toISOString();
}

app.post('/api/operations/financial/recurring/generate', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'generate_recurring')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para gerar lançamentos recorrentes.', code: '403' } });
    const companyId = String(request.body?.company_id || profileCompanies(request.profile)[0] || '');
    const asOf = new Date(String(request.body?.as_of || now()));
    if (!companyId || Number.isNaN(asOf.getTime())) return response.status(400).json({ data: null, error: { message: 'Empresa e data de referência são obrigatórias.', code: 'INVALID_RECURRENCE' } });
    if (!profileCompanies(request.profile).includes(companyId) && !isMaster(request.profile)) return response.status(403).json({ data: null, error: { message: 'Empresa fora do seu escopo.', code: '403' } });
    const templates = selectRows("SELECT * FROM financial_entries WHERE company_id = ? AND is_recurring = 1 AND recurrence_source_id IS NULL AND status <> 'cancelled'", [companyId]);
    const generated: Record<string, unknown>[] = [];
    getDatabase().run('BEGIN');
    transactionStarted = true;
    for (const source of templates) {
      const config = parseRecurrenceConfig(source.recurrence_config);
      let cursor = String(source.due_date || source.created_at || now());
      const frequency = String(config.frequency || 'monthly');
      const interval = Math.max(1, Number(config.interval || 1));
      const maxOccurrences = Math.min(120, Math.max(1, Number(config.occurrences || 24)));
      for (let occurrence = 0; occurrence < maxOccurrences; occurrence += 1) {
        const next = addPeriod(cursor, frequency, interval);
        if (!next || new Date(next) > asOf) break;
        cursor = next;
        const dueDate = next.slice(0, 30);
        if (selectRows('SELECT id FROM financial_entries WHERE recurrence_source_id = ? AND due_date = ? LIMIT 1', [source.id, dueDate]).length > 0) continue;
        const id = newId();
        const createdAt = now();
        execute('INSERT INTO financial_entries (id, company_id, store_id, type, description, amount, due_date, payment_date, paid_amount, status, category, category_id, payment_method, payment_note, origin_table, origin_id, supplier_customer_name, customer_id, cost_center, tags, is_reconciled, audit_log, recurrence_config, is_recurring, recurrence_source_id, original_amount, net_amount, approval_status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, source.company_id, source.store_id || null, source.type, `${source.description} · recorrente`, Number(source.amount || 0), dueDate, null, 0, 'pending', source.category || null, source.category_id || null, source.payment_method || null, source.payment_note || null, 'recurring', source.id, source.supplier_customer_name || null, source.customer_id || null, source.cost_center || null, source.tags || '[]', 0, JSON.stringify({ recurrence_source_id: source.id, generated_at: createdAt }), JSON.stringify(config), 0, source.id, Number(source.amount || 0), Number(source.amount || 0), source.approval_status || 'approved', request.userId, createdAt, createdAt]);
        generated.push(deserializeRow(selectRows('SELECT * FROM financial_entries WHERE id = ?', [id])[0]));
      }
    }
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: { generated_count: generated.length, entries: generated }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/installments', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'create_installments')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para parcelar despesas.', code: '403' } });
    const input = request.body || {};
    const companyId = String(input.company_id || '');
    const storeId = String(input.store_id || '');
    const description = String(input.description || '').trim();
    const totalAmount = Number(input.total_amount);
    const installmentCount = Math.floor(Number(input.installment_count || 1));
    const intervalDays = Math.max(1, Math.floor(Number(input.interval_days || 30)));
    const firstDueDate = String(input.first_due_date || '').slice(0, 10);
    if (!companyId || !storeId || !description || !Number.isFinite(totalAmount) || totalAmount <= 0 || installmentCount < 2 || installmentCount > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) return response.status(400).json({ data: null, error: { message: 'Empresa, loja, descrição, valor, parcelas e primeiro vencimento válidos são obrigatórios.', code: 'INVALID_INSTALLMENTS' } });
    if (!rowInScope('financial_entries', { company_id: companyId, store_id: storeId }, request.profile)) return response.status(403).json({ data: null, error: { message: 'Despesa fora do escopo permitido.', code: '403' } });
    const groupId = newId();
    const cents = Math.round(totalAmount * 100);
    const baseCents = Math.floor(cents / installmentCount);
    const remainder = cents - baseCents * installmentCount;
    const approvalStatus = input.approval_required ? 'pending_approval' : 'approved';
    const timestamp = now();
    const entries: Record<string, unknown>[] = [];
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('INSERT INTO financial_installment_groups (id, company_id, store_id, description, total_amount, installment_count, interval_days, first_due_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [groupId, companyId, storeId, description, Number(totalAmount.toFixed(2)), installmentCount, intervalDays, firstDueDate, request.userId, timestamp]);
    for (let i = 0; i < installmentCount; i += 1) {
      const due = new Date(`${firstDueDate}T12:00:00`);
      due.setDate(due.getDate() + i * intervalDays);
      const amount = (baseCents + (i === installmentCount - 1 ? remainder : 0)) / 100;
      const id = newId();
      execute('INSERT INTO financial_entries (id, company_id, store_id, type, description, amount, due_date, paid_amount, status, category, category_id, payment_method, supplier_customer_name, cost_center, installment_group_id, installment_number, installment_total, original_amount, net_amount, approval_status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, companyId, storeId, 'payable', `${description} (${i + 1}/${installmentCount})`, Number(amount.toFixed(2)), due.toISOString().slice(0, 10), 0, 'pending', input.category || 'Despesas Parceladas', input.category_id || null, input.payment_method || null, input.supplier_customer_name || null, input.cost_center || 'Operacional', groupId, i + 1, installmentCount, Number(amount.toFixed(2)), Number(amount.toFixed(2)), approvalStatus, request.userId, timestamp, timestamp]);
      if (approvalStatus === 'pending_approval') execute('INSERT INTO financial_approvals (id, company_id, store_id, entry_id, status, requested_by, requested_at, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), companyId, storeId, id, 'pending', request.userId, timestamp, 'Aguardando aprovação da despesa parcelada.', timestamp]);
      entries.push(deserializeRow(selectRows('SELECT * FROM financial_entries WHERE id = ?', [id])[0]));
    }
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: { installment_group_id: groupId, entries }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/:id/approval', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'approve')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para aprovar lançamentos.', code: '403' } });
    const entryId = String(request.params.id);
    const entry = selectRows('SELECT * FROM financial_entries WHERE id = ? LIMIT 1', [entryId])[0];
    const status = String(request.body?.status || '');
    const note = request.body?.note ? String(request.body.note).slice(0, 500) : null;
    if (!entry) return response.status(404).json({ data: null, error: { message: 'Lançamento não encontrado.', code: '404' } });
    if (!rowInScope('financial_entries', entry, request.profile)) return response.status(403).json({ data: null, error: { message: 'Lançamento fora do seu escopo.', code: '403' } });
    if (!['approved', 'rejected', 'pending'].includes(status)) return response.status(400).json({ data: null, error: { message: 'Status de aprovação inválido.', code: 'INVALID_APPROVAL' } });
    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('UPDATE financial_entries SET approval_status = ?, approved_by = ?, approved_at = ?, approval_note = ?, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE id = ?', [status, status === 'approved' ? request.userId : null, status === 'approved' ? timestamp : null, note, request.userId, actorName(request.userId), timestamp, entryId]);
    execute('INSERT INTO financial_approvals (id, company_id, store_id, entry_id, status, requested_by, requested_by_name, requested_at, approved_by, approved_by_name, approved_at, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), entry.company_id, entry.store_id || null, entryId, status, entry.created_by || null, actorName(entry.created_by), entry.created_at || timestamp, status === 'approved' ? request.userId : null, status === 'approved' ? actorName(request.userId) : null, status === 'approved' ? timestamp : null, note, timestamp]);
    addFinancialAudit(entry, `approval_${status}`, { before: entry.approval_status || 'approved', after: status, note }, request, timestamp);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: deserializeRow(selectRows('SELECT * FROM financial_entries WHERE id = ?', [entryId])[0]), error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/:id/reverse', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'reverse_entry')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para estornar lançamentos.', code: '403' } });
    const entryId = String(request.params.id);
    const entry = selectRows('SELECT * FROM financial_entries WHERE id = ? LIMIT 1', [entryId])[0];
    const reason = String(request.body?.reason || '').trim().slice(0, 500);
    if (!entry) return response.status(404).json({ data: null, error: { message: 'Lançamento não encontrado.', code: '404' } });
    if (!rowInScope('financial_entries', entry, request.profile)) return response.status(403).json({ data: null, error: { message: 'Lançamento fora do seu escopo.', code: '403' } });
    if (String(entry.status) === 'cancelled' || String(entry.origin_table) === 'financial_reversal') return response.status(409).json({ data: null, error: { message: 'Este lançamento não pode ser estornado novamente.', code: 'ALREADY_REVERSED' } });
    if (!reason) return response.status(400).json({ data: null, error: { message: 'Informe o motivo do estorno.', code: 'REVERSAL_REASON_REQUIRED' } });
    const amount = Number(Number(entry.paid_amount || entry.amount || 0).toFixed(2));
    if (amount <= 0) return response.status(400).json({ data: null, error: { message: 'Somente lançamentos com valor podem ser estornados.', code: 'INVALID_REVERSAL_AMOUNT' } });
    const reversalId = newId();
    const timestamp = now();
    const reversalType = ['in', 'receivable'].includes(String(entry.type)) ? 'out' : 'in';
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('UPDATE financial_entries SET status = ?, payment_date = NULL, paid_amount = 0, payment_note = ?, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE id = ?', ['cancelled', `Estornado: ${reason}`, request.userId, actorName(request.userId), timestamp, entryId]);
    execute('INSERT INTO financial_entries (id, company_id, store_id, type, description, amount, due_date, payment_date, paid_amount, status, category, payment_method, payment_note, origin_table, origin_id, supplier_customer_name, customer_id, cost_center, original_amount, net_amount, reversed_entry_id, reversal_reason, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [reversalId, entry.company_id, entry.store_id || null, reversalType, `Estorno · ${entry.description}`, amount, timestamp, timestamp, amount, 'paid', 'Estorno Financeiro', entry.payment_method || null, reason, 'financial_reversal', entryId, entry.supplier_customer_name || null, entry.customer_id || null, entry.cost_center || 'Financeiro', amount, amount, entryId, reason, request.userId, timestamp, timestamp]);
    addFinancialAudit(entry, 'reversed', { original_entry_id: entryId, reversal_entry_id: reversalId, amount, reason }, request, timestamp);
    addFinancialAudit({ ...entry, id: reversalId }, 'reversal_created', { original_entry_id: entryId, amount, reason }, request, timestamp);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: { original_entry_id: entryId, reversal_entry_id: reversalId, amount }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/card-settlements/:id/settle', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'manage_card_settlements')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para conciliar liquidações de cartão.', code: '403' } });
    const settlementId = String(request.params.id || '');
    const settlement = selectRows('SELECT * FROM financial_card_settlements WHERE id = ? LIMIT 1', [settlementId])[0];
    if (!settlement) return response.status(404).json({ data: null, error: { message: 'Liquidação de cartão não encontrada.', code: 'NOT_FOUND' } });
    if (!rowInScope('financial_card_settlements', settlement, request.profile)) return response.status(403).json({ data: null, error: { message: 'Liquidação fora do seu escopo.', code: '403' } });
    if (String(settlement.status) === 'settled') return response.status(409).json({ data: null, error: { message: 'Esta parcela já está liquidada.', code: 'CARD_SETTLEMENT_ALREADY_SETTLED' } });
    const settledDate = String(request.body?.settled_date || now()).slice(0, 30);
    const actualNetAmount = Number(request.body?.actual_net_amount === undefined ? settlement.net_amount : request.body.actual_net_amount);
    const bankTransactionId = request.body?.bank_transaction_id ? String(request.body.bank_transaction_id) : null;
    if (Number.isNaN(new Date(settledDate).getTime()) || !Number.isFinite(actualNetAmount) || actualNetAmount < 0) return response.status(400).json({ data: null, error: { message: 'Data ou valor líquido recebido inválido.', code: 'INVALID_CARD_SETTLEMENT' } });
    const bankTransaction = bankTransactionId ? selectRows('SELECT * FROM bank_transactions WHERE id = ? LIMIT 1', [bankTransactionId])[0] : null;
    if (bankTransactionId && (!bankTransaction || !rowInScope('bank_transactions', bankTransaction, request.profile))) return response.status(403).json({ data: null, error: { message: 'Transação bancária inválida ou fora do escopo.', code: 'INVALID_BANK_TRANSACTION' } });
    if (bankTransactionId && Number(bankTransaction.is_reconciled || 0) === 1 && String(bankTransaction.matched_entry_id || '') !== String(settlement.entry_id || '')) return response.status(409).json({ data: null, error: { message: 'A transação bancária já está conciliada com outro lançamento.', code: 'BANK_TRANSACTION_ALREADY_MATCHED' } });
    if (bankTransactionId && selectRows('SELECT id FROM financial_card_settlements WHERE bank_transaction_id = ? AND id <> ? LIMIT 1', [bankTransactionId, settlementId]).length > 0) return response.status(409).json({ data: null, error: { message: 'A transação bancária já está vinculada a outra parcela de cartão.', code: 'BANK_TRANSACTION_ALREADY_LINKED' } });
    const timestamp = now();
    const difference = Number((actualNetAmount - Number(settlement.net_amount || 0)).toFixed(2));
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('UPDATE financial_card_settlements SET settled_date = ?, status = ?, bank_transaction_id = ?, net_amount = ?, settled_by = ?, settled_by_name = ?, updated_at = ? WHERE id = ?', [settledDate, 'settled', bankTransactionId, Number(actualNetAmount.toFixed(2)), request.userId, actorName(request.userId), timestamp, settlementId]);
    if (bankTransactionId) execute('UPDATE bank_transactions SET matched_entry_id = ?, match_confidence = ?, is_reconciled = 1, reconciled_by = ?, reconciled_by_name = ?, reconciled_at = ? WHERE id = ?', [settlement.entry_id || null, 1, request.userId, actorName(request.userId), timestamp, bankTransactionId]);
    const pendingSettlementCount = selectRows("SELECT id FROM financial_card_settlements WHERE entry_id = ? AND status <> 'settled'", [settlement.entry_id]).length;
    if (pendingSettlementCount === 0 && settlement.entry_id) execute('UPDATE financial_entries SET is_reconciled = 1, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE id = ?', [request.userId, actorName(request.userId), timestamp, settlement.entry_id]);
    execute('INSERT INTO financial_entry_audits (id, company_id, store_id, customer_id, entry_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), settlement.company_id, settlement.store_id || null, null, settlement.entry_id || settlementId, 'card_settlement_reconciled', JSON.stringify({ settlement_id: settlementId, sale_id: settlement.sale_id, installment_number: settlement.installment_number, expected_net_amount: settlement.net_amount, actual_net_amount: actualNetAmount, difference, bank_transaction_id: bankTransactionId, settled_date: settledDate }), request.userId, String(request.profile?.name || request.profile?.email || 'Usuário atual'), timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: { settlement_id: settlementId, status: 'settled', actual_net_amount: actualNetAmount, difference, bank_transaction_id: bankTransactionId }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/transfers', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'manage_transfers')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para realizar transferências financeiras.', code: '403' } });
    const input = request.body || {};
    const companyId = String(input.company_id || '');
    const amount = Number(input.amount);
    const transferDate = String(input.transfer_date || now()).slice(0, 30);
    const fromStoreId = input.from_store_id ? String(input.from_store_id) : null;
    const toStoreId = input.to_store_id ? String(input.to_store_id) : null;
    const fromBankId = input.from_bank_account_id ? String(input.from_bank_account_id) : null;
    const toBankId = input.to_bank_account_id ? String(input.to_bank_account_id) : null;
    const fromCashId = input.from_cash_register_id ? String(input.from_cash_register_id) : null;
    const toCashId = input.to_cash_register_id ? String(input.to_cash_register_id) : null;
    if (!companyId || !Number.isFinite(amount) || amount <= 0 || (!fromBankId && !fromCashId) || (!toBankId && !toCashId)) return response.status(400).json({ data: null, error: { message: 'Origem, destino e valor válidos são obrigatórios.', code: 'INVALID_TRANSFER' } });
    if ([fromBankId, fromCashId].filter(Boolean).length !== 1 || [toBankId, toCashId].filter(Boolean).length !== 1) return response.status(400).json({ data: null, error: { message: 'Selecione exatamente uma conta ou caixa de origem e um destino.', code: 'INVALID_TRANSFER_ENDPOINTS' } });
    if (fromBankId && toBankId && fromBankId === toBankId) return response.status(400).json({ data: null, error: { message: 'A origem e o destino bancário devem ser diferentes.', code: 'SAME_TRANSFER_ENDPOINT' } });
    if (fromCashId && toCashId && fromCashId === toCashId) return response.status(400).json({ data: null, error: { message: 'A origem e o destino de caixa devem ser diferentes.', code: 'SAME_TRANSFER_ENDPOINT' } });
    if (!profileCompanies(request.profile).includes(companyId) && !isMaster(request.profile)) return response.status(403).json({ data: null, error: { message: 'Empresa fora do seu escopo.', code: '403' } });
    const sourceBank = fromBankId ? selectRows('SELECT * FROM bank_accounts WHERE id = ? AND company_id = ? LIMIT 1', [fromBankId, companyId])[0] : null;
    const targetBank = toBankId ? selectRows('SELECT * FROM bank_accounts WHERE id = ? AND company_id = ? LIMIT 1', [toBankId, companyId])[0] : null;
    const sourceCash = fromCashId ? selectRows('SELECT * FROM cash_registers WHERE id = ? AND company_id = ? LIMIT 1', [fromCashId, companyId])[0] : null;
    const targetCash = toCashId ? selectRows('SELECT * FROM cash_registers WHERE id = ? AND company_id = ? LIMIT 1', [toCashId, companyId])[0] : null;
    if ((fromBankId && (!sourceBank || !rowInScope('bank_accounts', sourceBank, request.profile))) || (toBankId && (!targetBank || !rowInScope('bank_accounts', targetBank, request.profile)))) return response.status(403).json({ data: null, error: { message: 'Conta bancária fora do escopo ou inexistente.', code: 'INVALID_TRANSFER_SCOPE' } });
    if ((fromCashId && (!sourceCash || !rowInScope('cash_registers', sourceCash, request.profile))) || (toCashId && (!targetCash || !rowInScope('cash_registers', targetCash, request.profile)))) return response.status(403).json({ data: null, error: { message: 'Caixa fora do escopo ou inexistente.', code: 'INVALID_TRANSFER_SCOPE' } });
    if ((sourceCash && sourceCash.status !== 'open') || (targetCash && targetCash.status !== 'open')) return response.status(409).json({ data: null, error: { message: 'Transferências só podem usar caixas abertos.', code: 'CASH_REGISTER_CLOSED' } });
    if ((sourceCash && fromStoreId && String(sourceCash.store_id) !== fromStoreId) || (targetCash && toStoreId && String(targetCash.store_id) !== toStoreId)) return response.status(400).json({ data: null, error: { message: 'A loja informada deve corresponder ao caixa selecionado.', code: 'TRANSFER_STORE_MISMATCH' } });
    const sourceStoreId = fromStoreId || (sourceCash ? String(sourceCash.store_id) : null);
    const targetStoreId = toStoreId || (targetCash ? String(targetCash.store_id) : null);
    if (sourceStoreId) {
      const sourceStore = selectRows('SELECT id, company_id FROM stores WHERE id = ? LIMIT 1', [sourceStoreId])[0];
      if (!sourceStore || String(sourceStore.company_id) !== companyId || !rowInScope('financial_entries', { company_id: companyId, store_id: sourceStoreId }, request.profile)) return response.status(403).json({ data: null, error: { message: 'Loja de origem inválida ou fora do escopo.', code: 'INVALID_TRANSFER_SCOPE' } });
    }
    if (targetStoreId) {
      const targetStore = selectRows('SELECT id, company_id FROM stores WHERE id = ? LIMIT 1', [targetStoreId])[0];
      if (!targetStore || String(targetStore.company_id) !== companyId || !rowInScope('financial_entries', { company_id: companyId, store_id: targetStoreId }, request.profile)) return response.status(403).json({ data: null, error: { message: 'Loja de destino inválida ou fora do escopo.', code: 'INVALID_TRANSFER_SCOPE' } });
    }
    const sourceCashBalance = sourceCash ? cashBalanceFromMovements(selectRows('SELECT type, amount FROM cash_register_movements WHERE cash_register_id = ?', [sourceCash.id])) : null;
    if (sourceCashBalance !== null && amount > sourceCashBalance + 0.001) return response.status(409).json({ data: null, error: { message: 'Saldo insuficiente no caixa de origem.', code: 'INSUFFICIENT_CASH' } });
    if (sourceBank && Number(sourceBank.current_balance || 0) < amount - 0.001) return response.status(409).json({ data: null, error: { message: 'Saldo insuficiente na conta bancária de origem.', code: 'INSUFFICIENT_BANK_BALANCE' } });
    const transferId = newId();
    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('INSERT INTO financial_transfers (id, company_id, from_store_id, to_store_id, from_cash_register_id, to_cash_register_id, from_bank_account_id, to_bank_account_id, amount, transfer_date, status, note, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [transferId, companyId, sourceStoreId, targetStoreId, fromCashId, toCashId, fromBankId, toBankId, Number(amount.toFixed(2)), transferDate, 'completed', input.note ? String(input.note).slice(0, 500) : null, request.userId, actorName(request.userId), timestamp]);
    const outId = newId();
    const inId = newId();
    execute('INSERT INTO financial_entries (id, company_id, store_id, type, description, amount, due_date, payment_date, paid_amount, status, category, payment_method, payment_note, origin_table, origin_id, original_amount, net_amount, created_by, created_by_name, settled_by, settled_by_name, settled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [outId, companyId, sourceStoreId, 'out', `Transferência enviada · ${transferId.slice(0, 8)}`, Number(amount.toFixed(2)), transferDate, transferDate, Number(amount.toFixed(2)), 'paid', 'Transferências', 'transfer', input.note || null, 'financial_transfer', transferId, Number(amount.toFixed(2)), Number(amount.toFixed(2)), request.userId, actorName(request.userId), request.userId, actorName(request.userId), timestamp, timestamp, timestamp]);
    execute('INSERT INTO financial_entries (id, company_id, store_id, type, description, amount, due_date, payment_date, paid_amount, status, category, payment_method, payment_note, origin_table, origin_id, original_amount, net_amount, created_by, created_by_name, settled_by, settled_by_name, settled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [inId, companyId, targetStoreId, 'in', `Transferência recebida · ${transferId.slice(0, 8)}`, Number(amount.toFixed(2)), transferDate, transferDate, Number(amount.toFixed(2)), 'paid', 'Transferências', 'transfer', input.note || null, 'financial_transfer', transferId, Number(amount.toFixed(2)), Number(amount.toFixed(2)), request.userId, actorName(request.userId), request.userId, actorName(request.userId), timestamp, timestamp, timestamp]);
    if (fromBankId) execute('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [Number(amount.toFixed(2)), fromBankId]);
    if (toBankId) execute('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [Number(amount.toFixed(2)), toBankId]);
    if (fromCashId) execute('INSERT INTO cash_register_movements (id, cash_register_id, type, amount, description, payment_method, reference_id, reference_table, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), fromCashId, 'transfer_out', Number(amount.toFixed(2)), `Transferência enviada · ${transferId.slice(0, 8)}`, 'transfer', transferId, 'financial_transfers', request.userId, actorName(request.userId), timestamp]);
    if (toCashId) execute('INSERT INTO cash_register_movements (id, cash_register_id, type, amount, description, payment_method, reference_id, reference_table, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), toCashId, 'transfer_in', Number(amount.toFixed(2)), `Transferência recebida · ${transferId.slice(0, 8)}`, 'transfer', transferId, 'financial_transfers', request.userId, actorName(request.userId), timestamp]);
    execute('INSERT INTO financial_entry_audits (id, company_id, store_id, entry_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), companyId, sourceStoreId || targetStoreId || null, outId, 'transfer_created', JSON.stringify({ transfer_id: transferId, incoming_entry_id: inId, amount, source: { cash_register_id: fromCashId, bank_account_id: fromBankId }, target: { cash_register_id: toCashId, bank_account_id: toBankId } }), request.userId, String(request.profile?.name || request.profile?.email || 'Usuário atual'), timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: { transfer_id: transferId, outgoing_entry_id: outId, incoming_entry_id: inId, amount }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/daily-closing', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'close_cash')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para fechar o consolidado diário.', code: '403' } });
    const companyId = String(request.body?.company_id || '');
    const storeId = String(request.body?.store_id || '');
    const closingDate = String(request.body?.closing_date || now()).slice(0, 10);
    if (!companyId || !storeId || !/^\d{4}-\d{2}-\d{2}$/.test(closingDate)) return response.status(400).json({ data: null, error: { message: 'Empresa, loja e data válidas são obrigatórias.', code: 'INVALID_DAILY_CLOSING' } });
    if (!rowInScope('financial_entries', { company_id: companyId, store_id: storeId }, request.profile)) return response.status(403).json({ data: null, error: { message: 'Loja fora do seu escopo.', code: '403' } });
    const existingClosing = selectRows('SELECT * FROM financial_daily_closings WHERE company_id = ? AND store_id = ? AND closing_date = ? LIMIT 1', [companyId, storeId, closingDate])[0];
    const isReopen = request.body?.reopen === true;
    const reopenReason = String(request.body?.reason || '').trim().slice(0, 500);
    if (isReopen) {
      if (!hasModulePermission(request.profile, 'financial', 'reopen_closing')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para reabrir fechamentos diários.', code: '403' } });
      if (!existingClosing) return response.status(404).json({ data: null, error: { message: 'Não existe fechamento para reabrir nesta loja e data.', code: 'CLOSING_NOT_FOUND' } });
      if (String(existingClosing.status) !== 'closed') return response.status(409).json({ data: null, error: { message: 'Este fechamento já está reaberto.', code: 'CLOSING_ALREADY_OPEN' } });
      if (!reopenReason) return response.status(400).json({ data: null, error: { message: 'Informe a justificativa da reabertura.', code: 'REOPEN_REASON_REQUIRED' } });
      const timestamp = now();
      getDatabase().run('BEGIN');
      transactionStarted = true;
      execute('UPDATE financial_daily_closings SET status = ?, notes = ?, closed_by = ?, closed_by_name = ?, created_at = ? WHERE id = ?', ['reopened', `Reaberto: ${reopenReason}`, request.userId, actorName(request.userId), timestamp, existingClosing.id]);
      execute('INSERT INTO financial_entry_audits (id, company_id, store_id, entry_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), companyId, storeId, String(existingClosing.id), 'daily_closing_reopened', JSON.stringify({ before: existingClosing, reason: reopenReason }), request.userId, String(request.profile?.name || request.profile?.email || 'Usuário atual'), timestamp]);
      getDatabase().run('COMMIT');
      transactionStarted = false;
      persistDatabase();
      return response.json({ data: deserializeRow(selectRows('SELECT * FROM financial_daily_closings WHERE id = ?', [existingClosing.id])[0]), error: null });
    }
    if (existingClosing && String(existingClosing.status) === 'closed') return response.status(409).json({ data: null, error: { message: 'O dia já está fechado. Reabra o fechamento com justificativa antes de recalcular.', code: 'DAILY_CLOSING_EXISTS' } });
    const entries = selectRows("SELECT * FROM financial_entries WHERE company_id = ? AND store_id = ? AND status <> 'cancelled' AND substr(COALESCE(payment_date, due_date), 1, 10) = ?", [companyId, storeId, closingDate]);
    const totalIn = entries.filter(entry => ['in', 'receivable'].includes(String(entry.type))).reduce((sum, entry) => sum + Number(entry.paid_amount || 0), 0);
    const totalOut = entries.filter(entry => ['out', 'payable'].includes(String(entry.type))).reduce((sum, entry) => sum + Number(entry.paid_amount || 0), 0);
    const pendingCount = selectRows("SELECT id FROM financial_entries WHERE company_id = ? AND store_id = ? AND status IN ('pending', 'partially_paid', 'overdue')", [companyId, storeId]).length;
    const unreconciledCount = entries.filter(entry => Number(entry.is_reconciled || 0) !== 1).length;
    const cashDifference = Number(request.body?.cash_difference || 0);
    if (!Number.isFinite(cashDifference)) return response.status(400).json({ data: null, error: { message: 'Diferença de caixa inválida.', code: 'INVALID_CASH_DIFFERENCE' } });
    const timestamp = now();
    const closingId = existingClosing?.id || newId();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('INSERT INTO financial_daily_closings (id, company_id, store_id, closing_date, total_in, total_out, cash_difference, pending_count, unreconciled_count, status, notes, closed_by, closed_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(company_id, store_id, closing_date) DO UPDATE SET total_in = excluded.total_in, total_out = excluded.total_out, cash_difference = excluded.cash_difference, pending_count = excluded.pending_count, unreconciled_count = excluded.unreconciled_count, status = excluded.status, notes = excluded.notes, closed_by = excluded.closed_by, closed_by_name = excluded.closed_by_name, created_at = excluded.created_at', [closingId, companyId, storeId, closingDate, Number(totalIn.toFixed(2)), Number(totalOut.toFixed(2)), Number(cashDifference.toFixed(2)), pendingCount, unreconciledCount, 'closed', request.body?.notes ? String(request.body.notes).slice(0, 500) : null, request.userId, actorName(request.userId), timestamp]);
    execute('INSERT INTO financial_entry_audits (id, company_id, store_id, entry_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), companyId, storeId, String(closingId), 'daily_closing_closed', JSON.stringify({ company_id: companyId, store_id: storeId, closing_date: closingDate, total_in: totalIn, total_out: totalOut, cash_difference: cashDifference, pending_count: pendingCount, unreconciled_count: unreconciledCount }), request.userId, String(request.profile?.name || request.profile?.email || 'Usuário atual'), timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: deserializeRow(selectRows('SELECT * FROM financial_daily_closings WHERE id = ?', [closingId])[0]), error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/reconciliation/match', requireAuth, (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'match_reconciliation')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para conciliar lançamentos financeiros.', code: '403' } });
    }
    const transactionId = String(request.body?.transaction_id || '');
    const entryId = String(request.body?.entry_id || '');
    const confidence = Number(request.body?.confidence ?? 1);
    if (!transactionId || !entryId || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return response.status(400).json({ data: null, error: { message: 'Transação, lançamento e confiança válidos são obrigatórios.', code: 'INVALID_RECONCILIATION' } });
    }
    const bankTransaction = selectRows('SELECT * FROM bank_transactions WHERE id = ? LIMIT 1', [transactionId])[0];
    const entry = selectRows('SELECT * FROM financial_entries WHERE id = ? LIMIT 1', [entryId])[0];
    if (!bankTransaction || !entry) return response.status(404).json({ data: null, error: { message: 'Transação bancária ou lançamento não encontrado.', code: 'NOT_FOUND' } });
    if (!rowInScope('bank_transactions', bankTransaction, request.profile) || !rowInScope('financial_entries', entry, request.profile)) {
      return response.status(403).json({ data: null, error: { message: 'Conciliação fora do seu escopo.', code: '403' } });
    }
    if (Number(bankTransaction.is_reconciled || 0) === 1 && String(bankTransaction.matched_entry_id || '') !== entryId) {
      return response.status(409).json({ data: null, error: { message: 'Esta transação bancária já está vinculada a outro lançamento.', code: 'ALREADY_RECONCILED' } });
    }
    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    const wasReconciled = Number(bankTransaction.is_reconciled || 0) === 1;
    execute('UPDATE bank_transactions SET matched_entry_id = ?, match_confidence = ?, is_reconciled = 1, reconciled_by = ?, reconciled_by_name = ?, reconciled_at = ? WHERE id = ?', [entryId, confidence, request.userId, actorName(request.userId), timestamp, transactionId]);
    execute('UPDATE financial_entries SET is_reconciled = 1, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE id = ?', [request.userId, actorName(request.userId), timestamp, entryId]);
    if (!wasReconciled && bankTransaction.reconciliation_id) {
      execute('UPDATE bank_reconciliations SET matched_manual = COALESCE(matched_manual, 0) + 1, pending = MAX(COALESCE(pending, 0) - 1, 0) WHERE id = ?', [bankTransaction.reconciliation_id]);
    }
    const snapshot = { bank_transaction_id: transactionId, entry_id: entryId, confidence, matched_by: request.userId, matched_at: timestamp };
    execute('INSERT INTO financial_entry_audits (id, company_id, store_id, customer_id, entry_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), entry.company_id, entry.store_id || null, entry.customer_id || null, entryId, 'reconciled', JSON.stringify(snapshot), request.userId || null, request.profile?.name || request.profile?.email || 'Usuário atual', timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: { transaction_id: transactionId, entry_id: entryId, reconciled: true }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/manual-entry', requireAuth, (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'create_entry')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para criar lançamentos financeiros.', code: '403' } });
    const input = { ...(request.body?.entry || {}) } as Record<string, unknown>;
    const type = String(input.type || '');
    const amount = Number(input.amount);
    if (!['in', 'out', 'receivable', 'payable'].includes(type) || !Number.isFinite(amount) || amount <= 0 || !input.company_id || !input.store_id) return response.status(400).json({ data: null, error: { message: 'Empresa, loja, tipo e valor válidos são obrigatórios.', code: 'INVALID_MANUAL_ENTRY' } });
    if (['receivable', 'payable'].includes(type) && String(input.status || 'pending') === 'paid') return response.status(400).json({ data: null, error: { message: 'Contas manuais a pagar ou receber devem ser baixadas pela operação de baixa.', code: 'INVALID_MANUAL_STATUS' } });
    if (!scopeInput('financial_entries', input, request.profile)) return response.status(403).json({ data: null, error: { message: 'Lançamento fora do escopo permitido.', code: '403' } });
    const id = String(input.id || newId());
    const createdAt = String(input.created_at || now());
    const responsibleName = String(request.profile?.name || request.profile?.email || 'Usuário atual');
    const row = { ...input, id, created_at: createdAt, amount: Number(amount.toFixed(2)), origin_table: 'manual', created_by: request.userId, created_by_name: responsibleName, updated_by: request.userId, updated_by_name: responsibleName, audit_log: { ...(parseAuditLog(input.audit_log) || {}), created_by: request.userId || null, created_by_name: responsibleName, created_at: createdAt, changes: Array.isArray(parseAuditLog(input.audit_log)?.changes) ? parseAuditLog(input.audit_log)?.changes : [] } };
    const columns = tableColumns('financial_entries');
    const validEntries = Object.entries(row).filter(([key]) => columns.has(key));
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute(`INSERT INTO financial_entries (${validEntries.map(([key]) => quoteIdentifier(key)).join(', ')}) VALUES (${validEntries.map(() => '?').join(', ')})`, validEntries.map(([key, value]) => serializeValue(key, value)));
    if (String(row.approval_status || '') === 'pending_approval') execute('INSERT INTO financial_approvals (id, company_id, store_id, entry_id, status, requested_by, requested_by_name, requested_at, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), row.company_id, row.store_id || null, id, 'pending', request.userId, responsibleName, createdAt, row.payment_note || null, createdAt]);
    addFinancialAudit(row, 'created_manual', { status: row.status || 'pending', approval_status: row.approval_status || 'approved', recurring: Boolean(row.is_recurring) }, request, createdAt);
    if (row.status === 'paid' && ['in', 'out'].includes(type) && row.store_id) {
      const register = selectRows("SELECT * FROM cash_registers WHERE store_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1", [row.store_id])[0];
      if (register) {
        const existingMovements = selectRows('SELECT type, amount FROM cash_register_movements WHERE cash_register_id = ?', [register.id]);
        const currentBalance = cashBalanceFromMovements(existingMovements);
        if (type === 'out' && amount > currentBalance + 0.001) throw new Error('A saída manual não pode ser maior que o saldo atual do caixa aberto.');
        execute('INSERT INTO cash_register_movements (id, cash_register_id, type, amount, description, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [newId(), register.id, type === 'in' ? 'sale' : 'withdrawal', Number(amount.toFixed(2)), String(row.description || 'Lançamento manual').slice(0, 500), request.userId, actorName(request.userId), createdAt]);
      }
    }
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: relationRows('financial_entries', deserializeRow(selectRows('SELECT * FROM financial_entries WHERE id = ?', [id])[0]), '*'), error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

function nextFixedCostDate(dateValue: string, frequency: string, intervalValue: unknown) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const interval = Math.max(1, Math.floor(Number(intervalValue || 1)));
  if (frequency === 'weekly') date.setDate(date.getDate() + interval * 7);
  else if (frequency === 'yearly') date.setFullYear(date.getFullYear() + interval);
  else if (frequency === 'daily') date.setDate(date.getDate() + interval);
  else date.setMonth(date.getMonth() + interval);
  return date.toISOString().slice(0, 10);
}

app.post('/api/operations/financial/fixed-costs/:id/adjust', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'manage_fixed_costs')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para reajustar custos fixos.', code: '403' } });
    const costId = String(request.params.id || '');
    const cost = selectRows('SELECT * FROM fixed_costs WHERE id = ? LIMIT 1', [costId])[0];
    if (!cost) return response.status(404).json({ data: null, error: { message: 'Custo fixo não encontrado.', code: 'NOT_FOUND' } });
    if (!rowInScope('fixed_costs', cost, request.profile)) return response.status(403).json({ data: null, error: { message: 'Custo fixo fora do seu escopo.', code: '403' } });
    const percent = Number(request.body?.percent === undefined ? cost.annual_adjustment_percent || 0 : request.body.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 1000) return response.status(400).json({ data: null, error: { message: 'Informe um percentual de reajuste entre 0 e 1000.', code: 'INVALID_ADJUSTMENT' } });
    const oldAmount = Number(cost.amount || 0);
    const newAmount = Number((oldAmount * (1 + percent / 100)).toFixed(2));
    if (!Number.isFinite(newAmount) || newAmount <= 0) return response.status(400).json({ data: null, error: { message: 'O novo valor calculado é inválido.', code: 'INVALID_ADJUSTMENT_AMOUNT' } });
    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('UPDATE fixed_costs SET amount = ?, annual_adjustment_percent = ?, last_adjustment_at = ?, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE id = ?', [newAmount, Number(percent.toFixed(2)), timestamp, request.userId, actorName(request.userId), timestamp, costId]);
    execute('INSERT INTO financial_entry_audits (id, company_id, store_id, entry_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), cost.company_id, cost.store_id, costId, 'fixed_cost_adjusted', JSON.stringify({ before_amount: oldAmount, after_amount: newAmount, percent, adjusted_at: timestamp }), request.userId, String(request.profile?.name || request.profile?.email || 'Usuário atual'), timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: deserializeRow(selectRows('SELECT * FROM fixed_costs WHERE id = ?', [costId])[0]), error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 400);
    return response.status(statusCode).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/financial/fixed-costs/:id/payments', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'manage_fixed_costs')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para registrar pagamentos de custos fixos.', code: '403' } });
    const fixedCostId = String(request.params.id);
    const cost = selectRows('SELECT * FROM fixed_costs WHERE id = ? LIMIT 1', [fixedCostId])[0];
    if (!cost) return response.status(404).json({ data: null, error: { message: 'Custo fixo não encontrado.', code: 'NOT_FOUND' } });
    if (!rowInScope('fixed_costs', cost, request.profile)) return response.status(403).json({ data: null, error: { message: 'Custo fixo fora do seu escopo.', code: '403' } });
    const amount = Number(request.body?.amount);
    const paymentDate = String(request.body?.payment_date || now()).slice(0, 10);
    const paymentMethod = request.body?.payment_method ? String(request.body.payment_method) : null;
    const note = request.body?.note ? String(request.body.note).slice(0, 500) : null;
    if (!Number.isFinite(amount) || amount <= 0) return response.status(400).json({ data: null, error: { message: 'Informe um valor de pagamento válido.', code: 'INVALID_AMOUNT' } });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return response.status(400).json({ data: null, error: { message: 'Data de pagamento inválida.', code: 'INVALID_DATE' } });
    const paymentId = newId();
    const financialEntryId = newId();
    const timestamp = now();
    const nextDueDate = nextFixedCostDate(paymentDate, String(cost.frequency || 'monthly'), cost.interval);
    const auditLog = { created_by: request.userId || null, created_by_name: actorName(request.userId), created_at: timestamp, changes: [], origin: 'fixed_cost_payment' };
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('INSERT INTO fixed_cost_payments (id, fixed_cost_id, company_id, store_id, amount, payment_date, payment_method, note, financial_entry_id, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [paymentId, fixedCostId, cost.company_id, cost.store_id, Number(amount.toFixed(2)), paymentDate, paymentMethod, note, financialEntryId, request.userId, actorName(request.userId), timestamp]);
    execute('INSERT INTO financial_entries (id, company_id, store_id, type, description, amount, due_date, payment_date, status, category, category_id, payment_method, payment_note, origin_table, origin_id, supplier_customer_name, cost_center, paid_amount, audit_log, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [financialEntryId, cost.company_id, cost.store_id, 'payable', `${cost.name} · pagamento`, Number(amount.toFixed(2)), paymentDate, paymentDate, 'paid', cost.category_id ? null : 'Custos Fixos', cost.category_id || null, paymentMethod, note, 'fixed_cost_payments', paymentId, cost.name, cost.cost_center || 'Operacional', Number(amount.toFixed(2)), JSON.stringify(auditLog), request.userId, timestamp, timestamp]);
    execute('UPDATE fixed_costs SET payment_count = COALESCE(payment_count, 0) + 1, last_paid_at = ?, next_due_date = ?, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE id = ?', [paymentDate, nextDueDate, request.userId, actorName(request.userId), timestamp, fixedCostId]);
    execute('UPDATE financial_entries SET created_by_name = ?, settled_by = ?, settled_by_name = ?, settled_at = ? WHERE id = ?', [actorName(request.userId), request.userId, actorName(request.userId), timestamp, financialEntryId]);
    execute('INSERT INTO financial_entry_audits (id, company_id, store_id, entry_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), cost.company_id, cost.store_id, financialEntryId, 'fixed_cost_payment_created', JSON.stringify({ fixed_cost_id: fixedCostId, amount, payment_date: paymentDate, payment_method: paymentMethod, note }), request.userId, String(request.profile?.name || request.profile?.email || ''), timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: { payment: deserializeRow(selectRows('SELECT * FROM fixed_cost_payments WHERE id = ?', [paymentId])[0]), entry: deserializeRow(selectRows('SELECT * FROM financial_entries WHERE id = ?', [financialEntryId])[0]) }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/cash/registers/open', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'open_cash')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para abrir caixas.', code: '403' } });
    const storeId = String(request.body?.store_id || '');
    const openingBalance = Number(request.body?.opening_balance);
    const store = selectRows('SELECT id, company_id FROM stores WHERE id = ? LIMIT 1', [storeId])[0];
    if (!store || !rowInScope('cash_registers', { company_id: store.company_id, store_id: storeId }, request.profile)) return response.status(403).json({ data: null, error: { message: 'Loja fora do seu escopo.', code: '403' } });
    if (!Number.isFinite(openingBalance) || openingBalance < 0) return response.status(400).json({ data: null, error: { message: 'Saldo inicial inválido.', code: 'INVALID_AMOUNT' } });
    if (selectRows("SELECT id FROM cash_registers WHERE store_id = ? AND status = 'open' LIMIT 1", [storeId]).length > 0) return response.status(409).json({ data: null, error: { message: 'Já existe um caixa aberto para esta loja.', code: 'OPEN_REGISTER_EXISTS' } });
    const registerId = newId();
    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('INSERT INTO cash_registers (id, company_id, store_id, user_id, opened_at, opening_balance, status, notes, opened_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [registerId, store.company_id, storeId, request.userId, timestamp, Number(openingBalance.toFixed(2)), 'open', request.body?.notes ? String(request.body.notes).slice(0, 500) : null, actorName(request.userId), timestamp]);
    execute('INSERT INTO cash_register_movements (id, cash_register_id, type, amount, description, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [newId(), registerId, 'opening', Number(openingBalance.toFixed(2)), 'Abertura de caixa', request.userId, actorName(request.userId), timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: deserializeRow(selectRows('SELECT * FROM cash_registers WHERE id = ?', [registerId])[0]), error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/cash/registers/:id/close', requireAuth, (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'close_cash')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para fechar caixas.', code: '403' } });
    const registerId = String(request.params.id || '');
    const actualBalance = Number(request.body?.actual_balance);
    const register = selectRows('SELECT * FROM cash_registers WHERE id = ? LIMIT 1', [registerId])[0];
    if (!register) return response.status(404).json({ data: null, error: { message: 'Caixa não encontrado.', code: 'NOT_FOUND' } });
    if (!rowInScope('cash_registers', register, request.profile)) return response.status(403).json({ data: null, error: { message: 'Caixa fora do seu escopo.', code: '403' } });
    if (String(register.status) !== 'open') return response.status(409).json({ data: null, error: { message: 'Este caixa já está fechado.', code: 'REGISTER_CLOSED' } });
    if (!Number.isFinite(actualBalance) || actualBalance < 0) return response.status(400).json({ data: null, error: { message: 'Saldo contado inválido.', code: 'INVALID_AMOUNT' } });
    const movements = selectRows('SELECT type, amount FROM cash_register_movements WHERE cash_register_id = ?', [registerId]);
    const expectedBalance = Number(cashBalanceFromMovements(movements).toFixed(2));
    const difference = Number((actualBalance - expectedBalance).toFixed(2));
    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('UPDATE cash_registers SET status = ?, closed_at = ?, closed_by = ?, closed_by_name = ?, expected_balance = ?, actual_balance = ?, difference = ?, notes = ? WHERE id = ?', ['closed', timestamp, request.userId, actorName(request.userId), expectedBalance, Number(actualBalance.toFixed(2)), difference, request.body?.notes ? String(request.body.notes).slice(0, 500) : register.notes || null, registerId]);
    execute('INSERT INTO cash_register_movements (id, cash_register_id, type, amount, description, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [newId(), registerId, 'closing', Number(actualBalance.toFixed(2)), `Fechamento de caixa - Diferença: R$ ${difference.toFixed(2)}`, request.userId, actorName(request.userId), timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: deserializeRow(selectRows('SELECT * FROM cash_registers WHERE id = ?', [registerId])[0]), error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/cash/movements', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'cash_movement')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para movimentar caixas.', code: '403' } });
    const registerId = String(request.body?.cash_register_id || '');
    const type = String(request.body?.type || '');
    const amount = Number(request.body?.amount);
    const register = selectRows('SELECT * FROM cash_registers WHERE id = ? LIMIT 1', [registerId])[0];
    if (!register) return response.status(404).json({ data: null, error: { message: 'Caixa não encontrado.', code: 'NOT_FOUND' } });
    if (!rowInScope('cash_registers', register, request.profile)) return response.status(403).json({ data: null, error: { message: 'Caixa fora do seu escopo.', code: '403' } });
    if (register.status !== 'open' || !['sale', 'withdrawal', 'reinforcement'].includes(type)) return response.status(400).json({ data: null, error: { message: 'Caixa aberto e tipo de movimento válido são obrigatórios.', code: 'INVALID_CASH_MOVEMENT' } });
    if (!Number.isFinite(amount) || amount <= 0) return response.status(400).json({ data: null, error: { message: 'Valor da movimentação inválido.', code: 'INVALID_AMOUNT' } });
    const movements = selectRows('SELECT type, amount FROM cash_register_movements WHERE cash_register_id = ?', [registerId]);
    const balance = cashBalanceFromMovements(movements);
    if (type === 'withdrawal' && amount > balance + 0.001) return response.status(409).json({ data: null, error: { message: 'A sangria não pode ser maior que o saldo atual do caixa.', code: 'INSUFFICIENT_CASH' } });
    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    const movementId = newId();
    execute('INSERT INTO cash_register_movements (id, cash_register_id, type, amount, description, payment_method, reference_id, reference_table, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [movementId, registerId, type, Number(amount.toFixed(2)), request.body?.description ? String(request.body.description).slice(0, 500) : null, request.body?.payment_method || null, request.body?.reference_id || null, request.body?.reference_table || null, request.userId, actorName(request.userId), timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: deserializeRow(selectRows('SELECT * FROM cash_register_movements WHERE id = ?', [movementId])[0]), error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/product-stock', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'products', 'manage_stock')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para movimentar estoque.', code: '403' } });
    }
    const productId = String(request.body?.product_id || '');
    const storeId = String(request.body?.store_id || '');
    const operation = String(request.body?.operation || 'in') as 'in' | 'out' | 'adjustment';
    const quantity = Number(request.body?.quantity || 0);
    const targetQuantity = Number(request.body?.target_quantity || 0);
    if (!productId || !storeId || !['in', 'out', 'adjustment'].includes(operation)) return response.status(400).json({ data: null, error: { message: 'Produto, loja e operação são obrigatórios.' } });
    if (!Number.isInteger(quantity) || quantity < 0 || (operation !== 'adjustment' && quantity === 0)) return response.status(400).json({ data: null, error: { message: 'Quantidade inválida.' } });
    if (operation === 'adjustment' && (!Number.isInteger(targetQuantity) || targetQuantity < 0)) return response.status(400).json({ data: null, error: { message: 'Saldo ajustado inválido.' } });
    const product = selectRows('SELECT id, name, company_id, min_stock, max_stock FROM products WHERE id = ? LIMIT 1', [productId])[0];
    const store = selectRows('SELECT id, name, company_id FROM stores WHERE id = ? LIMIT 1', [storeId])[0];
    if (!product || !store || String(product.company_id) !== String(store.company_id)) return response.status(400).json({ data: null, error: { message: 'Produto ou loja inválidos.' } });
    if (!rowInScope('product_stock', { company_id: product.company_id, store_id: storeId }, request.profile)) return response.status(403).json({ data: null, error: { message: 'Estoque fora do seu escopo.', code: '403' } });
    const current = selectRows('SELECT * FROM product_stock WHERE product_id = ? AND store_id = ? LIMIT 1', [productId, storeId])[0];
    const before = Number(current?.quantity || 0);
    const reservedBefore = Number(current?.reserved_quantity || 0);
    const availableBefore = Math.max(before - reservedBefore, 0);
    const delta = operation === 'adjustment' ? targetQuantity - before : operation === 'in' ? quantity : -quantity;
    const after = before + delta;
    if (operation === 'out' && quantity > availableBefore) return response.status(409).json({ data: null, error: { message: `Estoque disponível insuficiente para ${product.name}. Disponível: ${availableBefore}.`, code: 'INSUFFICIENT_AVAILABLE_STOCK' } });
    if (operation === 'adjustment' && targetQuantity < reservedBefore) return response.status(409).json({ data: null, error: { message: `O novo saldo não pode ser menor que o estoque reservado (${reservedBefore}).`, code: 'STOCK_BELOW_RESERVED' } });
    if (after < 0) return response.status(409).json({ data: null, error: { message: `Estoque insuficiente para ${product.name}.`, code: 'INSUFFICIENT_STOCK' } });
    const timestamp = now();
    const unitCost = hasModulePermission(request.profile, 'products', 'view_cost') ? Number(request.body?.unit_cost || 0) : null;
    getDatabase().run('BEGIN');
    transactionStarted = true;
    if (current) {
      execute('UPDATE product_stock SET quantity = ?, updated_at = ? WHERE id = ?', [after, timestamp, current.id]);
    } else {
      execute('INSERT INTO product_stock (id, product_id, store_id, quantity, min_quantity, max_quantity, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [newId(), productId, storeId, after, Number(product.min_stock || 0), product.max_stock == null ? null : Number(product.max_stock), timestamp, timestamp]);
    }
    const movementId = newId();
    execute('INSERT INTO product_movements (id, product_id, store_id, type, quantity, quantity_before, quantity_after, unit_cost, document_number, supplier_name, reason, reference_type, description, user_id, product_name, store_name, user_name, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [movementId, productId, storeId, operation, delta, before, after, unitCost, request.body?.document_number ? String(request.body.document_number) : null, request.body?.supplier_name ? String(request.body.supplier_name) : null, request.body?.reason ? String(request.body.reason) : null, 'manual', request.body?.reason ? String(request.body.reason) : `Movimentação manual de ${product.name}`, request.userId, product.name, store.name, request.profile?.name || 'Usuário atual', timestamp, timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: { id: movementId, product_id: productId, store_id: storeId, quantity: delta, quantity_before: before, quantity_after: after, type: operation }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/product-stock/reservation', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'products', 'manage_stock')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para reservar estoque.', code: '403' } });
    const productId = String(request.body?.product_id || '');
    const storeId = String(request.body?.store_id || '');
    const operation = String(request.body?.operation || 'reserve') as 'reserve' | 'release';
    const quantity = Number(request.body?.quantity || 0);
    if (!productId || !storeId || !['reserve', 'release'].includes(operation) || !Number.isInteger(quantity) || quantity <= 0) return response.status(400).json({ data: null, error: { message: 'Produto, loja, operação e quantidade válida são obrigatórios.' } });
    const product = selectRows('SELECT id, name, company_id FROM products WHERE id = ? LIMIT 1', [productId])[0];
    const store = selectRows('SELECT id, name, company_id FROM stores WHERE id = ? LIMIT 1', [storeId])[0];
    if (!product || !store || String(product.company_id) !== String(store.company_id)) return response.status(400).json({ data: null, error: { message: 'Produto ou loja inválidos.' } });
    if (!rowInScope('product_stock', { company_id: product.company_id, store_id: storeId }, request.profile)) return response.status(403).json({ data: null, error: { message: 'Reserva fora do seu escopo.', code: '403' } });
    const current = selectRows('SELECT * FROM product_stock WHERE product_id = ? AND store_id = ? LIMIT 1', [productId, storeId])[0];
    const physical = Number(current?.quantity || 0); const reserved = Number(current?.reserved_quantity || 0);
    const nextReserved = operation === 'reserve' ? reserved + quantity : reserved - quantity;
    if (operation === 'reserve' && quantity > physical - reserved) return response.status(409).json({ data: null, error: { message: `Disponível para reserva: ${Math.max(physical - reserved, 0)} unidade(s).`, code: 'INSUFFICIENT_AVAILABLE_STOCK' } });
    if (operation === 'release' && nextReserved < 0) return response.status(409).json({ data: null, error: { message: `Reserva atual insuficiente: ${reserved} unidade(s).`, code: 'INSUFFICIENT_RESERVED_STOCK' } });
    const timestamp = now();
    getDatabase().run('BEGIN'); transactionStarted = true;
    if (current) execute('UPDATE product_stock SET reserved_quantity = ?, updated_at = ? WHERE id = ?', [nextReserved, timestamp, current.id]);
    else if (operation === 'release') throw new Error('Não há reserva registrada para liberar.');
    else execute('INSERT INTO product_stock (id, product_id, store_id, quantity, reserved_quantity, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId(), productId, storeId, physical, nextReserved, timestamp, timestamp]);
    execute('INSERT INTO product_movements (id, product_id, store_id, type, quantity, quantity_before, quantity_after, reserved_before, reserved_after, reference_type, description, user_id, product_name, store_name, user_name, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), productId, storeId, operation, operation === 'reserve' ? quantity : -quantity, physical, physical, reserved, nextReserved, 'reservation', request.body?.description ? String(request.body.description).slice(0, 500) : `${operation === 'reserve' ? 'Reserva' : 'Liberação de reserva'} de ${quantity} unidade(s)`, request.userId, product.name, store.name, actorName(request.userId), timestamp, timestamp]);
    getDatabase().run('COMMIT'); transactionStarted = false; persistDatabase();
    return response.status(201).json({ data: { product_id: productId, store_id: storeId, operation, quantity, reserved_before: reserved, reserved_after: nextReserved, available_after: physical - nextReserved }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/product-stock/transfer', requireAuth, (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'products', 'manage_stock')) return response.status(403).json({ data: null, error: { message: 'Sem permissão para transferir estoque.', code: '403' } });
    const productId = String(request.body?.product_id || '');
    const sourceStoreId = String(request.body?.source_store_id || '');
    const targetStoreId = String(request.body?.target_store_id || '');
    const quantity = Number(request.body?.quantity || 0);
    const product = selectRows('SELECT id, name, company_id FROM products WHERE id = ? LIMIT 1', [productId])[0];
    const sourceStore = selectRows('SELECT id, name, company_id FROM stores WHERE id = ? LIMIT 1', [sourceStoreId])[0];
    const targetStore = selectRows('SELECT id, name, company_id FROM stores WHERE id = ? LIMIT 1', [targetStoreId])[0];
    if (!product || !sourceStore || !targetStore || String(product.company_id) !== String(sourceStore.company_id) || String(sourceStore.company_id) !== String(targetStore.company_id)) return response.status(400).json({ data: null, error: { message: 'Produto, origem ou destino inválidos.' } });
    if (sourceStoreId === targetStoreId || !Number.isInteger(quantity) || quantity <= 0) return response.status(400).json({ data: null, error: { message: 'Origem, destino e quantidade precisam ser válidos.' } });
    if (!rowInScope('product_stock', { company_id: product.company_id, store_id: sourceStoreId }, request.profile) || !rowInScope('product_stock', { company_id: product.company_id, store_id: targetStoreId }, request.profile)) return response.status(403).json({ data: null, error: { message: 'Transferência fora do seu escopo.', code: '403' } });
    const source = selectRows('SELECT * FROM product_stock WHERE product_id = ? AND store_id = ? LIMIT 1', [productId, sourceStoreId])[0];
    const target = selectRows('SELECT * FROM product_stock WHERE product_id = ? AND store_id = ? LIMIT 1', [productId, targetStoreId])[0];
    const sourceBefore = Number(source?.quantity || 0);
    const sourceReserved = Number(source?.reserved_quantity || 0);
    const sourceAvailable = Math.max(sourceBefore - sourceReserved, 0);
    const targetBefore = Number(target?.quantity || 0);
    if (sourceAvailable < quantity) return response.status(409).json({ data: null, error: { message: `Estoque disponível insuficiente na origem para ${product.name}. Disponível: ${sourceAvailable}.`, code: 'INSUFFICIENT_AVAILABLE_STOCK' } });
    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    if (source) execute('UPDATE product_stock SET quantity = ?, updated_at = ? WHERE id = ?', [sourceBefore - quantity, timestamp, source.id]);
    else throw new Error('Estoque de origem não encontrado.');
    if (target) execute('UPDATE product_stock SET quantity = ?, updated_at = ? WHERE id = ?', [targetBefore + quantity, timestamp, target.id]);
    else execute('INSERT INTO product_stock (id, product_id, store_id, quantity, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)', [newId(), productId, targetStoreId, targetBefore + quantity, timestamp, timestamp]);
    const description = request.body?.description ? String(request.body.description) : `Transferência para ${targetStore.name}`;
    const reverseDescription = request.body?.description ? String(request.body.description) : `Transferência de ${sourceStore.name}`;
    execute('INSERT INTO product_movements (id, product_id, store_id, type, quantity, quantity_before, quantity_after, reference_type, description, user_id, product_name, store_name, user_name, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), productId, sourceStoreId, 'transfer', -quantity, sourceBefore, sourceBefore - quantity, 'manual', description, request.userId, product.name, sourceStore.name, request.profile?.name || 'Usuário atual', timestamp, timestamp]);
    execute('INSERT INTO product_movements (id, product_id, store_id, type, quantity, quantity_before, quantity_after, reference_type, description, user_id, product_name, store_name, user_name, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), productId, targetStoreId, 'transfer', quantity, targetBefore, targetBefore + quantity, 'manual', reverseDescription, request.userId, product.name, targetStore.name, request.profile?.name || 'Usuário atual', timestamp, timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.status(201).json({ data: { product_id: productId, quantity, source_store_id: sourceStoreId, target_store_id: targetStoreId }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

const SERVICE_ORDER_STATUS_LABELS: Record<string, string> = {
  opened: 'Em preparação', waiting_lab: 'Aguardando laboratório', in_production: 'Em produção', ready: 'Pronta', delivered: 'Entregue', cancelled: 'Cancelada',
};
const SERVICE_ORDER_STATUS_FLOW = ['opened', 'waiting_lab', 'in_production', 'ready', 'delivered', 'cancelled'];

function serviceOrderStatusLabel(status: unknown) {
  return SERVICE_ORDER_STATUS_LABELS[String(status || '')] || String(status || 'Sem status');
}

app.patch('/api/operations/service-orders/:id/status', requireAuth, (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    if (!canAccessTable(request, 'service_orders', 'update')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para alterar o status da O.S.', code: '403' } });
    }
    const orderId = String(request.params.id || '');
    const nextStatus = String(request.body?.status || '').trim();
    if (!SERVICE_ORDER_STATUS_FLOW.includes(nextStatus)) {
      return response.status(400).json({ data: null, error: { message: 'Etapa de O.S. inválida.', code: 'INVALID_SERVICE_ORDER_STATUS' } });
    }
    const order = selectRows('SELECT * FROM service_orders WHERE id = ? LIMIT 1', [orderId])[0];
    if (!order) return response.status(404).json({ data: null, error: { message: 'O.S. não encontrada.', code: '404' } });
    if (!rowInScope('service_orders', order, request.profile)) {
      return response.status(403).json({ data: null, error: { message: 'O.S. fora do escopo permitido.', code: '403' } });
    }
    const previousStatus = String(order.status || 'opened');
    if (previousStatus === nextStatus) {
      return response.json({ data: { id: orderId, previous_status: previousStatus, status: nextStatus, changed: false }, error: null });
    }
    const timestamp = now();
    const userName = String(request.profile?.name || request.profile?.email || 'Usuário atual');
    getDatabase().run('BEGIN');
    transactionStarted = true;
    execute('UPDATE service_orders SET status = ? WHERE id = ?', [nextStatus, orderId]);
    const timelineId = newId();
    execute('INSERT INTO service_order_timeline (id, service_order_id, action, user_name, user_id, status, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [timelineId, orderId, `Status alterado de ${serviceOrderStatusLabel(previousStatus)} para ${serviceOrderStatusLabel(nextStatus)}`, userName, request.userId, nextStatus, timestamp, timestamp]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: { id: orderId, previous_status: previousStatus, status: nextStatus, changed: true, changed_by: userName, changed_at: timestamp, timeline_id: timelineId }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

type FinancialDeletionEntry = Record<string, unknown>;

function isCustomerReceivable(entry: FinancialDeletionEntry) {
  return entry.type === 'receivable' && entry.origin_table === 'customers' && Boolean(entry.customer_id);
}

function financialEntrySnapshot(entry: FinancialDeletionEntry) {
  return JSON.stringify({
    id: entry.id,
    description: entry.description,
    amount: Number(entry.amount || 0),
    paid_amount: Number(entry.paid_amount || 0),
    remaining_amount: Math.max(Number(entry.amount || 0) - Number(entry.paid_amount || 0), 0),
    due_date: entry.due_date || null,
    payment_date: entry.payment_date || null,
    payment_method: entry.payment_method || null,
    payment_note: entry.payment_note || null,
    status: entry.status || null,
    company_id: entry.company_id,
    store_id: entry.store_id,
    customer_id: entry.customer_id,
    supplier_customer_name: entry.supplier_customer_name || null,
    origin_table: entry.origin_table,
    origin_id: entry.origin_id || null,
  });
}

function auditFinancialDeletion(entry: FinancialDeletionEntry, action: 'delete_entry' | 'delete_installment' | 'delete_credit_book', carneId: string | null, request: AuthenticatedRequest, timestamp: string) {
  execute(
    'INSERT INTO financial_entry_audits (id, company_id, store_id, customer_id, entry_id, carne_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [newId(), entry.company_id, entry.store_id || null, entry.customer_id || null, entry.id, carneId, action, financialEntrySnapshot(entry), request.userId || null, String(request.profile?.name || request.profile?.email || 'Usuário atual'), timestamp],
  );
}

app.delete('/api/operations/financial/:id', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'delete_entry')) return response.status(403).json({ data: null, error: { message: 'Sem permissão específica para excluir lançamento.', code: 'FINANCIAL_DELETE_ENTRY_FORBIDDEN' } });
    const entryId = String(request.params.id || '');
    const entry = selectRows('SELECT * FROM financial_entries WHERE id = ? LIMIT 1', [entryId])[0] as FinancialDeletionEntry | undefined;
    const reason = String(request.body?.reason || '').trim().slice(0, 500);
    if (!entry) return response.status(404).json({ data: null, error: { message: 'Lançamento não encontrado.', code: 'FINANCIAL_ENTRY_NOT_FOUND' } });
    if (!rowInScope('financial_entries', entry, request.profile)) return response.status(403).json({ data: null, error: { message: 'Lançamento fora do escopo permitido.', code: '403' } });
    if (!reason) return response.status(400).json({ data: null, error: { message: 'Informe o motivo da exclusão.', code: 'FINANCIAL_DELETE_REASON_REQUIRED' } });
    if (['sales', 'service_orders', 'customers'].includes(String(entry.origin_table || ''))) return response.status(409).json({ data: null, error: { message: 'Lançamentos originados de Venda, O.S. ou Carnê não podem ser excluídos por esta tela.', code: 'FINANCIAL_ENTRY_ORIGIN_LOCKED' } });
    const linkedReversals = selectRows("SELECT id FROM financial_entries WHERE origin_table = 'financial_reversal' AND reversed_entry_id = ? LIMIT 1", [entryId]);
    if (linkedReversals.length > 0) return response.status(409).json({ data: null, error: { message: 'Exclua primeiro o estorno associado a este lançamento.', code: 'FINANCIAL_ENTRY_HAS_REVERSAL' } });
    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    auditFinancialDeletion(entry, 'delete_entry', null, request, timestamp);
    execute('DELETE FROM financial_entries WHERE id = ?', [entryId]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: { deleted_count: 1, entry_id: entryId, deleted_at: timestamp, reason }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.delete('/api/operations/financial/installments/:id', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'delete_installment')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão específica para excluir parcela.', code: 'FINANCIAL_DELETE_INSTALLMENT_FORBIDDEN' } });
    }
    const entryId = String(request.params.id || '');
    const entry = selectRows('SELECT * FROM financial_entries WHERE id = ? LIMIT 1', [entryId])[0] as FinancialDeletionEntry | undefined;
    if (!entry) return response.status(404).json({ data: null, error: { message: 'Parcela não encontrada.', code: 'FINANCIAL_INSTALLMENT_NOT_FOUND' } });
    if (!isCustomerReceivable(entry)) return response.status(409).json({ data: null, error: { message: 'Somente parcelas de carnê do cliente podem ser excluídas por esta operação.', code: 'FINANCIAL_INSTALLMENT_INVALID_ORIGIN' } });
    if (!rowInScope('financial_entries', entry, request.profile)) return response.status(403).json({ data: null, error: { message: 'Parcela fora do escopo permitido.', code: '403' } });

    const timestamp = now();
    const carneId = entry.origin_id ? String(entry.origin_id) : null;
    getDatabase().run('BEGIN');
    transactionStarted = true;
    auditFinancialDeletion(entry, 'delete_installment', carneId, request, timestamp);
    execute('DELETE FROM financial_entries WHERE id = ?', [entryId]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: { deleted_count: 1, entry_id: entryId, carne_id: carneId, customer_id: entry.customer_id, deleted_at: timestamp }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.delete('/api/operations/financial/credit-books/:id', requireAuth, (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    if (!hasModulePermission(request.profile, 'financial', 'delete_credit_book')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão específica para excluir carnê completo.', code: 'FINANCIAL_DELETE_CREDIT_BOOK_FORBIDDEN' } });
    }
    const carneId = String(request.params.id || '');
    const entries = selectRows(
      "SELECT * FROM financial_entries WHERE type = 'receivable' AND origin_table = 'customers' AND (origin_id = ? OR (origin_id IS NULL AND id = ?)) ORDER BY due_date ASC, created_at ASC",
      [carneId, carneId],
    ) as FinancialDeletionEntry[];
    if (entries.length === 0) return response.status(404).json({ data: null, error: { message: 'Carnê não encontrado.', code: 'FINANCIAL_CREDIT_BOOK_NOT_FOUND' } });
    if (entries.some(entry => !isCustomerReceivable(entry))) return response.status(409).json({ data: null, error: { message: 'O carnê possui registros financeiros incompatíveis.', code: 'FINANCIAL_CREDIT_BOOK_INVALID_ORIGIN' } });
    if (entries.some(entry => !rowInScope('financial_entries', entry, request.profile))) return response.status(403).json({ data: null, error: { message: 'Carnê fora do escopo permitido.', code: '403' } });
    const customerIds = new Set(entries.map(entry => String(entry.customer_id || '')));
    if (customerIds.size !== 1 || customerIds.has('')) return response.status(409).json({ data: null, error: { message: 'Não foi possível confirmar o cliente deste carnê.', code: 'FINANCIAL_CREDIT_BOOK_CUSTOMER_INVALID' } });

    const timestamp = now();
    getDatabase().run('BEGIN');
    transactionStarted = true;
    entries.forEach(entry => auditFinancialDeletion(entry, 'delete_credit_book', carneId, request, timestamp));
    execute("DELETE FROM financial_entries WHERE type = 'receivable' AND origin_table = 'customers' AND (origin_id = ? OR (origin_id IS NULL AND id = ?))", [carneId, carneId]);
    getDatabase().run('COMMIT');
    transactionStarted = false;
    persistDatabase();
    return response.json({ data: { deleted_count: entries.length, carne_id: carneId, customer_id: entries[0].customer_id, deleted_at: timestamp }, error: null });
  } catch (error) {
    if (transactionStarted) { try { getDatabase().run('ROLLBACK'); } catch { /* rollback best effort */ } }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

type FiscalDocumentStatus = 'draft' | 'validation_pending' | 'queued' | 'processing' | 'simulation' | 'authorized' | 'rejected' | 'communication_failed' | 'denied' | 'cancelled' | 'inutilized' | 'contingency';
const fiscalDocumentStatuses = new Set<FiscalDocumentStatus>(['draft', 'validation_pending', 'queued', 'processing', 'simulation', 'authorized', 'rejected', 'communication_failed', 'denied', 'cancelled', 'inutilized', 'contingency']);
const fiscalTypes = new Set(['NF-e', 'NFC-e', 'NFS-e']);
const fiscalOperations = new Set(['sale', 'service', 'entry', 'return', 'remittance', 'manual']);

function fiscalScopeAllowed(request: AuthenticatedRequest, companyId: string, storeId: string) {
  const company = selectRows('SELECT id FROM companies WHERE id = ? LIMIT 1', [companyId])[0];
  const store = selectRows('SELECT id, company_id FROM stores WHERE id = ? LIMIT 1', [storeId])[0];
  if (!company || !store || String(store.company_id) !== companyId) return false;
  return rowInScope('fiscal_documents', { company_id: companyId, store_id: storeId }, request.profile);
}

function fiscalPermission(request: AuthenticatedRequest, action: string) {
  return isMaster(request.profile) || hasModulePermission(request.profile, 'fiscal', action);
}

function fiscalForbidden(response: Response, message = 'Sem permissão para esta operação fiscal.') {
  return response.status(403).json({ data: null, error: { message, code: 'FISCAL_FORBIDDEN' } });
}

function fiscalConfigForScope(companyId: string, storeId: string) {
  return selectRows('SELECT * FROM fiscal_configs WHERE company_id = ? AND store_id = ? LIMIT 1', [companyId, storeId])[0];
}

function fiscalDocumentById(id: string) {
  return selectRows('SELECT * FROM fiscal_documents WHERE id = ? LIMIT 1', [id])[0];
}

function fiscalAudit(request: AuthenticatedRequest, companyId: string, storeId: string, documentId: string | null, action: string, snapshot: Record<string, unknown>, timestamp = now()) {
  execute(
    'INSERT INTO fiscal_audits (id, company_id, store_id, document_id, action, snapshot, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [newId(), companyId, storeId, documentId, action, JSON.stringify(snapshot), request.userId || null, actorName(request.userId), timestamp],
  );
}

function fiscalEvent(request: AuthenticatedRequest, documentId: string, eventType: string, status: string, message: string, justification?: string) {
  const timestamp = now();
  const document = fiscalDocumentById(documentId);
  if (!document) return null;
  const eventId = newId();
  execute(
    'INSERT INTO fiscal_events (id, document_id, event_type, status, justification, response_message, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [eventId, documentId, eventType, status, justification || null, message, request.userId || null, actorName(request.userId), timestamp],
  );
  fiscalAudit(request, String(document.company_id), String(document.store_id), documentId, eventType, { status, message, justification: justification || null }, timestamp);
  return selectRows('SELECT * FROM fiscal_events WHERE id = ? LIMIT 1', [eventId])[0];
}

function sanitizeFiscalDocument(row: Record<string, unknown>, profile?: Record<string, unknown>) {
  const sanitized = cleanRow(row);
  if (!hasModulePermission(profile, 'fiscal', 'view_protocol')) {
    delete sanitized.access_key;
    delete sanitized.protocol;
  }
  if (!hasModulePermission(profile, 'fiscal', 'view_xml')) {
    delete sanitized.xml_url;
  }
  return sanitized;
}

function fiscalDetail(documentId: string, profile?: Record<string, unknown>) {
  const document = fiscalDocumentById(documentId);
  if (!document) return null;
  const items = selectRows('SELECT * FROM fiscal_document_items WHERE document_id = ? ORDER BY created_at ASC', [documentId]).map((item) => {
    const output = cleanRow(item);
    try { output.tax_json = JSON.parse(String(output.tax_json || '{}')); } catch { output.tax_json = {}; }
    return output;
  });
  const events = selectRows('SELECT * FROM fiscal_events WHERE document_id = ? ORDER BY created_at ASC', [documentId]).map(cleanRow);
  const audits = hasModulePermission(profile, 'fiscal', 'view_audit')
    ? selectRows('SELECT * FROM fiscal_audits WHERE document_id = ? ORDER BY created_at ASC', [documentId]).map(cleanRow)
    : [];
  return { document: sanitizeFiscalDocument(document, profile), items, events, audits };
}

function fiscalListScope(request: AuthenticatedRequest, companyId?: string, storeId?: string) {
  return selectRows('SELECT * FROM fiscal_documents ORDER BY created_at DESC').filter((row) => {
    const matchesRequestedScope = (!companyId || String(row.company_id) === companyId) && (!storeId || String(row.store_id) === storeId);
    return matchesRequestedScope && rowInScope('fiscal_documents', row, request.profile);
  });
}

app.get('/api/operations/fiscal/config', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'view')) return fiscalForbidden(response);
  const companyId = String(request.query.company_id || '');
  const storeId = String(request.query.store_id || '');
  if (!companyId || !storeId || !fiscalScopeAllowed(request, companyId, storeId)) return response.status(403).json({ data: null, error: { message: 'Empresa ou loja fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
  return response.json({ data: fiscalConfigForScope(companyId, storeId) ? cleanRow(fiscalConfigForScope(companyId, storeId)) : null, error: null });
});

app.put('/api/operations/fiscal/config', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'configure')) return fiscalForbidden(response, 'Sem permissão para configurar o ambiente fiscal.');
  try {
    const companyId = String(request.body?.company_id || '').trim();
    const storeId = String(request.body?.store_id || '').trim();
    if (!companyId || !storeId || !fiscalScopeAllowed(request, companyId, storeId)) return response.status(403).json({ data: null, error: { message: 'Empresa ou loja fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    const environment = String(request.body?.environment || 'homologacao');
    if (!['homologacao', 'producao'].includes(environment)) return response.status(400).json({ data: null, error: { message: 'Ambiente fiscal inválido.', code: 'FISCAL_INVALID_ENVIRONMENT' } });
    const cnpj = String(request.body?.cnpj || '').replace(/\D/g, '');
    if (cnpj && cnpj.length !== 14) return response.status(400).json({ data: null, error: { message: 'O CNPJ precisa conter 14 dígitos.', code: 'FISCAL_INVALID_CNPJ' } });
    const timestamp = now();
    const existing = fiscalConfigForScope(companyId, storeId);
    const provider = String(request.body?.provider || '').trim();
    const taxRegime = String(request.body?.tax_regime || request.body?.regime || '').trim();
    const stateRegistration = String(request.body?.state_registration || '').trim();
    const municipalRegistration = String(request.body?.municipal_registration || '').trim();
    const nfceSeries = String(request.body?.nfce_series || '1').trim() || '1';
    const nfeSeries = String(request.body?.nfe_series || '1').trim() || '1';
    const nfseSeries = String(request.body?.nfse_series || '1').trim() || '1';
    if (existing) {
      execute('UPDATE fiscal_configs SET environment = ?, provider = ?, cnpj = ?, tax_regime = ?, state_registration = ?, municipal_registration = ?, nfce_series = ?, nfe_series = ?, nfse_series = ?, is_active = 1, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE id = ?', [environment, provider || null, cnpj || null, taxRegime || null, stateRegistration || null, municipalRegistration || null, nfceSeries, nfeSeries, nfseSeries, request.userId || null, actorName(request.userId), timestamp, existing.id]);
    } else {
      execute('INSERT INTO fiscal_configs (id, company_id, store_id, environment, provider, cnpj, tax_regime, state_registration, municipal_registration, nfce_series, nfe_series, nfse_series, is_active, updated_by, updated_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)', [newId(), companyId, storeId, environment, provider || null, cnpj || null, taxRegime || null, stateRegistration || null, municipalRegistration || null, nfceSeries, nfeSeries, nfseSeries, request.userId || null, actorName(request.userId), timestamp, timestamp]);
    }
    fiscalAudit(request, companyId, storeId, null, 'config_update', { environment, provider: provider || null, cnpj_configured: Boolean(cnpj), tax_regime: taxRegime || null, state_registration_configured: Boolean(stateRegistration), municipal_registration_configured: Boolean(municipalRegistration), nfce_series: nfceSeries, nfe_series: nfeSeries, nfse_series: nfseSeries }, timestamp);
    persistDatabase();
    return response.json({ data: cleanRow(fiscalConfigForScope(companyId, storeId) || {}), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.get('/api/operations/fiscal/documents', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'view')) return fiscalForbidden(response);
  const companyId = String(request.query.company_id || '') || undefined;
  const storeId = String(request.query.store_id || '') || undefined;
  if ((companyId && storeId && !fiscalScopeAllowed(request, companyId, storeId)) || (companyId && !profileCompanies(request.profile).includes(companyId) && !isMaster(request.profile))) return response.status(403).json({ data: null, error: { message: 'Empresa ou loja fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
  const status = String(request.query.status || '');
  const type = String(request.query.type || '');
  const term = String(request.query.search || '').trim().toLowerCase();
  const all = fiscalListScope(request, companyId, storeId).filter((row) => (!status || String(row.status) === status) && (!type || String(row.type) === type) && (!term || [row.number, row.series, row.customer_name, row.customer_document, row.origin_table, row.origin_id, row.access_key].some((value) => String(value || '').toLowerCase().includes(term))));
  const offset = Math.max(0, Math.floor(Number(request.query.offset || 0) || 0));
  const limitNumber = Number(request.query.limit || 0);
  const rows = limitNumber > 0 ? all.slice(offset, offset + Math.min(100, Math.floor(limitNumber))) : all.slice(offset);
  response.setHeader('X-Total-Count', String(all.length));
  return response.json({ data: rows.map((row) => sanitizeFiscalDocument(row, request.profile)), error: null });
});

app.get('/api/operations/fiscal/documents/:id', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'view')) return fiscalForbidden(response);
  const document = fiscalDocumentById(String(request.params.id));
  if (!document) return response.status(404).json({ data: null, error: { message: 'Documento fiscal não encontrado.', code: 'FISCAL_NOT_FOUND' } });
  if (!fiscalScopeAllowed(request, String(document.company_id), String(document.store_id))) return response.status(403).json({ data: null, error: { message: 'Documento fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
  return response.json({ data: fiscalDetail(String(document.id), request.profile), error: null });
});

app.post('/api/operations/fiscal/from-sales/:id', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'create')) return fiscalForbidden(response, 'Sem permissão para preparar documento fiscal a partir de venda.');
  try {
    const sale = selectRows('SELECT * FROM sales WHERE id = ? LIMIT 1', [request.params.id])[0];
    if (!sale) return response.status(404).json({ data: null, error: { message: 'Venda não encontrada.', code: 'SALE_NOT_FOUND' } });
    if (!fiscalScopeAllowed(request, String(sale.company_id), String(sale.store_id))) return response.status(403).json({ data: null, error: { message: 'Venda fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    if (String(sale.status) === 'cancelled') return response.status(409).json({ data: null, error: { message: 'Venda cancelada não pode originar nova nota fiscal.', code: 'FISCAL_CANCELLED_ORIGIN' } });
    const type = String(request.body?.type || 'NFC-e');
    if (!fiscalTypes.has(type) || type === 'NFS-e') return response.status(400).json({ data: null, error: { message: 'Venda de mercadoria deve originar NF-e ou NFC-e.', code: 'FISCAL_INVALID_SALE_TYPE' } });
    const idempotencyKey = `sale:${sale.id}:${type}`;
    const existing = selectRows('SELECT * FROM fiscal_documents WHERE idempotency_key = ? LIMIT 1', [idempotencyKey])[0];
    if (existing) return response.json({ data: fiscalDetail(String(existing.id), request.profile), error: null });
    const customer = sale.customer_id ? selectRows('SELECT name, cpf, cnpj FROM customers WHERE id = ? LIMIT 1', [sale.customer_id])[0] : undefined;
    const customerName = String(sale.customer_name || customer?.name || 'Consumidor não identificado');
    const config = fiscalConfigForScope(String(sale.company_id), String(sale.store_id));
    const series = String(request.body?.series || (type === 'NFC-e' ? config?.nfce_series : config?.nfe_series) || '1');
    const timestamp = now();
    const id = newId();
    execute('INSERT INTO fiscal_documents (id, company_id, store_id, type, operation, environment, series, number, status, customer_id, customer_name, customer_document, origin_table, origin_id, total, discount, notes, idempotency_key, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, sale.company_id, sale.store_id, type, 'sale', config?.environment || 'homologacao', series, 'draft', sale.customer_id || null, customerName, customer?.cnpj || customer?.cpf || sale.customer_document || null, 'sales', sale.id, Number(sale.total || 0), Number(sale.discount || 0), `Preparado a partir da venda ${sale.id}.`, idempotencyKey, request.userId || null, actorName(request.userId), timestamp, timestamp]);
    const items = selectRows('SELECT si.*, p.sku, p.barcode, p.ncm, p.cest, p.default_cfop, p.default_cst, p.default_csosn FROM sale_items si LEFT JOIN products p ON p.id = si.product_id WHERE si.sale_id = ? ORDER BY si.created_at ASC', [sale.id]);
    for (const item of items) execute('INSERT INTO fiscal_document_items (id, document_id, product_id, product_name, sku, barcode, ncm, cest, cfop, cst, csosn, quantity, unit_price, total_price, tax_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), id, item.product_id || null, String(item.product_name || 'Item da venda'), item.sku || null, item.barcode || null, item.ncm || null, item.cest || null, item.default_cfop || null, item.default_cst || null, item.default_csosn || null, Number(item.quantity || 1), Number(item.unit_price || 0), Number(item.total_price || 0), '{}', timestamp]);
    fiscalAudit(request, String(sale.company_id), String(sale.store_id), id, 'source_sale_linked', { origin_table: 'sales', origin_id: sale.id, item_count: items.length, total: Number(sale.total || 0) }, timestamp);
    persistDatabase();
    return response.status(201).json({ data: fiscalDetail(id, request.profile), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/fiscal/from-service-orders/:id', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!fiscalPermission(request, 'create')) return fiscalForbidden(response, 'Sem permissão para preparar documento fiscal a partir de O.S.');
  try {
    const order = selectRows('SELECT * FROM service_orders WHERE id = ? LIMIT 1', [request.params.id])[0];
    if (!order) return response.status(404).json({ data: null, error: { message: 'Ordem de serviço não encontrada.', code: 'SERVICE_ORDER_NOT_FOUND' } });
    if (!fiscalScopeAllowed(request, String(order.company_id), String(order.store_id))) return response.status(403).json({ data: null, error: { message: 'O.S. fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    const type = String(request.body?.type || 'NFS-e');
    if (type !== 'NFS-e') return response.status(400).json({ data: null, error: { message: 'O.S. deve originar uma NFS-e nesta etapa.', code: 'FISCAL_INVALID_SERVICE_TYPE' } });
    const idempotencyKey = `service_order:${order.id}:${type}`;
    const existing = selectRows('SELECT * FROM fiscal_documents WHERE idempotency_key = ? LIMIT 1', [idempotencyKey])[0];
    if (existing) return response.json({ data: fiscalDetail(String(existing.id), request.profile), error: null });
    const customer = order.customer_id ? selectRows('SELECT name, cpf, cnpj FROM customers WHERE id = ? LIMIT 1', [order.customer_id])[0] : undefined;
    const customerName = String(customer?.name || 'Tomador não identificado');
    const config = fiscalConfigForScope(String(order.company_id), String(order.store_id));
    const description = String(order.description || order.service_type || order.product_name || order.lens_name || 'Serviço óptico');
    const total = Number(order.total || 0);
    if (!Number.isFinite(total) || total <= 0) return response.status(409).json({ data: null, error: { message: 'A O.S. precisa ter valor maior que zero para preparar a NFS-e.', code: 'FISCAL_SERVICE_TOTAL_INVALID' } });
    const timestamp = now();
    const id = newId();
    execute('INSERT INTO fiscal_documents (id, company_id, store_id, type, operation, environment, series, number, status, customer_id, customer_name, customer_document, origin_table, origin_id, total, discount, notes, idempotency_key, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, order.company_id, order.store_id, type, 'service', config?.environment || 'homologacao', String(request.body?.series || config?.nfse_series || '1'), 'draft', order.customer_id || null, customerName, customer?.cnpj || customer?.cpf || null, 'service_orders', order.id, total, 0, `Preparado a partir da O.S. ${order.id}.`, idempotencyKey, request.userId || null, actorName(request.userId), timestamp, timestamp]);
    execute('INSERT INTO fiscal_document_items (id, document_id, product_id, product_name, quantity, unit_price, total_price, tax_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), id, order.product_id || null, description, Number(order.product_quantity || 1), total / Math.max(1, Number(order.product_quantity || 1)), total, '{}', timestamp]);
    fiscalAudit(request, String(order.company_id), String(order.store_id), id, 'source_service_order_linked', { origin_table: 'service_orders', origin_id: order.id, total }, timestamp);
    persistDatabase();
    return response.status(201).json({ data: fiscalDetail(id, request.profile), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/fiscal/documents', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  const manual = String(request.body?.operation || '').toLowerCase() === 'manual' || request.body?.manual === true;
  if (!fiscalPermission(request, manual ? 'create_manual' : 'create')) return fiscalForbidden(response, manual ? 'Sem permissão para criar documento fiscal manual.' : 'Sem permissão para criar documento fiscal.');
  try {
    const companyId = String(request.body?.company_id || '').trim();
    const storeId = String(request.body?.store_id || '').trim();
    if (!companyId || !storeId || !fiscalScopeAllowed(request, companyId, storeId)) return response.status(403).json({ data: null, error: { message: 'Empresa ou loja fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    const type = String(request.body?.type || '').trim();
    const operation = String(request.body?.operation || (type === 'NFS-e' ? 'service' : 'sale')).trim();
    if (!fiscalTypes.has(type) || !fiscalOperations.has(operation)) return response.status(400).json({ data: null, error: { message: 'Tipo ou operação fiscal inválida.', code: 'FISCAL_INVALID_DOCUMENT' } });
    const customerName = String(request.body?.customer_name || request.body?.customer || '').trim();
    const total = Number(request.body?.total || 0);
    if (!customerName || !Number.isFinite(total) || total <= 0) return response.status(400).json({ data: null, error: { message: 'Destinatário e valor total maior que zero são obrigatórios.', code: 'FISCAL_INVALID_TOTAL' } });
    const config = fiscalConfigForScope(companyId, storeId);
    const environment = String(request.body?.environment || config?.environment || 'homologacao');
    const series = String(request.body?.series || (type === 'NFC-e' ? config?.nfce_series : type === 'NFS-e' ? config?.nfse_series : config?.nfe_series) || '1');
    const timestamp = now();
    const id = newId();
    const idempotencyKey = String(request.body?.idempotency_key || request.headers['idempotency-key'] || `fiscal-draft:${id}`).trim();
    const existing = selectRows('SELECT * FROM fiscal_documents WHERE idempotency_key = ? LIMIT 1', [idempotencyKey])[0];
    if (existing) return response.status(200).json({ data: fiscalDetail(String(existing.id), request.profile), error: null });
    execute('INSERT INTO fiscal_documents (id, company_id, store_id, type, operation, environment, series, number, status, customer_id, customer_name, customer_document, origin_table, origin_id, total, discount, notes, idempotency_key, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, companyId, storeId, type, operation, environment, series, 'draft', request.body?.customer_id || null, customerName, String(request.body?.customer_document || '').replace(/\D/g, '') || null, request.body?.origin_table || null, request.body?.origin_id || null, total, Number(request.body?.discount || 0) || 0, String(request.body?.notes || request.body?.note || '').trim() || null, idempotencyKey, request.userId || null, actorName(request.userId), timestamp, timestamp]);
    const items = Array.isArray(request.body?.items) ? request.body.items : [];
    for (const rawItem of items) {
      const quantity = Math.max(1, Math.floor(Number(rawItem?.quantity || 1)));
      const unitPrice = Number(rawItem?.unit_price || rawItem?.unitPrice || 0) || 0;
      execute('INSERT INTO fiscal_document_items (id, document_id, product_id, product_name, sku, barcode, ncm, cest, cfop, cst, csosn, quantity, unit_price, total_price, tax_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), id, rawItem?.product_id || rawItem?.productId || null, String(rawItem?.product_name || rawItem?.productName || 'Item sem descrição'), rawItem?.sku || null, rawItem?.barcode || null, rawItem?.ncm || null, rawItem?.cest || null, rawItem?.cfop || null, rawItem?.cst || null, rawItem?.csosn || null, quantity, unitPrice, Number(rawItem?.total_price || rawItem?.totalPrice || unitPrice * quantity) || 0, JSON.stringify(rawItem?.tax_json || rawItem?.tax || {}), timestamp]);
    }
    fiscalAudit(request, companyId, storeId, id, 'draft_created', { type, operation, environment, series, customer_name: customerName, total, item_count: items.length, origin_table: request.body?.origin_table || null, origin_id: request.body?.origin_id || null }, timestamp);
    persistDatabase();
    return response.status(201).json({ data: fiscalDetail(id, request.profile), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.patch('/api/operations/fiscal/documents/:id', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'edit')) return fiscalForbidden(response, 'Sem permissão para editar documento fiscal.');
  try {
    const document = fiscalDocumentById(String(request.params.id));
    if (!document) return response.status(404).json({ data: null, error: { message: 'Documento fiscal não encontrado.', code: 'FISCAL_NOT_FOUND' } });
    if (!fiscalScopeAllowed(request, String(document.company_id), String(document.store_id))) return response.status(403).json({ data: null, error: { message: 'Documento fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    if (String(document.status) !== 'draft') return response.status(409).json({ data: null, error: { message: 'Somente rascunhos podem ser editados.', code: 'FISCAL_DOCUMENT_NOT_DRAFT' } });
    const customerName = request.body?.customer_name === undefined ? String(document.customer_name || '') : String(request.body.customer_name || '').trim();
    const total = request.body?.total === undefined ? Number(document.total || 0) : Number(request.body.total || 0);
    if (!customerName || !Number.isFinite(total) || total <= 0) return response.status(400).json({ data: null, error: { message: 'Destinatário e valor total maior que zero são obrigatórios.', code: 'FISCAL_INVALID_TOTAL' } });
    const timestamp = now();
    execute('UPDATE fiscal_documents SET customer_id = ?, customer_name = ?, customer_document = ?, total = ?, discount = ?, notes = ?, updated_at = ? WHERE id = ?', [request.body?.customer_id ?? document.customer_id ?? null, customerName, request.body?.customer_document === undefined ? document.customer_document ?? null : String(request.body.customer_document || '').replace(/\D/g, '') || null, total, request.body?.discount === undefined ? Number(document.discount || 0) : Number(request.body.discount || 0), request.body?.notes === undefined ? document.notes ?? null : String(request.body.notes || '').trim() || null, timestamp, document.id]);
    if (Array.isArray(request.body?.items)) {
      execute('DELETE FROM fiscal_document_items WHERE document_id = ?', [document.id]);
      for (const rawItem of request.body.items) {
        const quantity = Math.max(1, Math.floor(Number(rawItem?.quantity || 1)));
        const unitPrice = Number(rawItem?.unit_price || rawItem?.unitPrice || 0) || 0;
        execute('INSERT INTO fiscal_document_items (id, document_id, product_id, product_name, sku, barcode, ncm, cest, cfop, cst, csosn, quantity, unit_price, total_price, tax_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), document.id, rawItem?.product_id || rawItem?.productId || null, String(rawItem?.product_name || rawItem?.productName || 'Item sem descrição'), rawItem?.sku || null, rawItem?.barcode || null, rawItem?.ncm || null, rawItem?.cest || null, rawItem?.cfop || null, rawItem?.cst || null, rawItem?.csosn || null, quantity, unitPrice, Number(rawItem?.total_price || rawItem?.totalPrice || unitPrice * quantity) || 0, JSON.stringify(rawItem?.tax_json || rawItem?.tax || {}), timestamp]);
      }
    }
    fiscalAudit(request, String(document.company_id), String(document.store_id), String(document.id), 'draft_updated', { changed_fields: Object.keys(request.body || {}).filter((field) => !['items'].includes(field)) }, timestamp);
    persistDatabase();
    return response.json({ data: fiscalDetail(String(document.id), request.profile), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/fiscal/documents/:id/transmit', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'emit')) return fiscalForbidden(response, 'Sem permissão para emitir documento fiscal.');
  try {
    const document = fiscalDocumentById(String(request.params.id));
    if (!document) return response.status(404).json({ data: null, error: { message: 'Documento fiscal não encontrado.', code: 'FISCAL_NOT_FOUND' } });
    if (!fiscalScopeAllowed(request, String(document.company_id), String(document.store_id))) return response.status(403).json({ data: null, error: { message: 'Documento fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    if (!canTransitionFiscalStatus(String(document.status), 'queued')) return response.status(409).json({ data: null, error: { message: 'O documento não está em uma situação que permita novo envio.', code: 'FISCAL_INVALID_TRANSITION' } });
    const config = fiscalConfigForScope(String(document.company_id), String(document.store_id));
    if (!config || !Number(config.is_active ?? 1) || !String(config.provider || '').trim() || String(config.provider).trim() === 'Ainda não configurado') return response.status(409).json({ data: null, error: { message: 'Configure empresa, loja e provedor fiscal antes de transmitir.', code: 'FISCAL_PROVIDER_NOT_CONFIGURED' } });
    if (isProductionEnvironment(document.environment) || isProductionEnvironment(config.environment)) return response.status(409).json({ data: null, error: { message: 'A transmissão em produção está bloqueada até a integração oficial e homologada do provedor fiscal.', code: 'FISCAL_PRODUCTION_LOCKED' } });
    const provider = resolveFiscalProvider(String(config.provider));
    if (!provider) return response.status(409).json({ data: null, error: { message: 'O provedor informado ainda não possui adapter implementado no servidor local. Selecione a simulação local ou aguarde a integração homologada.', code: 'FISCAL_PROVIDER_NOT_IMPLEMENTED' } });
    const queuedAt = now();
    execute('UPDATE fiscal_documents SET status = ?, updated_at = ? WHERE id = ?', ['queued', queuedAt, document.id]);
    fiscalEvent(request, String(document.id), 'queued', 'queued', 'Documento colocado na fila local; nenhum provedor externo foi chamado.');
    const processingAt = now();
    if (!canTransitionFiscalStatus('queued', 'processing')) return response.status(409).json({ data: null, error: { message: 'Transição interna de processamento fiscal inválida.', code: 'FISCAL_INVALID_TRANSITION' } });
    execute('UPDATE fiscal_documents SET status = ?, updated_at = ? WHERE id = ?', ['processing', processingAt, document.id]);
    fiscalEvent(request, String(document.id), 'processing', 'processing', 'Documento em processamento pelo adapter local.');
    const result = provider.transmit({ documentId: String(document.id), type: String(document.type), operation: String(document.operation), environment: String(document.environment), provider: String(config.provider) });
    const timestamp = now();
    execute('UPDATE fiscal_documents SET status = ?, number = ?, access_key = ?, protocol = ?, error_code = NULL, error_message = ?, issued_at = ?, authorized_at = ?, updated_at = ? WHERE id = ?', [result.status, result.number || document.number || null, result.accessKey || document.access_key || null, result.protocol || document.protocol || null, result.message, timestamp, result.status === 'authorized' ? timestamp : null, timestamp, document.id]);
    fiscalEvent(request, String(document.id), 'transmission', result.status, result.message);
    fiscalAudit(request, String(document.company_id), String(document.store_id), String(document.id), 'transmit', { environment: document.environment, provider: provider.name, result_status: result.status }, timestamp);
    persistDatabase();
    return response.json({ data: fiscalDetail(String(document.id), request.profile), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/fiscal/documents/:id/resend', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'resend')) return fiscalForbidden(response, 'Sem permissão para reenviar documento fiscal.');
  const document = fiscalDocumentById(String(request.params.id));
  if (!document) return response.status(404).json({ data: null, error: { message: 'Documento fiscal não encontrado.', code: 'FISCAL_NOT_FOUND' } });
  if (!fiscalScopeAllowed(request, String(document.company_id), String(document.store_id))) return response.status(403).json({ data: null, error: { message: 'Documento fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
  if (String(document.status) !== 'simulation' && String(document.status) !== 'communication_failed') return response.status(409).json({ data: null, error: { message: 'Somente documentos simulados ou com falha de comunicação podem ser reenviados.', code: 'FISCAL_INVALID_TRANSITION' } });
  const timestamp = now();
  execute('UPDATE fiscal_documents SET status = ?, updated_at = ? WHERE id = ?', ['simulation', timestamp, document.id]);
  fiscalEvent(request, String(document.id), 'resend_simulation', 'simulated', 'Reenvio local simulado; nenhuma transmissão real foi realizada.');
  fiscalAudit(request, String(document.company_id), String(document.store_id), String(document.id), 'resend_simulation', {}, timestamp);
  persistDatabase();
  return response.json({ data: fiscalDetail(String(document.id), request.profile), error: null });
});

app.post('/api/operations/fiscal/documents/:id/events', requireAuth, (request: AuthenticatedRequest, response) => {
  const eventType = String(request.body?.event_type || '').trim();
  const permissionByEvent: Record<string, string> = { cancel: 'cancel', correction: 'correct', inutilization: 'inutilize' };
  const permission = permissionByEvent[eventType];
  if (!permission || !fiscalPermission(request, permission)) return fiscalForbidden(response, 'Sem permissão para este evento fiscal.');
  try {
    const document = fiscalDocumentById(String(request.params.id));
    if (!document) return response.status(404).json({ data: null, error: { message: 'Documento fiscal não encontrado.', code: 'FISCAL_NOT_FOUND' } });
    if (!fiscalScopeAllowed(request, String(document.company_id), String(document.store_id))) return response.status(403).json({ data: null, error: { message: 'Documento fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    const justification = String(request.body?.justification || '').trim();
    if (justification.length < 15) return response.status(400).json({ data: null, error: { message: 'Informe uma justificativa com pelo menos 15 caracteres.', code: 'FISCAL_JUSTIFICATION_REQUIRED' } });
    if (String(document.status) !== 'authorized') return response.status(409).json({ data: null, error: { message: 'Eventos oficiais só podem ser solicitados após autorização real do documento. A simulação local não cria autorização jurídica.', code: 'FISCAL_EVENT_REQUIRES_AUTHORIZATION' } });
    const event = fiscalEvent(request, String(document.id), eventType, 'blocked', 'Transmissão real desativada até a configuração oficial do provedor fiscal.', justification);
    persistDatabase();
    return response.status(409).json({ data: { event: cleanRow(event || {}) }, error: { message: 'Evento registrado como bloqueado; nenhuma transmissão real foi realizada.', code: 'FISCAL_EXTERNAL_PROVIDER_REQUIRED' } });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.delete('/api/operations/fiscal/documents/:id', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'delete')) return fiscalForbidden(response, 'Sem permissão para excluir rascunho fiscal.');
  try {
    const document = fiscalDocumentById(String(request.params.id));
    if (!document) return response.status(404).json({ data: null, error: { message: 'Documento fiscal não encontrado.', code: 'FISCAL_NOT_FOUND' } });
    if (!fiscalScopeAllowed(request, String(document.company_id), String(document.store_id))) return response.status(403).json({ data: null, error: { message: 'Documento fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    if (String(document.status) !== 'draft') return response.status(409).json({ data: null, error: { message: 'Somente rascunhos podem ser excluídos.', code: 'FISCAL_DOCUMENT_NOT_DRAFT' } });
    const timestamp = now();
    fiscalAudit(request, String(document.company_id), String(document.store_id), String(document.id), 'draft_deleted', { document: sanitizeFiscalDocument(document, request.profile) }, timestamp);
    execute('DELETE FROM fiscal_document_items WHERE document_id = ?', [document.id]);
    execute('DELETE FROM fiscal_events WHERE document_id = ?', [document.id]);
    execute('DELETE FROM fiscal_documents WHERE id = ?', [document.id]);
    persistDatabase();
    return response.json({ data: { id: document.id, deleted_at: timestamp }, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.get('/api/operations/fiscal/xml-imports', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!fiscalPermission(request, 'import')) return fiscalForbidden(response, 'Sem permissão para consultar importações XML.');
  const companyId = String(request.query.company_id || '');
  const storeId = String(request.query.store_id || '');
  if ((companyId && storeId && !fiscalScopeAllowed(request, companyId, storeId)) || (companyId && !profileCompanies(request.profile).includes(companyId) && !isMaster(request.profile))) return response.status(403).json({ data: null, error: { message: 'Empresa ou loja fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
  const rows = selectRows('SELECT * FROM fiscal_xml_imports ORDER BY created_at DESC').filter((row) => (!companyId || String(row.company_id) === companyId) && (!storeId || String(row.store_id) === storeId) && rowInScope('fiscal_documents', row, request.profile)).map(cleanRow);
  response.setHeader('X-Total-Count', String(rows.length));
  return response.json({ data: rows, error: null });
});

app.post('/api/operations/fiscal/xml-imports/preview', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!fiscalPermission(request, 'import')) return fiscalForbidden(response, 'Sem permissão para importar XML fiscal.');
  try {
    const companyId = String(request.body?.company_id || '').trim();
    const storeId = String(request.body?.store_id || '').trim();
    const rawXml = String(request.body?.raw_xml || '').trim();
    if (!companyId || !storeId || !fiscalScopeAllowed(request, companyId, storeId)) return response.status(403).json({ data: null, error: { message: 'Empresa ou loja fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    if (rawXml.length < 20 || rawXml.length > 8 * 1024 * 1024 || !/<[A-Za-z][^>]*>/.test(rawXml)) return response.status(400).json({ data: null, error: { message: 'Envie um XML fiscal para pré-visualização.', code: 'FISCAL_XML_INVALID' } });
    const rawHash = createHash('sha256').update(rawXml).digest('hex');
    const duplicate = selectRows('SELECT * FROM fiscal_xml_imports WHERE company_id = ? AND store_id = ? AND raw_hash = ? LIMIT 1', [companyId, storeId, rawHash])[0];
    if (duplicate) return response.json({ data: { import: cleanRow(duplicate), duplicate: true }, error: null });
    const tag = (name: string) => {
      const match = new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`, 'i').exec(rawXml);
      return match?.[1]?.trim() || null;
    };
    const keyMatch = /(?:<chNFe>|Id=["']NFe)([0-9]{44})/i.exec(rawXml);
    const totalText = tag('vNF');
    const total = totalText ? Number(totalText.replace(',', '.')) || 0 : 0;
    const timestamp = now();
    const id = newId();
    execute('INSERT INTO fiscal_xml_imports (id, company_id, store_id, access_key, supplier_name, issue_date, total, status, raw_hash, imported_by, imported_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, companyId, storeId, keyMatch?.[1] || null, tag('xNome'), tag('dhEmi') || tag('dEmi'), total, 'preview', rawHash, request.userId || null, actorName(request.userId), timestamp]);
    fiscalAudit(request, companyId, storeId, null, 'xml_import_preview', { import_id: id, raw_hash: rawHash, access_key: keyMatch?.[1] || null, supplier_name: tag('xNome'), total }, timestamp);
    persistDatabase();
    return response.status(201).json({ data: { import: cleanRow(selectRows('SELECT * FROM fiscal_xml_imports WHERE id = ? LIMIT 1', [id])[0]), duplicate: false, note: 'Prévia criada. Nenhuma entrada de estoque, financeiro ou documento fiscal foi criada automaticamente.' }, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/operations/fiscal/xml-imports/:id/confirm', requireAuth, (request: AuthenticatedRequest, response: Response) => {
  if (!fiscalPermission(request, 'import')) return fiscalForbidden(response, 'Sem permissão para confirmar importação XML.');
  try {
    const row = selectRows('SELECT * FROM fiscal_xml_imports WHERE id = ? LIMIT 1', [request.params.id])[0];
    if (!row) return response.status(404).json({ data: null, error: { message: 'Importação XML não encontrada.', code: 'FISCAL_XML_IMPORT_NOT_FOUND' } });
    if (!fiscalScopeAllowed(request, String(row.company_id), String(row.store_id))) return response.status(403).json({ data: null, error: { message: 'Importação fora do escopo permitido.', code: 'FISCAL_SCOPE_FORBIDDEN' } });
    if (!['preview', 'pending'].includes(String(row.status))) return response.status(409).json({ data: null, error: { message: 'Esta importação já foi confirmada ou encerrada.', code: 'FISCAL_XML_IMPORT_INVALID_STATE' } });
    const timestamp = now();
    execute('UPDATE fiscal_xml_imports SET status = ? WHERE id = ?', ['confirmed', row.id]);
    fiscalAudit(request, String(row.company_id), String(row.store_id), null, 'xml_import_confirmed', { import_id: row.id, access_key: row.access_key || null, raw_hash: row.raw_hash || null }, timestamp);
    persistDatabase();
    return response.json({ data: cleanRow(selectRows('SELECT * FROM fiscal_xml_imports WHERE id = ? LIMIT 1', [row.id])[0]), error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

const adminManagedTables = new Set(['profiles', 'roles', 'permissions', 'role_permissions', 'user_permissions']);

function canWriteGenericTable(request: AuthenticatedRequest, table: string, operation: 'insert' | 'update' | 'delete') {
  if (table === 'profiles') return canManageUsers(request, operation === 'insert' ? 'create' : operation === 'update' ? 'edit' : 'delete');
  if (adminManagedTables.has(table)) return isMaster(request.profile) || canManageRoles(request);
  return canAccessTable(request, table, operation);
}

app.use('/api/tables', requireAuth);
app.get('/api/tables/:table', (request: AuthenticatedRequest, response: Response) => {
  try {
    const table = String(request.params.table);
    if (!canAccessTable(request, table, 'select')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para consultar este módulo.', code: '403' } });
    }
    const scopedRows = getRows(table, request.query, request.profile)
      .filter((row) => rowInScope(table, row, request.profile))
      .map((row) => table === 'profiles' ? cleanRow(row) : table === 'products' ? sanitizeProductRow(row, request.profile) : row);
    const totalCount = scopedRows.length;
    const offsetValue = Number(readQueryValue(request.query.offset));
    const limitValue = Number(readQueryValue(request.query.limit));
    const offset = Number.isFinite(offsetValue) && offsetValue >= 0 ? Math.floor(offsetValue) : 0;
    const paginatedRows = Number.isFinite(limitValue) && limitValue > 0
      ? scopedRows.slice(offset, offset + Math.floor(limitValue))
      : scopedRows.slice(offset);
    response.setHeader('X-Total-Count', String(totalCount));
    const rows = paginatedRows;
    const single = readQueryValue(request.query.single) === '1';
    const maybeSingle = readQueryValue(request.query.maybeSingle) === '1';
    if (single) {
      if (rows.length === 0 && maybeSingle) return response.json({ data: null, error: null });
      if (rows.length !== 1) return response.json({ data: null, error: { message: rows.length === 0 ? 'Registro não encontrado.' : 'Mais de um registro encontrado.', code: rows.length === 0 ? 'PGRST116' : 'PGRST117' } });
      return response.json({ data: rows[0], error: null });
    }
    return response.json({ data: rows, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.post('/api/tables/:table', (request: AuthenticatedRequest, response) => {
  try {
    const table = String(request.params.table);
    if (table === 'financial_entry_audits') return response.status(403).json({ data: null, error: { message: 'A auditoria financeira é somente leitura.', code: 'AUDIT_READ_ONLY' } });
    if (!canWriteGenericTable(request, table, 'insert')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para criar neste módulo.', code: '403' } });
    }
    if (table === 'profiles') return response.status(403).json({ data: null, error: { message: 'Use a rota administrativa para criar usuários.', code: 'ADMIN_USER_ROUTE_REQUIRED' } });
    const tableName = safeTable(table);
    const columns = tableColumns(table);
    const input = Array.isArray(request.body?.data) ? request.body.data : [request.body?.data || {}];
    const inserted: Record<string, unknown>[] = [];
    for (const item of input) {
      const row = { ...item } as Record<string, unknown>;
      if (table === 'products' && row.cost !== undefined && !hasModulePermission(request.profile, 'products', 'manage_cost')) {
        return response.status(403).json({ data: null, error: { message: 'Sem permissão para definir preço de custo.', code: '403' } });
      }
      if (table === 'products') {
        const sku = String(row.sku || '').trim();
        const barcode = String(row.barcode || '').trim();
        if (sku && selectRows('SELECT id FROM products WHERE company_id = ? AND sku = ? LIMIT 1', [row.company_id, sku]).length > 0) throw new Error('Já existe um produto com este SKU.');
        if (barcode && selectRows('SELECT id FROM products WHERE company_id = ? AND barcode = ? LIMIT 1', [row.company_id, barcode]).length > 0) throw new Error('Já existe um produto com este código de barras.');
      }
      const id = String(row.id || newId());
      const createdAt = String(row.created_at || now());
      row.id = id;
      row.created_at = createdAt;
      if (['financial_entries', 'financial_transfers', 'fixed_costs', 'fixed_cost_payments', 'financial_card_settlements', 'bank_transactions', 'bank_reconciliations'].includes(table)) {
        if (columns.has('created_by')) row.created_by = request.userId;
        if (columns.has('created_by_name')) row.created_by_name = actorName(request.userId);
      }
      if (table === 'financial_entries') {
        row.audit_log = { ...(parseAuditLog(row.audit_log) || {}), created_by: request.userId || null, created_by_name: actorName(request.userId), created_at: createdAt, changes: Array.isArray(parseAuditLog(row.audit_log)?.changes) ? parseAuditLog(row.audit_log)?.changes : [] };
      }
      if (table === 'financial_approvals') {
        if (columns.has('requested_by')) row.requested_by = request.userId;
        if (columns.has('requested_by_name')) row.requested_by_name = actorName(request.userId);
      }
      if (!scopeInput(table, row, request.profile)) {
        return response.status(403).json({ data: null, error: { message: 'Registro fora do escopo permitido.', code: '403' } });
      }
      if (table === 'financial_entries' && !row.audit_log) row.audit_log = { created_by: request.userId || null, created_by_name: actorName(request.userId), created_at: createdAt, changes: [] };
      if (table === 'products') {
        row.created_by = request.userId;
        row.updated_by = request.userId;
        row.updated_by_name = actorName(request.userId);
      }
      const validEntries = Object.entries(row).filter(([key]) => columns.has(key));
      const names = validEntries.map(([key]) => quoteIdentifier(key));
      const values = validEntries.map(([key, value]) => serializeValue(key, value));
      const placeholders = values.map(() => '?').join(', ');
      const onConflict = request.body?.upsert ? ` ON CONFLICT(${quoteIdentifier(String(request.body?.onConflict || 'id'))}) DO UPDATE SET ${validEntries.filter(([key]) => key !== 'id').map(([key]) => `${quoteIdentifier(key)} = excluded.${quoteIdentifier(key)}`).join(', ')}` : '';
      execute(`INSERT INTO ${tableName} (${names.join(', ')}) VALUES (${placeholders})${onConflict}`, values);
      if (table === 'products') {
        row.created_by = request.userId;
        row.updated_by = request.userId;
        row.updated_by_name = actorName(request.userId);
        addProductAudit({ ...row, id, company_id: row.company_id }, 'created', {}, request, createdAt);
      }
      if (table === 'companies') ensureDefaultFinancialCategories(id);
      const result = selectRows(`SELECT * FROM ${tableName} WHERE id = ?`, [id])[0]
        || (request.body?.upsert && request.body?.onConflict && row[request.body.onConflict]
          ? selectRows(`SELECT * FROM ${tableName} WHERE ${quoteIdentifier(String(request.body.onConflict))} = ?`, [row[request.body.onConflict]])[0]
          : undefined);
      if (!result) throw new Error('Registro inserido não pôde ser recuperado.');
      inserted.push(relationRows(table, result, String(request.body?.select || '*')));
    }
    persistDatabase();
    const data = request.body?.single ? inserted[0] || null : inserted;
    return response.status(201).json({ data, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.patch('/api/tables/:table', (request: AuthenticatedRequest, response) => {
  try {
    const table = String(request.params.table);
    if (table === 'financial_entry_audits') return response.status(403).json({ data: null, error: { message: 'A auditoria financeira é somente leitura.', code: 'AUDIT_READ_ONLY' } });
    if (!canWriteGenericTable(request, table, 'update')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para editar este módulo.', code: '403' } });
    }
    if (table === 'profiles') return response.status(403).json({ data: null, error: { message: 'Use a rota administrativa para editar usuários.', code: 'ADMIN_USER_ROUTE_REQUIRED' } });
    const tableName = safeTable(table);
    const columns = tableColumns(table);
    const filters = parseFilters(request.query);
    const candidates = selectRows(`SELECT * FROM ${tableName}`)
      .map(deserializeRow)
      .filter((row) => matchesFilters(row, filters) && rowInScope(table, row, request.profile));
    const protectedFields = new Set(['created_by', 'created_by_name', 'updated_by', 'updated_by_name', 'settled_by', 'settled_by_name', 'settled_at', 'user_id', 'closed_by', 'closed_by_name', 'reconciled_by', 'reconciled_by_name', 'requested_by', 'requested_by_name', 'approved_by', 'approved_by_name']);
    const updates = Object.entries(request.body?.data || {}).filter(([key]) => columns.has(key) && key !== 'id' && !protectedFields.has(key));
    if (table === 'products') {
      const nextSku = updates.find(([key]) => key === 'sku')?.[1];
      const nextBarcode = updates.find(([key]) => key === 'barcode')?.[1];
      if (nextSku && selectRows('SELECT id FROM products WHERE company_id = ? AND sku = ? AND id != ? LIMIT 1', [candidates[0]?.company_id, nextSku, candidates[0]?.id]).length > 0) return response.status(409).json({ data: null, error: { message: 'Já existe um produto com este SKU.', code: 'DUPLICATE_SKU' } });
      if (nextBarcode && selectRows('SELECT id FROM products WHERE company_id = ? AND barcode = ? AND id != ? LIMIT 1', [candidates[0]?.company_id, nextBarcode, candidates[0]?.id]).length > 0) return response.status(409).json({ data: null, error: { message: 'Já existe um produto com este código de barras.', code: 'DUPLICATE_BARCODE' } });
    }
    if (table === 'financial_entries') { updates.push(['updated_by', request.userId], ['updated_by_name', actorName(request.userId)]); }
    if (table === 'fixed_costs') { updates.push(['updated_by', request.userId], ['updated_by_name', actorName(request.userId)]); }
    const requestedStatus = updates.find(([key]) => key === 'status')?.[1];
    if (table === 'service_orders' && requestedStatus !== undefined && !SERVICE_ORDER_STATUS_FLOW.includes(String(requestedStatus))) {
      return response.status(400).json({ data: null, error: { message: 'Etapa de O.S. inválida.', code: 'INVALID_SERVICE_ORDER_STATUS' } });
    }
    if (table === 'products' && updates.some(([key]) => key === 'cost') && !hasModulePermission(request.profile, 'products', 'manage_cost')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para alterar preço de custo.', code: '403' } });
    }
    const productTaxFields = new Set(['ncm', 'cest', 'tax_origin', 'commercial_unit', 'taxable_unit', 'default_cfop', 'default_cst', 'default_csosn', 'tax_notes']);
    if (table === 'products' && updates.some(([key]) => productTaxFields.has(key)) && !hasModulePermission(request.profile, 'products', 'manage_product_tax')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para alterar dados tributários do produto.', code: 'PRODUCT_TAX_PERMISSION_REQUIRED' } });
    }
    if (updates.length === 0) return response.status(400).json({ data: null, error: { message: 'Nenhum campo válido para atualizar.', code: '400' } });
    if (table === 'financial_entries' && candidates.some((row) => ['sales', 'service_orders', 'customers'].includes(String(row.origin_table || '')))
      && updates.some(([key]) => ['amount', 'status', 'paid_amount', 'payment_date', 'payment_method', 'origin_table', 'origin_id'].includes(key))) {
      return response.status(409).json({ data: null, error: { message: 'Lançamentos originados de Vendas, O.S. ou Crediário devem ser alterados na origem ou por uma operação financeira dedicada.', code: 'ORIGIN_LOCKED' } });
    }
    const setSql = updates.map(([key]) => `${quoteIdentifier(key)} = ?`).join(', ');
    const values = updates.map(([key, value]) => serializeValue(key, value));
    for (const row of candidates) {
      const nextRow = { ...row, ...Object.fromEntries(updates.map(([key, value]) => [key, value])) };
      if (!scopeInput(table, nextRow, request.profile)) {
        return response.status(403).json({ data: null, error: { message: 'Registro fora do escopo permitido.', code: '403' } });
      }
      const productAuditChanges = table === 'products'
        ? Object.fromEntries(updates.filter(([key]) => !['updated_by', 'updated_by_name'].includes(key)).map(([key, value]) => [key, { oldValue: row[key], newValue: value }]))
        : {};
      execute(`UPDATE ${tableName} SET ${setSql}${columns.has('updated_at') ? ', updated_at = ?' : ''} WHERE id = ?`, [...values, ...(columns.has('updated_at') ? [now()] : []), row.id]);
      if (table === 'products') addProductAudit(nextRow, 'updated', productAuditChanges, request, now());
      if (table === 'service_orders' && requestedStatus !== undefined && String(row.status || 'opened') !== String(requestedStatus)) {
        const timestamp = now();
        const userName = String(request.profile?.name || request.profile?.email || 'Usuário atual');
        execute('INSERT INTO service_order_timeline (id, service_order_id, action, user_name, user_id, status, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [newId(), row.id, `Status alterado de ${serviceOrderStatusLabel(row.status || 'opened')} para ${serviceOrderStatusLabel(requestedStatus)}`, userName, request.userId, String(requestedStatus), timestamp, timestamp]);
      }
    }
    persistDatabase();
    const updatedRows = candidates.map((row) => relationRows(table, selectRows(`SELECT * FROM ${tableName} WHERE id = ?`, [row.id])[0], String(request.body?.select || '*')));
    const responseRows = table === 'products'
      ? updatedRows.map((row) => sanitizeProductRow(row, request.profile))
      : updatedRows;
    const data = request.body?.single ? responseRows[0] || null : responseRows;
    return response.json({ data, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.delete('/api/tables/:table', (request: AuthenticatedRequest, response) => {
  let transactionStarted = false;
  try {
    const table = String(request.params.table);
    if (table === 'products') {
      if (!hasModulePermission(request.profile, 'products', 'delete_permanently')) {
        return response.status(403).json({ data: null, error: { message: 'Sem permissão para excluir produtos permanentemente.', code: 'PRODUCT_DELETE_PERMISSION_REQUIRED' } });
      }
    } else if (!canWriteGenericTable(request, table, 'delete')) {
      return response.status(403).json({ data: null, error: { message: 'Sem permissão para excluir neste módulo.', code: '403' } });
    }
    if (table === 'profiles') return response.status(403).json({ data: null, error: { message: 'Use a rota administrativa para excluir usuários.', code: 'ADMIN_USER_ROUTE_REQUIRED' } });
    const tableName = safeTable(table);
    const filters = parseFilters(request.query);
    const candidates = selectRows(`SELECT * FROM ${tableName}`)
      .map(deserializeRow)
      .filter((row) => matchesFilters(row, filters) && rowInScope(table, row, request.profile));
    if (table === 'products') {
      if (candidates.length === 0) return response.status(404).json({ data: null, error: { message: 'Produto não encontrado ou fora do seu escopo.', code: 'PRODUCT_NOT_FOUND' } });
      getDatabase().run('BEGIN');
      transactionStarted = true;
      for (const row of candidates) {
        const productId = String(row.id);
        execute('UPDATE sale_items SET product_id = NULL WHERE product_id = ?', [productId]);
        execute('UPDATE service_orders SET product_id = NULL WHERE product_id = ?', [productId]);
        execute('DELETE FROM product_images WHERE product_id = ?', [productId]);
        execute('DELETE FROM product_stock WHERE product_id = ?', [productId]);
        execute('DELETE FROM product_movements WHERE product_id = ?', [productId]);
        execute('DELETE FROM product_audits WHERE product_id = ?', [productId]);
        execute('DELETE FROM products WHERE id = ?', [productId]);
      }
      getDatabase().run('COMMIT');
      transactionStarted = false;
      persistDatabase();
      return response.json({ data: { deleted: candidates.length }, error: null });
    }
    if (table === 'financial_entries' && candidates.some((row) => ['sales', 'service_orders', 'customers'].includes(String(row.origin_table || '')))) {
      return response.status(409).json({ data: null, error: { message: 'Lançamentos originados de Vendas, O.S. ou Crediário não podem ser excluídos por esta tela. Use o fluxo de origem autorizado.', code: 'ORIGIN_LOCKED' } });
    }
    if (table === 'financial_entry_audits') {
      return response.status(403).json({ data: null, error: { message: 'A auditoria financeira é somente leitura.', code: 'AUDIT_READ_ONLY' } });
    }
    for (const row of candidates) execute(`DELETE FROM ${tableName} WHERE id = ?`, [row.id]);
    persistDatabase();
    return response.json({ data: null, error: null });
  } catch (error) {
    if (transactionStarted) {
      try { getDatabase().run('ROLLBACK'); } catch { /* transação já encerrada */ }
    }
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.use('/api/storage', requireAuth);
app.get('/api/storage/:bucket/list', (request, response) => {
  const bucket = path.basename(String(request.params.bucket));
  const prefix = normalizeStoragePath(request.query.path);
  if (!prefix || !canAccessStoragePath(request, bucket, prefix, true)) return forbiddenStorage(response);
  const directory = path.resolve(uploadsRoot, bucket, prefix);
  if (!isWithinUploads(directory)) return response.status(400).json({ data: null, error: { message: 'Caminho inválido.' } });
  if (!fs.existsSync(directory)) return response.json({ data: [], error: null });
  if (!isSafeDirectory(directory)) return response.status(400).json({ data: null, error: { message: 'Diretório inválido.' } });
  const files = fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const fullPath = path.join(directory, entry.name);
    const stats = fs.statSync(fullPath);
    return { name: entry.name, created_at: stats.birthtime.toISOString(), metadata: { size: stats.size, mimetype: mimeFromName(entry.name) } };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return response.json({ data: files.slice(0, Number(request.query.limit || 100)), error: null });
});

app.post('/api/storage/:bucket/upload', upload.single('file'), (request: AuthenticatedRequest, response) => {
  try {
    if (!request.file) return response.status(400).json({ data: null, error: { message: 'Arquivo não enviado.' } });
    const bucket = path.basename(String(request.params.bucket));
    const relativePath = normalizeStoragePath(request.body?.path);
    if (!relativePath || !canAccessStoragePath(request, bucket, relativePath)) return forbiddenStorage(response);
    const destination = path.resolve(uploadsRoot, bucket, relativePath);
    if (!isWithinUploads(destination)) return response.status(400).json({ data: null, error: { message: 'Caminho inválido.' } });
    if (fs.existsSync(destination) && !isSafeRegularFile(destination)) return response.status(400).json({ data: null, error: { message: 'Destino de arquivo inválido.' } });
    if (fs.existsSync(destination) && request.body?.upsert !== 'true') return response.status(409).json({ data: null, error: { message: 'Arquivo já existe.' } });
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, request.file.buffer);
    return response.json({ data: { path: relativePath, id: relativePath, fullPath: relativePath }, error: null });
  } catch (error) {
    return response.status(400).json({ data: null, error: errorPayload(error) });
  }
});

app.get('/api/storage/:bucket/download', (request, response) => {
  const bucket = path.basename(String(request.params.bucket));
  const relativePath = normalizeStoragePath(request.query.path);
  if (!relativePath || !canAccessStoragePath(request, bucket, relativePath)) return forbiddenStorage(response);
  const filePath = path.resolve(uploadsRoot, bucket, relativePath);
  if (!isWithinUploads(filePath) || !isSafeRegularFile(filePath)) return response.status(404).send('Arquivo não encontrado.');
  return response.sendFile(filePath);
});

app.delete('/api/storage/:bucket', (request, response) => {
  const bucket = path.basename(String(request.params.bucket));
  const paths = Array.isArray(request.body?.paths) ? request.body.paths.map(normalizeStoragePath) : [];
  if (paths.some((relativePath) => !relativePath || !canAccessStoragePath(request, bucket, relativePath))) return forbiddenStorage(response);
  for (const relativePath of paths as string[]) {
    const filePath = path.resolve(uploadsRoot, bucket, relativePath);
    if (isWithinUploads(filePath) && isSafeRegularFile(filePath)) fs.rmSync(filePath);
  }
  return response.json({ data: null, error: null });
});

app.post('/api/functions/generate-insights', requireAuth, (request: AuthenticatedRequest, response) => {
  if (!isMaster(request.profile) && !hasPermission(request.profile, 'dashboard', 'generate_insights')) {
    return response.status(403).json({ data: null, error: { message: 'Permissão insuficiente.' } });
  }
  const stats = request.body?.stats || {};
  const revenue = Number(stats.revenue || stats.totalRevenue || 0);
  const appointments = Number(stats.appointments || stats.totalAppointments || 0);
  const customers = Number(stats.customers || stats.totalCustomers || 0);
  const insight = revenue || appointments || customers
    ? `Com base nos dados locais, o período registra ${appointments} agendamento(s), ${customers} cliente(s) e R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em receita. Priorize o retorno de clientes sem visita recente e acompanhe a conversão dos próximos agendamentos.`
    : 'Ainda não há dados suficientes para gerar um insight. Cadastre empresas, lojas, clientes e vendas para começar.';
  return response.json({ data: { insight }, error: null });
});

if (process.env.NODE_ENV === 'production') {
  const staticDirectory = path.join(projectRoot, 'dist');
  app.use(express.static(staticDirectory));
  app.get(/.*/, (_request, response) => response.sendFile(path.join(staticDirectory, 'index.html')));
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const typedError = error as { code?: string; statusCode?: number };
  const statusCode = typedError.code === 'LIMIT_FILE_SIZE' ? 413 : Number(typedError.statusCode || 400);
  response.status(statusCode).json({ data: null, error: errorPayload(error) });
});

initDatabase().then(() => {
  startBackupScheduler();
  runBackupScheduler().catch((error) => console.error('[backup-scheduler:first-run]', error));
  app.listen(port, '0.0.0.0', () => console.log(`Servidor local em http://localhost:${port}`));
}).catch((error) => {
  console.error('Falha ao iniciar o banco local:', error);
  process.exitCode = 1;
});

function mimeFromName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf', '.txt': 'text/plain' };
  return mimeTypes[extension] || 'application/octet-stream';
}

export default app;
