import type { ApiErrorBody } from '../shared/api';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: string[];

  constructor(status: number, message: string, code: string, fields: string[] = []) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function errorResponse(status: number, message: string, code: string, fields: string[] = []): Response {
  const body: ApiErrorBody = { error: { message, code, ...(fields.length > 0 ? { fields } : {}) } };
  return json(body, status);
}

const MAX_BODY_BYTES = 32 * 1024;

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) throw new HttpError(413, 'The request is too large.', 'too_large');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'The request is too large.', 'too_large');
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Partial<T>;
  } catch {
    throw new HttpError(400, 'The request body must be a JSON object.', 'bad_json');
  }
}

/** Browser POSTs must come from this site. Blocks cross-site form posts to the API. */
export function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === url.host;
    } catch {
      return false;
    }
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
}

export function clientIp(request: Request): string | undefined {
  const raw =
    request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? '';
  const ip = raw.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || /^[0-9a-f:]{3,45}$/i.test(ip)) return ip;
  return undefined;
}

// ---------------------------------------------------------------- input helpers

export function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function multiline(value: unknown, max = 1500): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
}

export function oneOf(value: unknown, options: string[]): string {
  return typeof value === 'string' && options.includes(value) ? value : (options[0] ?? '');
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function isUsPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

export function isZip(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value);
}

/** Removes undefined, null and empty-string values so optional API fields are left out. */
export function compact<T extends Record<string, unknown>>(object: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || value === null || value === '') continue;
    (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

/** Keeps a small per-instance window of requests per key. Not a hard limit, just a brake on bursts. */
const buckets = new Map<string, number[]>();
export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) buckets.clear();
  return true;
}
