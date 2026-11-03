import { readFileSync, writeFileSync } from 'node:fs';
const version = 'signup-2026-11-03-v1';
const notices = { version };
let sql =
  'begin;\nupdate public.signup_document_versions set is_current=false where is_current;\n';
for (const [kind, file] of [
  ['terms', 'terms-of-service.ko.md'],
  ['account_collection', 'signup-privacy.ko.md'],
]) {
  const text = readFileSync(`docs/legal/${file}`, 'utf8');
  if (!text.includes(`버전 ${version}`) || text.includes('$podoong_notice$'))
    throw Error('Invalid signup notice');
  notices[kind] = text;
  sql += `insert into public.signup_document_versions(kind,version,document_locale,snapshot,is_current,status) values ('${kind}','${version}','ko',$podoong_notice$${text}$podoong_notice$,true,'published');\n`;
}
sql += "notify pgrst,'reload schema';\ncommit;\n";
// Freeze only this unreleased bundle. Never edit a version users already accepted.
writeFileSync(
  'src/features/legal/signup-notices.json',
  JSON.stringify(notices, null, 2) + '\n',
);
writeFileSync(
  'supabase/migrations/202611030088_signup_privacy_notices.sql',
  sql,
);
