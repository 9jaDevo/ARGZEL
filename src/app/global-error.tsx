'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Last-resort error screen when the root layout itself fails. It renders its own
// document (no global styles apply here), so styling is inline.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8f9fb', color: '#20232b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <main style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 20px', color: '#5b6070' }}>Your reminders are safe. Please try again.</p>
          <button onClick={() => retry()} style={{ border: 0, borderRadius: 999, padding: '12px 22px', background: '#20232b', color: '#fff', fontSize: 15, fontWeight: 600 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
