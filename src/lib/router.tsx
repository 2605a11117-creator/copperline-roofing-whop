import { Link as RouterLink, useLocation as useRouterLocation } from '@tanstack/react-router';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { clientRouter } from './router-ref';

// Routing helpers the components use. TanStack Router (src/routes) owns history and rendering;
// this file keeps the small API the components were written against: Link, navigate,
// useLocation and scrollToHash.

export interface AppLocation {
  pathname: string;
  search: string;
  hash: string;
}

const isBrowser = typeof window !== 'undefined';

export function prefersReducedMotion(): boolean {
  if (!isBrowser) return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function scrollToHash(hash: string): void {
  if (!isBrowser) return;
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  if (!id) return;
  // Wait a frame so a page that just rendered has its sections in the DOM.
  window.requestAnimationFrame(() => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  });
}

/** Goes to a path on this site through the router (full page load for other origins). */
export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (!isBrowser) return;
  const url = new URL(to, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }
  const router = clientRouter();
  const href = `${url.pathname}${url.search}${url.hash}`;
  if (!router) {
    window.location.assign(href);
    return;
  }
  void router.navigate({ href, replace: options.replace, resetScroll: !url.hash }).then(() => {
    if (url.hash) scrollToHash(url.hash);
  });
}

/** The current location, with search and hash as strings that start with ? and # (or are empty). */
export function useLocation(): AppLocation {
  const location = useRouterLocation();
  const search = location.searchStr && location.searchStr !== '?' ? location.searchStr : '';
  const hash = location.hash ? `#${location.hash.replace(/^#/, '')}` : '';
  return { pathname: location.pathname, search, hash };
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };

function splitTarget(to: string): { pathname: string; search: string; hash: string } {
  const hashAt = to.indexOf('#');
  const withoutHash = hashAt >= 0 ? to.slice(0, hashAt) : to;
  const hash = hashAt >= 0 ? to.slice(hashAt + 1) : '';
  const searchAt = withoutHash.indexOf('?');
  return {
    pathname: searchAt >= 0 ? withoutHash.slice(0, searchAt) : withoutHash,
    search: searchAt >= 0 ? withoutHash.slice(searchAt) : '',
    hash,
  };
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>, target: string | undefined): boolean {
  if (event.defaultPrevented || event.button !== 0 || target === '_blank') return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

/**
 * A router link for internal paths such as "/", "/book/inspection" or "/#estimate".
 * Hash-only links ("#faq"), links with a query string and other schemes are plain anchors.
 */
export function Link({ to, onClick, target, ...rest }: LinkProps) {
  const { pathname, search, hash } = splitTarget(to);

  if (!pathname.startsWith('/') || search) {
    const internal = !/^[a-z][a-z0-9+.-]*:/i.test(to);
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (!internal || !isPlainLeftClick(event, target)) return;
      event.preventDefault();
      navigate(to);
    };
    return <a href={to} target={target} onClick={handleClick} {...rest} />;
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!isPlainLeftClick(event, target)) return;
    // Scroll to the section ourselves (smooth unless reduced motion), also when the hash is already current.
    if (hash && isBrowser && window.location.pathname === pathname) scrollToHash(hash);
  };

  return (
    <RouterLink
      // The site's paths are plain strings from src/config/site.ts, so they are not checked against the route tree.
      to={pathname as '/'}
      hash={hash || undefined}
      hashScrollIntoView={false}
      resetScroll={hash ? false : undefined}
      target={target}
      onClick={handleClick}
      {...rest}
    />
  );
}
