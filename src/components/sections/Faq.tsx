import { site } from '../../config/site';
import { IconPlus } from '../Icons';

export function Faq() {
  const { faq } = site;
  return (
    <section id="faq" className="section section--paper" aria-labelledby="faq-title">
      <div className="container faq">
        <h2 id="faq-title" className="section__title section__title--side">
          {faq.heading}
        </h2>
        <div className="faq__list">
          {faq.items.map((item) => (
            <details key={item.question} className="faq__item">
              <summary className="faq__question">
                <span>{item.question}</span>
                <IconPlus className="faq__icon" />
              </summary>
              <p className="faq__answer">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
