import { useEffect, useState } from 'react';
import { pixelDetected, subscribeToTracking, trackedEvents, type TrackedEvent } from '../lib/track';
import { readSession, writeSession } from '../lib/storage';

const KEY = 'pixel-inspector';

function inspectorEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const flag = params.get('debug');
  if (flag === '1' || flag === 'pixel') writeSession(KEY, true);
  if (flag === '0') writeSession(KEY, false);
  return readSession<boolean>(KEY) === true;
}

const STATUS_TEXT: Record<TrackedEvent['status'], string> = {
  sent: 'Sent to Whop',
  queued: 'Waiting for pixel',
  failed: 'Pixel error',
};

/**
 * Lists every whop.track call on the page. Open any URL with ?debug=1 to show it, and ?debug=0 to hide it.
 * Useful for demos: events also reach the Whop dashboard about a minute later.
 */
export function PixelInspector() {
  // Read ?debug and sessionStorage after mounting, so the server and browser render the same first frame.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(inspectorEnabled()), []);
  const [open, setOpen] = useState(true);
  const [events, setEvents] = useState<TrackedEvent[]>(trackedEvents);
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setDetected(pixelDetected());
    const refresh = () => {
      setEvents(trackedEvents());
      setDetected(pixelDetected());
    };
    const unsubscribe = subscribeToTracking(refresh);
    const timer = window.setInterval(() => setDetected(pixelDetected()), 2000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside className={open ? 'inspector inspector--open' : 'inspector'} aria-label="Pixel event inspector">
      <button type="button" className="inspector__toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        Pixel events ({events.length})
      </button>
      {open && (
        <div className="inspector__body">
          <p className={detected ? 'inspector__pixel inspector__pixel--ok' : 'inspector__pixel'}>
            {detected ? 'Whop pixel detected on this page' : 'Whop pixel not detected yet'}
          </p>
          {events.length === 0 ? (
            <p className="inspector__empty">No events yet. Scroll to the services, request an estimate, or open the deposit page.</p>
          ) : (
            <ol className="inspector__list" reversed>
              {events
                .slice()
                .reverse()
                .map((event) => (
                  <li key={event.id} className="inspector__item">
                    <div className="inspector__row">
                      <strong>{event.name}</strong>
                      <span className={`inspector__status inspector__status--${event.status}`}>{STATUS_TEXT[event.status]}</span>
                    </div>
                    <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleTimeString()}</time>
                    {Object.keys(event.props).length > 0 && (
                      <pre className="inspector__props">{JSON.stringify(event.props, null, 1)}</pre>
                    )}
                  </li>
                ))}
            </ol>
          )}
        </div>
      )}
    </aside>
  );
}
