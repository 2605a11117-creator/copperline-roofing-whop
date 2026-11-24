import type { BookingDetails, DepositCharged, PaymentStep, WhopEnvironment } from '../../shared/api';
import type { Offer } from '../config/types';
import { api, ApiError, delay } from './api';
import { isUsPhone, isZip, toE164 } from './format';
import { runNextAction, type PaymentsHandle } from './whop-elements';

export const DETAILS_KEY = 'booking-details';

export function depositKey(jobId: string): string {
  return `deposit-${jobId}`;
}

export function emptyDetails(): BookingDetails {
  return { name: '', phone: '', address: '', zip: '', window: '', reference: '', notes: '' };
}

export type DetailsField = 'name' | 'phone' | 'address' | 'zip' | 'window';

export function validateDetails(details: BookingDetails, offer: Offer): DetailsField[] {
  const invalid: DetailsField[] = [];
  if (details.name.trim().length < 2) invalid.push('name');
  if (!isUsPhone(details.phone)) invalid.push('phone');
  if (details.address.trim().length < 5) invalid.push('address');
  if (!isZip(details.zip)) invalid.push('zip');
  if (offer.details === 'appointment' && !details.window) invalid.push('window');
  return invalid;
}

/** Metadata attached to the Whop payment so the order shows who and where in the dashboard. */
export function detailsMetadata(offerId: string, details: BookingDetails): Record<string, string> {
  const metadata: Record<string, string> = {
    offer: offerId,
    customer_name: details.name.trim(),
    phone: details.phone.trim(),
    service_address: details.address.trim(),
    zip: details.zip.trim(),
    source: 'website',
  };
  if (details.window) metadata.preferred_window = details.window;
  if (details.reference.trim()) metadata.estimate_ref = details.reference.trim();
  if (details.notes.trim()) metadata.notes = details.notes.trim().slice(0, 450);
  return metadata;
}

/** Billing defaults for PaymentElement so the buyer does not type them twice. */
export function billingDefaults(details: BookingDetails): Record<string, unknown> {
  const phone = toE164(details.phone);
  return {
    billingDetails: {
      name: details.name.trim(),
      ...(phone ? { phone } : {}),
      address: { line1: details.address.trim(), postal_code: details.zip.trim().slice(0, 5), country: 'US' },
    },
  };
}

export function returnUrlFor(offerId: string): string {
  return `${window.location.origin}/book/${offerId}/return`;
}

export type Settled = 'paid' | 'pending' | 'redirected';

/**
 * A new Whop payment is created first and collected in the background. If it is not paid yet,
 * handleNextAction runs any 3D Secure or bank step and waits for the charge to settle.
 */
export async function settlePayment(
  step: PaymentStep,
  handle: PaymentsHandle | null,
  environment: WhopEnvironment,
): Promise<Settled> {
  if (step.status === 'paid') return 'paid';
  if (!step.clientSecret) return 'pending';
  const result = await runNextAction(handle, step.clientSecret, environment);
  if (result.redirected) return 'redirected';
  const status = result.status ?? '';
  if (status === 'succeeded' || status === 'paid') return 'paid';
  if (status === 'processing' || status === 'pending') return 'pending';
  throw new Error(result.lastPaymentError?.message || 'The payment was not completed. Try another payment method.');
}

/** After a setup intent succeeds, charge the deposit to the saved card. Retries while Whop finishes the setup. */
export async function completeDeposit(setupIntentId: string): Promise<DepositCharged> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await api<DepositCharged>('/api/deposit/complete', { body: { setupIntentId } });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'setup_pending') {
        await delay(1500);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Your card is still being confirmed. Refresh this page in a minute to finish your deposit.');
}

export function returnQuery(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  return search.toString();
}
