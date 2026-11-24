import { useState, type FormEvent, type ReactNode } from 'react';
import type { BookingDetails } from '../../../shared/api';
import { site } from '../../config/site';
import type { Offer } from '../../config/types';
import { validateDetails, type DetailsField } from '../../lib/booking';

const MESSAGES: Record<DetailsField, string> = {
  name: 'Enter your name.',
  phone: 'Enter a 10-digit phone number.',
  address: 'Enter the street address of the property.',
  zip: 'Enter a 5-digit ZIP code.',
  window: 'Pick a time that works for you.',
};

interface BookingDetailsFormProps {
  offer: Offer;
  initial: BookingDetails;
  onContinue: (details: BookingDetails) => void;
}

export function BookingDetailsForm({ offer, initial, onContinue }: BookingDetailsFormProps) {
  const [details, setDetails] = useState<BookingDetails>(initial);
  const [invalid, setInvalid] = useState<DetailsField[]>([]);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const isJob = offer.details === 'job';

  const set = (key: keyof BookingDetails, value: string) => {
    setDetails((current) => ({ ...current, [key]: value }));
    setInvalid((list) => list.filter((name) => name !== key));
  };

  const errorFor = (name: DetailsField) => (invalid.includes(name) ? MESSAGES[name] : '');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems = validateDetails(details, offer);
    const missingConsent = isJob && !consent;
    setInvalid(problems);
    setConsentError(missingConsent);
    if (problems.length > 0 || missingConsent) {
      const first = problems[0] ?? 'deposit-consent';
      document.getElementById(`book-${first}`)?.focus();
      return;
    }
    onContinue(details);
  };

  return (
    <form className="form-panel" onSubmit={submit} noValidate aria-labelledby="details-title">
      <h2 id="details-title" className="form-panel__title">
        {isJob ? 'Job details' : 'Appointment details'}
      </h2>
      <div className="form-grid">
        <DetailsInput id="name" label="Full name" error={errorFor('name')}>
          <input
            id="book-name"
            className="input"
            autoComplete="name"
            value={details.name}
            onChange={(event) => set('name', event.target.value)}
            aria-invalid={errorFor('name') ? true : undefined}
            aria-describedby={errorFor('name') ? 'book-name-error' : undefined}
          />
        </DetailsInput>
        <DetailsInput id="phone" label="Phone" error={errorFor('phone')}>
          <input
            id="book-phone"
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={details.phone}
            onChange={(event) => set('phone', event.target.value)}
            aria-invalid={errorFor('phone') ? true : undefined}
            aria-describedby={errorFor('phone') ? 'book-phone-error' : undefined}
          />
        </DetailsInput>
        <DetailsInput id="address" label={isJob ? 'Job address' : 'Property address'} error={errorFor('address')}>
          <input
            id="book-address"
            className="input"
            autoComplete="street-address"
            value={details.address}
            onChange={(event) => set('address', event.target.value)}
            aria-invalid={errorFor('address') ? true : undefined}
            aria-describedby={errorFor('address') ? 'book-address-error' : undefined}
          />
        </DetailsInput>
        <DetailsInput id="zip" label="ZIP code" error={errorFor('zip')}>
          <input
            id="book-zip"
            className="input"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            value={details.zip}
            onChange={(event) => set('zip', event.target.value)}
            aria-invalid={errorFor('zip') ? true : undefined}
            aria-describedby={errorFor('zip') ? 'book-zip-error' : undefined}
          />
        </DetailsInput>
        {isJob ? (
          <DetailsInput id="reference" label="Estimate number (optional)" wide>
            <input
              id="book-reference"
              className="input"
              value={details.reference}
              onChange={(event) => set('reference', event.target.value)}
            />
          </DetailsInput>
        ) : (
          <DetailsInput id="window" label="Preferred time" error={errorFor('window')} wide>
            <select
              id="book-window"
              className="input"
              value={details.window}
              onChange={(event) => set('window', event.target.value)}
              aria-invalid={errorFor('window') ? true : undefined}
              aria-describedby={errorFor('window') ? 'book-window-error' : undefined}
            >
              <option value="">Choose a time</option>
              {site.booking.appointmentWindows.map((slot) => (
                <option key={slot}>{slot}</option>
              ))}
            </select>
          </DetailsInput>
        )}
        <DetailsInput id="notes" label="Notes for the crew (optional)" wide>
          <textarea
            id="book-notes"
            className="input input--area"
            rows={3}
            maxLength={450}
            value={details.notes}
            onChange={(event) => set('notes', event.target.value)}
          />
        </DetailsInput>
      </div>

      {isJob && (
        <>
          <div className={consentError ? 'check check--invalid' : 'check'}>
            <input
              id="book-deposit-consent"
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                if (event.target.checked) setConsentError(false);
              }}
              aria-describedby={consentError ? 'book-deposit-consent-error' : undefined}
            />
            <label htmlFor="book-deposit-consent">{site.booking.depositConsent}</label>
          </div>
          {consentError && (
            <p id="book-deposit-consent-error" className="field__error">
              Check this box to save your card for the final balance.
            </p>
          )}
        </>
      )}

      <button type="submit" className="btn btn--primary btn--lg btn--block">
        Continue to payment
      </button>
    </form>
  );
}

function DetailsInput({
  id,
  label,
  error = '',
  wide = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? 'field field--wide' : 'field'}>
      <label htmlFor={`book-${id}`} className="field__label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`book-${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
