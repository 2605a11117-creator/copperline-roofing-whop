import { site } from '../../config/site';

/** The job sequence, with what is paid at each step. Numbered because it is an actual sequence. */
export function Process() {
  const { process } = site;
  return (
    <section id="process" className="section section--sky" aria-labelledby="process-title">
      <div className="container">
        <div className="section__head">
          <h2 id="process-title" className="section__title">
            {process.heading}
          </h2>
          <p className="section__intro">{process.intro}</p>
        </div>
        <ol className="steps">
          {process.steps.map((step, index) => (
            <li key={step.title} className="step">
              <span className="step__number" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="step__title">{step.title}</h3>
              <p className="step__body">{step.body}</p>
              <p className="step__pay">
                <span className="visually-hidden">You pay: </span>
                {step.payment}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
