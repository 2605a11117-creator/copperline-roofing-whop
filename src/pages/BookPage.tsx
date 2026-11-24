import { useEffect, useRef, useState } from 'react';
import type { BookingDetails, PublicConfig } from '../../shared/api';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { BookingDetailsForm } from '../components/booking/BookingDetailsForm';
import { ChargeCheckout } from '../components/booking/ChargeCheckout';
import { DepositCheckout } from '../components/booking/DepositCheckout';
import { OrderSummary } from '../components/booking/OrderSummary';
import { IconAlert } from '../components/Icons';
import { findOffer, site } from '../config/site';
import type { Offer } from '../config/types';
import { DETAILS_KEY, emptyDetails } from '../lib/booking';
import { telHref } from '../lib/format';
import { usePublicConfig } from '../lib/public-config';
import { Link } from '../lib/router';
import { readSession, writeSession } from '../lib/storage';
import { eventId, track } from '../lib/track';
import { NotFoundPage } from './NotFoundPage';

type Step = 'details' | 'payment';

function trackingIds(offer: Offer, config: PublicConfig | null) {
  return {
    variant_id: config?.variants[offer.id] ?? undefined,
    product_id: config?.productId ?? undefined,
    value: offer.price,
    currency: 'USD',
  };
}

export function BookPage({ offerId }: { offerId: string }) {
  const offer = findOffer(offerId);
  if (!offer) return <NotFoundPage />;
  return <Booking offer={offer} />;
}

function Booking({ offer }: { offer: Offer }) {
  const configState = usePublicConfig();
  const config = configState.status === 'ready' ? configState.config : null;
  const [step, setStep] = useState<Step>('details');
  const [details, setDetails] = useState<BookingDetails>(() => readSession<BookingDetails>(DETAILS_KEY) ?? emptyDetails());
  const viewTracked = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = `${offer.pageTitle} | ${site.company.name}`;
  }, [offer]);

  // view_content for every offer, and deposit_started when the deposit checkout opens.
  useEffect(() => {
    if (viewTracked.current || configState.status === 'loading') return;
    viewTracked.current = true;
    const ids = trackingIds(offer, config);
    track('view_content', ids);
    if (offer.kind === 'deposit') {
      track('deposit_started', { ...ids, offer: offer.id, event_id: eventId('deposit_started') });
    }
  }, [offer, config, configState.status]);

  // initiate_checkout each time the payment step opens (not when config or offer re-render).
  useEffect(() => {
    if (step === 'payment') track('initiate_checkout', trackingIds(offer, config));
  }, [step]);

  const continueToPayment = (next: BookingDetails) => {
    setDetails(next);
    writeSession(DETAILS_KEY, next);
    setStep('payment');
    window.requestAnimationFrame(() => {
      headingRef.current?.scrollIntoView({ block: 'start' });
      headingRef.current?.focus();
    });
  };

  const accountId = config?.accountId ?? null;
  const variantId = config?.variants[offer.id] ?? null;
  const unavailable = configState.status === 'error' || (config !== null && (!accountId || !variantId));

  return (
    <>
      <Header variant="focused" />
      <main id="main" className="book">
        <div className="container book__grid">
          <div className="book__main">
            <p className="book__back">
              <Link to="/#services">Back to services</Link>
            </p>
            <h1 ref={headingRef} className="book__title" tabIndex={-1}>
              {offer.pageTitle}
            </h1>
            <ol className="book__steps">
              <li aria-current={step === 'details' ? 'step' : undefined}>
                <span className="book__step-number">1</span> Your details
              </li>
              <li aria-current={step === 'payment' ? 'step' : undefined}>
                <span className="book__step-number">2</span> Payment
              </li>
            </ol>

            {unavailable ? (
              <div className="notice" role="status">
                <IconAlert />
                <div>
                  <p className="notice__title">Online booking is not available right now</p>
                  <p>
                    Call <a href={telHref(site.company.phone)}>{site.company.phone}</a> and we will book you over the
                    phone.
                  </p>
                  {config && config.missing.length > 0 && (
                    <p className="notice__hint">Site owner: open /admin to see which Whop IDs are missing.</p>
                  )}
                </div>
              </div>
            ) : step === 'details' ? (
              <BookingDetailsForm offer={offer} initial={details} onContinue={continueToPayment} />
            ) : (
              <div className="book__payment">
                <div className="details-card">
                  <div>
                    <p className="details-card__name">{details.name}</p>
                    <p>
                      {details.address}, {details.zip}
                    </p>
                    <p>{details.phone}</p>
                    {details.window && <p>Preferred time: {details.window}</p>}
                    {details.reference && <p>Estimate number: {details.reference}</p>}
                  </div>
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => setStep('details')}>
                    Edit details
                  </button>
                </div>
                {!config || !accountId ? (
                  <p className="loading" role="status">
                    Loading secure checkout…
                  </p>
                ) : offer.kind === 'deposit' ? (
                  <DepositCheckout offer={offer} config={config} accountId={accountId} details={details} />
                ) : variantId ? (
                  <ChargeCheckout
                    offer={offer}
                    config={config}
                    accountId={accountId}
                    variantId={variantId}
                    details={details}
                  />
                ) : null}
              </div>
            )}
          </div>
          <aside className="book__aside">
            <OrderSummary offer={offer} variantId={variantId} productId={config?.productId ?? null} />
            {offer.kind === 'deposit' && (
              <div className="aside-note">
                <h2 className="aside-note__title">How the balance is billed</h2>
                <p>
                  After the final walkthrough we send an invoice for the remaining balance. It is charged to the card you
                  save today, or you can pay it from the invoice email.
                </p>
              </div>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
