// Custom pixel events with whop.track.
//
// On *.whop.site Whop injects the pixel into every page, so window.whop exists before this
// code runs. Page views, Whop checkout views and purchases are recorded automatically; this
// module sends the events the site defines: service_viewed, estimate_requested and
// deposit_started, plus the standard lead, view_content and initiate_checkout events.
//
// Every call is also kept in a short log for the on-page inspector (add ?debug=1 to any URL)
// and written to the browser console.

export type TrackValue = string | number | boolean;
export type TrackProps = Record<string, TrackValue | null | undefined>;

export type TrackStatus = 'sent' | 'queued' | 'failed';

export interface TrackedEvent {
  id: number;
  name: string;
  props: Record<string, TrackValue>;
  at: number;
  status: TrackStatus;
}

interface WhopPixel {
  track?: (name: string, props?: Record<string, TrackValue>) => void;
}

// Read window.whop through a local type instead of augmenting the global Window interface,
// so this file never clashes with typings that other packages declare for the same global.
type WindowWithPixel = Window & { whop?: WhopPixel };

const MAX_LOG = 100;
const RETRY_MS = 500;
const MAX_RETRIES = 40;

const log: TrackedEvent[] = [];
const listeners = new Set<() => void>();
let sequence = 0;
let retryTimer: number | undefined;
let retries = 0;

function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

let pageView: string | null = null;

/** One id per full page load, made on first use. Used to build event_id values Whop deduplicates on. */
export function pageViewId(): string {
  pageView ??= randomId();
  return pageView;
}

export function eventId(...parts: Array<string | number>): string {
  return [...parts, pageViewId()].join('_');
}

function pixel(): WhopPixel | null {
  const candidate = typeof window === 'undefined' ? undefined : (window as WindowWithPixel).whop;
  return candidate && typeof candidate.track === 'function' ? candidate : null;
}

export function pixelDetected(): boolean {
  return pixel() !== null;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function deliver(entry: TrackedEvent): boolean {
  const target = pixel();
  if (!target?.track) return false;
  try {
    target.track(entry.name, entry.props);
    entry.status = 'sent';
  } catch (error) {
    entry.status = 'failed';
    console.warn('[whop.track] The pixel rejected', entry.name, error);
  }
  return true;
}

function scheduleRetry() {
  if (retryTimer !== undefined) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined;
    const queued = log.filter((entry) => entry.status === 'queued');
    if (queued.length === 0) return;
    if (!pixel()) {
      retries += 1;
      if (retries < MAX_RETRIES) scheduleRetry();
      else
        console.warn(
          '[whop.track] No Whop pixel found. It is injected automatically on *.whop.site. On a custom domain, install the pixel snippet.',
        );
      return;
    }
    queued.forEach(deliver);
    emit();
  }, RETRY_MS);
}

export function track(name: string, props: TrackProps = {}): void {
  const clean: Record<string, TrackValue> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === '') continue;
    clean[key] = value;
  }
  const entry: TrackedEvent = { id: (sequence += 1), name, props: clean, at: Date.now(), status: 'queued' };
  log.push(entry);
  if (log.length > MAX_LOG) log.shift();
  console.info('%c[whop.track]', 'color:#2e7a6b;font-weight:700', name, clean);
  if (!deliver(entry)) scheduleRetry();
  emit();
}

export function trackedEvents(): TrackedEvent[] {
  return log.slice();
}

export function subscribeToTracking(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
