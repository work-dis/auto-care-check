'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });

      if ('caches' in window) {
        void window.caches.keys().then((cacheNames) => {
          cacheNames
            .filter((name) => name.startsWith('autopulse-'))
            .forEach((name) => {
              void window.caches.delete(name);
            });
        });
      }

      return;
    }

    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('[SW] Registered:', registration.scope);
      },
      (err) => {
        console.error('[SW] Registration failed:', err);
      }
    );
  }, []);

  return null;
}
