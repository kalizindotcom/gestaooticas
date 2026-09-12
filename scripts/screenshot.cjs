// Tira screenshots da página de login em diferentes tamanhos
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const sizes = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-390', width: 390, height: 844 },
  ];

  for (const s of sizes) {
    const ctx = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // animações
    const out = path.join(__dirname, `..`, `screenshots`, `login-${s.name}.png`);
    require('fs').mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: false });
    console.log(`✓ ${s.name} → ${out}`);

    // Também forgot-password
    await page.goto('http://localhost:8080/forgot-password', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const out2 = path.join(__dirname, `..`, `screenshots`, `forgot-${s.name}.png`);
    await page.screenshot({ path: out2, fullPage: false });
    console.log(`✓ forgot-${s.name} → ${out2}`);

    await ctx.close();
  }

  await browser.close();
  console.log('done');
})().catch(err => { console.error(err); process.exit(1); });