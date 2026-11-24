import { ClientOnly, createFileRoute, notFound } from '@tanstack/react-router'

import { BookingFallback } from '../components/booking/BookingFallback'
import { findOffer, site } from '../config/site'
import { formatUSD } from '../lib/format'
import { BookPage } from '../pages/BookPage'

export const Route = createFileRoute('/book/$offerId')({
  beforeLoad: ({ params }) => {
    if (!findOffer(params.offerId)) throw notFound()
  },
  head: ({ params }) => {
    const offer = findOffer(params.offerId)
    return {
      meta: [
        { title: `${offer?.pageTitle ?? 'Book online'} | ${site.company.name}` },
        ...(offer ? [{ name: 'description', content: `${offer.name}, ${formatUSD(offer.price)}. ${offer.summary}` }] : []),
      ],
    }
  },
  component: Book,
})

function Book() {
  const { offerId } = Route.useParams()
  // Booking details are kept in sessionStorage and the checkout is Whop Elements, so this page renders in the browser.
  return (
    <ClientOnly fallback={<BookingFallback />}>
      <BookPage key={offerId} offerId={offerId} />
    </ClientOnly>
  )
}
