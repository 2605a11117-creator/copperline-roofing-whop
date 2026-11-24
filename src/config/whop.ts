import type { WhopEnvironment } from '../../shared/api';

// Whop IDs for checkout. These are public values (they appear in checkout links), so they
// can live in the code. Secrets (API keys, the admin passcode) are set with
// `whop apps secrets set`, never here.
//
// 1. Create one product and three one-time plans in the Whop dashboard
//    (sandbox.whop.com for testing, whop.com for real payments).
// 2. Paste the IDs below. The plan keys must match the offer ids in site.ts.
// 3. Set `environment` to the dashboard you used.

export interface WhopIds {
  /** Your business ID, starts with biz_. In production it can stay empty: hosting provides it. */
  accountId: string;
  /** The product the plans belong to, starts with prod_. Optional, used for leads and tracking. */
  productId: string;
  /** Plan IDs (start with plan_) keyed by offer id from site.ts. */
  variants: Record<string, string>;
}

export interface WhopConfig {
  environment: WhopEnvironment;
  /** Pins the Whop API version the server code was written against. */
  apiVersionDate: string;
  sandbox: WhopIds;
  production: WhopIds;
}

export const whopConfig: WhopConfig = {
  environment: 'sandbox',
  apiVersionDate: '2026-11-20',

  sandbox: {
    accountId: 'biz_eQExOLn217GBtX',
    productId: 'prod_Jdv0Fh0JnkAQh',
    variants: {
      inspection: 'plan_t8HoC6ioEgNZ3',
      'leak-repair': 'plan_kEFGh9LQSnJ94',
      deposit: 'plan_c8CLxMwE55yTK',
    },
  },

  production: {
    accountId: '',
    productId: '',
    variants: {
      inspection: '',
      'leak-repair': '',
      deposit: '',
    },
  },
};
