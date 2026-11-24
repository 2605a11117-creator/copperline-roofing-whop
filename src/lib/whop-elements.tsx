import * as WhopReact from '@whop/elements-react';
import { loadWhop } from '@whop/elements';
import { useMemo, type ReactNode } from 'react';
import type { WhopEnvironment } from '../../shared/api';
import { site } from '../config/site';

// Thin bindings to Whop Elements (https://docs.whop.com/elements).
//
// The components are looked up by their documented export names and receive plain props,
// exactly as in Whop's examples:
//   <WhopElements elements={loadWhop()} environment="sandbox">
//     <Checkout plan="plan_..."><ExpressCheckoutElement /></Checkout>
//     <Payments accountId="biz_..." plan="plan_...">
//       <EmailElement /> <PaymentElement /> <BrandingElement />
//     </Payments>
//   </WhopElements>

type LooseProps = Record<string, unknown> & { children?: ReactNode };
type LooseComponent = (props: LooseProps) => ReactNode;

const elementExports = WhopReact as unknown as Record<string, unknown>;

function elementComponent(name: string): LooseComponent {
  const found = elementExports[name];
  if (typeof found === 'function' || (typeof found === 'object' && found !== null)) {
    return found as LooseComponent;
  }
  const Missing: LooseComponent = () => {
    console.error(`[whop] @whop/elements-react has no export named ${name}. Update the package.`);
    return null;
  };
  return Missing;
}

export const WhopElements = elementComponent('WhopElements');
export const Checkout = elementComponent('Checkout');
export const ExpressCheckoutElement = elementComponent('ExpressCheckoutElement');
export const Payments = elementComponent('Payments');
export const EmailElement = elementComponent('EmailElement');
export const PaymentElement = elementComponent('PaymentElement');
export const BrandingElement = elementComponent('BrandingElement');

/** usePayments() from @whop/elements-react when the installed version has it. */
export const usePaymentsHandle: () => unknown =
  typeof elementExports.usePayments === 'function' ? (elementExports.usePayments as () => unknown) : () => null;

let elementsLoader: unknown = null;

/** loadWhop() injects Whop's hosted script once; every provider shares the same loader. */
export function elementsLoaderOnce(): unknown {
  if (elementsLoader === null) elementsLoader = loadWhop();
  return elementsLoader;
}

export const elementsAppearance = {
  theme: { appearance: 'light', accentColor: site.whopAppearance.accentColor },
};

export function WhopProvider({ environment, children }: { environment: WhopEnvironment; children: ReactNode }) {
  const elements = useMemo(() => elementsLoaderOnce(), []);
  return (
    <WhopElements elements={elements} environment={environment} appearance={elementsAppearance}>
      {children}
    </WhopElements>
  );
}

// ---------------------------------------------------------------- payment handle helpers

export interface NextActionResult {
  status?: string;
  redirected?: boolean;
  lastPaymentError?: { code?: string; message?: string } | null;
}

export interface PaymentsHandle {
  createConfirmationToken?: (input?: Record<string, unknown>) => Promise<unknown>;
  handleNextAction?: (input: { clientSecret: string }) => Promise<NextActionResult>;
}

export function asPaymentsHandle(value: unknown): PaymentsHandle | null {
  if (!value || typeof value !== 'object') return null;
  const handle = value as PaymentsHandle;
  return typeof handle.createConfirmationToken === 'function' ? handle : null;
}

/** createConfirmationToken() resolves to { confirmationToken, type }. */
export function readConfirmationToken(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const value = (result as { confirmationToken?: unknown; id?: unknown }).confirmationToken ??
      (result as { id?: unknown }).id;
    if (typeof value === 'string' && value) return value;
  }
  return null;
}

/** The buyer closed a wallet sheet or bank window. Not an error worth showing. */
export function isBuyerCancel(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return code === 'payment_request_cancelled' || /payment_request_cancelled/.test(message);
}

/**
 * Finishes 3D Secure, a bank step, or simply waits for a charge to settle.
 * Uses the mounted Payments handle when it exposes handleNextAction, otherwise the static
 * whop.payments.handleNextAction from a Whop Elements instance.
 */
export async function runNextAction(
  handle: PaymentsHandle | null,
  clientSecret: string,
  environment: WhopEnvironment,
): Promise<NextActionResult> {
  if (handle?.handleNextAction) return handle.handleNextAction({ clientSecret });
  const createWhop = await Promise.resolve(elementsLoaderOnce());
  if (typeof createWhop !== 'function') throw new Error('Whop Elements did not load. Refresh the page and try again.');
  const instance = (createWhop as (options: Record<string, unknown>) => {
    payments?: { handleNextAction?: (input: { clientSecret: string }) => Promise<NextActionResult> };
  })({ environment, appearance: elementsAppearance });
  if (!instance.payments?.handleNextAction) throw new Error('Whop Elements could not finish the payment step.');
  return instance.payments.handleNextAction({ clientSecret });
}
