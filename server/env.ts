// Bindings available to the server at runtime.
//
// Injected by Whop hosting: APP_ID, BUILD_ID, WHOP_API_ORIGIN, WHOP_ACCOUNT_ID, ASSETS.
// Set by you with `whop apps secrets set --secret NAME=value`:
//   ADMIN_PASSCODE         required for /admin
//   WHOP_SANDBOX_API_KEY   required when src/config/whop.ts uses the sandbox
//   WHOP_COMPANY_API_KEY   optional in production, if the injected app key lacks a permission
//   WHOP_ENVIRONMENT       optional: "sandbox" or "production", overrides whop.ts without a code change

export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS?: AssetsBinding;
  APP_ID?: string;
  BUILD_ID?: string;
  WHOP_API_ORIGIN?: string;
  WHOP_ACCOUNT_ID?: string;
  /** Short-lived key that `whop apps dev` injects for local development. */
  WHOP_API_KEY?: string;
  WHOP_COMPANY_API_KEY?: string;
  WHOP_SANDBOX_API_KEY?: string;
  WHOP_ENVIRONMENT?: string;
  ADMIN_PASSCODE?: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
