import { site } from '../config/site';
import { Link } from '../lib/router';
import { telHref } from '../lib/format';
import { IconPhone } from './Icons';

/** Call and estimate buttons pinned to the bottom of small screens. */
export function MobileCtaBar() {
  return (
    <div className="mobile-cta" aria-label="Quick contact">
      <a className="btn btn--secondary" href={telHref(site.company.phone)}>
        <IconPhone />
        Call
      </a>
      <Link className="btn btn--primary" to="/#estimate">
        Free estimate
      </Link>
    </div>
  );
}
