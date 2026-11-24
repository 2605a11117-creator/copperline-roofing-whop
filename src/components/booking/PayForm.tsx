import { useRef, useState, type RefObject } from 'react';
import type { WhopEnvironment } from '../../../shared/api';
import { errorMessage } from '../../lib/api';
import {
  asPaymentsHandle,
  BrandingElement,
  EmailElement,
  isBuyerCancel,
  PaymentElement,
  Payments,
  readConfirmationToken,
  usePaymentsHandle,
  type PaymentsHandle,
} from '../../lib/whop-elements';
import { IconAlert, IconLock } from '../Icons';

export interface PayFormProps {
  accountId: string;
  environment: WhopEnvironment;
  /** payment: charge a plan now. setup: save the card without charging (setup intent). */
  mode: 'payment' | 'setup';
  variantId?: string;
  returnUrl: string;
  payLabel: string;
  /** Hide wallet tiles when an ExpressCheckoutElement already shows those buttons. */
  hideWallets: boolean;
  billingDefaults: Record<string, unknown>;
  note: string;
  onToken: (confirmationToken: string, handle: PaymentsHandle | null) => Promise<void>;
}

const NO_WALLETS = { applePay: 'never', googlePay: 'never', payPal: 'never' };

/**
 * Whop Payment Elements: EmailElement, PaymentElement and the required BrandingElement under a
 * Payments handle. Card data stays inside Whop's frames; this code only receives a confirmation token.
 */
export function PayForm(props: PayFormProps) {
  const handleRef = useRef<unknown>(null);
  const paymentsOptions =
    props.mode === 'setup'
      ? { accountId: props.accountId, mode: 'setup', currency: 'usd', returnUrl: props.returnUrl }
      : { accountId: props.accountId, plan: props.variantId, returnUrl: props.returnUrl };

  return (
    <Payments ref={handleRef} {...paymentsOptions}>
      <PayFormFields {...props} handleRef={handleRef} />
    </Payments>
  );
}

function PayFormFields({
  handleRef,
  payLabel,
  hideWallets,
  billingDefaults,
  note,
  onToken,
}: PayFormProps & { handleRef: RefObject<unknown> }) {
  const hookHandle = usePaymentsHandle();
  const [complete, setComplete] = useState(false);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pay = async () => {
    const handle = asPaymentsHandle(handleRef.current) ?? asPaymentsHandle(hookHandle);
    if (!handle?.createConfirmationToken) {
      setError('The payment form is still loading. Try again in a moment.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const token = readConfirmationToken(await handle.createConfirmationToken({}));
      if (!token) throw new Error('Whop did not return a payment token. Try again.');
      await onToken(token, handle);
    } catch (caught) {
      if (!isBuyerCancel(caught)) setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pay-form">
      <div className="pay-form__element">
        <EmailElement />
      </div>
      <div className="pay-form__element">
        <PaymentElement
          onChange={(event: { complete?: boolean } | undefined) => {
            setChanged(true);
            setComplete(Boolean(event?.complete));
          }}
          wallets={hideWallets ? NO_WALLETS : undefined}
          defaultValues={billingDefaults}
        />
      </div>
      {error && (
        <p className="alert" role="alert">
          <IconAlert />
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn--primary btn--lg btn--block"
        onClick={pay}
        disabled={busy || (changed && !complete)}
      >
        {busy ? 'Processing…' : payLabel}
      </button>
      <p className="pay-form__note">
        <IconLock />
        {note}
      </p>
      <div className="pay-form__branding">
        <BrandingElement />
      </div>
    </div>
  );
}
