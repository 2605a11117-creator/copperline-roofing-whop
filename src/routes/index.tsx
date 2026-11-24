import { createFileRoute } from '@tanstack/react-router'

import { site } from '../config/site'
import { useLocation } from '../lib/router'
import { HomePage } from '../pages/HomePage'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: site.seo.title }] }),
  component: Home,
})

function Home() {
  const { hash } = useLocation()
  return <HomePage hash={hash} />
}
