import { ChevronDown } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import './posts.css';

export function CommunityWelcome({
  neighborhood,
  locale,
  expanded,
  founders,
  reopened,
}: {
  neighborhood: string;
  locale: Locale;
  expanded: boolean;
  founders: string[];
  reopened: boolean;
}) {
  const ko = locale === 'ko';
  return (
    <details className="community-welcome" open={expanded}>
      <summary>
        <strong>
          {ko
            ? `[운영자] ${neighborhood} 부모님, 반가워요 👋`
            : `[From the founder] Hello, parents of ${neighborhood} 👋`}
        </strong>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="community-welcome-body">
        {founders.length > 0 && (
          <p>
            {ko
              ? `${founders.join(', ')} 가족 덕분에 ${neighborhood} 이야기가 ${reopened ? '다시 열렸어요' : '열렸어요'}. 함께해 주셔서 감사합니다 🌱`
              : `Thanks to ${founders.join(', ')}, stories in ${neighborhood} ${reopened ? 'have reopened' : 'are now open'}. Thank you for joining us 🌱`}
          </p>
        )}
        <p>
          {ko
            ? '2026년생 딸을 키우며 포둥을 만드는 아빠 운영자입니다.'
            : 'I’m a dad raising a daughter born in 2026, and the founder of podoong.'}
          <br />
          {ko
            ? '가까이 사는 부모님들이 육아 이야기를 편하게 나눌 수 있도록 이 공간을 만들었어요.'
            : 'I created this space so parents living nearby can comfortably share their parenting stories.'}
        </p>
        <p>
          {ko
            ? '아이와 걷기 좋은 길, 어린이집·유치원 궁금증, 소소한 동네 일상까지 함께 나눠주세요.'
            : 'Share your favorite walks with your child, questions about daycare or preschool, and little moments from neighborhood life.'}
        </p>
        <p>
          {ko ? '첫 이야기로 ' : 'For your first story, tell us about '}
          <strong>
            {ko
              ? '“아이와 요즘 자주 가는 곳”'
              : '“a place you and your child often visit”'}
          </strong>
          {ko ? '을 소개해 주실래요?' : '.'}
        </p>
      </div>
    </details>
  );
}
