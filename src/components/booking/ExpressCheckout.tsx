import { useEffect, useRef, useState } from 'react';
import { Checkout, ExpressCheckoutElement } from '../../lib/whop-elements';

interface ExpressCheckoutProps {
  variantId: string;
  returnUrl: string;
  metadata: Record<string, string>;
  onComplete: (paymentId: string | null) => void;
}

/** Reads the payment id from Checkout's onComplete payload. */
function paymentIdFrom(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null;
  const value = event as { paymentId?: unknown; receiptId?: unknown; result?: { paymentId?: unknown } };
  const id = value.paymentId ?? value.result?.paymentId ?? value.receiptId;
  return typeof id === 'string' ? id : null;
}

/**
 * One-press Apple Pay, Google Pay and PayPal through Whop's ExpressCheckoutElement. It renders
 * only the wallets the device supports, and nothing when none are available, so the divider
 * below is shown only when buttons actually appear.
 */
export function ExpressCheckout({ variantId, returnUrl, metadata, onComplete }: ExpressCheckoutProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [hasButtons, setHasButtons] = useState(false);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHasButtons(slot.getBoundingClientRect().height > 12));
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="express">
      <div ref={slotRef} className="express__slot">
        <Checkout
          plan={variantId}
          returnUrl={returnUrl}
          metadata={metadata}
          onComplete={(event: unknown) => onComplete(paymentIdFrom(event))}
        >
          <ExpressCheckoutElement
            layout="auto"
            onError={(error: { message?: string } | undefined) =>
              console.warn('[whop] Express checkout is unavailable here:', error?.message ?? error)
            }
          />
        </Checkout>
      </div>
      {hasButtons && (
        <p className="divider">
          <span>Or pay by card, bank or payment plan</span>
        </p>
      )}
    </div>
  );
}
