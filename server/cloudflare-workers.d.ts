// The parts of the workerd built-in module that server/runtime.ts uses.
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown> | undefined;
  export const waitUntil: ((promise: Promise<unknown>) => void) | undefined;
}
