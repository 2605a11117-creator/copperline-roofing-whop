import { site } from '../../config/site';
import { Link } from '../../lib/router';
import { IconCheck, IconLock } from '../Icons';

export function Financing() {
  const { financing } = site;
  return (
    <section id="financing" className="section section--ink" aria-labelledby="financing-title">
      <div className="container financing">
        <div className="financing__copy">
          <h2 id="financing-title" className="section__title">
            {financing.heading}
          </h2>
          <p className="financing__body">{financing.body}</p>
          <ul className="financing__points">
            {financing.points.map((point) => (
              <li key={point}>
                <IconCheck className="financing__check" />
                {point}
              </li>
            ))}
          </ul>
          <Link to={financing.cta.href} className="btn btn--primary btn--lg">
            {financing.cta.label}
          </Link>
          <p className="financing__footnote">{financing.footnote}</p>
        </div>
        <div className="financing__panel">
          <p className="financing__panel-title">
            <IconLock />
            Ways to pay at checkout
          </p>
          <ul className="financing__methods">
            {financing.methods.map((method) => (
              <li key={method}>{method}</li>
            ))}
          </ul>
          <p className="financing__panel-note">Checkout is hosted by Whop. Card details never touch this website.</p>
        </div>
      </div>
    </section>
  );
}
