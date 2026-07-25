import webPush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@autopulse.local',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export { webPush };

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    notificationId?: string;
    vehicleId?: string;
  };
}
