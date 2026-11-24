import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { EstimateRequest, EstimateResponse } from '../../../shared/api';
import { site } from '../../config/site';
import { api, ApiError, errorMessage } from '../../lib/api';
import { isEmail, isUsPhone, isZip, telHref } from '../../lib/format';
import { track } from '../../lib/track';
import { IconAlert, IconCheck, IconClock, IconPhone } from '../Icons';

type FieldName = 'name' | 'email' | 'phone' | 'address' | 'zip' | 'consent';

type FormState = Omit<EstimateRequest, 'page' | 'eventId'>;

const EMPTY: FormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  zip: '',
  service: site.estimate.serviceOptions[0] ?? '',
  roofType: site.estimate.roofTypes[0] ?? '',
  timeline: site.estimate.timelines[0] ?? '',
  insurance: site.estimate.insuranceOptions[0] ?? '',
  message: '',
  consent: false,
  company: '',
};

/** One id per estimate request. The browser pixel and the server's Events API copy share it. */
function newEventId(): string {
  try {
    return `est_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  } catch {
    return `est_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

const FIELD_ERRORS: Record<FieldName, string> = {
  name: 'Enter your name.',
  email: 'Enter an email address like name@example.com.',
  phone: 'Enter a 10-digit phone number.',
  address: 'Enter the street address of the property.',
  zip: 'Enter a 5-digit ZIP code.',
  consent: 'Check this box so we can contact you about the estimate.',
};

function validate(form: FormState): FieldName[] {
  const invalid: FieldName[] = [];
  if (form.name.trim().length < 2) invalid.push('name');
  if (!isEmail(form.email.trim())) invalid.push('email');
  if (!isUsPhone(form.phone)) invalid.push('phone');
  if (form.address.trim().length < 5) invalid.push('address');
  if (!isZip(form.zip)) invalid.push('zip');
  if (!form.consent) invalid.push('consent');
  return invalid;
}

function EstimateForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [invalid, setInvalid] = useState<FieldName[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState<EstimateResponse | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  // Kept across retries of the same request so a resend never counts as a second lead.
  const eventIdRef = useRef<string>(newEventId());

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (invalid.includes(key as FieldName)) setInvalid((list) => list.filter((name) => name !== key));
  };

  const errorFor = (name: FieldName) => (invalid.includes(name) ? FIELD_ERRORS[name] : '');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems = validate(form);
    setInvalid(problems);
    if (problems.length > 0) {
      formRef.current?.querySelector<HTMLElement>(`[name="${problems[0]}"]`)?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const eventId = eventIdRef.current;
      const result = await api<EstimateResponse>('/api/estimate', {
        body: { ...form, page: window.location.href, eventId } satisfies EstimateRequest,
      });
      track('estimate_requested', {
        service: form.service,
        roof_type: form.roofType,
        timeline: form.timeline,
        insurance_claim: form.insurance,
        in_service_area: result.inServiceArea,
        // Each event name gets its own id; the server sends copies with the same ids, so each counts once.
        event_id: `${eventId}-req`,
      });
      track('lead', { event_id: eventId });
      setDone(result);
      window.requestAnimationFrame(() => successRef.current?.focus());
    } catch (error) {
      if (error instanceof ApiError && error.fields.length > 0) {
        setInvalid(error.fields.filter((name): name is FieldName => name in FIELD_ERRORS));
      }
      setSubmitError(errorMessage(error, `We couldn't send your request. Call us at ${site.company.phone}.`));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div ref={successRef} className="form-panel form-panel--done" tabIndex={-1} aria-live="polite">
        <IconCheck className="form-panel__done-icon" />
        <h3 className="form-panel__title">{site.estimate.successTitle}</h3>
        <p>{site.estimate.successBody}</p>
        <p className="reference">
          Reference <strong>{done.reference}</strong>
        </p>
        {!done.inServiceArea && (
          <p className="form-panel__note">
            Your ZIP code is outside our usual area. We will let you know if we can take the job.
          </p>
        )}
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => {
            eventIdRef.current = newEventId();
            setForm(EMPTY);
            setDone(null);
          }}
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} className="form-panel" onSubmit={submit} noValidate aria-labelledby="estimate-form-title">
      <h3 id="estimate-form-title" className="form-panel__title">
        Your roof and how to reach you
      </h3>
      <div className="form-grid">
        <Field label="Full name" name="name" error={errorFor('name')}>
          <input
            id="name"
            name="name"
            className="input"
            autoComplete="name"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            aria-invalid={errorFor('name') ? true : undefined}
            aria-describedby={errorFor('name') ? 'name-error' : undefined}
          />
        </Field>
        <Field label="Phone" name="phone" error={errorFor('phone')}>
          <input
            id="phone"
            name="phone"
            className="input"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => set('phone', event.target.value)}
            aria-invalid={errorFor('phone') ? true : undefined}
            aria-describedby={errorFor('phone') ? 'phone-error' : undefined}
          />
        </Field>
        <Field label="Email" name="email" error={errorFor('email')} wide>
          <input
            id="email"
            name="email"
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={form.email}
            onChange={(event) => set('email', event.target.value)}
            aria-invalid={errorFor('email') ? true : undefined}
            aria-describedby={errorFor('email') ? 'email-error' : undefined}
          />
        </Field>
        <Field label="Property address" name="address" error={errorFor('address')}>
          <input
            id="address"
            name="address"
            className="input"
            autoComplete="street-address"
            value={form.address}
            onChange={(event) => set('address', event.target.value)}
            aria-invalid={errorFor('address') ? true : undefined}
            aria-describedby={errorFor('address') ? 'address-error' : undefined}
          />
        </Field>
        <Field label="ZIP code" name="zip" error={errorFor('zip')}>
          <input
            id="zip"
            name="zip"
            className="input"
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={10}
            value={form.zip}
            onChange={(event) => set('zip', event.target.value)}
            aria-invalid={errorFor('zip') ? true : undefined}
            aria-describedby={errorFor('zip') ? 'zip-error' : undefined}
          />
        </Field>
        <Field label="What do you need?" name="service">
          <select id="service" name="service" className="input" value={form.service} onChange={(event) => set('service', event.target.value)}>
            {site.estimate.serviceOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Roof type" name="roofType">
          <select id="roofType" name="roofType" className="input" value={form.roofType} onChange={(event) => set('roofType', event.target.value)}>
            {site.estimate.roofTypes.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="When do you want the work done?" name="timeline">
          <select id="timeline" name="timeline" className="input" value={form.timeline} onChange={(event) => set('timeline', event.target.value)}>
            {site.estimate.timelines.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Filing an insurance claim?" name="insurance">
          <select id="insurance" name="insurance" className="input" value={form.insurance} onChange={(event) => set('insurance', event.target.value)}>
            {site.estimate.insuranceOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Anything else we should know? (optional)" name="message" wide>
          <textarea
            id="message"
            name="message"
            className="input input--area"
            rows={4}
            maxLength={1500}
            value={form.message}
            onChange={(event) => set('message', event.target.value)}
          />
        </Field>
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={(event) => set('company', event.target.value)} />
      </div>

      <div className={errorFor('consent') ? 'check check--invalid' : 'check'}>
        <input
          id="consent"
          name="consent"
          type="checkbox"
          checked={form.consent}
          onChange={(event) => set('consent', event.target.checked)}
          aria-describedby={errorFor('consent') ? 'consent-error' : undefined}
        />
        <label htmlFor="consent">{site.estimate.consent}</label>
      </div>
      {errorFor('consent') && (
        <p id="consent-error" className="field__error">
          {errorFor('consent')}
        </p>
      )}

      {submitError && (
        <p className="alert" role="alert">
          <IconAlert />
          {submitError}
        </p>
      )}

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting}>
        {submitting ? 'Sending request…' : 'Send estimate request'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  error = '',
  wide = false,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? 'field field--wide' : 'field'}>
      <label htmlFor={name} className="field__label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}

export function EstimateSection() {
  const { estimate, company } = site;
  return (
    <section id="estimate" className="section section--sky" aria-labelledby="estimate-title">
      <div className="container estimate">
        <div className="estimate__copy">
          <h2 id="estimate-title" className="section__title section__title--side">
            {estimate.heading}
          </h2>
          <p className="section__intro">{estimate.intro}</p>
          <h3 className="estimate__subhead">What happens next</h3>
          <ol className="estimate__next">
            {estimate.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="contact-card">
            <a className="contact-card__phone" href={telHref(company.phone)}>
              <IconPhone />
              {company.phone}
            </a>
            <p>
              <a href={`mailto:${company.email}`}>{company.email}</a>
            </p>
            <p className="contact-card__hours">
              <IconClock />
              <span>
                {company.hours.map((row) => (
                  <span key={row.days} className="contact-card__hours-row">
                    {row.days}: {row.time}
                  </span>
                ))}
              </span>
            </p>
            <p className="contact-card__emergency">{company.emergency}</p>
          </div>
        </div>
        <EstimateForm />
      </div>
    </section>
  );
}
