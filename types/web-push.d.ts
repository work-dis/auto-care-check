declare module 'web-push' {
  interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface SendNotificationOptions {
    TTL?: number;
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
    contentEncoding?: 'aesgcm' | 'aes128gcm';
  }

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  export function generateVAPIDKeys(): VapidKeys;

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: SendNotificationOptions
  ): Promise<void>;
}

export {};
