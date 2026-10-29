import { createECDH } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const destination = process.argv[2] || '.env.push.local';
const key = createECDH('prime256v1');
key.generateKeys();
writeFileSync(
  destination,
  `WEB_PUSH_PUBLIC_KEY=${key.getPublicKey().toString('base64url')}\nWEB_PUSH_PRIVATE_KEY=${key.getPrivateKey().toString('base64url')}\n`,
  { flag: 'wx', mode: 0o600 },
);
console.log(
  'Created private Web Push key file. Keep it out of Git and reuse it for future deployments.',
);
