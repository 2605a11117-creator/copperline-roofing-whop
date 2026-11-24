import { useMemo } from 'react';
import type { BookingDetails, CheckoutResponse, PublicConfig } from '../../../shared/api';
import type { Offer } from '../../config/types';
import { api } from '../../lib/api';
import { billingDefaults, detailsMetadata, returnQuery, returnUrlFor, settlePayment } from '../../lib/booking';
import { formatUSD } from '../../lib/format';
import { navigate } from '../../lib/router';
import { WhopProvider, type PaymentsHandle } from '../../lib/whop-elements';
import { ExpressCheckout } from './ExpressCheckout';
import { PayForm } from './PayForm';

interface ChargeCheckoutProps {
  offer: Offer;
  config: PublicConfig;
  accountId: string;
  variantId: string;
  details: BookingDetails;
}

/**
 * Checkout for fixed-price offers (inspection, flat-rate repair):
 * ExpressCheckoutElement for wallets, then PaymentElement for card, bank and pay-over-time.
 */
export function ChargeCheckout({ offer, config, accountId, variantId, details }: ChargeCheckoutProps) {
  const returnUrl = returnUrlFor(offer.id);
  const metadata = useMemo(() => detailsMetadata(offer.id, details), [offer.id, details]);
  const defaults = useMemo(() => billingDefaults(details), [details]);

  const finish = (paymentId: string | null, status: 'succeeded' | 'processing') => {
    navigate(`/book/${offer.id}/return?${returnQuery({ payment: paymentId, status })}`);
  };

  const payWithToken = async (confirmationToken: string, handle: PaymentsHandle | null) => {
    const step = await api<CheckoutResponse>('/api/checkout', {
      body: { offerId: offer.id, confirmationToken, details },
    });
    const outcome = await settlePayment(step, handle, config.environment);
    if (outcome === 'redirected') return;
    finish(step.paymentId, outcome === 'paid' ? 'succeeded' : 'processing');
  };

  return (
    <WhopProvider environment={config.environment}>
      <div className="checkout-panel">
        <h2 className="checkout-panel__title">Payment</h2>
        <ExpressCheckout
          variantId={variantId}
          returnUrl={returnUrl}
          metadata={metadata}
          onComplete={(paymentId) => finish(paymentId, 'succeeded')}
        />
        <PayForm
          mode="payment"
          accountId={accountId}
          environment={config.environment}
          variantId={variantId}
          returnUrl={returnUrl}
          payLabel={`Pay ${formatUSD(offer.price)} and book`}
          hideWallets
          billingDefaults={defaults}
          note="Payment is processed securely by Whop. Pay-over-time plans appear here when you are eligible."
          onToken={payWithToken}
        />
      </div>
    </WhopProvider>
  );
}
