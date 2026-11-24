import { useEffect, useState } from 'react';
import type { CardSummary, PaymentStatusResponse } from '../../shared/api';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { IconAlert, IconCheck, IconClock } from '../components/Icons';
import { findOffer, site } from '../config/site';
import { api, delay, errorMessage } from '../lib/api';
import { completeDeposit, depositKey, returnQuery, settlePayment } from '../lib/booking';
import { telHref } from '../lib/format';
import { usePublicConfig } from '../lib/public-config';
import { Link, navigate } from '../lib/router';
import { readSession, writeSession } from '../lib/storage';
import { NotFoundPage } from './NotFoundPage';

type Phase =
  | { kind: 'checking' }
  | { kind: 'paid'; paymentId: string; jobId: string | null }
  | { kind: 'pending'; paymentId: string }
  | { kind: 'failed'; message: string }
  | { kind: 'missing' };

const POLL_ATTEMPTS = 10;
const POLL_MS = 2500;

/**
 * Where buyers land after paying, including after a 3D Secure or bank redirect.
 * Whop appends ?payment=pay_...&status=..., or ?setup=sint_... for a saved card. The status in
 * the URL is only a hint: this page confirms the payment with the server before showing success.
 */
export function ReturnPage({ offerId, search }: { offerId: string; search: string }) {
  const offer = findOffer(offerId);
  const configState = usePublicConfig();
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

  const params = new URLSearchParams(search);
  const paymentId = params.get('payment');
  const setupId = params.get('setup') ?? params.get('setup_intent_id');
  const urlStatus = params.get('status');
  const jobId = params.get('job');
  const environment = configState.status === 'ready' ? configState.config.environment : null;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Back from a bank step while saving the deposit card: finish the deposit charge.
      if (!paymentId && setupId) {
        if (urlStatus && urlStatus !== 'succeeded') {
          setPhase({ kind: 'failed', message: "Your bank didn't approve saving this card. Try again with another card." });
          return;
        }
        if (!environment) return;
        const charged = await completeDeposit(setupId);
        writeSession(depositKey(charged.jobId), { jobId: charged.jobId, card: charged.card });
        const outcome = await settlePayment(charged, null, environment);
        if (outcome === 'redirected' || cancelled) return;
        navigate(
          `?${returnQuery({ payment: charged.paymentId, job: charged.jobId, status: outcome === 'paid' ? 'succeeded' : 'processing' })}`,
          { replace: true },
        );
        return;
      }

      if (!paymentId) {
        setPhase({ kind: 'missing' });
        return;
      }
      if (urlStatus === 'failed' || urlStatus === 'canceled') {
        setPhase({ kind: 'failed', message: 'The payment was not completed and you were not charged.' });
        return;
      }

      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        const status = await api<PaymentStatusResponse>(`/api/payments/${encodeURIComponent(paymentId)}`);
        if (cancelled) return;
        if (status.outcome === 'paid') {
          setPhase({ kind: 'paid', paymentId, jobId: status.jobId ?? jobId });
          return;
        }
        if (status.outcome === 'failed') {
          setPhase({ kind: 'failed', message: 'The payment did not go through and you were not charged.' });
          return;
        }
        setPhase({ kind: 'pending', paymentId });
        await delay(POLL_MS);
        if (cancelled) return;
      }
    };

    run().catch((error: unknown) => {
      if (!cancelled) setPhase({ kind: 'failed', message: errorMessage(error) });
    });
    return () => {
      cancelled = true;
    };
  }, [paymentId, setupId, urlStatus, jobId, environment]);

  useEffect(() => {
    document.title = `${offer?.name ?? 'Payment'} | ${site.company.name}`;
  }, [offer]);

  if (!offer) return <NotFoundPage />;

  const saved = phase.kind === 'paid' && phase.jobId ? readSession<{ card: CardSummary | null }>(depositKey(phase.jobId)) : null;

  return (
    <>
      <Header variant="focused" />
      <main id="main" className="status-page">
        <div className="container status-page__inner" aria-live="polite">
          {phase.kind === 'checking' && (
            <>
              <IconClock className="status-page__icon" />
              <h1 className="status-page__title">Confirming your payment</h1>
              <p>This takes a few seconds.</p>
            </>
          )}

          {phase.kind === 'pending' && (
            <>
              <IconClock className="status-page__icon" />
              <h1 className="status-page__title">Your payment is processing</h1>
              <p>Some banks take a little longer to confirm. This page updates on its own, and we will contact you once it clears.</p>
              <p className="reference">
                Payment reference <strong>{phase.paymentId}</strong>
              </p>
            </>
          )}

          {phase.kind === 'paid' && (
            <>
              <IconCheck className="status-page__icon status-page__icon--ok" />
              <h1 className="status-page__title">{offer.successTitle}</h1>
              <p>{offer.successBody}</p>
              <dl className="receipt">
                <div>
                  <dt>Payment reference</dt>
                  <dd>{phase.paymentId}</dd>
                </div>
                {phase.jobId && (
                  <div>
                    <dt>Job number</dt>
                    <dd>{phase.jobId}</dd>
                  </div>
                )}
                {saved?.card && (
                  <div>
                    <dt>Card on file for the balance</dt>
                    <dd>{saved.card.label}</dd>
                  </div>
                )}
              </dl>
              <div className="status-page__actions">
                <Link to="/" className="btn btn--primary">
                  Back to the home page
                </Link>
                <a href={telHref(site.company.phone)} className="btn btn--secondary">
                  Call {site.company.phone}
                </a>
              </div>
            </>
          )}

          {phase.kind === 'failed' && (
            <>
              <IconAlert className="status-page__icon status-page__icon--bad" />
              <h1 className="status-page__title">Payment not completed</h1>
              <p>{phase.message}</p>
              <div className="status-page__actions">
                <Link to={`/book/${offer.id}`} className="btn btn--primary">
                  Try again
                </Link>
                <a href={telHref(site.company.phone)} className="btn btn--secondary">
                  Call {site.company.phone}
                </a>
              </div>
            </>
          )}

          {phase.kind === 'missing' && (
            <>
              <IconAlert className="status-page__icon" />
              <h1 className="status-page__title">We could not find a payment</h1>
              <p>Open this page from the checkout, or start a new booking.</p>
              <div className="status-page__actions">
                <Link to={`/book/${offer.id}`} className="btn btn--primary">
                  {offer.bookLabel}
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
