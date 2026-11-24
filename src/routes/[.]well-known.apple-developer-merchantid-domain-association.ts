import { createFileRoute } from '@tanstack/react-router'

import { applePayFile } from '../../server/index'

// Whop's Apple Pay domain file, so this domain can show the Apple Pay button in Express Checkout.
export const Route = createFileRoute('/.well-known/apple-developer-merchantid-domain-association')({
  server: {
    handlers: {
      GET: () => applePayFile(),
    },
  },
})
