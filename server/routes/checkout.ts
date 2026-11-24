import type { CheckoutRequest, CheckoutResponse, PaymentOutcome, PaymentStatusResponse } from '../../shared/api';
import { findOffer } from '../../src/config/site';
import type { Env } from '../env';
import { clientIp, compact, HttpError, json, readJson } from '../http';
import { metaString, requireAccount, toHttpError, whopContext, whopRequest, type WhopPayment } from '../whop';
import { bookingMetadata, confirmationToken, parseDetails, returnUrl } from './booking';

/**
 * Fixed-price offers (inspection, flat-rate repair). The browser's PaymentElement returns a
 * confirmation token; this charges the offer's Whop plan with it. The response is the payment as
 * created; the browser finishes any 3D Secure step with handleNextAction and the client_secret.
 */
export async function postCheckout(request: Request, env: Env, url: URL): Promise<Response> {
  const body = await readJson<CheckoutRequest>(request);
  const offer = typeof body.offerId === 'string' ? findOffer(body.offerId) : null;
  if (!offer || offer.kind !== 'charge') throw new HttpError(400, 'This service cannot be booked online.', 'unknown_offer');
  const token = confirmationToken(body.confirmationToken);
  const details = parseDetails(body.details, offer);

  const whop = whopContext(env);
  const accountId = requireAccount(whop);
  const variantId = whop.variants[offer.id];
  if (!variantId) throw new HttpError(503, 'Online booking is not set up for this service yet.', 'not_configured');

  try {
    const payment = await whopRequest<WhopPayment>(whop, 'POST', '/payments', {
      idempotencyKey: `checkout_${token}`,
      body: compact({
        account_id: accountId,
        variant_id: variantId,
        confirmation_token: token,
        off_session: false,
        return_url: returnUrl(url, offer.id),
        ip_address: clientIp(request),
        metadata: bookingMetadata(offer, details),
      }),
    });
    const response: CheckoutResponse = {
      paymentId: payment.id,
      status: payment.status,
      clientSecret: payment.client_secret ?? null,
    };
    return json(response);
  } catch (error) {
    throw toHttpError(error, `charge ${offer.id}`);
  }
}

export function paymentOutcome(payment: WhopPayment): PaymentOutcome {
  if (payment.status === 'paid') return 'paid';
  const sub = (payment.substatus ?? '').toLowerCase();
  if (payment.status === 'void' || payment.status === 'uncollectible' || /fail|declin|cancel/.test(sub)) return 'failed';
  return 'pending';
}

/** Lets the return page confirm a payment with Whop instead of trusting the URL. */
export async function getPaymentStatus(env: Env, paymentId: string): Promise<Response> {
  const whop = whopContext(env);
  requireAccount(whop);
  try {
    const payment = await whopRequest<WhopPayment>(whop, 'GET', `/payments/${encodeURIComponent(paymentId)}`);
    const response: PaymentStatusResponse = {
      id: payment.id,
      status: payment.status,
      outcome: paymentOutcome(payment),
      offerId: metaString(payment.metadata, 'offer'),
      jobId: metaString(payment.metadata, 'job_id'),
    };
    return json(response);
  } catch (error) {
    throw toHttpError(error, 'retrieve payment', 'We could not look up this payment yet.');
  }
}
