const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const withCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUSD(amount: number): string {
  return Number.isInteger(amount) ? wholeDollars.format(amount) : withCents.format(amount);
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** "(303) 555-0148" becomes "tel:+13035550148". */
export function telHref(phone: string): string {
  const digits = digitsOnly(phone);
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return national.length === 10 ? `tel:+1${national}` : `tel:${digits}`;
}

/** US phone number in E.164 format, or undefined when it is not a 10-digit number. */
export function toE164(phone: string): string | undefined {
  const digits = digitsOnly(phone);
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return national.length === 10 ? `+1${national}` : undefined;
}

export function isUsPhone(phone: string): boolean {
  return toE164(phone) !== undefined;
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function isZip(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value.trim());
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Splits a drawing label written with \n into lines. */
export function lines(label: string): string[] {
  return label.split('\n');
}
