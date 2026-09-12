// Tira screenshots das páginas internas (requer login)
// Como não temos auth, vamos capturar as que não exigem login OU login direto.
// Para simplificar, vamos capturar a página de login primeiro e as telas com mockData
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const routes = [
    { name: 'dashboard', url: 'http://localhost:8080/dashboard' },
    { name: 'customers', url: 'http://localhost:8080/customers' },
    { name: 'appointments', url: 'http://localhost:8080/appointments' },
    { name: 'sales', url: 'http://localhost:8080/sales' },
    { name: 'service-orders', url: 'http://localhost:8080/service-orders' },
    { name: 'products', url: 'http://localhost:8080/products' },
    { name: 'financial', url: 'http://localhost:8080/financial' },
    { name: 'reports', url: 'http://localhost:8080/reports' },
    { name: 'companies', url: 'http://localhost:8080/companies' },
    { name: 'stores', url: 'http://localhost:8080/stores' },
    { name: 'users', url: 'http://localhost:8080/users' },
    { name: 'settings', url: 'http://localhost:8080/settings' },
    { name: 'profile', url: 'http://localhost:8080/profile' },
    { name: 'notfound', url: 'http://localhost:8080/xyz-nao-existe' },
  ];

  fs.mkdirSync(path.join(__dirname, '..', 'screenshots'), { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  for (const r of routes) {
    const page = await ctx.newPage();
    try {
      await page.goto(r.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2500);
      const out = path.join(__dirname, '..', 'screenshots', `app-${r.name}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`✓ ${r.name}`);
    } catch (e) {
      console.log(`✗ ${r.name}: ${e.message.slice(0, 100)}`);
    }
    await page.close();
  }

  await ctx.close();
  await browser.close();
  console.log('done');
})().catch(err => { console.error(err); process.exit(1); });