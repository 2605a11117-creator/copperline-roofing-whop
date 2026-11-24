import { Footer } from '../Footer';
import { Header } from '../Header';

/** What the server sends for a booking page before the browser takes over. */
export function BookingFallback() {
  return (
    <>
      <Header variant="focused" />
      <main id="main" className="book">
        <div className="container">
          <p className="loading" role="status">
            Loading secure checkout…
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
