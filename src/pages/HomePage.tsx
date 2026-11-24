import { useEffect } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { MobileCtaBar } from '../components/MobileCtaBar';
import { Hero } from '../components/sections/Hero';
import { Services } from '../components/sections/Services';
import { Process } from '../components/sections/Process';
import { Financing } from '../components/sections/Financing';
import { ServiceArea } from '../components/sections/ServiceArea';
import { Reviews } from '../components/sections/Reviews';
import { Faq } from '../components/sections/Faq';
import { EstimateSection } from '../components/sections/EstimateSection';
import { scrollToHash } from '../lib/router';

export function HomePage({ hash }: { hash: string }) {
  // Arriving from another page with /#section: scroll once the sections exist.
  useEffect(() => {
    if (hash) scrollToHash(hash);
  }, [hash]);

  return (
    <>
      <Header />
      <main id="main" className="has-mobile-cta">
        <Hero />
        <Services />
        <Process />
        <Financing />
        <ServiceArea />
        <Reviews />
        <Faq />
        <EstimateSection />
      </main>
      <Footer />
      <MobileCtaBar />
    </>
  );
}
