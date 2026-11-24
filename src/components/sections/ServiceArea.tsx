import { useId, useState, type FormEvent } from 'react';
import { isInServiceArea, site } from '../../config/site';
import { Link } from '../../lib/router';

type ZipResult = { zip: string; served: boolean } | null;

/** Cities placed around the hub on two rings. Decorative; the list beside it carries the content. */
function AreaRings() {
  const { cities, hub, radiusMiles } = site.serviceArea;
  const cx = 280;
  const cy = 220;
  return (
    <svg className="area__rings" viewBox="0 0 560 440" aria-hidden="true">
      {[70, 130, 190].map((radius) => (
        <circle key={radius} className="area__ring" cx={cx} cy={cy} r={radius} />
      ))}
      <text className="area__ring-label" x={cx} y={cy - 190 + 20} textAnchor="middle">
        {radiusMiles} mi
      </text>
      {cities.map((city, index) => {
        const angle = (index / cities.length) * Math.PI * 2 - Math.PI / 2 + 0.26;
        const radius = index % 2 === 0 ? 112 : 158;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const leftSide = x < cx - 8;
        return (
          <g key={city}>
            <circle className="area__city-dot" cx={x} cy={y} r="4" />
            <text className="area__city" x={leftSide ? x - 9 : x + 9} y={y + 5} textAnchor={leftSide ? 'end' : 'start'}>
              {city}
            </text>
          </g>
        );
      })}
      <circle className="area__hub-dot" cx={cx} cy={cy} r="8" />
      <text className="area__hub" x={cx} y={cy + 30} textAnchor="middle">
        {hub}
      </text>
    </svg>
  );
}

export function ServiceArea() {
  const { serviceArea } = site;
  const inputId = useId();
  const [zip, setZip] = useState('');
  const [result, setResult] = useState<ZipResult>(null);
  const [error, setError] = useState('');

  const check = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = zip.trim();
    if (!/^\d{5}$/.test(value)) {
      setResult(null);
      setError('Enter a 5-digit ZIP code.');
      return;
    }
    setError('');
    setResult({ zip: value, served: isInServiceArea(value) });
  };

  return (
    <section id="area" className="section section--paper" aria-labelledby="area-title">
      <div className="container area">
        <div className="area__copy">
          <h2 id="area-title" className="section__title">
            {serviceArea.heading}
          </h2>
          <p className="section__intro">{serviceArea.intro}</p>

          <form className="zip-check" onSubmit={check} noValidate>
            <label htmlFor={inputId} className="field__label">
              Check your ZIP code
            </label>
            <div className="zip-check__row">
              <input
                id={inputId}
                className="input zip-check__input"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                value={zip}
                onChange={(event) => setZip(event.target.value.replace(/\D/g, '').slice(0, 5))}
                aria-describedby={`${inputId}-result`}
                aria-invalid={error ? true : undefined}
              />
              <button type="submit" className="btn btn--secondary">
                Check ZIP
              </button>
            </div>
            <p id={`${inputId}-result`} className="zip-check__result" aria-live="polite">
              {error && <span className="text-danger">{error}</span>}
              {result?.served && (
                <span>
                  Yes, we work in {result.zip}. <Link to="/#estimate">Request a free estimate</Link>.
                </span>
              )}
              {result && !result.served && (
                <span>
                  {result.zip} {serviceArea.outsideNote}
                </span>
              )}
            </p>
          </form>

          <h3 className="area__list-title">Cities we cover</h3>
          <ul className="area__cities">
            <li>{serviceArea.hub}</li>
            {serviceArea.cities.map((city) => (
              <li key={city}>{city}</li>
            ))}
          </ul>
        </div>
        <div className="area__map">
          <AreaRings />
        </div>
      </div>
    </section>
  );
}
