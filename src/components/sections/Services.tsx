import { useEffect, useRef } from 'react';
import { findOffer, site } from '../../config/site';
import type { Service } from '../../config/types';
import { Link } from '../../lib/router';
import { eventId, track } from '../../lib/track';
import { IconCheck } from '../Icons';

/** Fires service_viewed once per service per page view, when at least half its row is on screen. */
function useServiceViewTracking(services: Service[]) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === 'undefined') return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.serviceId;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          observer.unobserve(entry.target);
          const service = services.find((item) => item.id === id);
          if (!service) continue;
          track('service_viewed', {
            service_id: service.id,
            service_name: service.name,
            value: service.startingPrice,
            currency: service.startingPrice ? 'USD' : undefined,
            event_id: eventId('service', service.id),
          });
        }
      },
      { threshold: 0.5 },
    );
    list.querySelectorAll<HTMLElement>('[data-service-id]').forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [services]);

  return listRef;
}

export function Services() {
  const { services } = site;
  const listRef = useServiceViewTracking(services.items);

  return (
    <section id="services" className="section section--paper" aria-labelledby="services-title">
      <div className="container">
        <div className="section__head">
          <h2 id="services-title" className="section__title">
            {services.heading}
          </h2>
          <p className="section__intro">{services.intro}</p>
        </div>
        <ol ref={listRef} className="spec-list">
          {services.items.map((service) => {
            const offer = service.offerId ? findOffer(service.offerId) : null;
            return (
              <li key={service.id} className="spec" data-service-id={service.id}>
                <h3 className="spec__name">{service.name}</h3>
                <div className="spec__body">
                  <p className="spec__summary">{service.summary}</p>
                  <ul className="spec__points">
                    {service.points.map((point) => (
                      <li key={point}>
                        <IconCheck className="spec__check" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <p className="spec__timing">{service.timing}</p>
                </div>
                <div className="spec__price">
                  <p className="spec__price-label">{service.priceLabel}</p>
                  {offer ? (
                    <Link to={`/book/${offer.id}`} className="btn btn--primary">
                      {offer.bookLabel}
                    </Link>
                  ) : (
                    <Link to="/#estimate" className="btn btn--secondary">
                      {service.ctaLabel ?? 'Request an estimate'}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
