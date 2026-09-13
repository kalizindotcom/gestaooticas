import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { tmpdir } from 'node:os';

type Json = Record<string, unknown> | Array<unknown> | null;
type ApiResult = { status: number; body: { data?: Json; error?: { code?: string; message?: string } | null } };

const masterEmail = 'phase3-master@example.test';
const masterPassword = 'Phase3Master-2026!';
const scopedEmail = 'phase3-company-a@example.test';
const scopedPassword = 'Phase3Scoped-2026!';
const fiscalViewerEmail = 'phase12-fiscal-viewer@example.test';
const fiscalViewerPassword = 'Phase12FiscalViewer-2026!';

let child: ChildProcess | undefined;
let dataDirectory = '';
let baseUrl = '';
let masterToken = '';
let scopedToken = '';
let fiscalViewerToken = '';

async function freePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForApi() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`Servidor HTTP encerrou durante o boot com código ${child.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // O processo ainda pode estar inicializando o sql.js.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Servidor HTTP de integração não respondeu ao healthcheck.');
}

async function api(pathname: string, options: { method?: string; body?: Json; token?: string; headers?: Record<string, string> } = {}): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json() as ApiResult['body'];
  return { status: response.status, body };
}

async function login(email: string, password: string) {
  const result = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  expect(result.status).toBe(200);
  const token = (result.body.data as { access_token?: string } | undefined)?.access_token;
  expect(token).toBeTruthy();
  return String(token);
}

async function insert(table: string, data: Record<string, unknown>, token = masterToken) {
  const result = await api(`/api/tables/${table}`, { method: 'POST', body: { data, single: true }, token });
  expect(result.status).toBe(201);
  return result.body.data as Record<string, unknown>;
}

async function stopServer() {
  if (!child) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    child?.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  child = undefined;
}

describe('isolamento HTTP por empresa e loja', () => {
  beforeAll(async () => {
    const port = await freePort();
    dataDirectory = await mkdtemp(path.join(tmpdir(), 'otica-phase3-'));
    baseUrl = `http://127.0.0.1:${port}`;
    const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
    child = spawn(process.execPath, [tsxCli, path.resolve(process.cwd(), 'server/index.ts')], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(port),
        OTICA_DATA_DIR: dataDirectory,
        OTICA_DISABLE_SCHEDULER: 'true',
        LOCAL_SEED_ADMIN: 'true',
        LOCAL_ADMIN_EMAIL: masterEmail,
        LOCAL_ADMIN_PASSWORD: masterPassword,
        LOCAL_AUTH_SECRET: 'phase3-test-secret-that-is-long-enough-2026',
      },
      stdio: 'ignore',
    });
    await waitForApi();
    masterToken = await login(masterEmail, masterPassword);

    await insert('companies', { id: 'company-a', name: 'Empresa A', status: 'active', created_at: new Date().toISOString() });
    await insert('companies', { id: 'company-b', name: 'Empresa B', status: 'active', created_at: new Date().toISOString() });
    await insert('stores', { id: 'store-a', company_id: 'company-a', name: 'Loja A', status: 'active', created_at: new Date().toISOString() });
    await insert('stores', { id: 'store-a2', company_id: 'company-a', name: 'Loja A2', status: 'active', created_at: new Date().toISOString() });
    await insert('stores', { id: 'store-b', company_id: 'company-b', name: 'Loja B', status: 'active', created_at: new Date().toISOString() });
    await insert('employees', { id: 'employee-a', company_id: 'company-a', store_id: 'store-a', name: 'Vendedor A', status: 'active', created_at: new Date().toISOString() });
    await insert('employees', { id: 'employee-b', company_id: 'company-b', store_id: 'store-b', name: 'Vendedor B', status: 'active', created_at: new Date().toISOString() });
    await insert('customers', { id: 'customer-a', company_id: 'company-a', store_id: 'store-a', name: 'Cliente A', status: 'active', created_at: new Date().toISOString() });
    await insert('customers', { id: 'customer-a2', company_id: 'company-a', store_id: 'store-a2', name: 'Cliente A2', status: 'active', created_at: new Date().toISOString() });
    await insert('customers', { id: 'customer-b', company_id: 'company-b', store_id: 'store-b', name: 'Cliente B', status: 'active', created_at: new Date().toISOString() });
    await insert('products', { id: 'product-a', company_id: 'company-a', name: 'Produto A', price: 100, status: 'active', created_at: new Date().toISOString() });
    await insert('products', { id: 'product-b', company_id: 'company-b', name: 'Produto B', price: 100, status: 'active', created_at: new Date().toISOString() });
    await insert('product_stock', { id: 'stock-a', product_id: 'product-a', store_id: 'store-a', quantity: 10, reserved_quantity: 0, created_at: new Date().toISOString() });
    await insert('product_stock', { id: 'stock-a2', product_id: 'product-a', store_id: 'store-a2', quantity: 10, reserved_quantity: 0, created_at: new Date().toISOString() });
    await insert('product_stock', { id: 'stock-b', product_id: 'product-b', store_id: 'store-b', quantity: 10, reserved_quantity: 0, created_at: new Date().toISOString() });
    await insert('service_orders', { id: 'order-b', company_id: 'company-b', store_id: 'store-b', customer_id: 'customer-b', date: '2026-09-12', status: 'opened', total: 100, created_at: new Date().toISOString() });

    const userResult = await api('/api/admin/users', {
      method: 'POST',
      token: masterToken,
      body: {
        email: scopedEmail,
        name: 'Operador Empresa A',
        password: scopedPassword,
        role: 'admin',
        companies: ['company-a'],
        stores: ['store-a'],
      },
    });
    expect(userResult.status).toBe(201);
    scopedToken = await login(scopedEmail, scopedPassword);

    const fiscalViewerResult = await api('/api/admin/users', {
      method: 'POST',
      token: masterToken,
      body: {
        email: fiscalViewerEmail,
        name: 'Visualizador Fiscal',
        password: fiscalViewerPassword,
        role: 'user',
        companies: ['company-a'],
        stores: ['store-a'],
      },
    });
    expect(fiscalViewerResult.status).toBe(201);
    fiscalViewerToken = await login(fiscalViewerEmail, fiscalViewerPassword);
  }, 30_000);

  afterAll(async () => {
    await stopServer();
    if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
  });

  it('expõe ao master o status formal do schema aplicado', async () => {
    const result = await api('/api/admin/database/migrations', { token: masterToken });
    expect(result.status).toBe(200);
    expect((result.body.data as { currentVersion: number; targetVersion: number; applied: Array<{ version: number }> })).toMatchObject({ currentVersion: 22, targetVersion: 22 });
    expect((result.body.data as { applied: Array<{ version: number }> }).applied.map((migration) => migration.version)).toEqual([20, 21, 22]);

    const scoped = await api('/api/admin/database/migrations', { token: scopedToken });
    expect(scoped.status).toBe(403);
  });

  it('não lista nem altera registros de outra empresa', async () => {
    const list = await api('/api/tables/customers?eq[id]=customer-b', { token: scopedToken });
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual([]);

    const update = await api('/api/tables/customers?eq[id]=customer-b', {
      method: 'PATCH',
      token: scopedToken,
      body: { data: { name: 'Tentativa indevida' } },
    });
    expect(update.status).toBe(200);
    expect(update.body.data).toEqual([]);

    const deletion = await api('/api/tables/customers?eq[id]=customer-b', {
      method: 'DELETE',
      token: scopedToken,
    });
    expect(deletion.status).toBe(200);
    expect(deletion.body.data).toBeNull();

    const masterRead = await api('/api/tables/customers?eq[id]=customer-b', { token: masterToken });
    expect(masterRead.status).toBe(200);
    expect((masterRead.body.data as Array<{ name: string }>)[0].name).toBe('Cliente B');
  });

  it('rejeita venda com cliente, vendedor, O.S. ou produto de outro tenant', async () => {
    const baseSale = {
      sale: { company_id: 'company-a', store_id: 'store-a', customer_id: 'customer-b', seller_id: 'employee-a', guest_name: 'Avulso', payment_method: 'pix' },
      items: [{ product_id: 'product-a', quantity: 1, unit_price: 100 }],
    };
    const foreignCustomer = await api('/api/operations/sales', { method: 'POST', token: scopedToken, body: baseSale });
    expect(foreignCustomer.status).toBe(403);
    expect(foreignCustomer.body.error?.code).toBe('TENANT_SCOPE_FORBIDDEN');

    const foreignProduct = await api('/api/operations/sales', {
      method: 'POST',
      token: scopedToken,
      body: { ...baseSale, sale: { ...baseSale.sale, customer_id: 'customer-a' }, items: [{ product_id: 'product-b', quantity: 1, unit_price: 100 }] },
    });
    expect(foreignProduct.status).toBe(403);

    const foreignOrder = await api('/api/operations/sales', {
      method: 'POST',
      token: scopedToken,
      body: { ...baseSale, sale: { ...baseSale.sale, customer_id: 'customer-a', service_order_id: 'order-b' } },
    });
    expect(foreignOrder.status).toBe(403);
  });

  it('rejeita O.S. e estoque de outra empresa ou de outra loja autorizada', async () => {
    const foreignOrder = await api('/api/tables/service_orders', {
      method: 'POST',
      token: scopedToken,
      body: { data: { id: 'order-cross', company_id: 'company-a', store_id: 'store-a', customer_id: 'customer-b', date: '2026-09-12', status: 'opened', total: 10, created_at: new Date().toISOString() } },
    });
    expect(foreignOrder.status).toBe(403);
    expect(foreignOrder.body.error?.code).toBe('TENANT_SCOPE_FORBIDDEN');

    const foreignStock = await api('/api/operations/product-stock', {
      method: 'POST',
      token: scopedToken,
      body: { product_id: 'product-b', store_id: 'store-a', operation: 'in', quantity: 1 },
    });
    expect(foreignStock.status).toBe(400);

    const crossStoreSale = await api('/api/operations/sales', {
      method: 'POST',
      token: scopedToken,
      body: {
        sale: { company_id: 'company-a', store_id: 'store-a2', customer_id: 'customer-a2', seller_id: 'employee-a', payment_method: 'pix' },
        items: [{ product_id: 'product-a', quantity: 1, unit_price: 100 }],
      },
    });
    expect(crossStoreSale.status).toBe(403);
    expect(crossStoreSale.body.error?.code).toBe('TENANT_SCOPE_FORBIDDEN');
  });

  it('rejeita financeiro e fiscal com referências cruzadas antes da escrita', async () => {
    const financial = await api('/api/operations/financial/manual-entry', {
      method: 'POST',
      token: scopedToken,
      body: { entry: { company_id: 'company-a', store_id: 'store-a', type: 'receivable', description: 'Teste cross tenant', amount: 25, customer_id: 'customer-b' } },
    });
    expect(financial.status).toBe(403);
    expect(financial.body.error?.code).toBe('TENANT_SCOPE_FORBIDDEN');

    const fiscal = await api('/api/operations/fiscal/documents', {
      method: 'POST',
      token: scopedToken,
      body: { company_id: 'company-a', store_id: 'store-a', type: 'NFC-e', operation: 'manual', customer_id: 'customer-b', customer_name: 'Cliente B', total: 25, items: [{ product_id: 'product-a', quantity: 1, unit_price: 25 }] },
    });
    expect(fiscal.status).toBe(403);
    expect(fiscal.body.error?.code).toBe('TENANT_SCOPE_FORBIDDEN');
  });

  it('faz rollback do lote genérico quando a segunda referência viola o tenant', async () => {
    const batch = await api('/api/tables/service_orders', {
      method: 'POST',
      token: scopedToken,
      body: {
        data: [
          { id: 'order-batch-a', company_id: 'company-a', store_id: 'store-a', customer_id: 'customer-a', date: '2026-09-12', status: 'opened', total: 10, created_at: new Date().toISOString() },
          { id: 'order-batch-cross', company_id: 'company-a', store_id: 'store-a', customer_id: 'customer-b', date: '2026-09-12', status: 'opened', total: 10, created_at: new Date().toISOString() },
        ],
      },
    });
    expect(batch.status).toBe(403);
    const after = await api('/api/tables/service_orders?eq[id]=order-batch-a', { token: masterToken });
    expect(after.status).toBe(200);
    expect(after.body.data).toEqual([]);
  });

  it('mantém a operação do master para todos os tenants', async () => {
    const masterRead = await api('/api/tables/service_orders?eq[id]=order-b', { token: masterToken });
    expect(masterRead.status).toBe(200);
    expect((masterRead.body.data as Array<{ id: string }>)[0].id).toBe('order-b');
  });

  it('grava O.S., timeline e financeiro em uma única operação idempotente', async () => {
    const key = 'phase11-os-idempotency-key';
    const payload = { company_id: 'company-a', store_id: 'store-a', customer_id: 'customer-a', date: '2026-09-13', delivery_date: '2026-09-20', total: 250, paid_amount: 50, status: 'opened', service_type: 'montagem' };
    const created = await api('/api/operations/service-orders', { method: 'POST', token: scopedToken, headers: { 'Idempotency-Key': key }, body: payload });
    expect(created.status).toBe(201);
    const orderId = String((created.body.data as { id: string }).id);
    expect(orderId).toBeTruthy();

    const replay = await api('/api/operations/service-orders', { method: 'POST', token: scopedToken, headers: { 'Idempotency-Key': key }, body: payload });
    expect(replay.status).toBe(200);
    expect((replay.body.data as { id: string }).id).toBe(orderId);

    const timeline = await api(`/api/tables/service_order_timeline?eq[service_order_id]=${orderId}`, { token: masterToken });
    expect(timeline.status).toBe(200);
    expect((timeline.body.data as Array<unknown>).length).toBe(1);
    const financial = await api(`/api/tables/financial_entries?eq[origin_table]=service_orders&eq[origin_id]=${orderId}`, { token: masterToken });
    expect(financial.status).toBe(200);
    expect((financial.body.data as Array<{ amount: number; paid_amount: number }>).length).toBe(1);
    expect((financial.body.data as Array<{ amount: number; paid_amount: number }>)[0]).toMatchObject({ amount: 250, paid_amount: 50 });

    const invalidUpdate = await api(`/api/operations/service-orders/${orderId}`, { method: 'PATCH', token: scopedToken, body: { customer_id: 'customer-b', total: 300 } });
    expect(invalidUpdate.status).toBe(403);
    const unchanged = await api(`/api/tables/service_orders?eq[id]=${orderId}`, { token: masterToken });
    expect((unchanged.body.data as Array<{ total: number; customer_id: string }>)[0]).toMatchObject({ total: 250, customer_id: 'customer-a' });
  });

  it('faz rollback dos efeitos de O.S. quando ocorre falha intermediária', async () => {
    const beforeOrders = await api('/api/tables/service_orders', { token: masterToken });
    const beforeFinancial = await api('/api/tables/financial_entries', { token: masterToken });
    const failed = await api('/api/operations/service-orders', {
      method: 'POST',
      token: scopedToken,
      headers: { 'Idempotency-Key': 'phase11-os-rollback-key', 'x-test-fail-after-os': '1' },
      body: { company_id: 'company-a', store_id: 'store-a', customer_id: 'customer-a', date: '2026-09-13', total: 99, paid_amount: 0 },
    });
    expect(failed.status).toBe(500);
    const afterOrders = await api('/api/tables/service_orders', { token: masterToken });
    const afterFinancial = await api('/api/tables/financial_entries', { token: masterToken });
    expect((afterOrders.body.data as Array<unknown>).length).toBe((beforeOrders.body.data as Array<unknown>).length);
    expect((afterFinancial.body.data as Array<unknown>).length).toBe((beforeFinancial.body.data as Array<unknown>).length);
  });

  it('permite consulta fiscal ao perfil de leitura, mas bloqueia configuração e emissão', async () => {
    const list = await api('/api/operations/fiscal/documents?company_id=company-a&store_id=store-a', { token: fiscalViewerToken });
    expect(list.status).toBe(200);
    const capabilities = await api('/api/operations/fiscal/capabilities?company_id=company-a&store_id=store-a', { token: fiscalViewerToken });
    expect(capabilities.status).toBe(200);
    expect(capabilities.body.data).toMatchObject({ simulation_enabled: true, external_transmission_enabled: false, production_enabled: false });
    const create = await api('/api/operations/fiscal/documents', {
      method: 'POST',
      token: fiscalViewerToken,
      body: { company_id: 'company-a', store_id: 'store-a', type: 'NFC-e', operation: 'manual', customer_name: 'Teste fiscal', total: 10 },
    });
    expect(create.status).toBe(403);
    const configure = await api('/api/operations/fiscal/config', {
      method: 'PUT',
      token: fiscalViewerToken,
      body: { company_id: 'company-a', store_id: 'store-a', environment: 'homologacao', provider: 'local-simulation' },
    });
    expect(configure.status).toBe(403);

    const masterConfig = await api('/api/operations/fiscal/config', {
      method: 'PUT',
      token: masterToken,
      body: { company_id: 'company-a', store_id: 'store-a', environment: 'producao', provider: 'local-simulation' },
    });
    expect(masterConfig.status).toBe(200);
    const draft = await api('/api/operations/fiscal/documents', {
      method: 'POST',
      token: masterToken,
      body: { company_id: 'company-a', store_id: 'store-a', type: 'NFC-e', operation: 'manual', customer_name: 'Teste produção bloqueada', total: 10, idempotency_key: 'phase12-production-lock' },
    });
    expect(draft.status).toBe(201);
    const transmission = await api(`/api/operations/fiscal/documents/${String((draft.body.data as { document: { id: string } }).document.id)}/transmit`, { method: 'POST', token: masterToken, body: {} });
    expect(transmission.status).toBe(409);
    expect(transmission.body.error?.code).toBe('FISCAL_PRODUCTION_LOCKED');
  });
});
