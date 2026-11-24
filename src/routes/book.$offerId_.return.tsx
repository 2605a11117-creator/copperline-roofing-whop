import { ClientOnly, createFileRoute, notFound } from '@tanstack/react-router'

import { findOffer, site } from '../config/site'
import { useLocation } from '../lib/router'
import { ReturnPage } from '../pages/ReturnPage'
import { BookingFallback } from '../components/booking/BookingFallback'

// /book/<offer>/return is where Whop sends buyers after paying. The trailing underscore in the
// file name keeps it a sibling of /book/<offer> instead of a child.
export const Route = createFileRoute('/book/$offerId_/return')({
  beforeLoad: ({ params }) => {
    if (!findOffer(params.offerId)) throw notFound()
  },
  head: ({ params }) => ({
    meta: [
      { title: `${findOffer(params.offerId)?.name ?? 'Payment'} | ${site.company.name}` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Return,
})

function Return() {
  const { offerId } = Route.useParams()
  const { search } = useLocation()
  return (
    <ClientOnly fallback={<BookingFallback />}>
      <ReturnPage key={offerId} offerId={offerId} search={search} />
    </ClientOnly>
  )
}
