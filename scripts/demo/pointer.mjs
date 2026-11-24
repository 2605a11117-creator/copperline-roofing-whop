// Visible mouse movement for the demo recording.
//
// Browser automation clicks without moving the real pointer, so a screen recording would show a pointer
// that never moves. This module glides the real Windows pointer (through cursor.ps1) to each element
// before the automation clicks it, and draws a short ripple where the click lands.
// Positions are in Windows' scaled screen units, the same units the page reports for window.screenX.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

let helper = null;
let lines = null;
let current = null;

/** Starts the pointer helper and waits until it answers (compiling its Windows bindings takes a few seconds). */
export async function startPointer() {
  if (process.platform !== 'win32' || helper) return;
  helper = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'cursor.ps1')],
    { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true },
  );
  lines = createInterface({ input: helper.stdout });
  helper.on('exit', () => {
    helper = null;
  });
  await syncPointer(15000);
}

export function stopPointer() {
  if (!helper) return;
  helper.stdin.write('quit\n');
  helper.stdin.end();
  helper = null;
}

function send(x, y) {
  if (helper) helper.stdin.write(`${Math.round(x)} ${Math.round(y)}\n`);
}

/** Reads where the pointer really is (after a person used the mouse). */
export async function syncPointer(timeoutMs = 2000) {
  if (!helper || !lines) return;
  const answer = new Promise((resolve) => {
    lines.once('line', resolve);
    setTimeout(() => resolve(null), timeoutMs);
  });
  helper.stdin.write('get\n');
  const text = await answer;
  const match = typeof text === 'string' ? /^(-?\d+) (-?\d+)$/.exec(text.trim()) : null;
  current = match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Glides the pointer to a screen point. */
export async function glideTo(x, y, ms = 600) {
  if (!helper) return;
  const from = current ?? { x: x - 160, y: y + 120 };
  const distance = Math.hypot(x - from.x, y - from.y);
  const duration = Math.min(ms, 250 + distance * 0.6);
  const steps = Math.max(6, Math.round(duration / 16));
  for (let step = 1; step <= steps; step += 1) {
    const t = ease(step / steps);
    send(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
    await sleep(duration / steps);
  }
  current = { x, y };
}

/** Where the page's top-left corner sits on the screen. */
async function viewportOrigin(page) {
  const m = await page.evaluate(() => ({
    sx: window.screenX,
    sy: window.screenY,
    ow: window.outerWidth,
    oh: window.outerHeight,
    iw: window.innerWidth,
    ih: window.innerHeight,
  }));
  const side = Math.max(0, (m.ow - m.iw) / 2);
  return { x: m.sx + side, y: m.sy + (m.oh - m.ih) - side, top: m.sy + side, left: m.sx + side };
}

/** Glides the pointer to the middle of an element. Returns the point in page coordinates. */
export async function pointAt(page, locator, ms) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return null;
  const origin = await viewportOrigin(page);
  const vx = box.x + Math.min(box.width / 2, 140);
  const vy = box.y + box.height / 2;
  await glideTo(origin.x + vx, origin.y + vy, ms);
  return { vx, vy };
}

/** Glides the pointer to a point given in page coordinates (for scrolling and reading). */
export async function pointAtViewport(page, vx, vy, ms) {
  const origin = await viewportOrigin(page);
  await glideTo(origin.x + vx, origin.y + vy, ms);
}

/** A short ring where a click lands, so clicks read clearly in the video. */
export async function ripple(page, vx, vy) {
  await page
    .evaluate(
      ([x, y]) => {
        const ring = document.createElement('div');
        Object.assign(ring.style, {
          position: 'fixed',
          left: `${x - 14}px`,
          top: `${y - 14}px`,
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: '3px solid rgba(46, 122, 107, 0.95)',
          background: 'rgba(46, 122, 107, 0.22)',
          zIndex: '2147483647',
          pointerEvents: 'none',
          transition: 'transform 450ms ease-out, opacity 450ms ease-out',
        });
        document.documentElement.appendChild(ring);
        requestAnimationFrame(() => {
          ring.style.transform = 'scale(2.1)';
          ring.style.opacity = '0';
        });
        setTimeout(() => ring.remove(), 650);
      },
      [vx, vy],
    )
    .catch(() => {});
}

/** Points at an element, shows the click ring, then clicks it. */
export async function clickWithPointer(page, locator) {
  const point = await pointAt(page, locator);
  if (point) {
    await sleep(140);
    await ripple(page, point.vx, point.vy);
  }
  await locator.click();
}

/** Points at the browser tab in position `index` (0-based) of a window with `count` tabs. */
export async function pointAtTab(page, index, count) {
  const origin = await viewportOrigin(page);
  const width = await page.evaluate(() => window.innerWidth);
  // Edge draws tabs after a 44px tab-actions button; each tab is at most 240px wide.
  const tabWidth = Math.min(240, (width - 200) / Math.max(1, count));
  await glideTo(origin.left + 44 + tabWidth * index + tabWidth / 2, origin.top + 20, 700);
  await sleep(150);
}
