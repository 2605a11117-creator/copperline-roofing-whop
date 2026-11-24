import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import type { AdminJob, AdminLead, AdminStatus, InvoiceMode, InvoiceRequest, InvoiceSummary } from '../../shared/api';
import { Brand } from '../components/Header';
import { IconAlert } from '../components/Icons';
import { site } from '../config/site';
import { api, ApiError, errorMessage } from '../lib/api';
import { formatDate, formatUSD, isEmail } from '../lib/format';
import { readSession, removeSession, writeSession } from '../lib/storage';

// Office view for the roofing company: confirms the Whop setup, lists estimate requests (lead events)
// and deposits with a card on file (setup intents), and bills final balances with the Invoices API.
// Protected by the ADMIN_PASSCODE secret; every call is checked on the server.

const PASS_KEY = 'admin-passcode';

function useAdminApi(passcode: string) {
  return useCallback(
    <T,>(path: string, body?: unknown) =>
      api<T>(path, { body, method: body === undefined ? 'GET' : 'POST', headers: { 'x-admin-passcode': passcode } }),
    [passcode],
  );
}

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const AUTH_TEXT: Record<AdminStatus['auth'], string> = {
  sandbox_key: 'Sandbox API key (WHOP_SANDBOX_API_KEY secret)',
  company_key: 'Company API key (WHOP_COMPANY_API_KEY secret)',
  dev_key: 'Local development key from whop apps dev',
  hosting: 'App key injected by Whop hosting',
};

export function AdminPage() {
  const [passcode, setPasscode] = useState(() => readSession<string>(PASS_KEY) ?? '');
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [gateError, setGateError] = useState('');

  useEffect(() => {
    document.title = `Office | ${site.company.name}`;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  const callApi = useAdminApi(passcode);

  useEffect(() => {
    if (!passcode) return;
    let active = true;
    callApi<AdminStatus>('/api/admin/status')
      .then((result) => {
        if (!active) return;
        setStatus(result);
        setGateError('');
        writeSession(PASS_KEY, passcode);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(null);
        setGateError(errorMessage(error));
        if (error instanceof ApiError && error.status === 401) removeSession(PASS_KEY);
      });
    return () => {
      active = false;
    };
  }, [passcode, callApi]);

  if (!status) {
    return <PasscodeGate error={gateError} onSubmit={setPasscode} />;
  }

  return (
    <div className="admin">
      <header className="admin__header">
        <div className="container admin__header-inner">
          <Brand />
          <p className="admin__env">
            {status.environment === 'sandbox' ? 'Sandbox: test payments only' : 'Production: real payments'}
          </p>
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={() => {
              removeSession(PASS_KEY);
              setStatus(null);
              setPasscode('');
            }}
          >
            Lock
          </button>
        </div>
      </header>
      <main id="main" className="container admin__main">
        <h1 className="admin__title">Office</h1>
        <SetupPanel status={status} />
        <LeadsPanel callApi={callApi} />
        <BillingPanels callApi={callApi} />
      </main>
    </div>
  );
}

function PasscodeGate({ error, onSubmit }: { error: string; onSubmit: (passcode: string) => void }) {
  const id = useId();
  const [value, setValue] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };
  return (
    <main id="main" className="admin-gate">
      <form className="form-panel admin-gate__panel" onSubmit={submit}>
        <Brand />
        <h1 className="form-panel__title">Office sign-in</h1>
        <p>Enter the passcode saved in the ADMIN_PASSCODE secret.</p>
        <div className="field">
          <label htmlFor={id} className="field__label">
            Passcode
          </label>
          <input
            id={id}
            className="input"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        {error && (
          <p className="alert" role="alert">
            <IconAlert />
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block">
          Open office
        </button>
      </form>
    </main>
  );
}

function SetupPanel({ status }: { status: AdminStatus }) {
  return (
    <section className="panel" aria-labelledby="setup-title">
      <h2 id="setup-title" className="panel__title">
        Whop setup
      </h2>
      <dl className="setup-grid">
        <div>
          <dt>Environment</dt>
          <dd>{status.environment}</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>{status.accountId ?? 'Missing'}</dd>
        </div>
        <div>
          <dt>Product</dt>
          <dd>{status.productId ?? 'Not set (optional)'}</dd>
        </div>
        <div>
          <dt>API access</dt>
          <dd>{AUTH_TEXT[status.auth]}</dd>
        </div>
      </dl>
      <table className="table">
        <caption className="visually-hidden">Plans used by checkout</caption>
        <thead>
          <tr>
            <th scope="col">Offer</th>
            <th scope="col">Price on site</th>
            <th scope="col">Whop plan</th>
          </tr>
        </thead>
        <tbody>
          {status.offers.map((offer) => (
            <tr key={offer.id}>
              <td>{offer.name}</td>
              <td>{formatUSD(offer.price)}</td>
              <td>{offer.variantId ?? <span className="text-danger">Missing</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {status.missing.length > 0 && (
        <p className="alert" role="status">
          <IconAlert />
          Checkout is not ready. Missing: {status.missing.join(', ')}. Add the IDs in src/config/whop.ts and deploy again.
        </p>
      )}
    </section>
  );
}

type AdminCall = <T>(path: string, body?: unknown) => Promise<T>;

function LeadsPanel({ callApi }: { callApi: AdminCall }) {
  const [leads, setLeads] = useState<AdminLead[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    callApi<{ leads: AdminLead[] }>('/api/admin/leads')
      .then((result) => setLeads(result.leads))
      .catch((caught: unknown) => setError(errorMessage(caught)));
  }, [callApi]);

  useEffect(load, [load]);

  return (
    <section className="panel" aria-labelledby="leads-title">
      <div className="panel__head">
        <h2 id="leads-title" className="panel__title">
          Estimate requests
        </h2>
        <button type="button" className="btn btn--quiet btn--sm" onClick={load}>
          Refresh
        </button>
      </div>
      <p className="panel__intro">
        Estimate requests from the website, newest first. Each one created a lead on your Whop account and a customer
        with a note holding the job details, read back here from the Whop API.
      </p>
      {error && <p className="alert">{error}</p>}
      {leads === null && !error && <p className="loading">Loading leads…</p>}
      {leads?.length === 0 && <p className="empty">No estimate requests yet. Send one from the form on the home page.</p>}
      {leads && leads.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Received</th>
                <th scope="col">Name</th>
                <th scope="col">Contact</th>
                <th scope="col">Property</th>
                <th scope="col">Needs</th>
                <th scope="col">On Whop</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{formatDate(lead.createdAt)}</td>
                  <td>{lead.name}</td>
                  <td>
                    {lead.email}
                    {lead.phone && <span className="table__sub">{lead.phone}</span>}
                  </td>
                  <td>
                    {lead.address}
                    {lead.zip && <span className="table__sub">{lead.zip}</span>}
                  </td>
                  <td>{lead.service}</td>
                  <td>
                    {lead.leadId && <span className="table__sub">Lead {lead.leadId.split(':').pop()}</span>}
                    <span className="table__sub">Member {lead.memberId}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BillingPanels({ callApi }: { callApi: AdminCall }) {
  const [jobs, setJobs] = useState<AdminJob[] | null>(null);
  const [jobsError, setJobsError] = useState('');
  const [selected, setSelected] = useState<AdminJob | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);

  const loadJobs = useCallback(() => {
    setJobsError('');
    callApi<{ jobs: AdminJob[] }>('/api/admin/jobs')
      .then((result) => setJobs(result.jobs))
      .catch((caught: unknown) => setJobsError(errorMessage(caught)));
  }, [callApi]);

  useEffect(loadJobs, [loadJobs]);

  const remember = (invoice: InvoiceSummary) =>
    setInvoices((list) => [invoice, ...list.filter((item) => item.id !== invoice.id)]);

  return (
    <>
      <section className="panel" aria-labelledby="jobs-title">
        <div className="panel__head">
          <h2 id="jobs-title" className="panel__title">
            Deposits with a card on file
          </h2>
          <button type="button" className="btn btn--quiet btn--sm" onClick={loadJobs}>
            Refresh
          </button>
        </div>
        <p className="panel__intro">
          Each row is a deposit checkout. The card was saved with a Whop setup intent and can be billed for the final balance.
        </p>
        {jobsError && <p className="alert">{jobsError}</p>}
        {jobs === null && !jobsError && <p className="loading">Loading deposits…</p>}
        {jobs?.length === 0 && <p className="empty">No deposits yet. Pay a test deposit at /book/deposit.</p>}
        {jobs && jobs.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Address</th>
                  <th scope="col">Card on file</th>
                  <th scope="col">
                    <span className="visually-hidden">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.setupIntentId} className={selected?.setupIntentId === job.setupIntentId ? 'is-selected' : undefined}>
                    <td>
                      {job.jobId}
                      <span className="table__sub">{formatDate(job.createdAt)}</span>
                    </td>
                    <td>
                      {job.customerName}
                      {job.phone && <span className="table__sub">{job.phone}</span>}
                    </td>
                    <td>{job.address}</td>
                    <td>{job.card?.label ?? 'Saved card'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={!job.memberId || !job.paymentMethodId}
                        onClick={() => setSelected(job)}
                      >
                        Bill final balance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <InvoiceForm callApi={callApi} job={selected} onCreated={remember} onClearJob={() => setSelected(null)} />

      {invoices.length > 0 && (
        <section className="panel" aria-labelledby="invoices-title">
          <h2 id="invoices-title" className="panel__title">
            Invoices created this session
          </h2>
          <div className="invoice-list">
            {invoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} callApi={callApi} onUpdate={remember} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function InvoiceForm({
  callApi,
  job,
  onCreated,
  onClearJob,
}: {
  callApi: AdminCall;
  job: AdminJob | null;
  onCreated: (invoice: InvoiceSummary) => void;
  onClearJob: () => void;
}) {
  const ids = useId();
  const [mode, setMode] = useState<InvoiceMode>('charge');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState(site.invoice.defaultDescription);
  const [email, setEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [dueInDays, setDueInDays] = useState(String(site.invoice.dueInDays));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMode(job ? 'charge' : 'send');
    setError('');
  }, [job]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1) {
      setError('Enter the balance in dollars, at least $1.');
      return;
    }
    if (!job && !isEmail(email.trim())) {
      setError('Pick a deposit above, or enter the customer email for an emailed invoice.');
      return;
    }
    const request: InvoiceRequest = {
      mode: job ? mode : 'send',
      amount: Math.round(value * 100) / 100,
      description: description.trim() || site.invoice.defaultDescription,
      requestId: newRequestId(),
      dueInDays: Number(dueInDays) || site.invoice.dueInDays,
      ...(job
        ? { jobId: job.jobId, memberId: job.memberId ?? undefined, paymentMethodId: job.paymentMethodId ?? undefined }
        : { email: email.trim(), customerName: customerName.trim() }),
    };
    setBusy(true);
    setError('');
    try {
      const invoice = await callApi<InvoiceSummary>('/api/admin/invoices', request);
      onCreated(invoice);
      setAmount('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby={`${ids}-title`}>
      <h2 id={`${ids}-title`} className="panel__title">
        Bill a final balance
      </h2>
      <p className="panel__intro">
        Creates a Whop invoice. Auto-charge bills the card saved at deposit right away. Email sends the customer an
        invoice with a payment link.
      </p>
      <form className="invoice-form" onSubmit={submit} noValidate>
        {job ? (
          <div className="details-card">
            <div>
              <p className="details-card__name">
                {job.customerName}, job {job.jobId}
              </p>
              <p>{job.address}</p>
              <p>{job.card?.label ?? 'Saved card'}</p>
            </div>
            <button type="button" className="btn btn--quiet btn--sm" onClick={onClearJob}>
              Bill someone else
            </button>
          </div>
        ) : (
          <div className="form-grid">
            <div className="field">
              <label htmlFor={`${ids}-email`} className="field__label">
                Customer email
              </label>
              <input id={`${ids}-email`} className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-name`} className="field__label">
                Customer name
              </label>
              <input id={`${ids}-name`} className="input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </div>
          </div>
        )}

        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${ids}-amount`} className="field__label">
              Balance due (USD)
            </label>
            <input
              id={`${ids}-amount`}
              className="input"
              inputMode="decimal"
              placeholder="8450.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
            />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-description`} className="field__label">
              Line item
            </label>
            <input
              id={`${ids}-description`}
              className="input"
              maxLength={200}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        {job && (
          <fieldset className="choice">
            <legend className="field__label">How to collect</legend>
            <label className="choice__option">
              <input type="radio" name={`${ids}-mode`} checked={mode === 'charge'} onChange={() => setMode('charge')} />
              <span>
                <strong>Auto-charge the card on file</strong>
                <span className="choice__hint">Charges {job.card?.label ?? 'the saved card'} now.</span>
              </span>
            </label>
            <label className="choice__option">
              <input type="radio" name={`${ids}-mode`} checked={mode === 'send'} onChange={() => setMode('send')} />
              <span>
                <strong>Email an invoice for manual payment</strong>
                <span className="choice__hint">The customer pays from the link in the email.</span>
              </span>
            </label>
          </fieldset>
        )}

        {(!job || mode === 'send') && (
          <div className="field field--narrow">
            <label htmlFor={`${ids}-due`} className="field__label">
              Due in (days)
            </label>
            <input
              id={`${ids}-due`}
              className="input"
              inputMode="numeric"
              value={dueInDays}
              onChange={(event) => setDueInDays(event.target.value.replace(/\D/g, '').slice(0, 3))}
            />
          </div>
        )}

        {error && (
          <p className="alert" role="alert">
            <IconAlert />
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy
            ? 'Creating invoice…'
            : job && mode === 'charge'
              ? 'Create invoice and charge card'
              : 'Create and email invoice'}
        </button>
      </form>
    </section>
  );
}

function InvoiceCard({
  invoice,
  callApi,
  onUpdate,
}: {
  invoice: InvoiceSummary;
  callApi: AdminCall;
  onUpdate: (invoice: InvoiceSummary) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    setError('');
    try {
      onUpdate(await callApi<InvoiceSummary>(path, body));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const canCharge = invoice.status === 'open' && invoice.paymentMethodId !== null;

  return (
    <article className="invoice-card">
      <div className="invoice-card__head">
        <h3 className="invoice-card__title">Invoice {invoice.number ?? invoice.id}</h3>
        <span className={`badge badge--${invoice.status}`}>{invoice.status}</span>
      </div>
      <dl className="invoice-card__facts">
        <div>
          <dt>Total</dt>
          <dd>{invoice.total ?? 'Pending'}</dd>
        </div>
        <div>
          <dt>Amount due</dt>
          <dd>{invoice.amountDue ?? 'Pending'}</dd>
        </div>
        {invoice.jobId && (
          <div>
            <dt>Job</dt>
            <dd>{invoice.jobId}</dd>
          </div>
        )}
        {invoice.email && (
          <div>
            <dt>Customer</dt>
            <dd>{invoice.email}</dd>
          </div>
        )}
        {invoice.paidAt && (
          <div>
            <dt>Paid</dt>
            <dd>{formatDate(invoice.paidAt)}</dd>
          </div>
        )}
      </dl>
      {invoice.checkoutLink && (
        <p className="invoice-card__link">
          <a href={invoice.checkoutLink} target="_blank" rel="noreferrer">
            Open the payment link
          </a>
        </p>
      )}
      {error && <p className="alert">{error}</p>}
      <div className="invoice-card__actions">
        <button type="button" className="btn btn--quiet btn--sm" disabled={busy} onClick={() => act(`/api/admin/invoices/${invoice.id}`)}>
          Refresh status
        </button>
        {canCharge && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={busy}
            onClick={() => act(`/api/admin/invoices/${invoice.id}/charge`, {})}
          >
            Charge card on file now
          </button>
        )}
      </div>
    </article>
  );
}
