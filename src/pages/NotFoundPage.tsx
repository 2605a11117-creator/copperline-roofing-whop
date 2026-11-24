import { useEffect } from 'react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { site } from '../config/site';
import { Link } from '../lib/router';

export function NotFoundPage() {
  useEffect(() => {
    document.title = `Page not found | ${site.company.name}`;
  }, []);
  return (
    <>
      <Header variant="focused" />
      <main id="main" className="status-page">
        <div className="container status-page__inner">
          <h1 className="status-page__title">This page does not exist</h1>
          <p>The link may be old or mistyped.</p>
          <div className="status-page__actions">
            <Link to="/" className="btn btn--primary">
              Go to the home page
            </Link>
            <Link to="/#estimate" className="btn btn--secondary">
              Request a free estimate
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
