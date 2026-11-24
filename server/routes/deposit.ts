import type { DepositCharged, DepositRequest, DepositResponse } from '../../shared/api';
import { findOffer } from '../../src/config/site';
import type { Offer } from '../../src/config/types';
import type { Env } from '../env';
import { clientIp, compact, HttpError, json, readJson } from '../http';
import {
  cardSummary,
  metaString,
  requireAccount,
  toHttpError,
  whopContext,
  whopRequest,
  type WhopContext,
  type WhopPayment,
  type WhopSetupIntent,
} from '../whop';
import { bookingMetadata, confirmationToken, parseDetails, returnUrl } from './booking';

const PURPOSE = 'project_deposit';

function depositOffer(): Offer {
  const offer = findOffer('deposit');
  if (!offer || offer.kind !== 'deposit') throw new HttpError(500, 'The deposit offer is missing from site.ts.', 'not_configured');
  return offer;
}

function newJobId(): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(5, '0').slice(-5);
  return `JOB-${date}-${random}`;
}

/**
 * Deposit checkout, step 1: save the card with a setup intent.
 * The browser mounts PaymentElement in setup mode and sends its confirmation token here.
 * If the bank needs a step (3D Secure), the browser finishes it and calls /api/deposit/complete.
 */
export async function postDeposit(request: Request, env: Env, url: URL): Promise<Response> {
  const body = await readJson<DepositRequest>(request);
  const offer = depositOffer();
  const token = confirmationToken(body.confirmationToken);
  const details = parseDetails(body.details, offer);
  if (body.consent !== true) {
    throw new HttpError(400, 'Agree to save your card for the final balance to continue.', 'consent_required');
  }

  const whop = whopContext(env);
  const accountId = requireAccount(whop);
  if (!whop.variants[offer.id]) throw new HttpError(503, 'Deposits are not set up yet.', 'not_configured');

  const jobId = newJobId();
  let setupIntent: WhopSetupIntent;
  try {
    setupIntent = await whopRequest<WhopSetupIntent>(whop, 'POST', '/setup_intents', {
      idempotencyKey: `setup_${token}`,
      body: compact({
        account_id: accountId,
        confirmation_token: token,
        currency: 'usd',
        return_url: returnUrl(url, offer.id),
        metadata: bookingMetadata(offer, details, { purpose: PURPOSE, job_id: jobId, card_consent: 'yes' }),
      }),
    });
  } catch (error) {
    throw toHttpError(error, 'create setup intent');
  }

  if (setupIntent.status === 'succeeded') {
    return json(await chargeDeposit(whop, offer, setupIntent, request, url));
  }
  if (setupIntent.status === 'canceled') {
    throw new HttpError(
      400,
      setupIntent.last_setup_error?.message ?? "Your bank didn't approve saving this card. Try another card.",
      'setup_canceled',
    );
  }
  const pending: DepositResponse = {
    stage: 'setup',
    jobId,
    setupIntentId: setupIntent.id,
    status: setupIntent.status,
    clientSecret: setupIntent.client_secret ?? null,
  };
  return json(pending);
}

/** Deposit checkout, step 2 after a bank step: charge the deposit to the card the setup intent saved. */
export async function postDepositComplete(request: Request, env: Env, url: URL): Promise<Response> {
  const body = await readJson<{ setupIntentId: string }>(request);
  const setupIntentId = typeof body.setupIntentId === 'string' ? body.setupIntentId.trim() : '';
  if (!/^sint_[A-Za-z0-9]+$/.test(setupIntentId)) throw new HttpError(400, 'Unknown card setup.', 'invalid_setup');

  const offer = depositOffer();
  const whop = whopContext(env);
  requireAccount(whop);

  let setupIntent: WhopSetupIntent;
  try {
    setupIntent = await whopRequest<WhopSetupIntent>(whop, 'GET', `/setup_intents/${setupIntentId}`);
  } catch (error) {
    throw toHttpError(error, 'retrieve setup intent', 'We could not find your card setup. Start the deposit again.');
  }
  if (metaString(setupIntent.metadata, 'purpose') !== PURPOSE) {
    throw new HttpError(400, 'This card setup is not for a deposit.', 'invalid_setup');
  }
  if (setupIntent.status === 'processing' || setupIntent.status === 'requires_action') {
    throw new HttpError(409, 'Your bank is still confirming the card.', 'setup_pending');
  }
  if (setupIntent.status !== 'succeeded') {
    throw new HttpError(
      400,
      setupIntent.last_setup_error?.message ?? "Your bank didn't approve saving this card. Try another card.",
      'setup_canceled',
    );
  }
  return json(await chargeDeposit(whop, offer, setupIntent, request, url));
}

/**
 * Charges the deposit plan to the saved payment method. The idempotency key is tied to the setup
 * intent, so one saved card can only ever pay one deposit, however often this runs.
 */
async function chargeDeposit(
  whop: WhopContext,
  offer: Offer,
  setupIntent: WhopSetupIntent,
  request: Request,
  url: URL,
): Promise<DepositCharged> {
  const variantId = whop.variants[offer.id];
  const accountId = whop.accountId;
  if (!variantId || !accountId) throw new HttpError(503, 'Deposits are not set up yet.', 'not_configured');
  if (!setupIntent.payment_method_id || !setupIntent.member_id) {
    console.error('[whop] setup intent succeeded without payment_method_id or member_id', {
      id: setupIntent.id,
      hint: 'The API key needs the member:basic:read permission to see member_id.',
    });
    throw new HttpError(502, 'Your card was saved, but the deposit could not be charged. We will call you to finish.', 'missing_member');
  }

  const jobId = metaString(setupIntent.metadata, 'job_id') ?? setupIntent.id;
  const metadata: Record<string, string> = {
    purpose: PURPOSE,
    job_id: jobId,
    setup_intent_id: setupIntent.id,
    offer: offer.id,
    source: 'website',
  };
  for (const key of ['customer_name', 'phone', 'service_address', 'zip', 'estimate_ref']) {
    const value = metaString(setupIntent.metadata, key);
    if (value) metadata[key] = value;
  }

  try {
    const payment = await whopRequest<WhopPayment>(whop, 'POST', '/payments', {
      idempotencyKey: `deposit_${setupIntent.id}`,
      body: compact({
        account_id: accountId,
        variant_id: variantId,
        member_id: setupIntent.member_id,
        payment_method_id: setupIntent.payment_method_id,
        off_session: false,
        return_url: returnUrl(url, offer.id),
        ip_address: clientIp(request),
        metadata,
      }),
    });
    return {
      stage: 'payment',
      jobId,
      setupIntentId: setupIntent.id,
      paymentId: payment.id,
      status: payment.status,
      clientSecret: payment.client_secret ?? null,
      card: cardSummary(setupIntent.payment_instrument),
    };
  } catch (error) {
    throw toHttpError(error, 'charge deposit to saved card');
  }
}
