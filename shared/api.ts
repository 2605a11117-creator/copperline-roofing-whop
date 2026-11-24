// Request and response shapes shared by the site (src/) and the server (server/).

export type WhopEnvironment = 'sandbox' | 'production';

/** GET /api/config: the public Whop IDs the checkout needs. */
export interface PublicConfig {
  environment: WhopEnvironment;
  accountId: string | null;
  productId: string | null;
  /** Whop plan IDs (plan_...) keyed by offer id. */
  variants: Record<string, string | null>;
  /** Setup items still missing, such as "plan for inspection". Empty when checkout is ready. */
  missing: string[];
}

export interface ApiErrorBody {
  error: { message: string; code?: string; fields?: string[] };
}

/** POST /api/estimate */
export interface EstimateRequest {
  name: string;
  email: string;
  phone: string;
  address: string;
  zip: string;
  service: string;
  roofType: string;
  timeline: string;
  insurance: string;
  message: string;
  consent: boolean;
  /** Honeypot. People never see or fill it. */
  company: string;
  page: string;
  /** Shared by the browser pixel events and their server-side copies, so Whop counts each once. */
  eventId: string;
}

export interface EstimateResponse {
  ok: true;
  reference: string;
  leadId: string | null;
  memberId: string | null;
  inServiceArea: boolean;
}

/** Details collected before payment on the booking pages. */
export interface BookingDetails {
  name: string;
  phone: string;
  address: string;
  zip: string;
  /** Preferred appointment window (appointments only). */
  window: string;
  /** Estimate or quote number (deposits only). */
  reference: string;
  notes: string;
}

export interface PaymentStep {
  paymentId: string;
  status: string;
  clientSecret: string | null;
}

/** POST /api/checkout: pay for a fixed-price offer with a confirmation token. */
export interface CheckoutRequest {
  offerId: string;
  confirmationToken: string;
  details: BookingDetails;
}

export type CheckoutResponse = PaymentStep;

export interface CardSummary {
  brand: string | null;
  last4: string | null;
  /** Ready to show, e.g. "Visa ending 4242". */
  label: string;
}

/** POST /api/deposit: save the card with a setup intent, then charge the deposit to it. */
export interface DepositRequest {
  confirmationToken: string;
  details: BookingDetails;
  consent: boolean;
}

export interface DepositSetupPending {
  stage: 'setup';
  jobId: string;
  setupIntentId: string;
  status: string;
  clientSecret: string | null;
}

export interface DepositCharged extends PaymentStep {
  stage: 'payment';
  jobId: string;
  setupIntentId: string;
  card: CardSummary | null;
}

export type DepositResponse = DepositSetupPending | DepositCharged;

export type PaymentOutcome = 'paid' | 'pending' | 'failed';

/** GET /api/payments/:id */
export interface PaymentStatusResponse {
  id: string;
  status: string;
  outcome: PaymentOutcome;
  offerId: string | null;
  jobId: string | null;
}

// ---------------------------------------------------------------- admin

export type ApiAuthMode = 'sandbox_key' | 'company_key' | 'dev_key' | 'hosting';

export interface AdminStatus {
  environment: WhopEnvironment;
  accountId: string | null;
  productId: string | null;
  auth: ApiAuthMode;
  offers: Array<{ id: string; name: string; price: number; variantId: string | null }>;
  missing: string[];
}

export interface AdminLead {
  /** The member note that holds the request. */
  id: string;
  /** The lead's ID on Whop (Events API). */
  leadId: string | null;
  memberId: string;
  createdAt: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  zip: string | null;
  service: string | null;
}

export interface AdminJob {
  setupIntentId: string;
  jobId: string;
  createdAt: string | null;
  customerName: string;
  phone: string | null;
  address: string | null;
  memberId: string | null;
  paymentMethodId: string | null;
  card: CardSummary | null;
}

export type InvoiceMode = 'charge' | 'send';

export interface InvoiceRequest {
  mode: InvoiceMode;
  amount: number;
  description: string;
  /** Unique per click, used as the idempotency key. */
  requestId: string;
  jobId?: string;
  memberId?: string;
  paymentMethodId?: string;
  email?: string;
  customerName?: string;
  dueInDays?: number;
}

export interface InvoiceSummary {
  id: string;
  number: string | null;
  status: string;
  total: string | null;
  amountDue: string | null;
  checkoutLink: string | null;
  email: string | null;
  paymentMethodId: string | null;
  scheduledChargeAt: string | null;
  paidAt: string | null;
  jobId: string | null;
}
