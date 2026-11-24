import type { AnyRouter } from '@tanstack/react-router';

// The browser's router instance, so plain functions such as navigate() in ./router.tsx can use it.
// src/router.tsx sets it when the client creates its router. Kept in its own module to avoid an
// import cycle (router.tsx → route tree → components → lib/router.tsx).

let current: AnyRouter | null = null;

export function setClientRouter(router: AnyRouter): void {
  if (typeof window !== 'undefined') current = router;
}

export function clientRouter(): AnyRouter | null {
  return current;
}
