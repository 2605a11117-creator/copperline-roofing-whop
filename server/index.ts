import type { PublicConfig } from '../shared/api';
import type { Env, ExecutionContext } from './env';
import { errorResponse, HttpError, isSameOrigin, json } from './http';
import { handleAdmin } from './routes/admin';
import { getPaymentStatus, postCheckout } from './routes/checkout';
import { postDeposit, postDepositComplete } from './routes/deposit';
import { postEstimate } from './routes/estimate';
import { missingSetup, toHttpError, whopContext } from './whop';

// /api/* and the Apple Pay domain file. TanStack Start serves the pages; src/routes/api/$.ts and
// src/routes/[.]well-known.apple-developer-merchantid-domain-association.ts call into this module.

export const APPLE_PAY_PATH = '/.well-known/apple-developer-merchantid-domain-association';
const APPLE_PAY_SOURCE = 'https://whop.com/.well-known/apple-platform-integrator/apple-developer-merchantid-domain-association';

export async function handleApi(request: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = url.pathname.replace(/\/+$/, '');

  if (method === 'POST' && !isSameOrigin(request, url)) {
    return errorResponse(403, 'Requests must come from this website.', 'bad_origin');
  }

  try {
    if (path === '/api/config' && method === 'GET') {
      const whop = whopContext(env);
      const config: PublicConfig = {
        environment: whop.environment,
        accountId: whop.accountId,
        productId: whop.productId,
        variants: whop.variants,
        missing: missingSetup(whop),
      };
      return json(config);
    }
    if (path === '/api/estimate' && method === 'POST') return await postEstimate(request, env, url, ctx);
    if (path === '/api/checkout' && method === 'POST') return await postCheckout(request, env, url);
    if (path === '/api/deposit' && method === 'POST') return await postDeposit(request, env, url);
    if (path === '/api/deposit/complete' && method === 'POST') return await postDepositComplete(request, env, url);

    const paymentMatch = /^\/api\/payments\/(pay_[A-Za-z0-9]+)$/.exec(path);
    if (paymentMatch && method === 'GET') return await getPaymentStatus(env, paymentMatch[1]);

    if (path.startsWith('/api/admin/')) return await handleAdmin(request, env, path);

    return errorResponse(404, 'Not found.', 'not_found');
  } catch (error) {
    const httpError = error instanceof HttpError ? error : toHttpError(error, `${method} ${path}`);
    return errorResponse(httpError.status, httpError.message, httpError.code, httpError.fields);
  }
}

/** Serves Whop's Apple Pay verification file so this domain can be approved for wallet buttons. */
export async function applePayFile(): Promise<Response> {
  const upstream = await fetch(APPLE_PAY_SOURCE, { headers: { 'x-whop-inject-key': 'none' } });
  if (!upstream.ok) return new Response('Not found', { status: 404 });
  return new Response(upstream.body, {
    status: 200,
    headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' },
  });
}

