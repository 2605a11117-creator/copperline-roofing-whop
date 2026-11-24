import type { BookingDetails } from '../../shared/api';
import type { Offer } from '../../src/config/types';
import { HttpError, isUsPhone, isZip, multiline, text } from '../http';

/** Validates the details the booking page collected before payment. */
export function parseDetails(value: unknown, offer: Offer): BookingDetails {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof BookingDetails, unknown>>;
  const details: BookingDetails = {
    name: text(raw.name, 120),
    phone: text(raw.phone, 40),
    address: text(raw.address, 200),
    zip: text(raw.zip, 10),
    window: text(raw.window, 60),
    reference: text(raw.reference, 60),
    notes: multiline(raw.notes, 450),
  };
  const invalid: string[] = [];
  if (details.name.length < 2) invalid.push('name');
  if (!isUsPhone(details.phone)) invalid.push('phone');
  if (details.address.length < 5) invalid.push('address');
  if (!isZip(details.zip)) invalid.push('zip');
  if (offer.details === 'appointment' && !details.window) invalid.push('window');
  if (invalid.length > 0) throw new HttpError(400, 'Some booking details are missing. Go back and check them.', 'invalid_details', invalid);
  return details;
}

/** Order metadata stored on the Whop payment (string values only). */
export function bookingMetadata(offer: Offer, details: BookingDetails, extra: Record<string, string> = {}): Record<string, string> {
  const metadata: Record<string, string> = {
    offer: offer.id,
    customer_name: details.name,
    phone: details.phone,
    service_address: details.address,
    zip: details.zip,
    source: 'website',
    ...extra,
  };
  // The browser shares details between booking pages: keep only the fields this offer asks for.
  if (offer.details === 'appointment' && details.window) metadata.preferred_window = details.window;
  if (offer.details === 'job' && details.reference) metadata.estimate_ref = details.reference;
  if (details.notes) metadata.notes = details.notes;
  return metadata;
}

export function confirmationToken(value: unknown): string {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token || token.length > 200 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new HttpError(400, 'The payment details expired. Enter them again.', 'invalid_token');
  }
  return token;
}

/** Whop requires an https return URL; local http development leaves it out. */
export function returnUrl(url: URL, offerId: string): string | undefined {
  return url.protocol === 'https:' ? `${url.origin}/book/${offerId}/return` : undefined;
}
