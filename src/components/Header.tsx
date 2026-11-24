import { useEffect, useState } from 'react';
import { site } from '../config/site';
import { Link } from '../lib/router';
import { telHref } from '../lib/format';
import { IconPhone, LogoMark } from './Icons';

const NAV = [
  { label: 'Services', to: '/#services' },
  { label: 'How it works', to: '/#process' },
  { label: 'Financing', to: '/#financing' },
  { label: 'Service area', to: '/#area' },
  { label: 'Reviews', to: '/#reviews' },
  { label: 'FAQ', to: '/#faq' },
];

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label={`${site.company.name}, home`}>
      <LogoMark className="brand__mark" />
      <span className="brand__name">{site.company.shortName}</span>
      <span className="brand__descriptor">{site.company.descriptor}</span>
    </Link>
  );
}

export function Header({ variant = 'site' }: { variant?: 'site' | 'focused' }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <header className="header">
      <div className="container header__inner">
        <Brand />
        {variant === 'site' && (
          <nav className="nav" aria-label="Main">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="nav__link">
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="header__actions">
          <a className="header__phone" href={telHref(site.company.phone)}>
            <IconPhone />
            <span>{site.company.phone}</span>
          </a>
          {variant === 'site' ? (
            <Link to="/#estimate" className="btn btn--primary btn--sm header__cta">
              Free estimate
            </Link>
          ) : (
            <Link to="/" className="btn btn--quiet btn--sm">
              Back to site
            </Link>
          )}
          {variant === 'site' && (
            <button
              type="button"
              className="menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          )}
        </div>
      </div>
      {variant === 'site' && menuOpen && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} className="mobile-menu__link" onClick={close}>
              {item.label}
            </Link>
          ))}
          <Link to="/#estimate" className="btn btn--primary btn--block" onClick={close}>
            Request a free estimate
          </Link>
        </nav>
      )}
    </header>
  );
}
