import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { DemoBanner } from '../components/DemoBanner'
import { PixelInspector } from '../components/PixelInspector'
import { site } from '../config/site'
import { NotFoundPage } from '../pages/NotFoundPage'
import appCss from '../styles.css?url'

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: site.seo.title },
      { name: 'description', content: site.seo.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: site.seo.title },
      { property: 'og:description', content: site.seo.description },
      { name: 'theme-color', content: '#1e2b33' },
      { name: 'color-scheme', content: 'light' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: FONT_CSS },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: AppShell,
  notFoundComponent: NotFoundPage,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <noscript>Turn on JavaScript to book online, or call {site.company.phone}.</noscript>
        <Scripts />
      </body>
    </html>
  )
}

/** Shared by every page: skip link, demo notice (not on the office page) and the ?debug=1 pixel inspector. */
function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isAdmin = pathname.replace(/\/+$/, '') === '/admin'
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!isAdmin && <DemoBanner />}
      <Outlet />
      <PixelInspector />
    </>
  )
}
