// Screenshot do app em localhost (login + dashboard + financeiro)
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

  try {
    // 1) Login page
    await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'c:/Users/h2k/Documents/projetos/otica_nordestina-main/screenshots/localhost-login.png' });
    console.log('OK localhost-login');

    // 2) Login submit
    await page.fill('input[type="email"]', 'kalieldeus.hiolaos@gmail.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'c:/Users/h2k/Documents/projetos/otica_nordestina-main/screenshots/localhost-dashboard.png' });
    console.log('OK localhost-dashboard');

    // 3) Financeiro
    await page.goto('http://localhost:8080/financial', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'c:/Users/h2k/Documents/projetos/otica_nordestina-main/screenshots/localhost-financeiro.png' });
    console.log('OK localhost-financeiro');
  } catch (e) {
    console.error('Erro:', e.message);
  }

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });