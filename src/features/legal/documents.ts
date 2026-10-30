import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@/lib/supabase/server';
export const legalDocuments = {
  terms: {
    ko: '서비스 이용약관',
    en: 'Terms of Service',
    file: 'terms-of-service.ko.md',
  },
  privacy: {
    ko: '개인정보 처리방침',
    en: 'Privacy Policy',
    file: 'privacy-policy.ko.md',
  },
  community: {
    ko: '동네 생활 운영정책',
    en: 'Community Policy',
    file: 'community-policy.ko.md',
  },
  consent: {
    ko: '동의 안내',
    en: 'Consent Information',
    file: 'consent-notices.ko.md',
  },
  'signup-privacy': {
    ko: '가입 개인정보 수집·이용 안내',
    en: 'Account Information Collection Notice',
    file: 'signup-privacy.ko.md',
  },
} as const;
export type LegalDocument = keyof typeof legalDocuments;
export function isLegalDocument(value: string): value is LegalDocument {
  return Object.hasOwn(legalDocuments, value);
}
export async function readLegalDocument(key: LegalDocument) {
  const markdown = await readFile(
    path.join(process.cwd(), 'docs/legal', legalDocuments[key].file),
    'utf8',
  );
  return parseDocument(markdown);
}

export async function readSignupDocument(key: LegalDocument, version: string) {
  const kind =
    key === 'terms'
      ? 'terms'
      : key === 'signup-privacy'
        ? 'account_collection'
        : null;
  if (!kind || !/^signup-[A-Za-z0-9.-]{1,80}$/.test(version)) return null;
  const db = await createClient();
  const result = await db
    .from('signup_document_versions')
    .select('snapshot,version')
    .eq('kind', kind)
    .eq('version', version)
    .maybeSingle();
  if (result.error) throw new Error('Signup document unavailable');
  if (!result.data) return null;
  return {
    ...parseDocument(result.data.snapshot),
    version: result.data.version,
  };
}

function parseDocument(markdown: string) {
  const version = markdown.match(/^버전\s+([\d.]+)/m)?.[1] ?? '';
  const updated = markdown.match(/작성일\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
  const body = markdown
    .split('\n')
    .filter(
      (line, i) =>
        i !== 0 && !line.startsWith('버전 ') && !line.startsWith('시행일:'),
    )
    .join('\n');
  return { body, version, updated };
}
