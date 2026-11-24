import { useMemo } from 'react';
import type { BookingDetails, DepositCharged, DepositResponse, PublicConfig } from '../../../shared/api';
import type { Offer } from '../../config/types';
import { api } from '../../lib/api';
import { billingDefaults, completeDeposit, depositKey, returnQuery, returnUrlFor, settlePayment } from '../../lib/booking';
import { formatUSD } from '../../lib/format';
import { navigate } from '../../lib/router';
import { writeSession } from '../../lib/storage';
import { runNextAction, WhopProvider, type PaymentsHandle } from '../../lib/whop-elements';
import { PayForm } from './PayForm';

interface DepositCheckoutProps {
  offer: Offer;
  config: PublicConfig;
  accountId: string;
  details: BookingDetails;
}

const SETUP_DECLINED = "Your bank didn't approve saving this card. Try another card.";

/**
 * Deposit checkout with card on file:
 * 1. PaymentElement in setup mode collects the card and returns a confirmation token.
 * 2. The server creates a setup intent (the card is saved to the customer), then charges the
 *    deposit plan to that saved card.
 * 3. The saved card is billed for the final balance later with the Invoices API (see /admin).
 */
export function DepositCheckout({ offer, config, accountId, details }: DepositCheckoutProps) {
  const returnUrl = returnUrlFor(offer.id);
  const defaults = useMemo(() => billingDefaults(details), [details]);

  const saveCardAndPay = async (confirmationToken: string, handle: PaymentsHandle | null) => {
    let result: DepositResponse = await api<DepositResponse>('/api/deposit', {
      body: { confirmationToken, details, consent: true },
    });

    if (result.stage === 'setup') {
      if (result.status === 'requires_action' && result.clientSecret) {
        const action = await runNextAction(handle, result.clientSecret, config.environment);
        if (action.redirected) return;
        if (action.status && action.status !== 'succeeded' && action.status !== 'processing') {
          throw new Error(action.lastPaymentError?.message || SETUP_DECLINED);
        }
      } else if (result.status === 'canceled') {
        throw new Error(SETUP_DECLINED);
      }
      result = await completeDeposit(result.setupIntentId);
    }

    const charged: DepositCharged = result;
    writeSession(depositKey(charged.jobId), { jobId: charged.jobId, card: charged.card });
    const outcome = await settlePayment(charged, handle, config.environment);
    if (outcome === 'redirected') return;
    navigate(
      `/book/${offer.id}/return?${returnQuery({
        payment: charged.paymentId,
        job: charged.jobId,
        status: outcome === 'paid' ? 'succeeded' : 'processing',
      })}`,
    );
  };

  return (
    <WhopProvider environment={config.environment}>
      <div className="checkout-panel">
        <h2 className="checkout-panel__title">Card for the deposit and final balance</h2>
        <PayForm
          mode="setup"
          accountId={accountId}
          environment={config.environment}
          returnUrl={returnUrl}
          payLabel={`Pay ${formatUSD(offer.price)} deposit and save card`}
          hideWallets={false}
          billingDefaults={defaults}
          note="Your card is saved with Whop for the final balance. You get an invoice before the balance is charged."
          onToken={saveCardAndPay}
        />
      </div>
    </WhopProvider>
  );
}
