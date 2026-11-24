import type { AdminJob, AdminLead, InvoiceRequest, InvoiceSummary } from '../../shared/api';
import { site } from '../../src/config/site';
import type { Env } from '../env';
import { ESTIMATE_NOTE_PREFIX } from './estimate';
import { allowRequest, clientIp, compact, errorResponse, HttpError, isEmail, json, readJson, text } from '../http';
import {
  adminStatus,
  cardSummary,
  formatMoney,
  metaString,
  requireAccount,
  toHttpError,
  whopContext,
  whopRequest,
  WhopApiError,
  type WhopContext,
  type WhopInvoice,
  type WhopMember,
  type WhopMemberNote,
  type WhopList,
  type WhopSetupIntent,
} from '../whop';

// Office endpoints behind the ADMIN_PASSCODE secret.

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/** Compares digests so the check takes the same time whatever the input. */
async function passcodeMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function handleAdmin(request: Request, env: Env, path: string): Promise<Response> {
  const expected = env.ADMIN_PASSCODE?.trim();
  if (!expected) {
    return errorResponse(503, 'Set the ADMIN_PASSCODE secret to use the office page.', 'admin_disabled');
  }
  const given = request.headers.get('x-admin-passcode') ?? '';
  if (!given || !(await passcodeMatches(given, expected))) {
    if (!allowRequest(`admin-fail:${clientIp(request) ?? 'unknown'}`, 10, 10 * 60 * 1000)) {
      return errorResponse(429, 'Too many wrong passcodes. Wait 10 minutes and try again.', 'rate_limited');
    }
    return errorResponse(401, 'That passcode is not right.', 'unauthorized');
  }

  const whop = whopContext(env);
  const method = request.method.toUpperCase();

  if (path === '/api/admin/status' && method === 'GET') return json(adminStatus(whop));
  if (path === '/api/admin/leads' && method === 'GET') return listLeads(whop);
  if (path === '/api/admin/jobs' && method === 'GET') return listJobs(whop);
  if (path === '/api/admin/invoices' && method === 'POST') return createInvoice(whop, request);

  const invoiceMatch = /^\/api\/admin\/invoices\/(pay_[A-Za-z0-9]+)(\/charge)?$/.exec(path);
  if (invoiceMatch) {
    const [, invoiceId, charge] = invoiceMatch;
    if (!charge && method === 'GET') return getInvoice(whop, invoiceId);
    if (charge && method === 'POST') return chargeInvoice(whop, invoiceId);
  }
  return errorResponse(404, 'Not found.', 'not_found');
}

/**
 * Estimate requests, newest first. Each request adds (or finds) a member and leaves a note on it
 * with the job details and the Whop lead ID (server/routes/estimate.ts), so the list is read back
 * from the Members API: recent members, then their notes.
 */
async function listLeads(whop: WhopContext): Promise<Response> {
  const accountId = requireAccount(whop);
  try {
    const members = await whopRequest<WhopList<WhopMember>>(whop, 'GET', '/members', {
      query: { account_id: accountId, order: 'created_at', direction: 'desc', first: 30 },
    });
    const perMember = await Promise.all(
      (members.data ?? []).map(async (member) => {
        try {
          const notes = await whopRequest<WhopList<WhopMemberNote>>(
            whop,
            'GET',
            `/members/${encodeURIComponent(member.id)}/notes`,
            { query: { first: 10 } },
          );
          return (notes.data ?? [])
            .filter((note) => note.content.startsWith(ESTIMATE_NOTE_PREFIX))
            .map((note) => leadFromNote(member, note));
        } catch (error) {
          toHttpError(error, 'list member notes');
          return [];
        }
      }),
    );
    const leads = perMember
      .flat()
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, 25);
    return json({ leads });
  } catch (error) {
    throw toHttpError(error, 'list estimate requests', 'Could not load estimate requests. Check that the API key can read members.');
  }
}

function leadFromNote(member: WhopMember, note: WhopMemberNote): AdminLead {
  const content = note.content;
  const pick = (pattern: RegExp) => pattern.exec(content)?.[1]?.trim() || null;
  return {
    id: note.id,
    leadId: pick(/^Whop lead: (\S+)\s*$/m),
    memberId: member.id,
    createdAt: note.created_at ?? null,
    name: member.name ?? member.user?.name ?? member.user?.username ?? 'Customer',
    email: member.email ?? member.user?.email ?? null,
    phone: pick(/^Address: .*\. Phone: (.+?)\.\s*$/m),
    address: pick(/^Address: (.+), \d{5}(?:-\d{4})?\. Phone:/m),
    zip: pick(/^Address: .+, (\d{5}(?:-\d{4})?)\. Phone:/m),
    service: pick(/^Service: (.+?)\. Roof:/m),
  };
}

/** Deposits whose card was saved with a setup intent: the jobs that can be billed a final balance. */
async function listJobs(whop: WhopContext): Promise<Response> {
  const accountId = requireAccount(whop);
  try {
    const result = await whopRequest<WhopList<WhopSetupIntent>>(whop, 'GET', '/setup_intents', {
      query: { account_id: accountId, status: 'succeeded', first: 50 },
    });
    const jobs: AdminJob[] = (result.data ?? [])
      .filter((intent) => metaString(intent.metadata, 'purpose') === 'project_deposit')
      .map((intent) => ({
        setupIntentId: intent.id,
        jobId: metaString(intent.metadata, 'job_id') ?? intent.id,
        createdAt: intent.created_at ?? null,
        customerName: metaString(intent.metadata, 'customer_name') ?? intent.user?.name ?? 'Customer',
        phone: metaString(intent.metadata, 'phone'),
        address: metaString(intent.metadata, 'service_address'),
        memberId: intent.member_id ?? null,
        paymentMethodId: intent.payment_method_id ?? null,
        card: cardSummary(intent.payment_instrument),
      }));
    return json({ jobs });
  } catch (error) {
    throw toHttpError(error, 'list setup intents', 'Could not load deposits. Check that the API key can read setup intents.');
  }
}

export function summarizeInvoice(invoice: WhopInvoice): InvoiceSummary {
  return {
    id: invoice.id,
    number: invoice.number ?? null,
    status: invoice.status,
    total: formatMoney(invoice.total),
    amountDue: formatMoney(invoice.amount_due),
    checkoutLink: invoice.checkout_link ?? null,
    email: invoice.email_address ?? null,
    paymentMethodId: invoice.payment_method_id ?? null,
    scheduledChargeAt: invoice.scheduled_charge_at ?? null,
    paidAt: invoice.paid_at ?? null,
    jobId: metaString(invoice.metadata, 'job_id'),
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'roofing';
}

/**
 * Final balance with the Invoices API:
 *   charge: draft with the saved payment_method_id, then issue. Issuing finalizes the invoice and
 *           charges the card off-session right away (no due date set).
 *   send:   draft with a due date and no payment method, then send. Whop emails the invoice with
 *           its payment link for manual payment.
 */
async function createInvoice(whop: WhopContext, request: Request): Promise<Response> {
  const body = await readJson<InvoiceRequest>(request);
  const accountId = requireAccount(whop);

  const mode = body.mode === 'charge' ? 'charge' : 'send';
  const amount = typeof body.amount === 'number' ? Math.round(body.amount * 100) / 100 : NaN;
  if (!Number.isFinite(amount) || amount < 1 || amount > 500000) {
    throw new HttpError(400, 'Enter a balance between $1 and $500,000.', 'invalid_amount');
  }
  const requestId = text(body.requestId, 80);
  if (!requestId) throw new HttpError(400, 'Missing request id.', 'invalid_request');
  const description = text(body.description, 200) || site.invoice.defaultDescription;
  const memberId = text(body.memberId, 60);
  const paymentMethodId = text(body.paymentMethodId, 60);
  const email = text(body.email, 254).toLowerCase();
  const customerName = text(body.customerName, 120);
  const jobId = text(body.jobId, 60);
  const dueInDays = Math.min(Math.max(Math.round(Number(body.dueInDays) || site.invoice.dueInDays), 1), 90);

  if (mode === 'charge' && (!/^mber_/.test(memberId) || !/^payt_/.test(paymentMethodId))) {
    throw new HttpError(400, 'Auto-charge needs a deposit with a saved card. Pick one from the list.', 'missing_card');
  }
  if (!/^mber_/.test(memberId) && !isEmail(email)) {
    throw new HttpError(400, 'Pick a deposit from the list or enter the customer email.', 'missing_customer');
  }

  const draftBody = compact({
    account_id: accountId,
    ...(/^mber_/.test(memberId) ? { member_id: memberId } : { email_address: email, customer_name: customerName }),
    items: [
      {
        quantity: 1,
        description,
        variant: {
          currency: 'usd',
          billing_type: 'one_time',
          initial_price: amount,
          title: 'Final balance',
          product: {
            external_identifier: `${slug(site.company.name)}-job-balances`,
            title: `${site.company.name} job balances`,
          },
        },
      },
    ],
    payment_method_id: mode === 'charge' ? paymentMethodId : undefined,
    due_at: mode === 'send' ? new Date(Date.now() + dueInDays * 86_400_000).toISOString() : undefined,
    memo: site.invoice.memo,
    time_zone: site.company.timeZone,
    metadata: compact({ kind: 'final_balance', job_id: jobId, source: 'office' }),
  });

  let invoice: WhopInvoice;
  try {
    invoice = await whopRequest<WhopInvoice>(whop, 'POST', '/invoices', {
      idempotencyKey: `invoice_${requestId}`,
      body: draftBody,
    });
  } catch (error) {
    throw toHttpError(error, 'create invoice');
  }

  try {
    if (mode === 'charge') {
      invoice = await whopRequest<WhopInvoice>(whop, 'POST', `/invoices/${invoice.id}/issue`, {
        idempotencyKey: `issue_${invoice.id}`,
        body: {},
      });
    } else {
      invoice = await whopRequest<WhopInvoice>(whop, 'POST', `/invoices/${invoice.id}/send`, {
        idempotencyKey: `send_${invoice.id}`,
        body: { send_as: 'invoice' },
      });
    }
  } catch (error) {
    // Whop finalizes invoices only for verified businesses. The draft exists with the saved card on it,
    // so show it and say what is missing instead of failing.
    if (error instanceof WhopApiError && error.code === 'invoice_account_verification_required') {
      toHttpError(error, mode === 'charge' ? 'issue invoice' : 'send invoice');
      return json({
        ...summarizeInvoice(invoice),
        notice: `Whop created this invoice but keeps it as a draft until the business completes account verification. On a verified account the same request ${mode === 'charge' ? 'charges the saved card right away' : 'emails the invoice'}.`,
      } satisfies InvoiceSummary);
    }
    throw toHttpError(error, mode === 'charge' ? 'issue invoice' : 'send invoice');
  }
  return json(summarizeInvoice(invoice));
}

async function getInvoice(whop: WhopContext, invoiceId: string): Promise<Response> {
  requireAccount(whop);
  try {
    return json(summarizeInvoice(await whopRequest<WhopInvoice>(whop, 'GET', `/invoices/${invoiceId}`)));
  } catch (error) {
    throw toHttpError(error, 'retrieve invoice');
  }
}

/** Charges an open invoice to its saved card now, for example after an emailed invoice goes unpaid. */
async function chargeInvoice(whop: WhopContext, invoiceId: string): Promise<Response> {
  requireAccount(whop);
  try {
    const invoice = await whopRequest<WhopInvoice>(whop, 'POST', `/invoices/${invoiceId}/charge`, {
      idempotencyKey: `charge_${invoiceId}_${Math.floor(Date.now() / 60000)}`,
      body: {},
    });
    return json(summarizeInvoice(invoice));
  } catch (error) {
    throw toHttpError(error, 'charge invoice');
  }
}
