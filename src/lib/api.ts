import type { ApiErrorBody } from '../../shared/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly fields: string[];

  constructor(message: string, status: number, code?: string, fields: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
}

/** Calls this site's own /api routes and turns error bodies into ApiError. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined;
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? (hasBody ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('You appear to be offline. Check your connection and try again.', 0, 'network');
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = (data as Partial<ApiErrorBody> | null)?.error;
    throw new ApiError(
      error?.message ?? `The request failed with status ${response.status}.`,
      response.status,
      error?.code,
      error?.fields ?? [],
    );
  }
  return data as T;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
