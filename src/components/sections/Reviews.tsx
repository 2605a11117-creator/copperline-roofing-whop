import { site } from '../../config/site';
import { IconStar } from '../Icons';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <IconStar key={value} className={value <= Math.round(rating) ? 'stars__on' : 'stars__off'} />
      ))}
    </span>
  );
}

export function Reviews() {
  const { reviews } = site;
  const [featured, ...others] = reviews.items;

  return (
    <section id="reviews" className="section section--sky" aria-labelledby="reviews-title">
      <div className="container reviews">
        <div className="reviews__summary">
          <h2 id="reviews-title" className="section__title section__title--side">
            {reviews.heading}
          </h2>
          {reviews.isSample && <p className="sample-tag">Sample reviews for this template. Replace them with your own.</p>}
          <p className="reviews__score">
            <span className="reviews__rating">{reviews.rating.toFixed(1)}</span>
            <span className="reviews__out-of">
              <Stars rating={reviews.rating} />
              {reviews.count} reviews on {reviews.source}
            </span>
          </p>
          <dl className="facts">
            {reviews.facts.map((fact) => (
              <div key={fact.label} className="facts__item">
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="reviews__quotes">
          {featured && (
            <figure className="quote quote--featured">
              <Stars rating={featured.rating} />
              <blockquote>
                <p>{featured.quote}</p>
              </blockquote>
              <figcaption>
                <strong>{featured.name}</strong>, {featured.place}
                <span className="quote__project">{featured.project}</span>
              </figcaption>
            </figure>
          )}
          {others.map((review) => (
            <figure key={review.name} className="quote">
              <Stars rating={review.rating} />
              <blockquote>
                <p>{review.quote}</p>
              </blockquote>
              <figcaption>
                <strong>{review.name}</strong>, {review.place}
                <span className="quote__project">{review.project}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
