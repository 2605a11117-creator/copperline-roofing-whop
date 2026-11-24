// Shapes for src/config/site.ts. Change the content there; the layout reads everything from it.

export type OfferKind =
  /** Paid in full at booking (inspection, flat-rate service). */
  | 'charge'
  /** Saves the card with a setup intent, charges the deposit, bills the balance later by invoice. */
  | 'deposit';

export interface Offer {
  /** URL slug (/book/<id>) and the key for its Whop plan ID in src/config/whop.ts. */
  id: string;
  kind: OfferKind;
  name: string;
  /** Price shown on the site in USD. Create the Whop plan with the same price. */
  price: number;
  priceNote: string;
  summary: string;
  includes: string[];
  /** Link text for the booking page. */
  bookLabel: string;
  /** Heading on the booking page. */
  pageTitle: string;
  /** What we ask before payment: an appointment (address and time window) or a job (address and estimate number). */
  details: 'appointment' | 'job';
  successTitle: string;
  successBody: string;
}

export interface Service {
  id: string;
  name: string;
  summary: string;
  points: string[];
  timing: string;
  priceLabel: string;
  /** Offer booked from this service row, if any. */
  offerId?: string;
  /** Label for the row's button when there is no offer. */
  ctaLabel?: string;
  /** Sent as the value of the service_viewed event when set. */
  startingPrice?: number;
}

export interface ProcessStep {
  title: string;
  body: string;
  /** What the homeowner pays at this step. */
  payment: string;
}

export interface Review {
  quote: string;
  name: string;
  place: string;
  project: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export interface Fact {
  label: string;
  value: string;
}

export interface Link {
  label: string;
  href: string;
}

export interface SiteConfig {
  /** Shows a notice that the company, reviews and stats are sample content. Turn off for a real business. */
  demoMode: boolean;
  company: {
    name: string;
    /** Wordmark, first part (bold). */
    shortName: string;
    /** Wordmark, second part. */
    descriptor: string;
    phone: string;
    email: string;
    city: string;
    state: string;
    hours: Array<{ days: string; time: string }>;
    emergency: string;
    license: string;
    /** IANA time zone used on invoices. */
    timeZone: string;
  };
  seo: { title: string; description: string };
  hero: {
    headline: string;
    intro: string;
    primaryCta: Link;
    secondaryCta: Link;
    proof: string[];
    /** Labels for the roof drawing. Use \n to break a label onto two lines. */
    drawing: {
      pitch: string;
      size: string;
      ridge: string;
      flashing: string;
      field: string;
      eave: string;
    };
  };
  services: { heading: string; intro: string; items: Service[] };
  offers: Offer[];
  process: { heading: string; intro: string; steps: ProcessStep[] };
  financing: {
    heading: string;
    body: string;
    points: string[];
    methods: string[];
    footnote: string;
    cta: Link;
  };
  serviceArea: {
    heading: string;
    intro: string;
    hub: string;
    radiusMiles: number;
    cities: string[];
    /** ZIP codes starting with these digits count as in the service area. */
    zipPrefixes: string[];
    /** Extra individual ZIP codes in the service area. */
    zips: string[];
    outsideNote: string;
  };
  reviews: {
    heading: string;
    /** Marks reviews and rating as sample content. Set to false once you use real reviews. */
    isSample: boolean;
    rating: number;
    count: number;
    source: string;
    items: Review[];
    facts: Fact[];
  };
  faq: { heading: string; items: Array<{ question: string; answer: string }> };
  estimate: {
    heading: string;
    intro: string;
    nextSteps: string[];
    serviceOptions: string[];
    roofTypes: string[];
    timelines: string[];
    insuranceOptions: string[];
    consent: string;
    successTitle: string;
    successBody: string;
  };
  booking: {
    appointmentWindows: string[];
    depositConsent: string;
  };
  invoice: {
    memo: string;
    defaultDescription: string;
    dueInDays: number;
  };
  /** Theme for the Whop payment elements. accentColor takes a color name such as teal, blue or orange. */
  whopAppearance: { accentColor: string };
}
