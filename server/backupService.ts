import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import initSqlJs from 'sql.js';
import {
  execute,
  getBackupDirectory,
  getDatabasePath,
  newId,
  now,
  persistDatabase,
  selectRows,
} from './db.js';
import { authSecret } from './securityConfig.js';
import { analyzeDataIntegrity, type IntegrityReport } from './dataIntegrity.js';
import { logOperationalError } from './observability.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(getDatabasePath()), '..');
const uploadsRoot = path.join(projectRoot, 'uploads');
const backupRoot = getBackupDirectory();
const settingsId = 'default';
const backupFormatVersion = 1;
const driveScope = 'https://www.googleapis.com/auth/drive.file';
const integrityTables = [
  'companies', 'stores', 'roles', 'permissions', 'role_permissions', 'profiles', 'user_permissions', 'employees', 'customers',
  'laboratories', 'professionals', 'appointments', 'products', 'product_stock', 'product_movements', 'product_categories',
  'product_brands', 'product_images', 'product_audits', 'sales', 'sale_items', 'service_orders', 'service_order_timeline',
  'cash_registers', 'cash_register_movements', 'financial_entries', 'financial_entry_audits', 'fixed_costs', 'fixed_cost_payments',
  'bank_accounts', 'bank_reconciliations', 'bank_transactions', 'financial_categories', 'financial_budgets', 'financial_approvals',
  'financial_transfers', 'financial_card_settlements', 'financial_daily_closings', 'prescriptions', 'fiscal_configs', 'fiscal_documents',
  'fiscal_document_items', 'fiscal_events', 'fiscal_audits', 'fiscal_xml_imports',
] as const;

export type BackupSettings = {
  id: string;
  enabled: boolean;
  timezone: string;
  daily_enabled: boolean;
  daily_count: number;
  weekly_enabled: boolean;
  weekly_count: number;
  monthly_enabled: boolean;
  monthly_count: number;
  schedule_hour: number;
  schedule_minute: number;
  include_database: boolean;
  include_uploads: boolean;
  upload_to_drive: boolean;
  drive_folder_id: string | null;
  drive_folder_name: string;
  google_account_email: string | null;
  google_token_expires_at: string | null;
  retention_daily: number;
  retention_weekly: number;
  retention_monthly: number;
  max_local_backups: number;
  last_scheduler_tick: string | null;
  last_drive_test_at: string | null;
  last_drive_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

type BackupJob = Record<string, unknown>;

type BackupManifest = {
  format_version: number;
  app: string;
  created_at: string;
  label: string;
  includes: { database: boolean; uploads: boolean };
  database?: { path: string; size_bytes: number; sha256: string };
  uploads?: { file_count: number; size_bytes: number };
};

type GoogleApiPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  id?: string;
  name?: string;
  webViewLink?: string;
  size?: number | string;
  error_description?: string;
  error?: string | { message?: string; error_description?: string };
  user?: { displayName?: string; emailAddress?: string; permissionId?: string };
  files?: Array<{ id: string; name?: string; size?: string; createdTime?: string; modifiedTime?: string; webViewLink?: string; mimeType?: string; md5Checksum?: string }>;
};

function googleErrorMessage(payload: GoogleApiPayload, fallback: string) {
  if (typeof payload.error === 'string') return payload.error;
  return payload.error_description || payload.error?.error_description || payload.error?.message || fallback;
}

function bool(value: unknown, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function int(value: unknown, fallback: number, min = 0, max = 3650) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function safeName(value: string) {
  return String(value || 'manual').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'manual';
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function sha256File(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function walkFiles(root: string) {
  const result: string[] = [];
  if (!fs.existsSync(root)) return result;
  const entries = await fsp.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await walkFiles(fullPath));
    else if (entry.isFile()) result.push(fullPath);
  }
  return result;
}

async function validateSafeTree(root: string) {
  if (!fs.existsSync(root)) return;
  const entries = await fsp.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink() || entry.isBlockDevice() || entry.isCharacterDevice() || entry.isSocket()) {
      throw new Error('O backup contém um tipo de arquivo não permitido.');
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) await validateSafeTree(fullPath);
  }
}

async function validateSqliteFile(filePath: string) {
  const SQL = await initSqlJs({ locateFile: (file) => path.join(path.dirname(require.resolve('sql.js')), file) });
  const database = new SQL.Database(new Uint8Array(await fsp.readFile(filePath)));
  try {
    const integrity = database.exec('PRAGMA integrity_check');
    const result = String(integrity[0]?.values?.[0]?.[0] || '').toLowerCase();
    if (result !== 'ok') throw new Error(`O SQLite restaurado falhou no integrity_check: ${result || 'resultado vazio'}.`);
    const tableRows = database.exec("SELECT name FROM sqlite_master WHERE type = 'table'");
    const tables = new Set((tableRows[0]?.values || []).map((row) => String(row[0])));
    for (const required of ['companies', 'stores', 'profiles', 'customers', 'backup_jobs']) {
      if (!tables.has(required)) throw new Error(`O SQLite restaurado não possui a tabela obrigatória ${required}.`);
    }
  } finally {
    database.close();
  }
}

async function validateArchiveMembers(archivePath: string) {
  const { stdout: detailedListing } = await execFileAsync('tar', ['-tvzf', archivePath], { maxBuffer: 16 * 1024 * 1024 });
  for (const line of detailedListing.split('\n').filter(Boolean)) {
    if (!['-', 'd'].includes(line.charAt(0))) throw new Error('O backup contém link simbólico ou tipo de arquivo não permitido.');
  }
  const { stdout } = await execFileAsync('tar', ['-tzf', archivePath], { maxBuffer: 16 * 1024 * 1024 });
  const members = stdout.split('\n').map((member) => member.trim()).filter(Boolean);
  if (members.length > 100_000) throw new Error('O backup contém arquivos demais para ser processado.');
  for (const member of members) {
    const normalized = member.replaceAll('\\', '/');
    if (normalized.startsWith('/') || normalized.split('/').some((part) => part === '..')) {
      throw new Error('O backup contém um caminho inseguro.');
    }
  }
  return members;
}

function encryptSecret(value: string) {
  const key = createHash('sha256').update(authSecret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const [version, ivText, tagText, encryptedText] = value.split(':');
    if (version !== 'v1' || !ivText || !tagText || !encryptedText) return null;
    const key = createHash('sha256').update(authSecret).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

function normalizeSettings(row: Record<string, unknown>): BackupSettings {
  return {
    id: String(row.id || settingsId),
    enabled: bool(row.enabled, true),
    timezone: String(row.timezone || 'America/Sao_Paulo'),
    daily_enabled: bool(row.daily_enabled, true),
    daily_count: int(row.daily_count, 2, 1, 24),
    weekly_enabled: bool(row.weekly_enabled, true),
    weekly_count: int(row.weekly_count, 1, 1, 7),
    monthly_enabled: bool(row.monthly_enabled, true),
    monthly_count: int(row.monthly_count, 1, 1, 31),
    schedule_hour: int(row.schedule_hour, 2, 0, 23),
    schedule_minute: int(row.schedule_minute, 0, 0, 59),
    include_database: bool(row.include_database, true),
    include_uploads: bool(row.include_uploads, true),
    upload_to_drive: bool(row.upload_to_drive, true),
    drive_folder_id: row.drive_folder_id ? String(row.drive_folder_id) : null,
    drive_folder_name: String(row.drive_folder_name || 'Gestão Óticas - Backups'),
    google_account_email: row.google_account_email ? String(row.google_account_email) : null,
    google_token_expires_at: row.google_token_expires_at ? String(row.google_token_expires_at) : null,
    retention_daily: int(row.retention_daily, 30, 1, 3650),
    retention_weekly: int(row.retention_weekly, 12, 1, 3650),
    retention_monthly: int(row.retention_monthly, 12, 1, 3650),
    max_local_backups: int(row.max_local_backups, 20, 1, 500),
    last_scheduler_tick: row.last_scheduler_tick ? String(row.last_scheduler_tick) : null,
    last_drive_test_at: row.last_drive_test_at ? String(row.last_drive_test_at) : null,
    last_drive_sync_at: row.last_drive_sync_at ? String(row.last_drive_sync_at) : null,
    created_at: String(row.created_at || now()),
    updated_at: String(row.updated_at || now()),
  };
}

export function getBackupSettings() {
  let row = selectRows('SELECT * FROM backup_settings WHERE id = ? LIMIT 1', [settingsId])[0];
  if (!row) {
    const createdAt = now();
    execute(`INSERT INTO backup_settings (id, created_at, updated_at) VALUES (?, ?, ?)`, [settingsId, createdAt, createdAt]);
    row = selectRows('SELECT * FROM backup_settings WHERE id = ? LIMIT 1', [settingsId])[0];
  }
  return normalizeSettings(row || { id: settingsId });
}

export function saveBackupSettings(input: Record<string, unknown>) {
  const current = getBackupSettings();
  const allowed = new Set([
    'enabled', 'timezone', 'daily_enabled', 'daily_count', 'weekly_enabled', 'weekly_count', 'monthly_enabled', 'monthly_count',
    'schedule_hour', 'schedule_minute', 'include_database', 'include_uploads', 'upload_to_drive', 'drive_folder_id', 'drive_folder_name',
    'retention_daily', 'retention_weekly', 'retention_monthly', 'max_local_backups',
  ]);
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(input || {})) {
    if (!allowed.has(key)) continue;
    columns.push(`"${key.replaceAll('"', '""')}" = ?`);
    if (['enabled', 'daily_enabled', 'weekly_enabled', 'monthly_enabled', 'include_database', 'include_uploads', 'upload_to_drive'].includes(key)) values.push(value ? 1 : 0);
    else if (['daily_count', 'weekly_count', 'monthly_count', 'schedule_hour', 'schedule_minute', 'retention_daily', 'retention_weekly', 'retention_monthly', 'max_local_backups'].includes(key)) {
      const minimum = key === 'schedule_hour' || key === 'schedule_minute' ? 0 : 1;
      const maximum = key === 'schedule_hour' ? 23 : key === 'schedule_minute' ? 59 : key === 'max_local_backups' ? 500 : 3650;
      const currentValue = current[key as keyof BackupSettings];
      values.push(int(value, Number(currentValue || 0), minimum, maximum));
    }
    else values.push(value === null || value === undefined ? null : String(value));
  }
  columns.push('updated_at = ?');
  values.push(now(), settingsId);
  execute(`UPDATE backup_settings SET ${columns.join(', ')} WHERE id = ?`, values);
  persistDatabase();
  return getBackupSettings();
}

function addEvent(jobId: string | null, eventType: string, message: string, details: Record<string, unknown> = {}, level = 'info') {
  execute('INSERT INTO backup_events (id, job_id, level, event_type, message, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId(), jobId, level, eventType, message, JSON.stringify(details), now()]);
}

function insertJob(input: Record<string, unknown>) {
  const id = String(input.id || newId());
  const createdAt = String(input.created_at || now());
  execute(`INSERT INTO backup_jobs (id, type, status, source, schedule_period, schedule_slot, label, archive_name, local_path, size_bytes, sha256, drive_file_id, drive_web_url, included_database, included_uploads, manifest_json, error_message, created_by, started_at, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, String(input.type || 'manual'), String(input.status || 'pending'), String(input.source || 'local'), input.schedule_period || null, input.schedule_slot || null,
    String(input.label || 'manual'), input.archive_name || null, input.local_path || null, Number(input.size_bytes || 0), input.sha256 || null, input.drive_file_id || null,
    input.drive_web_url || null, input.included_database === false ? 0 : 1, input.included_uploads === false ? 0 : 1,
    JSON.stringify(input.manifest_json || {}), input.error_message || null, input.created_by || null, input.started_at || null, input.completed_at || null, createdAt,
  ]);
  return id;
}

function updateJob(id: string, fields: Record<string, unknown>) {
  const allowed = new Set(['status', 'source', 'archive_name', 'local_path', 'size_bytes', 'sha256', 'drive_file_id', 'drive_web_url', 'manifest_json', 'error_message', 'started_at', 'completed_at']);
  const entries = Object.entries(fields).filter(([key]) => allowed.has(key));
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `"${key}" = ?`);
  const values = entries.map(([, value]) => keyValue(value));
  execute(`UPDATE backup_jobs SET ${assignments.join(', ')} WHERE id = ?`, [...values, id]);
}

function keyValue(value: unknown) {
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value ?? null;
}

async function createArchive(label: string, includeDatabase: boolean, includeUploads: boolean, jobId: string) {
  persistDatabase();
  fs.mkdirSync(backupRoot, { recursive: true });
  const stage = path.join(backupRoot, `.stage-${jobId}`);
  const archiveName = `gestao-oticas-${safeName(label)}-${timestamp()}.tar.gz`;
  const archivePath = path.join(backupRoot, archiveName);
  await fsp.rm(stage, { recursive: true, force: true });
  await fsp.mkdir(stage, { recursive: true });
  const manifest: BackupManifest = {
    format_version: backupFormatVersion,
    app: 'Gestão Óticas H2K',
    created_at: now(),
    label,
    includes: { database: includeDatabase, uploads: includeUploads },
  };
  if (includeDatabase) {
    const target = path.join(stage, 'database', 'otica-nordestina.sqlite');
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.copyFile(getDatabasePath(), target);
    const stat = await fsp.stat(target);
    manifest.database = { path: 'database/otica-nordestina.sqlite', size_bytes: stat.size, sha256: await sha256File(target) };
  }
  if (includeUploads) {
    const target = path.join(stage, 'uploads');
    if (fs.existsSync(uploadsRoot)) await fsp.cp(uploadsRoot, target, { recursive: true });
    const files = await walkFiles(target);
    let size = 0;
    for (const file of files) size += (await fsp.stat(file)).size;
    manifest.uploads = { file_count: files.length, size_bytes: size };
  }
  await fsp.writeFile(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fsp.writeFile(path.join(stage, 'RESTORE.txt'), 'Backup do Gestão Óticas. Valide o manifesto antes de restaurar.\n');
  await execFileAsync('tar', ['-czf', archivePath, '-C', stage, '.']);
  await fsp.rm(stage, { recursive: true, force: true });
  const stat = await fsp.stat(archivePath);
  return { archiveName, archivePath, sizeBytes: stat.size, sha256: await sha256File(archivePath), manifest };
}

function googleConfig(redirectUri?: string) {
  return {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
    redirectUri: redirectUri || process.env.GOOGLE_DRIVE_REDIRECT_URI || '',
  };
}

export function getGoogleDriveConfigStatus(redirectUri?: string) {
  const config = googleConfig(redirectUri);
  return { configured: Boolean(config.clientId && config.clientSecret && config.redirectUri), redirect_uri: config.redirectUri || null, scope: driveScope };
}

function stateSignature(payload: string) {
  return createHmac('sha256', authSecret).update(payload).digest('hex');
}

export function createGoogleOAuthUrl(redirectUri: string) {
  const config = googleConfig(redirectUri);
  if (!config.clientId || !config.clientSecret || !config.redirectUri) throw new Error('Configure GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET e GOOGLE_DRIVE_REDIRECT_URI no Coolify antes de conectar.');
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 10 * 60 * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  const state = `${payload}.${stateSignature(payload)}`;
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: driveScope, state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function verifyState(state: string) {
  const [payload, signature] = String(state || '').split('.');
  if (!payload || !signature || stateSignature(payload) !== signature) throw new Error('Estado OAuth inválido.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
  if (!data.exp || data.exp < Date.now()) throw new Error('A autorização expirou.');
}

async function exchangeGoogleCode(code: string, redirectUri: string) {
  const config = googleConfig(redirectUri);
  const body = new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const payload = await response.json() as GoogleApiPayload;
  if (!response.ok || !payload.refresh_token) throw new Error(googleErrorMessage(payload, 'Google não devolveu um refresh token. Revogue a autorização anterior e tente conectar novamente.'));
  return payload;
}

async function googleAccessToken(redirectUri?: string) {
  const settingsRow = selectRows('SELECT google_refresh_token FROM backup_settings WHERE id = ? LIMIT 1', [settingsId])[0];
  const refreshToken = decryptSecret(settingsRow?.google_refresh_token);
  if (!refreshToken) throw new Error('Google Drive ainda não está conectado.');
  const config = googleConfig(redirectUri);
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const payload = await response.json() as GoogleApiPayload;
  if (!response.ok || !payload.access_token) throw new Error(googleErrorMessage(payload, 'Não foi possível renovar o acesso ao Google Drive.'));
  execute('UPDATE backup_settings SET google_token_expires_at = ?, updated_at = ? WHERE id = ?', [new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString(), now(), settingsId]);
  persistDatabase();
  return String(payload.access_token);
}

async function driveFetch(url: string, init: RequestInit = {}, redirectUri?: string) {
  const token = await googleAccessToken(redirectUri);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function aboutDrive(redirectUri?: string) {
  const response = await driveFetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,permissionId)', {}, redirectUri);
  const payload = await response.json() as GoogleApiPayload;
  if (!response.ok) throw new Error(googleErrorMessage(payload, 'Não foi possível consultar a conta Google Drive.'));
  return payload.user || {};
}

async function ensureDriveFolder(redirectUri?: string) {
  const settings = getBackupSettings();
  if (settings.drive_folder_id) {
    const check = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(settings.drive_folder_id)}?fields=id,name,mimeType,trashed`, {}, redirectUri);
    if (check.ok) return settings.drive_folder_id;
  }
  const query = encodeURIComponent(`name = '${settings.drive_folder_name.replaceAll("'", "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const found = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=10&fields=files(id,name,mimeType)`, {}, redirectUri);
  if (found.ok) {
    const payload = await found.json() as { files?: Array<{ id: string }> };
    if (payload.files?.[0]?.id) {
      saveBackupSettings({ drive_folder_id: payload.files[0].id });
      return payload.files[0].id;
    }
  }
  const created = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: settings.drive_folder_name, mimeType: 'application/vnd.google-apps.folder' }) }, redirectUri);
  const payload = await created.json() as GoogleApiPayload;
  if (!created.ok || !payload.id) throw new Error(googleErrorMessage(payload, 'Não foi possível criar a pasta de backups no Google Drive.'));
  saveBackupSettings({ drive_folder_id: payload.id });
  return String(payload.id);
}

async function uploadArchiveToDrive(archivePath: string, archiveName: string, redirectUri?: string) {
  const folderId = await ensureDriveFolder(redirectUri);
  const stat = await fsp.stat(archivePath);
  const metadata = { name: archiveName, parents: [folderId], description: 'Backup automático do Gestão Óticas H2K' };
  const init = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,size', { method: 'POST', headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'application/gzip', 'x-upload-content-length': String(stat.size) }, body: JSON.stringify(metadata) }, redirectUri);
  if (!init.ok) throw new Error(`Falha ao iniciar upload no Drive (${init.status}).`);
  const location = init.headers.get('location');
  if (!location) throw new Error('Google Drive não retornou a sessão de upload.');
  const token = await googleAccessToken(redirectUri);
  const uploadInit = {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/gzip', 'content-length': String(stat.size) },
    body: fs.createReadStream(archivePath) as unknown as BodyInit,
    duplex: 'half' as const,
  } as RequestInit & { duplex: 'half' };
  const uploadResponse = await fetch(location, uploadInit);
  const payload = await uploadResponse.json() as GoogleApiPayload;
  if (!uploadResponse.ok || !payload.id) throw new Error(googleErrorMessage(payload, `Falha ao enviar backup ao Drive (${uploadResponse.status}).`));
  return { id: String(payload.id), name: String(payload.name || archiveName), webViewLink: payload.webViewLink ? String(payload.webViewLink) : `https://drive.google.com/file/d/${payload.id}/view`, size: Number(payload.size || stat.size) };
}

export async function connectGoogleDrive(code: string, state: string, redirectUri: string) {
  verifyState(state);
  const payload = await exchangeGoogleCode(code, redirectUri);
  const refreshToken = encryptSecret(String(payload.refresh_token));
  execute('UPDATE backup_settings SET google_refresh_token = ?, google_token_expires_at = ?, updated_at = ? WHERE id = ?', [refreshToken, new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString(), now(), settingsId]);
  persistDatabase();
  const user = await aboutDrive(redirectUri);
  execute('UPDATE backup_settings SET google_account_email = ?, last_drive_test_at = ?, updated_at = ? WHERE id = ?', [user.emailAddress || null, now(), now(), settingsId]);
  persistDatabase();
  return user;
}

export async function testGoogleDrive(redirectUri?: string) {
  const user = await aboutDrive(redirectUri);
  const folderId = await ensureDriveFolder(redirectUri);
  execute('UPDATE backup_settings SET google_account_email = ?, last_drive_test_at = ?, updated_at = ? WHERE id = ?', [user.emailAddress || null, now(), now(), settingsId]);
  persistDatabase();
  return { user, folder_id: folderId };
}

export function disconnectGoogleDrive() {
  execute('UPDATE backup_settings SET google_refresh_token = NULL, google_token_expires_at = NULL, google_account_email = NULL, drive_folder_id = NULL, last_drive_test_at = NULL, last_drive_sync_at = NULL, updated_at = ? WHERE id = ?', [now(), settingsId]);
  persistDatabase();
  return getBackupSettings();
}

export async function listGoogleDriveBackups(redirectUri?: string) {
  const folderId = await ensureDriveFolder(redirectUri);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=100&fields=files(id,name,size,createdTime,modifiedTime,webViewLink,mimeType,md5Checksum)`, {}, redirectUri);
  const payload = await response.json() as GoogleApiPayload;
  if (!response.ok) throw new Error(googleErrorMessage(payload, 'Não foi possível listar os backups do Google Drive.'));
  execute('UPDATE backup_settings SET last_drive_sync_at = ?, updated_at = ? WHERE id = ?', [now(), now(), settingsId]);
  persistDatabase();
  return payload.files || [];
}

export async function downloadGoogleDriveBackup(fileId: string, redirectUri?: string) {
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {}, redirectUri);
  if (!response.ok || !response.body) throw new Error(`Não foi possível baixar o backup do Drive (${response.status}).`);
  fs.mkdirSync(backupRoot, { recursive: true });
  const target = path.join(backupRoot, `drive-import-${safeName(fileId)}-${timestamp()}.tar.gz`);
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(target);
    output.on('finish', resolve);
    output.on('error', reject);
    Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]).pipe(output);
  });
  return target;
}

export async function createBackup(input: { type?: string; label?: string; period?: string | null; slot?: string | null; createdBy?: string | null; redirectUri?: string; forceDrive?: boolean } = {}) {
  const settings = getBackupSettings();
  const jobId = insertJob({ type: input.type || 'manual', status: 'running', source: 'local', schedule_period: input.period || null, schedule_slot: input.slot || null, label: input.label || 'manual', included_database: settings.include_database, included_uploads: settings.include_uploads, created_by: input.createdBy || null, started_at: now() });
  addEvent(jobId, 'started', 'Backup iniciado.', { type: input.type || 'manual' });
  persistDatabase();
  try {
    const archive = await createArchive(input.label || 'manual', settings.include_database, settings.include_uploads, jobId);
    let status = 'completed';
    let source = 'local';
    let errorMessage: string | null = null;
    let drive: { id: string; webViewLink: string } | null = null;
    if (input.forceDrive || (settings.upload_to_drive && settings.google_account_email)) {
      try {
        const uploaded = await uploadArchiveToDrive(archive.archivePath, archive.archiveName, input.redirectUri);
        source = 'local+google_drive';
        drive = { id: uploaded.id, webViewLink: uploaded.webViewLink };
        addEvent(jobId, 'drive_uploaded', 'Backup enviado ao Google Drive.', { file_id: uploaded.id });
      } catch (error) {
        status = 'partial';
        errorMessage = error instanceof Error ? error.message : String(error);
        addEvent(jobId, 'drive_failed', errorMessage, {}, 'warning');
      }
    }
    updateJob(jobId, { status, source, archive_name: archive.archiveName, local_path: archive.archivePath, size_bytes: archive.sizeBytes, sha256: archive.sha256, manifest_json: archive.manifest, drive_file_id: drive?.id || null, drive_web_url: drive?.webViewLink || null, error_message: errorMessage, completed_at: now() });
    addEvent(jobId, 'completed', status === 'completed' ? 'Backup concluído.' : 'Backup local concluído com falha parcial no Google Drive.', { size_bytes: archive.sizeBytes }, status === 'completed' ? 'info' : 'warning');
    await pruneLocalBackups(getBackupSettings().max_local_backups);
    persistDatabase();
    return selectRows('SELECT * FROM backup_jobs WHERE id = ? LIMIT 1', [jobId])[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateJob(jobId, { status: 'failed', error_message: message, completed_at: now() });
    addEvent(jobId, 'failed', message, {}, 'error');
    persistDatabase();
    throw error;
  }
}

async function pruneLocalBackups(maxLocal: number) {
  const jobs = selectRows("SELECT id, local_path FROM backup_jobs WHERE local_path IS NOT NULL AND status IN ('completed', 'partial', 'imported') ORDER BY created_at DESC");
  for (const job of jobs.slice(maxLocal)) {
    const localPath = String(job.local_path || '');
    if (localPath && localPath.startsWith(backupRoot) && fs.existsSync(localPath)) await fsp.rm(localPath, { force: true });
    execute('UPDATE backup_jobs SET local_path = NULL WHERE id = ?', [job.id]);
  }
}

export function listBackupJobs(filters: { status?: string; limit?: number; offset?: number } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.status && filters.status !== 'all') { conditions.push('status = ?'); params.push(filters.status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = Number(selectRows(`SELECT COUNT(*) AS count FROM backup_jobs ${where}`, params)[0]?.count || 0);
  const limit = Math.min(200, Math.max(1, Number(filters.limit || 50)));
  const offset = Math.max(0, Number(filters.offset || 0));
  const rows = selectRows(`SELECT * FROM backup_jobs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}

export function getBackupOperationalStatus() {
  const settings = getBackupSettings();
  const latest = listBackupJobs({ status: 'all', limit: 1 }).rows[0];
  return {
    enabled: settings.enabled,
    scheduler: {
      last_tick_at: settings.last_scheduler_tick,
      timezone: settings.timezone,
      schedule_hour: settings.schedule_hour,
      schedule_minute: settings.schedule_minute,
    },
    latest_job: latest ? {
      id: latest.id,
      status: latest.status,
      source: latest.source,
      created_at: latest.created_at,
      completed_at: latest.completed_at,
      size_bytes: latest.size_bytes,
    } : null,
  };
}

export function getBackupJob(id: string) {
  return selectRows('SELECT * FROM backup_jobs WHERE id = ? LIMIT 1', [id])[0];
}

export function listBackupEvents(jobId?: string, limit = 200) {
  if (jobId) return selectRows('SELECT * FROM backup_events WHERE job_id = ? ORDER BY created_at DESC LIMIT ?', [jobId, Math.min(500, limit)]);
  return selectRows('SELECT * FROM backup_events ORDER BY created_at DESC LIMIT ?', [Math.min(500, limit)]);
}

function readIntegrityData() {
  return Object.fromEntries(integrityTables.map((table) => [table, selectRows(`SELECT * FROM "${table}"`)]));
}

export function getDataIntegrityReport() {
  return analyzeDataIntegrity(readIntegrityData());
}

export function runDataIntegrityCheck(createdBy?: string | null) {
  const report = getDataIntegrityReport();
  const status = report.ok ? (report.counts.warning ? 'warning' : 'healthy') : 'critical';
  const id = newId();
  execute('INSERT INTO data_integrity_checks (id, status, issue_count, critical_count, warning_count, summary_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    id, status, report.counts.issues, report.counts.critical, report.counts.warning, JSON.stringify(report), createdBy || null, report.checked_at,
  ]);
  persistDatabase();
  return { id, status, ...report };
}

export function listDataIntegrityChecks(limit = 20) {
  return selectRows('SELECT * FROM data_integrity_checks ORDER BY created_at DESC LIMIT ?', [Math.min(100, Math.max(1, Number(limit || 20)))]).map((row) => {
    let summary: unknown = {};
    try { summary = JSON.parse(String(row.summary_json || '{}')); } catch { /* histórico legado inválido */ }
    return { ...row, summary_json: summary };
  });
}

export async function inspectArchive(archivePath: string) {
  const resolvedArchivePath = path.resolve(String(archivePath || ''));
  const resolvedRoot = path.resolve(backupRoot);
  if (!archivePath || !(resolvedArchivePath === resolvedRoot || resolvedArchivePath.startsWith(`${resolvedRoot}${path.sep}`)) || !fs.existsSync(resolvedArchivePath) || !fs.lstatSync(resolvedArchivePath).isFile()) throw new Error('Arquivo de backup não encontrado.');
  await validateArchiveMembers(resolvedArchivePath);
  const { stdout } = await execFileAsync('tar', ['-xOf', resolvedArchivePath, './manifest.json']);
  const manifest = JSON.parse(stdout) as BackupManifest;
  if (manifest.format_version !== backupFormatVersion || manifest.app !== 'Gestão Óticas H2K') throw new Error('Backup incompatível com esta aplicação.');
  if (manifest.database && manifest.database.path !== 'database/otica-nordestina.sqlite') throw new Error('O manifesto do backup possui um caminho de banco inválido.');
  const stat = await fsp.stat(resolvedArchivePath);
  return { manifest, size_bytes: stat.size, sha256: await sha256File(resolvedArchivePath), archive_name: path.basename(resolvedArchivePath) };
}

export async function importBackupArchive(archivePath: string, createdBy?: string | null) {
  const inspected = await inspectArchive(archivePath);
  const jobId = insertJob({ type: 'imported', status: 'imported', source: 'local_import', label: inspected.manifest.label || 'importado', archive_name: inspected.archive_name, local_path: archivePath, size_bytes: inspected.size_bytes, sha256: inspected.sha256, manifest_json: inspected.manifest, created_by: createdBy || null, completed_at: now() });
  addEvent(jobId, 'imported', 'Arquivo de backup validado e adicionado ao histórico.', { archive_name: inspected.archive_name });
  persistDatabase();
  return getBackupJob(jobId);
}

export async function restoreBackup(jobId: string, confirmation: string) {
  if (confirmation !== 'RESTAURAR') throw new Error('Digite RESTAURAR para confirmar a operação.');
  const job = getBackupJob(jobId);
  if (!job?.local_path) throw new Error('Este backup não possui uma cópia local disponível.');
  const archivePath = String(job.local_path);
  const inspected = await inspectArchive(archivePath);
  const preRestore = await createBackup({ type: 'pre_restore', label: `pre-restore-${jobId}` });
  const stage = path.join(backupRoot, `.restore-${jobId}-${Date.now()}`);
  await fsp.rm(stage, { recursive: true, force: true });
  await fsp.mkdir(stage, { recursive: true });
  let pendingWritten = false;
  try {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', stage]);
    await validateSafeTree(stage);
    const restoredDb = path.join(stage, 'database', 'otica-nordestina.sqlite');
    if (!inspected.manifest.database || !fs.existsSync(restoredDb)) throw new Error('O backup não contém um banco de dados restaurável.');
    const restoredStat = await fsp.stat(restoredDb);
    const restoredHash = await sha256File(restoredDb);
    if (restoredStat.size !== inspected.manifest.database.size_bytes || restoredHash !== inspected.manifest.database.sha256) {
      throw new Error('A integridade do banco restaurado não pôde ser confirmada.');
    }
    await validateSqliteFile(restoredDb);
    const stagedDatabase = path.join(stage, 'database', 'otica-nordestina.sqlite');
    const restoredUploads = path.join(stage, 'uploads');
    const pendingPath = path.join(backupRoot, 'restore-pending.json');
    const pending = {
      job_id: jobId,
      pre_restore_job_id: String(preRestore.id || ''),
      restored_at: now(),
      database_stage: stagedDatabase,
      database_sha256: restoredHash,
      restore_uploads: Boolean(inspected.manifest.includes.uploads && fs.existsSync(restoredUploads)),
      uploads_stage: fs.existsSync(restoredUploads) ? restoredUploads : null,
    };
    const pendingTemp = `${pendingPath}.tmp-${newId()}`;
    await fsp.writeFile(pendingTemp, JSON.stringify(pending, null, 2), { mode: 0o600 });
    await fsp.rename(pendingTemp, pendingPath);
    pendingWritten = true;
    addEvent(jobId, 'restore_scheduled', 'Restore validado e agendado para o próximo boot.', { pre_restore_job_id: preRestore.id, sha256: restoredHash });
    updateJob(jobId, { status: 'restore_pending', completed_at: now(), error_message: null });
    persistDatabase();
  } catch (error) {
    if (!pendingWritten) await fsp.rm(stage, { recursive: true, force: true });
    throw error;
  }
  setTimeout(() => process.exit(0), 750);
  return { job_id: jobId, pre_restore_job_id: preRestore.id, restart_scheduled: true };
}

function scheduleHours(settings: BackupSettings) {
  const count = Math.max(1, settings.daily_count);
  const step = Math.max(1, Math.floor(24 / count));
  return Array.from({ length: count }, (_, index) => (settings.schedule_hour + index * step) % 24);
}

function spacedDays(totalDays: number, count: number) {
  const safeCount = Math.max(1, Math.min(count, totalDays));
  return Array.from(new Set(Array.from({ length: safeCount }, (_, index) => Math.min(totalDays, Math.floor(index * totalDays / safeCount) + 1))));
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const weekday = get('weekday');
  return { year: get('year'), month: get('month'), day: get('day'), hour: Number(get('hour')), minute: Number(get('minute')), weekday, dateKey: `${get('year')}-${get('month')}-${get('day')}` };
}

export async function runBackupScheduler(redirectUri?: string) {
  const settings = getBackupSettings();
  if (!settings.enabled) return null;
  const current = new Date();
  const parts = zonedParts(current, settings.timezone);
  const minuteMatches = parts.minute === settings.schedule_minute;
  if (!minuteMatches) return null;
  const candidates: Array<{ period: string; slot: string; label: string }> = [];
  if (settings.daily_enabled && scheduleHours(settings).includes(parts.hour)) candidates.push({ period: 'daily', slot: `daily-${parts.dateKey}-${parts.hour}-${parts.minute}`, label: 'daily' });
  const day = current.getDay() === 0 ? 7 : current.getDay();
  if (settings.weekly_enabled && spacedDays(7, settings.weekly_count).includes(day) && parts.hour === settings.schedule_hour) candidates.push({ period: 'weekly', slot: `weekly-${parts.dateKey}`, label: 'weekly' });
  const daysInMonth = new Date(Number(parts.year), Number(parts.month), 0).getDate();
  const monthDay = Number(parts.day);
  if (settings.monthly_enabled && spacedDays(daysInMonth, settings.monthly_count).includes(monthDay) && parts.hour === settings.schedule_hour) candidates.push({ period: 'monthly', slot: `monthly-${parts.year}-${parts.month}-${parts.day}`, label: 'monthly' });
  if (!candidates.length) return null;
  saveBackupSettings({ last_scheduler_tick: current.toISOString() });
  for (const candidate of candidates) {
    const existing = selectRows('SELECT id FROM backup_jobs WHERE schedule_slot = ? LIMIT 1', [candidate.slot])[0];
    if (existing) continue;
    await createBackup({ type: 'scheduled', period: candidate.period, slot: candidate.slot, label: candidate.label, redirectUri });
  }
  return candidates;
}

export function startBackupScheduler(redirectUri?: string) {
  const timer = setInterval(() => { runBackupScheduler(redirectUri).catch((error) => logOperationalError('backup_scheduler_failed', error)); }, 60_000);
  timer.unref?.();
  return timer;
}

export { encryptSecret, decryptSecret };
export function getBackupArchivePath(id: string) {
  const job = getBackupJob(id);
  if (!job?.local_path) return null;
  const localPath = String(job.local_path);
  const resolved = path.resolve(localPath);
  const root = path.resolve(backupRoot);
  return (resolved === root || resolved.startsWith(`${root}${path.sep}`)) && fs.existsSync(resolved) && fs.lstatSync(resolved).isFile() ? resolved : null;
}

export function recordGoogleOAuthTokens(refreshToken: string, accountEmail?: string | null) {
  execute('UPDATE backup_settings SET google_refresh_token = ?, google_account_email = ?, updated_at = ? WHERE id = ?', [encryptSecret(refreshToken), accountEmail || null, now(), settingsId]);
  persistDatabase();
}

export { getBackupDirectory };
export { verifyState, exchangeGoogleCode };
