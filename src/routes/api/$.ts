import { createFileRoute } from '@tanstack/react-router'

import { handleApi } from '../../../server/index'
import { requestScope, serverEnv } from '../../../server/runtime'

// Every /api/* request goes to the site's API handler in server/index.ts
// (estimates → member + lead event, checkout, deposits with a saved card, office invoices).
async function serve({ request }: { request: Request }): Promise<Response> {
  const scope = requestScope()
  const response = await handleApi(request, serverEnv(), new URL(request.url), scope.ctx)
  await scope.settle()
  return response
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: serve,
      POST: serve,
    },
  },
})
