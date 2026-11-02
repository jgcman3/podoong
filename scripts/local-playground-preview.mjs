import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { seedPlaygroundDemo } from './seed-playground-demo.mjs';
const { env: local, state } = await seedPlaygroundDemo();
const declaration = readFileSync('next-env.d.ts', 'utf8');
const preview = spawn(
  'npx',
  ['next', 'dev', '--hostname', '127.0.0.1', '--port', '3190'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
      SUPABASE_SECRET_KEY: '',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3190',
      NEXT_PUBLIC_AUTH_PROVIDERS: '',
      PODUNG_LOCAL_PLAYGROUND_DEMO: '1',
      PODOONG_LOCAL_DEMO_EMAIL: state.users[0].email,
      PODOONG_LOCAL_DEMO_PASSWORD: state.users[0].password,
      PODOONG_LOCAL_DEMO_CHILD: state.child,
    },
  },
);
console.log('Open local demo: http://localhost:3190/api/local/playground-demo');
preview.on('exit', (code) => {
  writeFileSync('next-env.d.ts', declaration);
  process.exitCode = code ?? 0;
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => preview.kill(signal));
