const fs = require('fs');
const append = '\n# Web Push (VAPID)\nNEXT_PUBLIC_VAPID_PUBLIC_KEY="BFfCgPmUoGgHL5XojQ1QgYdTmxEGoi9rl2P73CR3iQhpROLdRoZpucCMDFg4SvIeuRnp6mt-8WBT7ZevzybE7Ok"\nVAPID_PRIVATE_KEY="1pyBn1n4aaOcD3TZFzZeh1ODT3oCEcCyLRyLeTJ-Jcc"\n';
let existing = '';
try { existing = fs.readFileSync('.env', 'utf8'); } catch (e) {}
if (!existing.includes('VAPID')) {
  fs.appendFileSync('.env', append);
  console.log('VAPID keys appended to .env');
} else {
  console.log('VAPID keys already in .env');
}
