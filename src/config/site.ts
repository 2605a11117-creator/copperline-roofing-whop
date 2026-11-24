import type { SiteConfig } from './types';

// Everything a roofing company changes lives in this file: name, contact details,
// services, prices, service area, reviews and FAQ. Whop IDs live in ./whop.ts.
//
// Prices here are what the site shows. Create each Whop plan with the same price.

export const site: SiteConfig = {
  demoMode: true,

  company: {
    name: 'Copperline Roofing Co.',
    shortName: 'Copperline',
    descriptor: 'Roofing Co.',
    phone: '(303) 555-0148',
    email: 'hello@copperline-roofing.example',
    city: 'Denver',
    state: 'CO',
    hours: [
      { days: 'Monday to Friday', time: '7am to 6pm' },
      { days: 'Saturday', time: '8am to 1pm' },
    ],
    emergency: 'Storm tarping line open 24/7',
    license: 'Licensed and insured. Denver contractor license #000000.',
    timeZone: 'America/Denver',
  },

  seo: {
    title: 'Copperline Roofing Co. | Roof repair and replacement in Denver',
    description:
      'Roof repair, replacement and inspections across the Denver metro. Book a $149 inspection online, get a line-item estimate and reserve your install date with a deposit.',
  },

  hero: {
    headline: 'Roof repair and replacement for the Front Range, priced before we start.',
    intro:
      'Book a $149 inspection online and get a line-item estimate with photos. Reserve your install date with a $500 deposit, and pay the balance only after the final walkthrough.',
    primaryCta: { label: 'Request a free estimate', href: '/#estimate' },
    secondaryCta: { label: 'Book a $149 inspection', href: '/book/inspection' },
    proof: [
      'Inspections within 5 business days',
      'Help with hail and wind insurance claims',
      '10-year workmanship warranty',
    ],
    drawing: {
      pitch: '8/12 pitch',
      size: '28 squares (2,800 sq ft)',
      ridge: 'Ridge vent',
      flashing: 'Copper step flashing',
      field: 'Class 4 impact-rated\nshingles',
      eave: 'Ice and water shield\nat the eaves',
    },
  },

  services: {
    heading: 'What we do',
    intro: 'Three ways to start, depending on what your roof needs. Every job begins with a written price.',
    items: [
      {
        id: 'repair',
        name: 'Roof repair',
        summary: 'Leaks, missing or creased shingles, hail and wind damage, failed flashing and pipe boots.',
        points: [
          'Leak tracing with a moisture meter',
          'Shingle, flashing and pipe-boot replacement',
          'Emergency tarping within 24 hours',
        ],
        timing: 'Most repairs are finished in one visit.',
        priceLabel: 'Flat $395 for most single-area leaks',
        offerId: 'leak-repair',
        startingPrice: 395,
      },
      {
        id: 'replacement',
        name: 'Roof replacement',
        summary: 'Full tear-off and a new roof system in asphalt, impact-rated shingle or standing-seam metal.',
        points: [
          'Line-item estimate with photos of every problem',
          'Permits, tear-off, disposal and cleanup included',
          'Manufacturer warranty registered in your name',
        ],
        timing: 'Most homes are done in one to two days.',
        priceLabel: 'Reserve your install date with a $500 deposit',
        offerId: 'deposit',
      },
      {
        id: 'inspection',
        name: 'Roof inspection',
        summary: 'A 21-point inspection with drone photos and a written report you can send to your insurer.',
        points: [
          'Drone and on-roof photos',
          'Written report within 48 hours',
          'Fee credited toward any job over $1,000',
        ],
        timing: 'Booked within 5 business days.',
        priceLabel: '$149, credited toward repairs',
        offerId: 'inspection',
        startingPrice: 149,
      },
    ],
  },

  offers: [
    {
      id: 'inspection',
      kind: 'charge',
      name: 'Roof inspection',
      price: 149,
      priceNote: 'Credited toward any repair or replacement over $1,000.',
      summary: 'A full inspection of your roof, attic ventilation and gutters, with photos and a written report.',
      includes: [
        '21-point inspection with drone and on-roof photos',
        'Written report and line-item estimate within 48 hours',
        'Documentation you can send to your insurance company',
      ],
      bookLabel: 'Book inspection',
      pageTitle: 'Book a roof inspection',
      details: 'appointment',
      successTitle: 'Inspection booked',
      successBody: 'We will call within one business day to confirm your appointment window.',
    },
    {
      id: 'leak-repair',
      kind: 'charge',
      name: 'Flat-rate leak repair',
      price: 395,
      priceNote: 'Covers one leak area up to 100 sq ft. If your roof needs more, we quote it before doing extra work.',
      summary: 'We find the source of the leak, fix it and seal the area, at a set price.',
      includes: [
        'Leak tracing and moisture check',
        'Up to 10 replacement shingles',
        'New flashing or pipe boots in the leak area',
        'One-year leak-free guarantee on the repaired area',
      ],
      bookLabel: 'Book leak repair',
      pageTitle: 'Book a flat-rate leak repair',
      details: 'appointment',
      successTitle: 'Repair booked',
      successBody: 'We will call within one business day to schedule your repair.',
    },
    {
      id: 'deposit',
      kind: 'deposit',
      name: 'Project deposit',
      price: 500,
      priceNote: 'Applied in full to your project total.',
      summary: 'Reserve your install date and material order. We save your card for the final balance.',
      includes: [
        'Locks in your install date and material order',
        'Applied in full to your project total',
        'Card saved securely with Whop for the final balance',
        'Refundable until materials are ordered',
      ],
      bookLabel: 'Reserve install date',
      pageTitle: 'Reserve your install date',
      details: 'job',
      successTitle: 'Deposit paid',
      successBody:
        'Your install date is reserved and your card is saved for the final balance. We bill the balance after you approve the final walkthrough.',
    },
  ],

  process: {
    heading: 'How a roof job works with us',
    intro: 'You always know what is due and when. Nothing is charged to your saved card until the job is done.',
    steps: [
      {
        title: 'Request an estimate',
        body: 'Tell us about your roof. We reply within one business day.',
        payment: 'Free',
      },
      {
        title: 'Inspection',
        body: 'We inspect, photograph and measure your roof, then send a line-item estimate.',
        payment: '$149, credited to the job',
      },
      {
        title: 'Deposit',
        body: 'Approve the estimate and reserve your date. Your card is saved for the balance.',
        payment: '$500 deposit',
      },
      {
        title: 'Install day',
        body: 'Our crew tears off, installs and cleans up, usually in one or two days.',
        payment: 'Nothing due',
      },
      {
        title: 'Final walkthrough',
        body: 'We walk the job with you. The balance goes to your saved card or arrives as an invoice.',
        payment: 'Remaining balance',
      },
    ],
  },

  financing: {
    heading: 'Spread the cost of a new roof over monthly payments',
    body:
      'Checkout runs on Whop, so eligible homeowners see pay-over-time options next to card and bank payments. There is no separate financing portal to sign up for.',
    points: [
      'Plans such as Klarna, Afterpay or Splitit show up at checkout when they are available to you',
      'You see the plan terms before you confirm',
      'Card, bank and wallet payments are always an option',
    ],
    methods: ['Credit or debit card', 'Apple Pay and Google Pay', 'Bank account', 'Pay over time'],
    footnote: 'Pay-over-time options depend on availability and approval.',
    cta: { label: 'Reserve with a deposit', href: '/book/deposit' },
  },

  serviceArea: {
    heading: 'Where we work',
    intro: 'Crews based in Denver cover the metro and the foothills, about 35 miles in every direction.',
    hub: 'Denver',
    radiusMiles: 35,
    cities: [
      'Aurora',
      'Lakewood',
      'Arvada',
      'Westminster',
      'Thornton',
      'Broomfield',
      'Centennial',
      'Littleton',
      'Highlands Ranch',
      'Parker',
      'Golden',
      'Englewood',
    ],
    zipPrefixes: ['800', '801', '802'],
    zips: ['80401', '80403', '80439'],
    outsideNote: 'is outside our usual area. Call us anyway. We take on larger projects farther out.',
  },

  reviews: {
    heading: 'What homeowners say',
    isSample: true,
    rating: 4.9,
    count: 312,
    source: 'Google',
    items: [
      {
        quote:
          'Hail took out half our shingles in June. They met our adjuster on the roof, documented everything, and had a new roof on in two days.',
        name: 'Dana M.',
        place: 'Aurora',
        project: 'Hail damage replacement',
        rating: 5,
      },
      {
        quote: 'They found the leak in an hour after two other companies guessed. The flat-rate price was what I paid.',
        name: 'Luis R.',
        place: 'Lakewood',
        project: 'Leak repair',
        rating: 5,
      },
      {
        quote: 'Clear estimate, photos of every problem, and they picked up every nail before they left.',
        name: 'Priya K.',
        place: 'Centennial',
        project: 'Inspection and replacement',
        rating: 5,
      },
    ],
    facts: [
      { label: 'Workmanship warranty', value: '10 years' },
      { label: 'Roofs completed', value: '1,800+' },
      { label: 'Inspection wait', value: 'Within 5 business days' },
      { label: 'Crews', value: 'Our own, no subcontractors' },
    ],
  },

  faq: {
    heading: 'Questions homeowners ask',
    items: [
      {
        question: 'Do you work with insurance claims?',
        answer:
          'Yes. We document hail and wind damage with photos and measurements, meet your adjuster on site, and give you a line-item estimate to send with your claim.',
      },
      {
        question: 'When is my card charged?',
        answer:
          'Inspections and flat-rate repairs are paid when you book. For a replacement you pay a $500 deposit to reserve your date. The balance is billed after the final walkthrough, either to the card you saved or by an emailed invoice.',
      },
      {
        question: 'Can I get my deposit back?',
        answer: 'Yes, until we order your materials. After that, the deposit is applied to your project total.',
      },
      {
        question: 'How long does a replacement take?',
        answer: 'Most homes take one to two days, depending on size, weather and how many old layers come off.',
      },
      {
        question: 'Can I pay over time?',
        answer:
          'Eligible homeowners can pick a pay-over-time plan at checkout. You see the terms before you confirm, and card and bank payments are always available.',
      },
      {
        question: 'Which areas do you serve?',
        answer: 'Denver and the cities around it, about 35 miles out. Use the ZIP code check on this page to confirm.',
      },
    ],
  },

  estimate: {
    heading: 'Request a free estimate',
    intro: 'Tell us what is going on with your roof. We reply within one business day with next steps and a time to come out.',
    nextSteps: [
      'We call or text to ask a few questions.',
      'We set a time to look at the roof, usually within the week.',
      'You get a written estimate with photos. No pressure, no expiry tricks.',
    ],
    serviceOptions: ['Roof repair or leak', 'Roof replacement', 'Storm or hail damage', 'Inspection', 'Not sure yet'],
    roofTypes: ['Asphalt shingle', 'Impact-rated shingle', 'Metal', 'Tile', 'Flat or low slope', 'Not sure'],
    timelines: ['As soon as possible', 'Within a month', 'In 1 to 3 months', 'Just planning'],
    insuranceOptions: ['Yes', 'No', 'Not sure'],
    consent: 'You can contact me by phone, text or email about this estimate.',
    successTitle: 'Estimate request sent',
    successBody: 'Thanks. We will reach out within one business day. Your reference number is below.',
  },

  booking: {
    appointmentWindows: ['Weekday morning', 'Weekday afternoon', 'Saturday morning', 'First available'],
    depositConsent:
      'Save my card with Whop and charge the remaining balance after I approve the final walkthrough.',
  },

  invoice: {
    memo: 'Thank you for choosing Copperline Roofing Co. Questions about this invoice? Call (303) 555-0148.',
    defaultDescription: 'Roof replacement, remaining balance',
    dueInDays: 7,
  },

  whopAppearance: { accentColor: 'teal' },
};

export function findOffer(id: string) {
  return site.offers.find((offer) => offer.id === id) ?? null;
}

/** True when the ZIP code is in the configured service area. */
export function isInServiceArea(zip: string): boolean {
  const five = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(five)) return false;
  return site.serviceArea.zips.includes(five) || site.serviceArea.zipPrefixes.some((prefix) => five.startsWith(prefix));
}
