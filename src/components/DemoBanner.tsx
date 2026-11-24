import { useEffect, useState } from 'react';
import { site } from '../config/site';
import { readSession, writeSession } from '../lib/storage';

const KEY = 'demo-banner-dismissed';

/** Tells visitors the company and reviews are sample content. Turn off with demoMode in site.ts. */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  // sessionStorage exists only in the browser: read it after mounting.
  useEffect(() => setDismissed(readSession<boolean>(KEY) === true), []);
  if (!site.demoMode || dismissed) return null;
  return (
    <div className="demo-banner" role="note">
      <p>
        This is a template demo. {site.company.name}, its reviews and its figures are sample content.
      </p>
      <button
        type="button"
        className="demo-banner__close"
        onClick={() => {
          writeSession(KEY, true);
          setDismissed(true);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
