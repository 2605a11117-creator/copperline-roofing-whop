import { useEffect, useState } from 'react';
import type { PublicConfig } from '../../shared/api';
import { api, errorMessage } from './api';

export type PublicConfigState =
  | { status: 'loading' }
  | { status: 'ready'; config: PublicConfig }
  | { status: 'error'; message: string };

let pending: Promise<PublicConfig> | null = null;

export function loadPublicConfig(): Promise<PublicConfig> {
  if (!pending) {
    pending = api<PublicConfig>('/api/config').catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

/** The Whop account, plan IDs and environment, served by /api/config. */
export function usePublicConfig(): PublicConfigState {
  const [state, setState] = useState<PublicConfigState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    loadPublicConfig()
      .then((config) => {
        if (active) setState({ status: 'ready', config });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, []);
  return state;
}
