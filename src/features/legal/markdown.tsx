import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Locale } from '@/lib/domain';
const related: Record<string, string> = {
  'terms-of-service.ko.md': 'terms',
  'privacy-policy.ko.md': 'privacy',
  'community-policy.ko.md': 'community',
  'consent-notices.ko.md': 'consent',
};
type ReturnTo = { source: 'signup' | 'login'; next: string };
function inline(
  text: string,
  locale: Locale,
  childId?: string,
  returnTo?: ReturnTo,
): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
    .filter(Boolean)
    .map((token, i) => {
      if (token.startsWith('**'))
        return <strong key={i}>{token.slice(2, -2)}</strong>;
      if (token.startsWith('`'))
        return <code key={i}>{token.slice(1, -1)}</code>;
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const slug = related[link[2]];
        if (slug)
          return (
            <Link
              key={i}
              href={`/${locale}/legal/${slug}${returnTo ? `?source=${returnTo.source}&next=${encodeURIComponent(returnTo.next)}` : childId ? `?child=${childId}` : ''}`}
            >
              {link[1]}
            </Link>
          );
        if (/^https:\/\//.test(link[2]))
          return (
            <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
              {link[1]}
            </a>
          );
        return <span key={i}>{link[1]}</span>;
      }
      return token;
    });
}
export function LegalMarkdown({
  body,
  locale,
  childId,
  returnTo,
}: {
  body: string;
  locale: Locale;
  childId?: string;
  returnTo?: ReturnTo;
}) {
  return (
    <>
      {body
        .trim()
        .split(/\n\s*\n/)
        .map((block, index) => {
          const lines = block.split('\n');
          const heading = lines[0].match(/^(#{2,4})\s+(.+)/);
          if (heading) {
            const Tag =
              heading[1].length === 2
                ? 'h2'
                : heading[1].length === 3
                  ? 'h3'
                  : 'h4';
            return (
              <Tag key={index}>
                {inline(heading[2], locale, childId, returnTo)}
              </Tag>
            );
          }
          if (lines[0].startsWith('|') && lines.length > 2) {
            const rows = lines
              .filter((_, i) => i !== 1)
              .map((line) =>
                line
                  .replace(/^\||\|$/g, '')
                  .split('|')
                  .map((c) => c.trim()),
              );
            return (
              <div className="legal-table" key={index}>
                <table>
                  <thead>
                    <tr>
                      {rows[0].map((cell, i) => (
                        <th key={i}>
                          {inline(cell, locale, childId, returnTo)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(1).map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>
                            {inline(cell, locale, childId, returnTo)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          if (lines.every((line) => /^[-*]\s/.test(line)))
            return (
              <ul key={index}>
                {lines.map((line, i) => (
                  <li key={i}>
                    {inline(line.slice(2), locale, childId, returnTo)}
                  </li>
                ))}
              </ul>
            );
          return (
            <p key={index}>
              {inline(block.replace(/\n/g, ' '), locale, childId, returnTo)}
            </p>
          );
        })}
    </>
  );
}
