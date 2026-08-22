import { chromium } from '@playwright/test';

const OUT = '/Users/rafalwolak/dev/cloudflare/planned.travel/.claude/ultrabuild/shots/w-widoku-atlas-brakuje-tooltips-w-mapie-aby-po-n/round-9/atlas-country-facts';
const combos = [
  [1440, 900, 'light'], [1440, 900, 'dark'],
  [360, 800, 'light'], [360, 800, 'dark'],
  [768, 1024, 'light'], [768, 1024, 'dark'],
  [2560, 1440, 'light'], [2560, 1440, 'dark'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  storageState: '/Users/rafalwolak/dev/cloudflare/planned.travel/.state.json',
});
const page = await ctx.newPage();
const msgs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) msgs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => msgs.push('pageerror: ' + e.message));

for (const [w, h, theme] of combos) {
  await page.setViewportSize({ width: w, height: h });
  msgs.length = 0;
  await page.goto('http://localhost:3001/atlas', { waitUntil: 'networkidle' });
  await page.evaluate((t) => {
    localStorage.setItem('planned.theme', t);
    document.documentElement.setAttribute('data-theme', t);
    let s = document.getElementById('no-anim') || document.createElement('style'); s.id = 'no-anim';
    s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    document.head.appendChild(s);
    let m = document.getElementById('mask-brand') || document.createElement('style'); m.id = 'mask-brand';
    m.textContent = 'nav a[href="/dashboard"], header a[href="/dashboard"]{visibility:hidden !important}';
    document.head.appendChild(m);
    window.scrollTo(0, 0);
  }, theme);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !!document.querySelector('[data-map-ready="true"]'), null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  const check = await page.evaluate(() => ({ w: innerWidth, t: document.documentElement.getAttribute('data-theme'), href: location.href }));
  await page.screenshot({ path: `${OUT}/${w}-${theme}-B.png`, fullPage: true });
  console.log(JSON.stringify({ file: `${w}-${theme}-B.png`, check, msgs: [...msgs] }));
}
await browser.close();
