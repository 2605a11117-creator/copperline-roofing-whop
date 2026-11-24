# Copperline Roofing: a Whop Websites template for roofing companies

A production-ready roofing company website that runs its whole sales flow on Whop:

**estimate request → $149 inspection → $500 deposit with card on file → install → final invoice**

**Live demo:** https://copperline-roofing-1.whop.site (Whop sandbox payments, test card 4242 4242 4242 4242)

- Built on **Whop Websites** with the Whop CLI: a **TanStack Start** (React) site with server routes, deployed with `whop apps deploy` to a `*.whop.site` address
- Checkout with **Whop Payment Elements**: `ExpressCheckoutElement`, `PaymentElement` (with `EmailElement`) and the required `BrandingElement`
- **Leads through the Whop API** for the "Request an estimate" form: `POST /members` finds or adds the customer, then `POST /events` records the `lead` on the account, tied to that member
- **Setup Intents** to save the customer's card at deposit checkout
- **Invoices API** to bill the final balance (auto-charge the saved card or email an invoice)
- Custom **whop.track** pixel events: `service_viewed`, `estimate_requested`, `deposit_started`
- Everything a roofing company changes lives in two files: `src/config/site.ts` and `src/config/whop.ts`

The company, reviews and figures in this template are sample content. A demo notice says so on the site until you set `demoMode: false`.

### Whop features used

Built on Whop Websites with the Whop CLI (a TanStack Start and React site with server routes on Whop hosting, deployed with `whop apps deploy` to a whop.site address), this template runs every payment on Whop. Checkout uses Whop Payment Elements: ExpressCheckoutElement for one-tap Apple Pay, Google Pay and PayPal, PaymentElement with EmailElement for card, bank and pay-over-time methods (Klarna, Afterpay and Splitit surface automatically for approved merchants), and the required BrandingElement. Three real plans back the offers: a $149 inspection and a $395 flat-rate leak repair are charged through the Payments API with the Elements confirmation token, and the $500 project deposit first saves the card with a Setup Intent, then charges the deposit to that saved card. The "Request an estimate" form creates a lead on the Whop account through the Whop API: it finds or adds the customer as a member (POST /members), records the lead with the Events API (POST /events, event_name "lead", tied to that member and user) and adds a member note with the job details. An office page lists leads and deposits with a card on file and bills the final balance with the Invoices API, either auto-charging the stored card (create, then issue) or emailing an invoice for manual payment (create, then send), with a charge-now action for open invoices; Whop issues invoices only for verified businesses, so in the unverified sandbox used for the demo the final-balance invoice is created as a draft with the saved card attached, and the office page says so. Custom whop.track events (verifiable in the Whop dashboard under Analytics, Websites, Events) (service_viewed, estimate_requested, deposit_started, plus the standard lead, view_content and initiate_checkout with event_id deduplication) fire alongside Whop's automatic page-view and checkout events, and a ?debug=1 inspector shows each one live. Company details, services, prices, service area, reviews and Whop IDs live in two config files, so a new roofing business needs no structural changes.

---

## Brief requirements and where they live

| Requirement | Where |
| --- | --- |
| Whop Websites, live on Whop hosting | TanStack Start project from `whop apps init`/`pull`: `vite.config.ts` (`whop()` plugin), `wrangler.jsonc`, routes in `src/routes/` (`api/$.ts` serves the API from `server/index.ts`), deployed with `whop apps deploy` |
| Sections: services, service area, financing, reviews and trust, contact | `src/components/sections/` (Services, ServiceArea, Financing, Reviews, EstimateSection) plus Process and FAQ |
| Real plans: $149 inspection, $500 deposit, one flat-rate service ($395 leak repair) | Created in your Whop dashboard, IDs in `src/config/whop.ts`, prices and copy in `src/config/site.ts` |
| CheckoutElement or PaymentElement, ExpressCheckoutElement, BrandingElement | `src/components/booking/ExpressCheckout.tsx`, `src/components/booking/PayForm.tsx` |
| No custom card forms, financing surfaces automatically | Card data only ever enters Whop's frames. `PaymentElement` shows card, bank, wallet and pay-over-time methods the account is approved for |
| Estimate form creates a Lead | `server/routes/estimate.ts`: `POST /members` (finds or adds the person), `POST /events` with `event_name: "lead"` (the lead, tied to that member and Whop user) and `estimate_requested`, `POST /members/:id/notes` (job details). `/admin` lists the requests with the Whop lead ID from `GET /members` and `GET /members/:id/notes` |
| Card on file via a setup intent at deposit checkout | `src/components/booking/DepositCheckout.tsx`, `server/routes/deposit.ts` (`POST /setup_intents`, then `POST /payments` with the saved card) |
| Final balance with the Invoices API (auto-charge or manual) | `/admin` page, `server/routes/admin.ts` (`POST /invoices` then `/issue` or `/send`, plus `/charge`) |
| Pixel events with whop.track | `src/lib/track.ts`, fired in `Services.tsx`, `EstimateSection.tsx`, `BookPage.tsx`. Inspect with `?debug=1` |
| Reusable template | `src/config/site.ts` and `src/config/whop.ts`; no component changes needed |
| Responsive | Mobile-first CSS in `src/styles.css`, sticky call and estimate bar on phones |

---

## What you need

- A computer (Windows, Mac or Linux) with a terminal
- **Node.js 22 or newer** from [nodejs.org](https://nodejs.org). Check with `node -v`
- A **Whop account** at [whop.com](https://whop.com) with a business
- For test payments: a **Whop sandbox account** at [sandbox.whop.com](https://sandbox.whop.com) (separate login, no real money)

---

## Set up and deploy (about 30 minutes)

### 1. Install the Whop CLI and sign in

Mac or Linux:

```bash
curl -fsSL https://whop.com/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://github.com/whopio/whop-public-cli/releases/latest/download/install.ps1 | iex
```

Or with npm on any system: `npm install -g @whop/cli`

Then sign in and choose the business the site belongs to:

```bash
whop login
whop quickstart
```

### 2. Install the project

Unzip this folder, open a terminal inside it, and run:

```bash
npm install
```

### 3. Create the website and claim its address

In a **different** folder (for example your Desktop), run:

```bash
whop apps init --app_type website --name "Copperline Roofing" --domain copperline-yourname
```

Pick any free name for `--domain`; the site will live at `https://copperline-yourname.whop.site`.
This registers the website app and creates a starter folder. Copy the `whop.app.json` file from that new folder into this project's folder. That file links this project to your website app. You can delete the starter folder afterwards.

If you'd rather not copy the file: note the app ID (`app_...`) that `whop apps init` prints, and deploy once with `whop apps deploy --app app_...` in step 6. That links this folder to the app.

### 4. Create the product and the three plans

Use the **sandbox** for the test checkout in your recording (no real money). Production works the same way at whop.com.

1. Open [sandbox.whop.com](https://sandbox.whop.com) and create a business if you don't have one.
2. Create a product named something like "Roofing services".
3. Add three **one-time** prices (plans) to it:
   - Roof inspection: **$149**
   - Project deposit: **$500**
   - Flat-rate leak repair: **$395**
4. Copy the IDs: business `biz_...`, product `prod_...` and each plan `plan_...`.
5. Paste them into `src/config/whop.ts` under `sandbox`, keep `environment: 'sandbox'`:

```ts
sandbox: {
  accountId: 'biz_...',
  productId: 'prod_...',
  variants: {
    inspection: 'plan_...',
    'leak-repair': 'plan_...',
    deposit: 'plan_...',
  },
},
```

6. Create an API key at [sandbox.whop.com/dashboard/developer](https://sandbox.whop.com/dashboard/developer). Give it these permissions:
   `payment:charge`, `payment:setup_intent:read`, `invoice:create`, `invoice:update`, `plan:create`, `member:manage`, `member:basic:read`, `member:email:read`, `access_pass:basic:read`, `event:create`, read access to events, payments and invoices.

Can't open the sandbox? Whop is still rolling it out. In that case use production: create the same plans at whop.com, pay once with a real card, then refund the payment in the dashboard (the refund is a good extra moment for the recording).

For production, create the same product and plans at whop.com and paste the IDs under `production`. The business ID can stay empty there: Whop hosting provides it.

### 5. Set the secrets

Secrets are stored encrypted by Whop, never in the code. Run these inside the project folder:

```bash
whop apps secrets set --secret ADMIN_PASSCODE=pick-a-long-passcode
whop apps secrets set --secret WHOP_SANDBOX_API_KEY=paste-the-sandbox-key-here
```

| Secret | When |
| --- | --- |
| `ADMIN_PASSCODE` | Always. Unlocks the `/admin` office page |
| `WHOP_SANDBOX_API_KEY` | When `environment` is `'sandbox'` |
| `WHOP_COMPANY_API_KEY` | Optional in production, only if the key Whop hosting injects lacks a permission |
| `WHOP_ENVIRONMENT` | Optional. `sandbox` or `production`, switches without a code change |

### 6. Deploy

```bash
npm run deploy
```

This runs `whop apps deploy`: it builds, type-checks, uploads and promotes the site. When it finishes, open `https://copperline-yourname.whop.site`.

Open `https://copperline-yourname.whop.site/admin`, enter your passcode, and check the **Whop setup** panel. It lists anything still missing.

### 7. Apple Pay and Google Pay (production)

Wallet buttons appear only on devices that support them, and only once the domain is approved for Apple Pay. In the Whop dashboard open **Websites**, select your domain, choose **Fix Apple Pay**, then **Check now**. The verification file Apple needs is already served by this site at `/.well-known/apple-developer-merchantid-domain-association`.

Whop's sandbox does not support Apple Pay or Google Pay yet. PayPal works there, so `ExpressCheckoutElement` shows a PayPal button in sandbox when PayPal is enabled.

---

## Test everything (sandbox)

Test cards from Whop's sandbox guide. Use any future expiry (12/34), any CVC (123) and any address.

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Payment succeeds |
| `5385 3083 6013 5181` | Asks for 3D Secure; type `Checkout1!` |
| `4000 0000 0000 0002` | Declined |

1. **Estimate (lead).** Fill in "Request a free estimate" on the home page. You get a reference number. The customer appears in the Whop dashboard under Customers with a note holding the job details. Open `/admin`: the request appears under **Estimate requests**, read back from the Whop Events API with its lead and person IDs.
2. **Inspection checkout.** Click "Book a $149 inspection", enter the appointment details, pay with `4242...`. The confirmation page checks the payment with Whop before saying it's booked. The payment shows in your sandbox dashboard under Payments.
3. **Deposit with card on file.** Open "Reserve install date", tick the box to save the card, pay with `4242...`. The confirmation shows the card on file (for example "Visa ending 4242").
4. **Final balance (Invoices API).** In `/admin`, find the deposit under **Deposits with a card on file**, click **Bill final balance**, enter an amount and choose:
   - **Auto-charge the card on file**: creates the invoice and charges the saved card. Click **Refresh status** to see it paid.
   - **Email an invoice for manual payment**: creates and emails the invoice, and shows its payment link.
5. **Pixel events.** Open the site with `?debug=1` (for example `https://copperline-yourname.whop.site/?debug=1`). A panel lists each `whop.track` call. Scroll past the services (`service_viewed`), send an estimate (`estimate_requested`), open the deposit page (`deposit_started`). They also appear in the Whop dashboard under Websites and the pixel events view about a minute later. In the browser's developer tools, the Network tab shows the requests the pixel sends.

---

## Screen recording script (3 to 5 minutes)

1. **0:00 Live site.** Show the whop.site address in the browser bar. Scroll the home page: services, how a job works (deposit, job, final invoice), financing, ZIP check, reviews, FAQ. Mention it's an original design built for roofing.
2. **0:40 Estimate creates a lead.** Open `?debug=1`, submit the estimate form, point at `estimate_requested` in the panel. Open `/admin` and show the new row under Estimate requests.
3. **1:20 Test checkout with Payment Elements.** Book the $149 inspection. On the payment step point out the express wallet buttons, the PaymentElement, and the Whop merchant-of-record notice (BrandingElement) under the button. Pay with `4242`. Show the confirmation page, then the payment in the sandbox dashboard.
4. **2:20 Deposit with card on file.** Open the deposit page (`deposit_started` appears in the panel), pay $500 with `4242`. Show "Visa ending 4242" on the confirmation.
5. **3:10 Final invoice.** In `/admin`, bill the final balance with auto-charge, refresh to show it paid. Then create an emailed invoice and show its payment link. Optionally show both invoices in the Whop dashboard.
6. **4:10 Pixel events.** Show the debug panel and the Whop dashboard's pixel events.
7. **4:30 Template.** Open `src/config/site.ts` and `src/config/whop.ts` and explain that a new roofing company only edits these two files.

---

## Customize for a new roofing company

- **Content:** `src/config/site.ts` holds the company name, phone, hours, services, offers and prices, process steps, financing copy, service area cities and ZIP prefixes, reviews, trust facts, FAQ and form options. Set `demoMode: false` and `reviews.isSample: false` once the content is real.
- **Whop:** `src/config/whop.ts` holds the business, product and plan IDs per environment. Offer ids in `site.ts` (`inspection`, `leak-repair`, `deposit`) are the keys for their plan IDs. If you change a price, create a plan with the new price and paste its ID.
- **Colors:** the variables at the top of `src/styles.css` (`--ink`, `--patina`, `--copper` and friends).
- **Logo:** `LogoMark` in `src/components/Icons.tsx`.
- **Hero drawing labels:** `hero.drawing` in `site.ts` (for example "Standing-seam metal" for a metal roofer).

---

## How it works

```
src/                    TanStack Start site (React, Vite)
  routes/               pages: index, book.$offerId, book.$offerId_.return, admin; api/$.ts for /api/*
  router.tsx            TanStack Router setup
  config/site.ts        all business content
  config/whop.ts        Whop IDs per environment
  components/booking/   checkout: ExpressCheckout, PayForm, ChargeCheckout, DepositCheckout
  components/sections/  home page sections
  lib/track.ts          whop.track wrapper and the ?debug=1 inspector feed
  lib/router.tsx        Link, navigate and useLocation on top of TanStack Router
  pages/                Home, Book, Return (confirmation), Admin (office), Not found
server/                 Server-only code, runs on Whop hosting (Cloudflare Workers runtime)
  index.ts              /api handler and the Apple Pay file, called from src/routes
  runtime.ts            bindings and secrets from cloudflare:workers
  whop.ts               Whop API client (hosting-signed in production, sandbox key in sandbox)
  routes/               estimate, checkout, deposit, admin
shared/api.ts           request and response types used by both sides
```

**Fixed-price offers** (inspection, leak repair): `ExpressCheckoutElement` inside `Checkout` handles one-tap wallets on its own. The card form is `EmailElement`, `PaymentElement` and `BrandingElement` inside `Payments`; it returns a confirmation token, and `POST /api/checkout` creates the payment with `POST /payments` (`variant_id`, `confirmation_token`). If the bank needs 3D Secure, the browser finishes it with `handleNextAction`.

**Deposit:** `Payments` in setup mode collects the card. `POST /api/deposit` creates a setup intent (`POST /setup_intents`), then charges the deposit plan to the saved card (`POST /payments` with `member_id` and `payment_method_id`). The idempotency key is tied to the setup intent, so a card can only pay one deposit.

**Final balance:** `/admin` lists succeeded setup intents tagged as deposits. Billing creates a draft invoice with an inline "Final balance" line (`POST /invoices`), then either issues it with the saved card, which charges it right away, or sends it by email with a due date.

**Confirmation pages** read `payment` and `status` from the URL Whop returns to, then confirm with `GET /payments/:id` before showing success.

**Estimate requests:** the server first finds or adds the person as a member by email (`POST /members`), then records the lead with the Events API (`POST /events`, `event_name: "lead"`) carrying that member and Whop user, the page and the contact details, plus a custom `estimate_requested` event. The browser pixel sends the same two events with the same `event_id` values, so each counts once and still arrives when an ad blocker stops the pixel. Whop's current API has no separate Leads endpoint (`POST /leads` returns 404); a lead is an event on the person it belongs to.

**Server calls to Whop:** in production, Whop hosting signs server-side requests with the app's key, so no key lives in the code. In sandbox, requests carry the `WHOP_SANDBOX_API_KEY` secret. Every call pins `Api-Version-Date` (set in `whop.ts`). Errors are logged for `whop apps logs` and shown to customers in plain words.

---

## Troubleshooting

- **"Online booking is not available right now"**: open `/admin`. The Whop setup panel names the missing ID or secret.
- **Payments or leads fail with a permission error**: the API key is missing a permission from step 4. In production you can set `WHOP_COMPANY_API_KEY` to a company key that has them. See details with `whop apps logs <app id> --level error`.
- **No express wallet buttons**: wallets appear only on supported devices and approved domains (step 7), and the sandbox has no Apple Pay or Google Pay.
- **Deploy stops at the type check**: run `npm run typecheck` to see the error.
- **Run locally (optional)**: `whop apps dev` starts the site with Whop credentials and the app secrets injected.
- **"Websites on Whop must be built with TanStack Start"**: Whop hosting only accepts TanStack Start projects. This template is one; if you start a new site, begin with `whop apps init` and copy `src/`, `server/` and `shared/` into it.
- **whop.app or whop.site?** Whop's current Websites docs deploy to `<name>.whop.site` (or your own domain). That is the address `whop apps deploy` gives you.

Docs used: [Websites quickstart](https://docs.whop.com/developer/websites/quickstart), [tracking](https://docs.whop.com/developer/websites/tracking), [Elements](https://docs.whop.com/elements), [hosting](https://docs.whop.com/developer/websites/hosting), [saving payment methods](https://docs.whop.com/developer/guides/save-payment-methods), [sandbox](https://docs.whop.com/developer/guides/sandbox).
