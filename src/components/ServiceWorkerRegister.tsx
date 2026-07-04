'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register on first load
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('[SW] Registered:', registration.scope);
        },
        (err) => {
          console.error('[SW] Registration failed:', err);
        }
      );
    }
  }, []);

  return null;
}
