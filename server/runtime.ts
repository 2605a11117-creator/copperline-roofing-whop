import * as workers from 'cloudflare:workers';
import type { Env, ExecutionContext } from './env';

// Bridges TanStack Start server routes to the request handler in ./index.ts.
// Bindings and secrets come from `cloudflare:workers` (Whop hosting and `whop apps dev` both run
// the server in workerd). Work queued with waitUntil keeps running after the response is sent;
// if this runtime has no waitUntil export, the handler waits for that work before responding.

export function serverEnv(): Env {
  return (workers.env ?? {}) as Env;
}

export interface RequestScope {
  ctx: ExecutionContext;
  /** Resolves when work that could not be handed to the runtime has finished. */
  settle(): Promise<void>;
}

export function requestScope(): RequestScope {
  const native = typeof workers.waitUntil === 'function' ? workers.waitUntil : null;
  const pending: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil(promise) {
        if (native) native(promise);
        else pending.push(promise);
      },
    },
    async settle() {
      await Promise.allSettled(pending);
    },
  };
}
