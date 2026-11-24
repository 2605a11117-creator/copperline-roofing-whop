import { site } from '../../config/site';
import { Link } from '../../lib/router';
import { IconCheck } from '../Icons';
import { RoofElevation } from './RoofElevation';

export function Hero() {
  const { hero } = site;
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero__grid">
        <h1 id="hero-title" className="hero__title">
          {hero.headline}
        </h1>
        <div className="hero__copy">
          <p className="hero__intro">{hero.intro}</p>
          <div className="hero__actions">
            <Link to={hero.primaryCta.href} className="btn btn--primary btn--lg">
              {hero.primaryCta.label}
            </Link>
            <Link to={hero.secondaryCta.href} className="btn btn--secondary btn--lg">
              {hero.secondaryCta.label}
            </Link>
          </div>
          <ul className="hero__proof">
            {hero.proof.map((item) => (
              <li key={item}>
                <IconCheck className="hero__proof-icon" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="hero__drawing">
          <RoofElevation />
        </div>
      </div>
    </section>
  );
}
