'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

export default function PushNotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  });
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if already subscribed by looking at existing push subscriptions
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          setIsSubscribed(!!sub);
        })
        .catch(() => {
          // SW not ready yet
        });
    }
  }, []);

  const handleSubscribe = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Push notifications not supported');
      return;
    }

    setIsSubscribing(true);

    try {
      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setIsSubscribing(false);
        return;
      }

      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.register('/sw.js');

      // Get the push subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        ) as unknown as string,
      });

      // Send to our server
      const subJson = subscription.toJSON();
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          userAgent: navigator.userAgent,
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
      } else {
        console.error('Failed to save push subscription on server');
      }
    } catch (error) {
      console.error('Error subscribing to push:', error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subJson = subscription.toJSON();

        // Tell server to remove subscription
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subJson.endpoint }),
        });

        // Unsubscribe from push manager
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
    }
  };

  if (permission === 'denied' || !('Notification' in window)) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <BellOff className="h-4 w-4" />
        <span>Push-уведомления отключены в браузере</span>
      </div>
    );
  }

  // Already subscribed
  if (isSubscribed) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-teal-400">
          <Bell className="h-4 w-4" />
          <span>Уведомления включены</span>
        </div>
        <button
          onClick={handleUnsubscribe}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition"
        >
          Отключить
        </button>
      </div>
    );
  }

  // Permission granted but not subscribed (should not happen normally)
  if (permission === 'granted' && !isSubscribed) {
    return (
      <button
        onClick={handleSubscribe}
        disabled={isSubscribing}
        className="inline-flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-400 transition hover:bg-teal-500 hover:text-neutral-950 disabled:opacity-55"
      >
        {isSubscribing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bell className="h-3.5 w-3.5" />
        )}
        {isSubscribing ? 'Подключение...' : 'Подключить уведомления'}
      </button>
    );
  }

  // Default state — ask for permission
  return (
    <button
      onClick={handleSubscribe}
      disabled={isSubscribing}
      className="inline-flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-400 transition hover:bg-teal-500 hover:text-neutral-950 disabled:opacity-55"
    >
      {isSubscribing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      {isSubscribing ? 'Подключение...' : 'Включить уведомления'}
    </button>
  );
}

/**
 * Convert a base64url string to a Uint8Array for applicationServerKey.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
