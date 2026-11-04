import { ChevronDown } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import './posts.css';

export function CommunityWelcome({
  neighborhood,
  locale,
  expanded,
}: {
  neighborhood?: string;
  locale: Locale;
  expanded: boolean;
}) {
  const ko = locale === 'ko';
  return (
    <details className="community-welcome" open={expanded}>
      <summary>
        <strong>
          {neighborhood
            ? ko
              ? `[운영자] ${neighborhood} 부모님, 반가워요 👋`
              : `[From the founder] Hello, parents of ${neighborhood} 👋`
            : ko
              ? '[운영자] 함께 육아 이야기 나눠요 👋'
              : '[From the founder] Let’s share our parenting stories 👋'}
        </strong>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="community-welcome-body">
        <p>
          {ko
            ? '2026년생 딸을 키우며 포둥을 만드는 아빠 운영자입니다.'
            : 'I’m a dad raising a daughter born in 2026, and the founder of podoong.'}
          {neighborhood && (
            <>
              <br />
              {ko
                ? '가까이 사는 부모님들이 육아 이야기를 편하게 나눌 수 있도록 이 공간을 만들었어요.'
                : 'I created this space so parents living nearby can comfortably share their parenting stories.'}
            </>
          )}
        </p>
        <p>
          {neighborhood
            ? ko
              ? '아이와 걷기 좋은 길, 어린이집·유치원 궁금증, 소소한 동네 일상까지 함께 나눠주세요.'
              : 'Share your favorite walks with your child, questions about daycare or preschool, and little moments from neighborhood life.'
            : ko
              ? '육아하다 궁금한 게 생기거나, 작은 변화를 누군가에게 자랑하고 싶을 때 편하게 글을 남겨주세요. 오늘 먹인 이유식 이야기부터 아이와 다녀온 나들이, 혼자 고민하던 질문까지 모두 환영해요.'
              : 'Share a question about parenting or a little change you’re excited about. From today’s baby food to an outing with your child or a question you’ve been wondering about, every story is welcome.'}
        </p>
        {!neighborhood && (
          <p>
            {ko
              ? '아이마다 자라는 속도도, 가족마다 돌보는 방법도 다르니 서로의 경험을 존중하며 이야기 나눠요.'
              : 'Every child grows at their own pace, and every family cares in their own way. Let’s respect each other’s experiences as we talk.'}
          </p>
        )}
        <p>
          {neighborhood
            ? ko
              ? '첫 이야기로 '
              : 'For your first story, tell us about '
            : ko
              ? '처음 오셨다면 '
              : 'If you’re new here, share '}
          <strong>
            {neighborhood
              ? ko
                ? '“아이와 요즘 자주 가는 곳”'
                : '“a place you and your child often visit”'
              : ko
                ? '“요즘 가장 궁금한 육아 이야기”'
                : '“a parenting question on your mind”'}
          </strong>
          {neighborhood
            ? ko
              ? '을 소개해 주실래요?'
              : '.'
            : ko
              ? ' 하나를 남겨주실래요?'
              : '.'}
        </p>
      </div>
    </details>
  );
}
