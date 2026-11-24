import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setClientRouter } from './lib/router-ref'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  // In the browser, navigate() in src/lib/router.tsx goes through this instance.
  setClientRouter(router)
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
