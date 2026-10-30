import { openFamilyInvitation } from './join-actions';
import type { Locale } from '@/lib/domain';

export function FamilyJoinEntry({
  locale,
  settings = false,
}: {
  locale: Locale;
  settings?: boolean;
}) {
  const ko = locale === 'ko';
  return (
    <form
      action={openFamilyInvitation}
      className="form-stack family-join-entry"
    >
      <input type="hidden" name="locale" value={locale} />
      <input
        type="hidden"
        name="settings"
        value={settings ? 'true' : 'false'}
      />
      <p className="small muted">
        {ko
          ? '먼저 사용 중인 가족에게 초대 링크를 받아 주세요.'
          : 'Ask a family member already using podoong for an invitation link.'}
      </p>
      <label>
        {ko ? '가족 초대 링크 또는 코드' : 'Family invitation link or code'}
        <input
          name="invitation"
          type="text"
          required
          maxLength={2048}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://…/invite/…"
        />
      </label>
      <p className="small muted">
        {ko
          ? '참여할 가족과 기존 아이 정보를 다음 화면에서 확인합니다. 기존 기록은 자동 삭제하지 않습니다.'
          : 'Review the destination family and your existing children next. Existing records are not deleted automatically.'}
      </p>
      <button className="button primary">
        {ko ? '초대 확인하기' : 'Review invitation'}
      </button>
    </form>
  );
}
