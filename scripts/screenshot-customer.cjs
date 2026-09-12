// Screenshot do CustomerDetailsModal após login
// Abre /customers, clica na primeira linha, espera o modal, tira screenshot.
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  // 1) Login
  await page.goto('http://localhost:8080/login');
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', 'kalieldeus.hiolaos@gmail.com');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 2) Vai para Customers
  await page.goto('http://localhost:8080/customers');
  await page.waitForTimeout(2500);

  // 3) Tira screenshot da página
  await page.screenshot({ path: 'c:/Users/h2k/Documents/projetos/otica_nordestina-main/screenshots/customer-list-after.png' });
  console.log('customer-list OK');

  // 4) Tenta clicar na primeira linha da tabela para abrir o modal
  try {
    const firstRow = await page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: 5000 })) {
      await firstRow.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: 'c:/Users/h2k/Documents/projetos/otica_nordestina-main/screenshots/customer-modal-after.png' });
      console.log('customer-modal OK');
    } else {
      console.log('no rows visible');
    }
  } catch (e) {
    console.log('row click failed:', e.message);
  }

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });