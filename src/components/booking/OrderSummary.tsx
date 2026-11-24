import type { Offer } from '../../config/types';
import { formatUSD } from '../../lib/format';
import { IconCheck } from '../Icons';

interface OrderSummaryProps {
  offer: Offer;
  variantId: string | null;
  productId: string | null;
}

/** The order on the booking page. The data-whop-* attributes let the Whop pixel read the product shown. */
export function OrderSummary({ offer, variantId, productId }: OrderSummaryProps) {
  return (
    <section
      className="summary"
      aria-labelledby="summary-title"
      data-whop-product-id={productId ?? undefined}
      data-whop-variant-id={variantId ?? undefined}
      data-whop-price={offer.price}
      data-whop-currency="USD"
    >
      <h2 id="summary-title" className="summary__title">
        {offer.name}
      </h2>
      <p className="summary__price">
        {formatUSD(offer.price)}
        <span className="summary__price-note">{offer.kind === 'deposit' ? 'due today' : 'paid at booking'}</span>
      </p>
      <p className="summary__text">{offer.summary}</p>
      <ul className="summary__includes">
        {offer.includes.map((item) => (
          <li key={item}>
            <IconCheck className="summary__check" />
            {item}
          </li>
        ))}
      </ul>
      <p className="summary__note">{offer.priceNote}</p>
    </section>
  );
}
