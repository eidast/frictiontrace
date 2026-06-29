const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const harPath = path.resolve(__dirname, '..', 'walmart-checkout.har');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    recordHar: {
      path: harPath,
      mode: 'full',
      content: 'omit',
    },
  });

  const page = await context.newPage();

  console.log('1. Homepage + location selection...');
  await page.goto('https://www.walmart.com.gt/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Dismiss location modal
  try {
    await page.waitForSelector('.styles_overlay__CLSq-', { timeout: 8000 });
    await page.evaluate(() => {
      const selects = document.querySelector('.styles_overlay__CLSq-').querySelectorAll('select');
      selects[0].value = 'Guatemala';
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const selects = document.querySelector('.styles_overlay__CLSq-').querySelectorAll('select');
      selects[1].value = 'Guatemala Zona 17';
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const btn = document.querySelector('.styles_overlay__CLSq-').querySelector('button:not([disabled])');
      if (btn) btn.click();
    });
    console.log('   Location modal dismissed');
    await page.waitForTimeout(3000);
  } catch (e) { console.log('   No location modal'); }

  // Now navigate to product directly
  console.log('2. Navigate to product page...');
  await page.goto('https://www.walmart.com.gt/arroz-suli-blanco-1700gr/p', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Add to cart
  console.log('3. Add to cart...');
  const addBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const cart = btns.find(b => b.offsetParent && b.textContent.includes('Agregar'));
    if (cart) { cart.click(); return true; }
    return false;
  });
  console.log('   Add to cart result:', addBtn);
  await page.waitForTimeout(4000);

  // Go to checkout
  console.log('4. Go to checkout...');
  await page.goto('https://www.walmart.com.gt/checkout/#/cart', { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(10000);

  console.log('5. Final state:', await page.title());

  // Extract cart summary
  const summary = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const lines = body.split('\n').filter(l => l.trim());
    const totalLine = lines.findIndex(l => l.includes('Total'));
    return lines.slice(Math.max(0, totalLine - 5), totalLine + 3).join(' | ');
  });
  console.log('   Cart summary:', summary);

  await context.close();

  const stats = fs.statSync(harPath);
  console.log('\n=== HAR file saved ===');
  console.log('Path:', harPath);
  console.log('Size:', (stats.size / 1024).toFixed(1), 'KB');
  console.log('\nTo analyze: Open Chrome DevTools > Network tab > Import HAR file');

  await browser.close();
})();
