import { site } from '../config/site';
import { Link } from '../lib/router';
import { telHref } from '../lib/format';
import { Brand } from './Header';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__about">
          <Brand />
          <p>
            Roof repair, replacement and inspections in {site.company.city} and the surrounding cities.
          </p>
          <p className="footer__small">{site.company.license}</p>
        </div>
        <div>
          <h2 className="footer__heading">Contact</h2>
          <ul className="footer__list">
            <li>
              <a href={telHref(site.company.phone)}>{site.company.phone}</a>
            </li>
            <li>
              <a href={`mailto:${site.company.email}`}>{site.company.email}</a>
            </li>
            <li>{site.company.emergency}</li>
          </ul>
        </div>
        <div>
          <h2 className="footer__heading">Hours</h2>
          <ul className="footer__list">
            {site.company.hours.map((row) => (
              <li key={row.days}>
                {row.days}: {row.time}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="footer__heading">Book online</h2>
          <ul className="footer__list">
            {site.offers.map((offer) => (
              <li key={offer.id}>
                <Link to={`/book/${offer.id}`}>{offer.bookLabel}</Link>
              </li>
            ))}
            <li>
              <Link to="/#estimate">Request a free estimate</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container footer__base">
        <p>
          © {year} {site.company.name}
        </p>
        <p>Payments are processed by Whop, the merchant of record for online orders.</p>
        {site.demoMode && <p>Demo site. The company, reviews and figures are sample content.</p>}
      </div>
    </footer>
  );
}
