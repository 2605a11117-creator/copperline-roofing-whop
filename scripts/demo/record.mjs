// Demo recorder for the roofing template.
//
//   node record.mjs setup    Opens Microsoft Edge with a separate demo profile. Sign in to Whop, the
//                            Whop sandbox and GitHub there, then close the window. Your normal browser
//                            profile is not touched.
//   node record.mjs rehearse Plays the script in that profile without recording or paying, to check it.
//   node record.mjs record   Opens the same profile, records the whole screen with ffmpeg and plays the
//                            demo: the live site, the estimate form, a sandbox checkout, the deposit,
//                            the final invoice, then the Whop dashboard and the source code.
//                            It pauses where a person has to type: the sandbox test card at each
//                            checkout and the office passcode. A caption on the page says what to do.
//
// Settings are read from demo.config.json next to this file (copy demo.config.example.json).

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright-core';
import {
  clickWithPointer,
  pointAt,
  pointAtTab,
  pointAtViewport,
  ripple,
  startPointer,
  stopPointer,
  syncPointer,
} from './pointer.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(here, 'demo.config.json'), 'utf8'));
const mode = process.argv[2] ?? 'record';
const PORT = Number(config.debugPort ?? 9333);
// The browser profile lives on the local disk by default (a profile on a USB drive is slow).
const profileDir = config.profileDir
  ? path.resolve(here, config.profileDir)
  : path.join(process.env.LOCALAPPDATA ?? here, 'roofing-template-demo-profile');
const outDir = path.resolve(here, config.outDir ?? 'output');
const site = config.siteUrl.replace(/\/+$/, '');
const WAIT_FOR_PERSON_MS = 6 * 60 * 1000;

function browserPath() {
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [];
  for (const root of roots) {
    candidates.push(path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    candidates.push(path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  if (config.browserPath) candidates.unshift(config.browserPath);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Could not find Microsoft Edge or Google Chrome. Set browserPath in demo.config.json.');
  return found;
}

async function waitForDebugger() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return;
    } catch {
      // The browser is still starting.
    }
    await sleep(500);
  }
  throw new Error(`The browser did not open its debugging port ${PORT}.`);
}

async function openBrowser(urls) {
  mkdirSync(profileDir, { recursive: true });
  const child = spawn(
    browserPath(),
    [
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${PORT}`,
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate,msEdgeSidebarV2',
      ...urls,
    ],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();
  await waitForDebugger();
  return chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
}

// ---------------------------------------------------------------------------------------------
// Captions: a box in the lower-left corner that says what each part of the video shows.

async function caption(page, title, body = '') {
  await page
    .evaluate(
      ([heading, text]) => {
        let box = document.getElementById('demo-caption');
        if (!box) {
          box = document.createElement('div');
          box.id = 'demo-caption';
          box.setAttribute('aria-hidden', 'true');
          Object.assign(box.style, {
            position: 'fixed',
            left: '20px',
            bottom: '20px',
            zIndex: '2147483647',
            maxWidth: 'min(560px, calc(100vw - 440px))',
            minWidth: '280px',
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.94)',
            color: '#fff',
            font: '500 17px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
            pointerEvents: 'none',
          });
          document.documentElement.appendChild(box);
        }
        box.innerHTML = '';
        const strong = document.createElement('div');
        strong.textContent = heading;
        strong.style.font = '700 19px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif';
        box.appendChild(strong);
        if (text) {
          const p = document.createElement('div');
          p.textContent = text;
          p.style.marginTop = '6px';
          p.style.opacity = '0.92';
          box.appendChild(p);
        }
      },
      [title, body],
    )
    .catch(() => {});
}

async function smoothScrollTo(page, selector, block = 'start') {
  // Rest the pointer over the content, as when scrolling with the wheel.
  const size = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight })).catch(() => null);
  if (size) await pointAtViewport(page, size.w * 0.58, size.h * 0.6, 500);
  await page.evaluate(
    ([sel, where]) => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: where }),
    [selector, block],
  );
  await sleep(1400);
}

/** Scrolls an element to the middle of the window, clear of the sticky header and the mobile bar. */
async function centre(locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});
  await sleep(250);
}

async function typeInto(page, selector, text) {
  const field = page.locator(selector).first();
  await centre(field);
  await clickWithPointer(page, field);
  await field.fill('');
  await field.pressSequentially(text, { delay: 35 });
}

async function clickCentred(locator) {
  await centre(locator);
  await clickWithPointer(locator.page(), locator);
}

async function checkCentred(locator) {
  await centre(locator);
  const point = await pointAt(locator.page(), locator);
  if (point) await ripple(locator.page(), point.vx, point.vy);
  await locator.check();
}

async function selectCentred(page, selector, option) {
  const select = page.locator(selector).first();
  await centre(select);
  await pointAt(page, select);
  await select.selectOption(option).catch(() => {});
  await sleep(300);
}

/** Opens or folds the ?debug=1 pixel panel; open, it covers the right edge of the window. */
async function setInspector(page, open) {
  const toggle = page.locator('.inspector__toggle').first();
  if (!(await toggle.count().catch(() => 0))) return;
  const expanded = (await toggle.getAttribute('aria-expanded').catch(() => null)) === 'true';
  if (expanded !== open) {
    await clickWithPointer(page, toggle).catch(() => {});
    await sleep(400);
  }
}

// Spans (seconds from the start of the recording) where a person typed. They are sped up afterwards.
const turns = [];
let recordingStartedAt = null;
const since = () => (recordingStartedAt === null ? null : (Date.now() - recordingStartedAt) / 1000);

async function waitForPerson(page, predicate, title, body) {
  await caption(page, title, body);
  const started = Date.now();
  const from = since();
  while (Date.now() - started < WAIT_FOR_PERSON_MS) {
    if (await predicate().catch(() => false)) {
      if (from !== null) turns.push({ from: from + 2, to: since() - 1 });
      // The person moved the mouse: continue the pointer's glides from where they left it.
      await syncPointer();
      return;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting: ${title}`);
}

// ---------------------------------------------------------------------------------------------
// Tabs: 1 the live Whop website, 2 the Whop dashboard, 3 the GitHub repository.

async function maximize(page) {
  try {
    const session = await page.context().newCDPSession(page);
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
    await session.detach();
  } catch {
    // Keep the window as it is.
  }
}

async function prepareTabs(browser) {
  const context = browser.contexts()[0];
  const pages = context.pages();
  const siteTab = pages[0] ?? (await context.newPage());
  for (const extra of pages.slice(1)) await extra.close().catch(() => {});
  await siteTab.bringToFront();
  await maximize(siteTab);
  await siteTab.goto(`${site}/?debug=1`, { waitUntil: 'domcontentloaded' });
  const views = config.dashboardViews ?? [];
  const dashboardTab = await context.newPage();
  const firstDashboard = views.find((view) => !/github\.com/.test(view.url));
  if (firstDashboard) {
    await dashboardTab.goto(firstDashboard.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    // Filter the first list before the recording starts, so other account details never appear.
    if (firstDashboard.search) await searchList(dashboardTab, firstDashboard.search, false);
  }
  const codeTab = await context.newPage();
  const code = views.find((view) => /github\.com/.test(view.url));
  if (code) await codeTab.goto(code.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await siteTab.bringToFront();
  await sleep(1000);
  return { order: [siteTab, dashboardTab, codeTab], site: siteTab, dashboard: dashboardTab, code: codeTab, active: siteTab };
}

/** Moves the pointer to a tab, then shows that tab. */
async function switchTab(tabs, tab) {
  if (tabs.active === tab) return;
  await pointAtTab(tabs.active, tabs.order.indexOf(tab), tabs.order.length);
  await tab.bringToFront();
  tabs.active = tab;
  await sleep(700);
}

// ---------------------------------------------------------------------------------------------
// Screen recording with ffmpeg (Windows screen capture through gdigrab).

function startRecording(file) {
  mkdirSync(path.dirname(file), { recursive: true });
  const args = [
    '-y',
    '-f', 'gdigrab',
    '-framerate', String(config.framerate ?? 24),
    '-draw_mouse', '1',
    '-i', 'desktop',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', String(config.crf ?? 26),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    file,
  ];
  const ffmpeg = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let log = '';
  ffmpeg.stderr.on('data', (chunk) => {
    log = (log + chunk.toString()).slice(-4000);
  });
  const done = new Promise((resolve) => ffmpeg.on('exit', (code) => resolve(code)));
  return {
    async stop() {
      ffmpeg.stdin.write('q');
      ffmpeg.stdin.end();
      const code = await done;
      if (code !== 0) console.error(log);
      return code;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The demo itself.

const person = config.testCustomer;

async function showSite(page) {
  await page.goto(`${site}/?debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#services');
  await caption(
    page,
    `Live on Whop Websites: ${new URL(site).host}`,
    'Deployed with the Whop CLI (whop apps deploy). The panel on the right lists every whop.track event as it fires.',
  );
  await sleep(4500);

  await smoothScrollTo(page, '#services');
  await caption(page, 'Services: repair, replacement, inspection', 'Each card fires whop.track("service_viewed") the first time it scrolls into view.');
  await sleep(4000);
  await page.mouse.wheel(0, 500);
  await sleep(2000);

  await smoothScrollTo(page, '#process');
  await caption(page, 'How a job runs', 'Inspection, then a $500 deposit saves the card on file, then the final invoice after the job.');
  await sleep(3000);

  await smoothScrollTo(page, '#financing');
  await caption(page, 'Financing callout', 'Checkout runs entirely on Whop, so Klarna, Afterpay and Splitit appear automatically for approved merchants.');
  await sleep(3500);

  await smoothScrollTo(page, '#area');
  await caption(page, 'Service area', 'ZIP code check against the configured service area.');
  await sleep(1200);
  await typeInto(page, '.zip-check__input', person.zip);
  await clickCentred(page.locator('.zip-check button[type="submit"]').first());
  await sleep(3000);

  await smoothScrollTo(page, '#reviews');
  await caption(page, 'Reviews and trust', 'Ratings, reviews, license and warranty details, all from the config file.');
  await sleep(3500);

  await smoothScrollTo(page, '#faq');
  await caption(page, 'Questions and contact details');
  await sleep(2000);
}

async function requestEstimate(page) {
  await smoothScrollTo(page, '#estimate');
  await setInspector(page, false);
  await caption(page, 'Request an estimate', 'This form creates a lead on the Whop account through the Whop API: POST /members, then POST /events with event_name "lead".');
  await typeInto(page, '#estimate [name="name"]', person.name);
  await typeInto(page, '#estimate [name="phone"]', person.phone);
  await typeInto(page, '#estimate [name="email"]', person.email);
  await typeInto(page, '#estimate [name="address"]', person.address);
  await typeInto(page, '#estimate [name="zip"]', person.zip);
  await selectCentred(page, '#estimate [name="service"]', { index: 1 });
  await selectCentred(page, '#estimate [name="timeline"]', { index: 1 });
  await typeInto(page, '#estimate [name="message"]', 'Shingles lifted after the last hail storm, small leak over the garage.');
  const consent = page.locator('#estimate #consent');
  if (await consent.count()) await checkCentred(consent);
  await sleep(800);
  await clickCentred(page.locator('#estimate button[type="submit"]').first());
  await page.waitForSelector('#estimate [role="status"], #estimate .form-panel--done, #estimate .estimate-done', { timeout: 30000 }).catch(() => {});
  await centre(page.locator('#estimate .form-panel--done, #estimate').first());
  await setInspector(page, true);
  await sleep(1500);
  await caption(page, 'Estimate request sent: lead created on the Whop account', 'The response carries the lead ID from Whop. The panel shows whop.track("estimate_requested") and the standard lead event, deduplicated with the server copies by event_id.');
  await sleep(5000);
}

async function fillBooking(page, { job }) {
  await typeInto(page, '#book-name', person.name);
  await typeInto(page, '#book-phone', person.phone);
  await typeInto(page, '#book-address', person.address);
  await typeInto(page, '#book-zip', person.zip);
  if (job) {
    const consent = page.locator('#book-deposit-consent');
    if (await consent.count()) await checkCentred(consent);
  } else {
    await selectCentred(page, '#book-window', { index: 1 });
  }
  await sleep(600);
  await clickCentred(page.getByRole('button', { name: /continue to payment/i }));
  await sleep(2500);
}

async function fillEmail(page) {
  // The email field lives in Whop's EmailElement frame. A fictional address is fine in the sandbox.
  // Each checkout gets a fresh address: an address Whop already knows (the estimate added this person
  // as a member) makes the form ask for an emailed sign-in code first.
  const email = person.email.replace('@', `+${Date.now().toString(36)}@`);
  let filled = false;
  for (const frame of page.frames()) {
    const input = frame.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
    if (await input.count().catch(() => 0)) {
      await clickWithPointer(page, input).catch(() => {});
      await input.fill(email).catch(() => {});
      await page.keyboard.press('Tab').catch(() => {});
      filled = true;
      break;
    }
  }
  await sleep(2500);
  for (const frame of page.frames()) {
    const skip = frame.getByText(/continue without signing in/i).first();
    if (await skip.count().catch(() => 0)) await skip.click().catch(() => {});
  }
  await fillBillingPlace(page);
  return filled;
}

/** City and state of the demo customer in the PaymentElement billing address, when they are empty. */
async function fillBillingPlace(page) {
  for (const frame of page.frames()) {
    const city = frame.locator('input[placeholder="City"]').first();
    if (await city.count().catch(() => 0)) {
      if (!(await city.inputValue().catch(() => ''))) await city.fill(person.city ?? 'Denver').catch(() => {});
    }
    for (const select of await frame.locator('select').all().catch(() => [])) {
      const labels = await select.locator('option').allTextContents().catch(() => []);
      if (!labels.includes('Colorado')) continue;
      const current = await select.evaluate((el) => el.options[el.selectedIndex]?.text ?? '').catch(() => '');
      if (!current || /^state$/i.test(current)) await select.selectOption({ label: person.state ?? 'Colorado' }).catch(() => {});
    }
  }
}

/**
 * Opens a booking page through the site's own link (in-app navigation, like a visitor), so the page is
 * never reloaded while the pixel still has events to send. Falls back to the address if no link is found.
 */
async function openOffer(page, offerPath) {
  const link = page.locator(`footer a[href="${offerPath}"], main a[href="${offerPath}"]`).first();
  if (await link.count().catch(() => 0)) {
    await clickCentred(link);
  } else {
    await page.goto(`${site}${offerPath}`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector('#book-name');
  await centre(page.locator('h1').first());
}

async function checkout(page, offerPath, { job }) {
  await openOffer(page, offerPath);
  await caption(
    page,
    job ? 'Project deposit, $500' : 'Inspection, $149',
    job ? 'Opening the deposit checkout fires whop.track("deposit_started").' : 'Booking details first, then payment on Whop.',
  );
  await sleep(3000);
  await fillBooking(page, { job });
  await caption(
    page,
    'Whop Payment Elements',
    'ExpressCheckoutElement (wallet buttons; the sandbox has no Apple Pay or Google Pay), EmailElement and PaymentElement, with the required BrandingElement. No custom card form.',
  );
  await sleep(4500);
  await fillEmail(page);
  await waitForPerson(
    page,
    async () => page.url().includes('/return'),
    'Your turn: enter the sandbox test card',
    '4242 4242 4242 4242, any future date, any CVC, then press the Pay button.',
  );
  await page.waitForLoadState('domcontentloaded');
  await sleep(3500);
  await caption(
    page,
    job ? 'Deposit paid, card saved on file' : 'Test checkout complete',
    job
      ? 'The card was saved with a Setup Intent, then the $500 deposit was charged to that saved card.'
      : 'Paid in the Whop sandbox with Payment Elements. The payment ID comes back from the Whop Payments API.',
  );
  await sleep(6000);
}

async function office(page) {
  await page.goto(`${site}/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="password"], .admin__title', { timeout: 20000 }).catch(() => {});
  await setInspector(page, false);
  await waitForPerson(
    page,
    async () => (await page.locator('.admin__title').count()) > 0,
    'Office page',
    'Your turn: type the office passcode and press Enter.',
  );
  await caption(page, 'Office: Whop setup check', 'Environment, product and plan IDs for the $149 inspection, $395 flat-rate leak repair and $500 deposit.');
  await sleep(4500);
  await smoothScrollTo(page, '#leads-title');
  await caption(page, 'Leads read back from the Whop API', 'The estimate request from a minute ago, with its Whop lead ID, read back from the Whop API (members and their notes).');
  await sleep(5000);
  await smoothScrollTo(page, '#jobs-title');
  await caption(page, 'Deposits with a card on file', 'Read from the Setup Intents API. Bill the final balance from here.');
  await sleep(4000);

  const bill = page.getByRole('button', { name: /bill final balance/i }).first();
  if (await bill.count()) {
    await clickCentred(bill);
    await sleep(1500);
  }
  const amount = page.locator('input[id$="-amount"]').first();
  if (await amount.count()) {
    await clickCentred(amount);
    await amount.fill('');
    await amount.pressSequentially(String(config.finalBalance ?? 7950), { delay: 60 });
  }
  const charge = page.locator('.choice input[type="radio"]').first();
  if (await charge.count()) await checkCentred(charge);
  await sleep(1000);
  await caption(
    page,
    'Final balance with the Whop Invoices API',
    'POST /invoices for the remaining $7,950, with the card saved at deposit checkout as its payment method, then /issue to charge it.',
  );
  await clickCentred(page.getByRole('button', { name: /create invoice/i }).first());
  await page.locator('.invoice-card').first().waitFor({ timeout: 30000 }).catch(() => {});
  await sleep(1500);
  await centre(page.locator('.invoice-card').first());
  const card = page.locator('.invoice-card').first();
  if (await card.count()) await pointAt(page, card.locator('dl').first(), 700);
  const draft = (await card.locator('.badge').first().textContent().catch(() => '')) === 'draft';
  await caption(
    page,
    draft ? 'Invoice created through the Invoices API' : 'Invoice created and charged',
    draft
      ? 'Whop created the $7,950 invoice with the saved card attached. Whop issues invoices only for verified businesses, and this sandbox account is not verified, so it stays a draft; on a verified account the same call charges the card.'
      : 'The invoice is read back from the Invoices API with its status.',
  );
  await sleep(8000);
}

/** Types into a dashboard list's search box (narrows the list to the demo customer). */
async function searchList(page, text, withPointer) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  const box = page.getByPlaceholder(/search by name/i).first();
  await box.waitFor({ timeout: 10000 }).catch(() => {});
  if (!(await box.count().catch(() => 0))) return false;
  if ((await box.inputValue().catch(() => '')) === text) return true;
  if (withPointer) await clickWithPointer(page, box).catch(() => {});
  else await box.click().catch(() => {});
  await box.fill('').catch(() => {});
  await box.pressSequentially(text, { delay: 60 }).catch(() => {});
  await sleep(2500);
  return true;
}

/** Analytics > Websites: the Events card lists the custom whop.track events Whop recorded. */
async function showEventsCard(page) {
  // The card loads after the page; wait for its Events tab.
  const tab = page.getByText('Events', { exact: true }).last();
  await tab.waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await tab.count().catch(() => 0))) return;
  await sleep(1000);
  // Minimize Whop's onboarding checklist (only its own minimize button: its other buttons open other pages).
  const minimize = page.getByRole('button', { name: 'Minimize checklist' }).first();
  if (await minimize.isVisible().catch(() => false)) {
    await minimize.click({ timeout: 3000 }).catch(() => {});
    await sleep(600);
  }
  await centre(tab);
  await clickWithPointer(page, tab).catch(() => {});
  await sleep(2000);
  const row = page.getByText(/estimate_requested/).first();
  if (await row.count().catch(() => 0)) {
    await centre(row);
    await pointAt(page, row, 700);
  }
}

/** The Whop dashboard pages in tab 2, then the source code in tab 3. */
async function dashboards(tabs) {
  for (const view of config.dashboardViews ?? []) {
    const page = /github\.com/.test(view.url) ? tabs.code : tabs.dashboard;
    await switchTab(tabs, page);
    if (page.url() !== view.url && page.url().replace(/[?#].*$/, '') !== view.url.replace(/[?#].*$/, '')) {
      await page.goto(view.url, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await sleep(1000);
    // Narrow a list to the demo customer, so no other account details appear in the video.
    if (view.search) await searchList(page, view.search, true);
    if (view.events) await showEventsCard(page);
    // Point at the first row of the list or the page heading while the caption is read.
    const focus = page.locator('table tbody tr, [role="row"], main h1, article h1').first();
    if (!view.events && (await focus.count().catch(() => 0))) await pointAt(page, focus, 700);
    await caption(page, view.title, view.body ?? '');
    await sleep(view.seconds ? view.seconds * 1000 : 6000);
    if (view.scroll) {
      const size = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
      await pointAtViewport(page, size.w * 0.5, size.h * 0.6, 500);
      await page.mouse.wheel(0, view.scroll);
      await sleep(3000);
    }
  }
}

async function record() {
  const browser = await openBrowser([]);
  const tabs = await prepareTabs(browser);
  const page = tabs.site;
  await startPointer();
  await sleep(1500);

  const file = path.join(outDir, config.outputName ?? 'roofing-template-demo.mp4');
  const raw = file.replace(/\.mp4$/, '-raw.mp4');
  const recording = startRecording(raw);
  recordingStartedAt = Date.now();
  console.log(`Recording to ${raw}`);
  let code = 1;
  try {
    await showSite(page);
    await requestEstimate(page);
    await checkout(page, '/book/inspection', { job: false });
    await checkout(page, '/book/deposit', { job: true });
    await office(page);
    await dashboards(tabs);
    await caption(tabs.active, 'Thanks for watching', config.closingLine ?? '');
    await sleep(4000);
  } finally {
    code = await recording.stop();
    console.log(code === 0 ? `Saved ${raw}` : `ffmpeg exited with code ${code}`);
    stopPointer();
    await browser.close().catch(() => {});
  }
  if (code === 0) {
    const fast = await speedUpTurns(raw, file, turns, Number(config.turnSpeed ?? 3));
    console.log(fast === 0 ? `Saved ${file} (typing turns sped up)` : `Could not speed up the turns; the full take is ${raw}`);
  }
}

/**
 * Plays the spans where a person typed (card details, passcode) faster, so the video stays short.
 * Everything else keeps its real speed. Writes a new file; the raw take is kept.
 */
function speedUpTurns(input, output, spans, speed) {
  const cuts = spans
    .filter((span) => span.to - span.from > 3)
    .sort((a, b) => a.from - b.from);
  // One time map for the whole video: inside a span, time runs `speed` times faster; outside, at 1x.
  // new_t = t - sum(clip(t - from, 0, length)) * (1 - 1/speed); fps then drops the surplus frames.
  const saved = (1 - 1 / speed).toFixed(4);
  const shift = cuts.map((span) => `clip(T-${span.from.toFixed(2)},0,${(span.to - span.from).toFixed(2)})`).join('+') || '0';
  const filter = `setpts='(T-(${shift})*${saved})/TB',fps=${config.framerate ?? 24}`;
  console.log(`Speeding up ${cuts.length} typing spans ${speed}x: ${cuts.map((c) => `${c.from.toFixed(0)}-${c.to.toFixed(0)}s`).join(', ')}`);
  return new Promise((resolve) => {
    const ffmpeg = spawn(
      ffmpegPath,
      ['-y', '-loglevel', 'error', '-i', input, '-vf', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(config.crf ?? 26), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    ffmpeg.on('exit', resolve);
  });
}

/** One still frame of the whole screen (used by the rehearsal to check the tabs). */
function screenshot(file) {
  mkdirSync(path.dirname(file), { recursive: true });
  return new Promise((resolve) => {
    const ffmpeg = spawn(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'gdigrab', '-draw_mouse', '1', '-i', 'desktop', '-frames:v', '1', file], { stdio: 'ignore' });
    ffmpeg.on('exit', resolve);
  });
}

/**
 * Plays the same script in the demo window without recording or paying: the site tour, the estimate,
 * both checkouts up to the card fields, the office passcode screen and the dashboard pages.
 * Run it before `record` to catch layout or sign-in problems.
 */
async function rehearse() {
  const browser = await openBrowser([]);
  const tabs = await prepareTabs(browser);
  const page = tabs.site;
  await startPointer();
  await screenshot(path.join(outDir, 'rehearsal-tabs.png'));
  const step = async (name, run) => {
    try {
      await run();
      console.log(`ok    ${name}`);
    } catch (error) {
      console.log(`FAIL  ${name}: ${String(error?.message ?? error).split('\n')[0]}`);
    }
  };
  try {
    // `node record.mjs rehearse dashboards` plays only the dashboard tour.
    if (process.argv[3] !== 'dashboards') {
      await page.goto(`${site}/?debug=1`, { waitUntil: 'domcontentloaded' });
      await step('site tour', () => showSite(page));
      await step('estimate form', () => requestEstimate(page));
      for (const [offerPath, job] of [['/book/inspection', false], ['/book/deposit', true]]) {
        await step(`${offerPath} up to the card fields`, async () => {
          await openOffer(page, offerPath);
          await fillBooking(page, { job });
          await sleep(4000);
          if (!(await fillEmail(page))) throw new Error('no email field found');
          await caption(page, 'Rehearsal: the card would be typed here', 'Nothing is paid in a rehearsal.');
          await sleep(2500);
        });
      }
      await step('office passcode screen', async () => {
        await page.goto(`${site}/admin`, { waitUntil: 'domcontentloaded' });
        await page.locator('input[type="password"]').first().waitFor({ timeout: 20000 });
      });
    }
    await step('dashboard pages', () => dashboards(tabs));
    const dashboardTitle = await tabs.dashboard.title().catch(() => '');
    if (/create campaign|ads/i.test(dashboardTitle)) console.log(`FAIL  dashboard tab ended on "${dashboardTitle}"`);
    await screenshot(path.join(outDir, 'rehearsal-end.png'));
    await caption(tabs.active, 'Rehearsal finished', 'Nothing was recorded or paid.');
  } finally {
    stopPointer();
    await browser.close().catch(() => {});
  }
}

async function setup() {
  const browser = await openBrowser(config.setupUrls ?? ['https://whop.com/login/', 'https://sandbox.whop.com/login/', 'https://github.com/login']);
  console.log('Edge is open with the demo profile. Sign in on each tab, then close the window.');
  await browser.close().catch(() => {}); // disconnects only; the window stays open
}

if (mode === 'setup') await setup();
else if (mode === 'record') await record();
else if (mode === 'rehearse') await rehearse();
else if (mode === 'speed') {
  // node record.mjs speed <raw.mp4> <out.mp4> <from-to,from-to,...>   (seconds) re-runs the speed-up on a take.
  const [input, output, list = ''] = process.argv.slice(3);
  const spans = list.split(',').filter(Boolean).map((pair) => { const [from, to] = pair.split('-').map(Number); return { from, to }; });
  process.exitCode = await speedUpTurns(input, output, spans, Number(config.turnSpeed ?? 3));
}
else console.log('Usage: node record.mjs setup | rehearse | record | speed <raw> <out> <from-to,...>');
