import { ClientOnly, createFileRoute } from '@tanstack/react-router'

import { site } from '../config/site'
import { AdminPage } from '../pages/AdminPage'

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [{ title: `Office | ${site.company.name}` }, { name: 'robots', content: 'noindex' }],
  }),
  component: Admin,
})

// The office page keeps its passcode in sessionStorage, so it renders in the browser only.
function Admin() {
  return (
    <ClientOnly
      fallback={
        <main id="main" className="status-page">
          <div className="container status-page__inner">
            <p className="loading" role="status">
              Loading the office page…
            </p>
          </div>
        </main>
      }
    >
      <AdminPage />
    </ClientOnly>
  )
}
