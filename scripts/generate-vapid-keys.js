const webPush = require('web-push');

const vapidKeys = webPush.generateVAPIDKeys();

console.log('VAPID keys generated successfully!\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('\nAdd these to your .env file.');
