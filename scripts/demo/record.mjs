// Demo recorder for the roofing template.
//
//   node record.mjs setup    Opens Microsoft Edge with a separate demo profile. Sign in to Whop, the
//                            Whop sandbox and GitHub there, then close the window. Your normal browser
//                            profile is not touched.
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
  await page.evaluate(
    ([sel, where]) => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: where }),
    [selector, block],
  );
  await sleep(1400);
}

async function typeInto(page, selector, text) {
  const field = page.locator(selector).first();
  await field.click();
  await field.fill('');
  await field.pressSequentially(text, { delay: 35 });
}

async function waitForPerson(page, predicate, title, body) {
  await caption(page, title, body);
  const started = Date.now();
  while (Date.now() - started < WAIT_FOR_PERSON_MS) {
    if (await predicate().catch(() => false)) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting: ${title}`);
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
  await sleep(5500);

  await smoothScrollTo(page, '#services');
  await caption(page, 'Services: repair, replacement, inspection', 'Each card fires whop.track("service_viewed") the first time it scrolls into view.');
  await sleep(4500);
  await page.mouse.wheel(0, 500);
  await sleep(2500);

  await smoothScrollTo(page, '#process');
  await caption(page, 'How a job runs', 'Inspection, then a $500 deposit saves the card on file, then the final invoice after the job.');
  await sleep(3500);

  await smoothScrollTo(page, '#financing');
  await caption(page, 'Financing callout', 'Checkout runs entirely on Whop, so Klarna, Afterpay and Splitit appear automatically for approved merchants.');
  await sleep(4000);

  await smoothScrollTo(page, '#area');
  await caption(page, 'Service area', 'ZIP code check against the configured service area.');
  await sleep(1200);
  await typeInto(page, '.zip-check__input', person.zip);
  await page.locator('.zip-check button[type="submit"]').first().click();
  await sleep(3000);

  await smoothScrollTo(page, '#reviews');
  await caption(page, 'Reviews and trust', 'Ratings, reviews, license and warranty details, all from the config file.');
  await sleep(4000);

  await smoothScrollTo(page, '#faq');
  await caption(page, 'Questions and contact details');
  await sleep(2500);
}

async function requestEstimate(page) {
  await smoothScrollTo(page, '#estimate');
  await caption(page, 'Request an estimate', 'This form creates a lead on the Whop account through the Whop API: POST /members, then POST /events with event_name "lead".');
  await typeInto(page, '#estimate [name="name"]', person.name);
  await typeInto(page, '#estimate [name="phone"]', person.phone);
  await typeInto(page, '#estimate [name="email"]', person.email);
  await typeInto(page, '#estimate [name="address"]', person.address);
  await typeInto(page, '#estimate [name="zip"]', person.zip);
  await page.selectOption('#estimate [name="service"]', { index: 1 }).catch(() => {});
  await page.selectOption('#estimate [name="timeline"]', { index: 1 }).catch(() => {});
  await typeInto(page, '#estimate [name="message"]', 'Shingles lifted after the last hail storm, small leak over the garage.');
  const consent = page.locator('#estimate #consent');
  if (await consent.count()) await consent.check();
  await sleep(800);
  await page.locator('#estimate button[type="submit"]').first().click();
  await page.waitForSelector('#estimate [role="status"], #estimate .form-panel--done, #estimate .estimate-done', { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  await caption(page, 'Estimate request sent: lead created on the Whop account', 'The response carries the lead ID from Whop. The panel shows whop.track("estimate_requested") and the standard lead event, deduplicated with the server copies by event_id.');
  await sleep(6000);
}

async function fillBooking(page, { job }) {
  await typeInto(page, '#book-name', person.name);
  await typeInto(page, '#book-phone', person.phone);
  await typeInto(page, '#book-address', person.address);
  await typeInto(page, '#book-zip', person.zip);
  if (job) {
    const consent = page.locator('#book-deposit-consent');
    if (await consent.count()) await consent.check();
  } else {
    await page.selectOption('#book-window', { index: 1 }).catch(() => {});
  }
  await sleep(600);
  await page.getByRole('button', { name: /continue to payment/i }).click();
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
      await input.click().catch(() => {});
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
  return filled;
}

async function checkout(page, offerPath, { job }) {
  await page.goto(`${site}${offerPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#book-name');
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
  await sleep(6000);
  await fillEmail(page);
  await waitForPerson(
    page,
    async () => page.url().includes('/return'),
    'Your turn: enter the sandbox test card',
    '4242 4242 4242 4242, any future date, any CVC, then press the Pay button.',
  );
  await page.waitForLoadState('domcontentloaded');
  await sleep(5000);
  await caption(
    page,
    job ? 'Deposit paid, card saved on file' : 'Test checkout complete',
    job
      ? 'The card was saved with a Setup Intent, then the $500 deposit was charged to that saved card.'
      : 'Paid in the Whop sandbox with Payment Elements. The payment ID comes back from the Whop Payments API.',
  );
  await sleep(7000);
}

async function office(page) {
  await page.goto(`${site}/admin`, { waitUntil: 'domcontentloaded' });
  await waitForPerson(
    page,
    async () => (await page.locator('.admin__title').count()) > 0,
    'Office page',
    'Your turn: type the office passcode and press Enter.',
  );
  await caption(page, 'Office: Whop setup check', 'Environment, product and plan IDs for the $149 inspection, $395 flat-rate leak repair and $500 deposit.');
  await sleep(5000);
  await smoothScrollTo(page, '#leads-title');
  await caption(page, 'Leads read back from the Whop API', 'The estimate request from a minute ago, with its Whop lead ID and person ID (GET /events?event=pixel.lead).');
  await sleep(6000);
  await smoothScrollTo(page, '#jobs-title');
  await caption(page, 'Deposits with a card on file', 'Read from the Setup Intents API. Bill the final balance from here.');
  await sleep(4000);

  const bill = page.getByRole('button', { name: /bill final balance/i }).first();
  if (await bill.count()) {
    await bill.click();
    await sleep(1500);
  }
  const amount = page.locator('input[id$="-amount"]').first();
  if (await amount.count()) {
    await amount.scrollIntoViewIfNeeded();
    await amount.click();
    await amount.fill('');
    await amount.pressSequentially(String(config.finalBalance ?? 7950), { delay: 60 });
  }
  const charge = page.locator('.choice input[type="radio"]').first();
  if (await charge.count()) await charge.check();
  await sleep(1000);
  await caption(page, 'Final balance with the Whop Invoices API', 'Creates an invoice for the remaining balance and charges the stored card automatically.');
  await page.getByRole('button', { name: /create invoice/i }).first().click();
  await sleep(9000);
  await smoothScrollTo(page, '#invoices-title');
  await caption(page, 'Invoice created and charged', 'The invoice is read back from the Invoices API with its status.');
  await sleep(6000);
}

async function dashboards(page) {
  for (const view of config.dashboardViews ?? []) {
    await page.goto(view.url, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    await caption(page, view.title, view.body ?? '');
    await sleep(view.seconds ? view.seconds * 1000 : 6000);
    if (view.scroll) {
      await page.mouse.wheel(0, view.scroll);
      await sleep(3000);
    }
  }
}

async function record() {
  const browser = await openBrowser([]);
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages[0] ?? (await context.newPage());
  for (const extra of pages.slice(1)) await extra.close().catch(() => {});
  await page.bringToFront();
  await page.goto(`${site}/?debug=1`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);

  const file = path.join(outDir, config.outputName ?? 'roofing-template-demo.mp4');
  const recording = startRecording(file);
  console.log(`Recording to ${file}`);
  try {
    await showSite(page);
    await requestEstimate(page);
    await checkout(page, '/book/inspection', { job: false });
    await checkout(page, '/book/deposit', { job: true });
    await office(page);
    await dashboards(page);
    await caption(page, 'Thanks for watching', config.closingLine ?? '');
    await sleep(4000);
  } finally {
    const code = await recording.stop();
    console.log(code === 0 ? `Saved ${file}` : `ffmpeg exited with code ${code}`);
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
else console.log('Usage: node record.mjs setup | record');
