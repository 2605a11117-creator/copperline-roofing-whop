import type { EstimateRequest, EstimateResponse } from '../../shared/api';
import { isInServiceArea, site } from '../../src/config/site';
import type { Env, ExecutionContext } from '../env';
import {
  allowRequest,
  clientIp,
  compact,
  errorResponse,
  isEmail,
  isUsPhone,
  isZip,
  json,
  multiline,
  oneOf,
  readJson,
  text,
} from '../http';
import {
  requireAccount,
  toHttpError,
  whopContext,
  whopRequest,
  type WhopContext,
  type WhopMember,
} from '../whop';

/**
 * "Request an estimate" form. Every request lands on the Whop account:
 *   1. POST /members finds or adds the person by email, so the lead belongs to a Whop user.
 *   2. POST /events with event_name "lead" creates the lead on the account (Events API), tied to
 *      that member and user, with the page, referrer and contact details. A custom
 *      "estimate_requested" event is recorded next to it. The browser pixel sends both events with
 *      the same event_id values, so each counts once and still arrives if an ad blocker stops the pixel.
 *   3. POST /members/:id/notes adds the job details (service, roof, timeline, address) for the team.
 */
/** First line of the member note an estimate request leaves. The office page looks for it. */
export const ESTIMATE_NOTE_PREFIX = 'Estimate request from the website';

export async function postEstimate(request: Request, env: Env, url: URL, _ctx: ExecutionContext): Promise<Response> {
  const body = await readJson<EstimateRequest>(request);
  const options = site.estimate;

  // Honeypot filled: answer like a success so bots learn nothing.
  if (text(body.company)) {
    return json({ ok: true, reference: 'EST-000000', leadId: null, memberId: null, inServiceArea: true } satisfies EstimateResponse);
  }

  const input = {
    name: text(body.name, 120),
    email: text(body.email, 254).toLowerCase(),
    phone: text(body.phone, 40),
    address: text(body.address, 200),
    zip: text(body.zip, 10),
    service: oneOf(body.service, options.serviceOptions),
    roofType: oneOf(body.roofType, options.roofTypes),
    timeline: oneOf(body.timeline, options.timelines),
    insurance: oneOf(body.insurance, options.insuranceOptions),
    message: multiline(body.message, 1500),
    consent: body.consent === true,
  };

  const invalid: string[] = [];
  if (input.name.length < 2) invalid.push('name');
  if (!isEmail(input.email)) invalid.push('email');
  if (!isUsPhone(input.phone)) invalid.push('phone');
  if (input.address.length < 5) invalid.push('address');
  if (!isZip(input.zip)) invalid.push('zip');
  if (!input.consent) invalid.push('consent');
  if (invalid.length > 0) return errorResponse(400, 'Check the highlighted fields and try again.', 'invalid_fields', invalid);

  if (!allowRequest(`estimate:${clientIp(request) ?? 'unknown'}`, 6, 10 * 60 * 1000)) {
    return errorResponse(429, `Too many requests from this connection. Call us at ${site.company.phone}.`, 'rate_limited');
  }

  const whop = whopContext(env);
  const accountId = requireAccount(whop);
  const inServiceArea = isInServiceArea(input.zip);
  const page = samePage(body.page, url);
  const eventId = typeof body.eventId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(body.eventId)
    ? body.eventId
    : `est_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // 1. The member first, so the lead is tied to their Whop user.
  const member = await findOrAddMember(whop, accountId, input.email, input.name);

  // 2. The lead itself, plus the custom estimate_requested event, through the Events API.
  const { leadId, recorded } = await recordLead(whop, env, accountId, eventId, request, page, member, input);

  if (!leadId && !member && !recorded) {
    return errorResponse(502, `We couldn't send your request. Call us at ${site.company.phone}.`, 'whop_unavailable');
  }

  // 3. The job details as a note on the customer. The office page reads these notes back
  //    (server/routes/admin.ts), so the note is written before answering.
  if (member?.id) {
    const note = [
      `${ESTIMATE_NOTE_PREFIX} (${inServiceArea ? 'in' : 'outside'} service area)`,
      `Service: ${input.service}. Roof: ${input.roofType}. Timeline: ${input.timeline}. Insurance claim: ${input.insurance}.`,
      `Address: ${input.address}, ${input.zip}. Phone: ${input.phone}.`,
      input.message ? `Message: ${input.message.replace(/\n+/g, ' ')}` : '',
      leadId ? `Whop lead: ${leadId}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    await whopRequest(whop, 'POST', `/members/${encodeURIComponent(member.id)}/notes`, {
      body: { content: note },
      idempotencyKey: `note_${eventId}`,
    }).catch((error: unknown) => {
      toHttpError(error, 'add member note');
    });
  }

  const id = leadId ?? member?.id ?? eventId;
  const response: EstimateResponse = {
    ok: true,
    reference: `EST-${id.replace(/^[a-z]+_/, '').slice(-6).toUpperCase()}`,
    leadId,
    memberId: member?.id ?? null,
    inServiceArea,
  };
  return json(response);
}

/** Finds or adds the person as a member of the account by email. */
async function findOrAddMember(
  whop: WhopContext,
  accountId: string,
  email: string,
  name: string,
): Promise<WhopMember | null> {
  try {
    return await whopRequest<WhopMember>(whop, 'POST', '/members', { body: { account_id: accountId, email, name } });
  } catch (error) {
    toHttpError(error, 'find or add member for estimate');
    return null;
  }
}

/**
 * Records the lead with the Whop Events API (POST /events, event_name "lead"), tied to the member's
 * Whop user, plus the custom estimate_requested event. The browser pixel sends the same two events
 * with the same event_id values, so Whop counts each once and still gets them when an ad blocker
 * stops the pixel. Needs the event:create permission.
 */
async function recordLead(
  whop: WhopContext,
  env: Env,
  accountId: string,
  eventId: string,
  request: Request,
  page: { full: string; referrer: string },
  member: WhopMember | null,
  input: { name: string; email: string; phone: string; zip: string; service: string },
): Promise<{ leadId: string | null; recorded: boolean }> {
  const [firstName, ...rest] = input.name.split(' ');
  const digits = input.phone.replace(/\D/g, '');
  const phone = digits.length === 10 ? `+1${digits}` : digits.length === 11 ? `+${digits}` : input.phone;
  const anonymousId = /(?:^|;\s*)_wuid=([^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1];

  const base = compact({
    account_id: accountId,
    action_source: 'website',
    url: page.full,
    referrer_url: request.headers.get('referer')?.slice(0, 500),
    product_id: whop.productId,
    app_id: env.APP_ID,
    app_build_id: env.BUILD_ID,
    user: compact({
      email: input.email,
      phone,
      name: input.name,
      first_name: firstName,
      last_name: rest.join(' '),
      postal_code: input.zip,
      country: 'US',
      member_id: member?.id,
      user_id: member?.user?.id,
      anonymous_id: anonymousId ? decodeURIComponent(anonymousId) : undefined,
    }),
    context: compact({
      ip_address: clientIp(request),
      user_agent: request.headers.get('user-agent')?.slice(0, 500),
    }),
  });

  const send = (eventName: string, id: string) =>
    whopRequest<{ id?: string }>(whop, 'POST', '/events', {
      idempotencyKey: `event_${eventName}_${id}`,
      body: { ...base, event_name: eventName, event_id: id },
    });

  const [lead, requested] = await Promise.allSettled([
    send('lead', eventId),
    send('estimate_requested', `${eventId}-req`),
  ]);
  if (lead.status === 'rejected') toHttpError(lead.reason, 'record lead event');
  if (requested.status === 'rejected') toHttpError(requested.reason, 'record estimate_requested event');

  const leadId = lead.status === 'fulfilled' ? (lead.value?.id ?? eventId) : null;
  return { leadId, recorded: lead.status === 'fulfilled' || requested.status === 'fulfilled' };
}

/** The page the form was sent from, if it is on this site. */
function samePage(page: unknown, url: URL): { full: string; referrer: string } {
  if (typeof page === 'string') {
    try {
      const parsed = new URL(page);
      if (parsed.host === url.host) {
        return { full: `${parsed.origin}${parsed.pathname}${parsed.search}`, referrer: `${parsed.origin}${parsed.pathname}` };
      }
    } catch {
      // Fall through to the site root.
    }
  }
  return { full: `${url.origin}/`, referrer: `${url.origin}/` };
}
