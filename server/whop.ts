import type { AdminStatus, ApiAuthMode, CardSummary, WhopEnvironment } from '../shared/api';
import { site } from '../src/config/site';
import { whopConfig } from '../src/config/whop';
import type { Env } from './env';
import { HttpError } from './http';

// Server-side Whop API access.
//
// On Whop hosting, server-side fetch calls to the Whop API go through an outbound proxy that
// signs them with the app's API key, so production needs no key in code. For the sandbox, or
// when you supply your own key, the request carries an Authorization header and asks the proxy
// not to inject its key (x-whop-inject-key: none).

const SANDBOX_API = 'https://sandbox-api.whop.com/api/v1';
const PRODUCTION_ORIGIN = 'https://api.whop.com';

export interface WhopContext {
  environment: WhopEnvironment;
  apiBase: string;
  apiKey: string | null;
  auth: ApiAuthMode;
  apiVersionDate: string;
  accountId: string | null;
  productId: string | null;
  variants: Record<string, string | null>;
}

function clean(value: string | undefined | null, prefix: string): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.startsWith(prefix) ? trimmed : null;
}

function productionBase(origin: string | undefined): string {
  const base = (origin?.trim() || PRODUCTION_ORIGIN).replace(/\/+$/, '');
  return /\/api\/v\d+$/.test(base) ? base : `${base}/api/v1`;
}

export function whopContext(env: Env): WhopContext {
  const override = env.WHOP_ENVIRONMENT?.trim();
  const environment: WhopEnvironment =
    override === 'sandbox' || override === 'production' ? override : whopConfig.environment;
  const ids = whopConfig[environment];

  let apiBase: string;
  let apiKey: string | null;
  let auth: ApiAuthMode;
  if (environment === 'sandbox') {
    apiBase = SANDBOX_API;
    apiKey = env.WHOP_SANDBOX_API_KEY?.trim() || null;
    auth = 'sandbox_key';
  } else {
    apiBase = productionBase(env.WHOP_API_ORIGIN);
    const company = env.WHOP_COMPANY_API_KEY?.trim();
    const dev = env.WHOP_API_KEY?.trim();
    apiKey = company || dev || null;
    auth = company ? 'company_key' : dev ? 'dev_key' : 'hosting';
  }

  const accountId =
    clean(ids.accountId, 'biz_') ?? (environment === 'production' ? clean(env.WHOP_ACCOUNT_ID, 'biz_') : null);

  const variants: Record<string, string | null> = {};
  for (const offer of site.offers) variants[offer.id] = clean(ids.variants[offer.id], 'plan_');

  return {
    environment,
    apiBase,
    apiKey,
    auth,
    apiVersionDate: whopConfig.apiVersionDate,
    accountId,
    productId: clean(ids.productId, 'prod_'),
    variants,
  };
}

/** What is still needed before checkout works, in words for the admin page. */
export function missingSetup(whop: WhopContext): string[] {
  const missing: string[] = [];
  if (!whop.accountId) missing.push(`account ID for ${whop.environment}`);
  for (const offer of site.offers) if (!whop.variants[offer.id]) missing.push(`plan for ${offer.id}`);
  if (whop.environment === 'sandbox' && !whop.apiKey) missing.push('WHOP_SANDBOX_API_KEY secret');
  return missing;
}

export function adminStatus(whop: WhopContext): AdminStatus {
  return {
    environment: whop.environment,
    accountId: whop.accountId,
    productId: whop.productId,
    auth: whop.auth,
    offers: site.offers.map((offer) => ({
      id: offer.id,
      name: offer.name,
      price: offer.price,
      variantId: whop.variants[offer.id] ?? null,
    })),
    missing: missingSetup(whop),
  };
}

export function requireAccount(whop: WhopContext): string {
  if (!whop.accountId) {
    throw new HttpError(503, `Online booking is not set up yet. Call ${site.company.phone}.`, 'not_configured');
  }
  if (whop.environment === 'sandbox' && !whop.apiKey) {
    throw new HttpError(503, `Online booking is not set up yet. Call ${site.company.phone}.`, 'not_configured');
  }
  return whop.accountId;
}

// ---------------------------------------------------------------- requests

export class WhopApiError extends Error {
  readonly status: number;
  readonly type: string | undefined;
  readonly code: string | undefined;
  readonly path: string;

  constructor(status: number, message: string, path: string, type?: string, code?: string) {
    super(message);
    this.name = 'WhopApiError';
    this.status = status;
    this.type = type;
    this.code = code;
    this.path = path;
  }
}

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
}

export async function whopRequest<T>(
  whop: WhopContext,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(`${whop.apiBase}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Api-Version-Date': whop.apiVersionDate,
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey.slice(0, 255);
  if (whop.apiKey) {
    headers.Authorization = `Bearer ${whop.apiKey}`;
    headers['x-whop-inject-key'] = 'none';
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const error = (data as { error?: { message?: string; type?: string; code?: string } } | null)?.error;
    throw new WhopApiError(
      response.status,
      error?.message ?? `Whop API ${method} ${path} failed with ${response.status}`,
      path,
      error?.type,
      error?.code,
    );
  }
  return data as T;
}

/** Logs a Whop failure for `whop apps logs` and turns it into a response-safe error. */
export function toHttpError(error: unknown, action: string, customerMessage?: string): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof WhopApiError) {
    console.error(`[whop] ${action} failed`, {
      status: error.status,
      type: error.type,
      code: error.code,
      path: error.path,
      message: error.message,
    });
    if (error.status === 401 || error.status === 403) {
      return new HttpError(
        502,
        customerMessage ?? `Online payments are not available right now. Call ${site.company.phone}.`,
        'whop_permission',
      );
    }
    if (error.status === 400 || error.status === 402 || error.status === 404 || error.status === 409) {
      return new HttpError(400, customerMessage ?? error.message, error.code ?? 'whop_rejected');
    }
    return new HttpError(502, customerMessage ?? 'Whop did not respond. Try again in a moment.', 'whop_unavailable');
  }
  console.error(`[server] ${action} failed`, error);
  return new HttpError(500, customerMessage ?? 'Something went wrong on our side. Try again.', 'server_error');
}

// ---------------------------------------------------------------- response shapes (fields this site reads)

export interface WhopUserSummary {
  id: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
}

export interface WhopMember {
  id: string;
  email?: string | null;
  name?: string | null;
  user?: WhopUserSummary | null;
}

/** A note on a member (GET /members/:id/notes). */
export interface WhopMemberNote {
  id: string;
  content: string;
  created_at?: string | null;
  member_id?: string | null;
}

export interface WhopPayment {
  id: string;
  status: string;
  substatus?: string | null;
  client_secret?: string | null;
  member_id?: string | null;
  payment_method_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface WhopPaymentInstrument {
  display_name?: string | null;
  card?: { brand?: string | null; last4?: string | null } | null;
}

export interface WhopSetupIntent {
  id: string;
  status: string;
  client_secret?: string | null;
  payment_method_id?: string | null;
  member_id?: string | null;
  metadata?: Record<string, unknown> | null;
  payment_instrument?: WhopPaymentInstrument | null;
  last_setup_error?: { code?: string | null; message?: string | null } | null;
  user?: WhopUserSummary | null;
  created_at?: string | null;
}

export interface WhopMoney {
  amount?: string | null;
  currency?: string | null;
  display_decimals?: number | null;
}

export interface WhopInvoice {
  id: string;
  number?: string | null;
  status: string;
  total?: WhopMoney | null;
  amount_due?: WhopMoney | null;
  checkout_link?: string | null;
  email_address?: string | null;
  payment_method_id?: string | null;
  scheduled_charge_at?: string | null;
  paid_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface WhopList<T> {
  data?: T[];
}

export function metaString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value ? value : null;
}

export function cardSummary(instrument: WhopPaymentInstrument | null | undefined): CardSummary | null {
  if (!instrument) return null;
  const brand = instrument.card?.brand ?? null;
  const last4 = instrument.card?.last4 ?? null;
  const brandName = brand ? brand.charAt(0).toUpperCase() + brand.slice(1).replace(/_/g, ' ') : null;
  const label =
    brandName && last4 ? `${brandName} ending ${last4}` : (instrument.display_name ?? (last4 ? `Card ending ${last4}` : 'Saved card'));
  return { brand, last4, label };
}

export function formatMoney(money: WhopMoney | null | undefined): string | null {
  if (!money?.amount) return null;
  const amount = Number(money.amount);
  if (!Number.isFinite(amount)) return money.amount;
  const currency = (money.currency ?? 'usd').toUpperCase();
  const decimals = money.display_decimals ?? 2;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${money.amount} ${currency}`;
  }
}
