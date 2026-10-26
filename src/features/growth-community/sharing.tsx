import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { Submit } from '@/features/child-care/form';
import { shareGrowthDiary } from './actions';
export async function DiarySharing({
  context,
  recordId,
  locale,
}: {
  context: CareContext;
  recordId: string;
  locale: Locale;
}) {
  const { data, error } = await context.db
    .from('growth_diary_shares')
    .select('same_birth_date,everyone')
    .eq('record_id', recordId)
    .maybeSingle();
  if (error) throw new Error('Diary sharing unavailable');
  const ko = locale === 'ko';
  return (
    <section className="panel diary-sharing">
      <h2>{ko ? '성장일기 공개' : 'Share growth diary'}</h2>
      <form action={shareGrowthDiary} className="form-stack">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="record" value={recordId} />
        <input type="hidden" name="child" value={context.child.id} />
        <label>
          {ko ? '성별' : 'Sex'}
          <select name="sex" defaultValue={context.child.sex ?? ''}>
            <option value="">{ko ? '선택하지 않음' : 'Not specified'}</option>
            <option value="female">{ko ? '여아' : 'Girl'}</option>
            <option value="male">{ko ? '남아' : 'Boy'}</option>
          </select>
        </label>
        <label className="diary-share-option">
          <input
            type="checkbox"
            name="birth"
            defaultChecked={data?.same_birth_date}
            disabled={!context.child.birth_date}
          />
          <span>
            <strong>
              {ko ? '출생일별 성장일기' : 'Same-birthday diaries'}
            </strong>
            <small>
              {ko
                ? '같은 출생일의 아이 가족에게 아이 이름·몸무게·키·머리둘레·성별·글·사진 공개'
                : 'Share the child’s nickname, measurements, sex, text and photos with families of children born on the same date.'}
            </small>
          </span>
        </label>
        <label className="diary-share-option">
          <input
            type="checkbox"
            name="all"
            defaultChecked={data?.everyone}
            disabled={!context.child.birth_date}
          />
          <span>
            <strong>{ko ? '전체 성장일기' : 'All growth diaries'}</strong>
            <small>
              {ko
                ? '커뮤니티 회원에게 아이 이름·성별·기록 당시 D+일수·글·사진 공개'
                : 'Share the child’s nickname, sex, age at the time of the entry, text and photos with community members.'}
            </small>
          </span>
        </label>
        {!context.child.birth_date && (
          <p>
            {ko
              ? '출생일을 등록하면 공개할 수 있어요.'
              : 'Add a birth date to share this diary.'}
          </p>
        )}
        <p className="small muted">
          {ko
            ? '선택하지 않으면 가족에게만 보여요. 공개한 기록의 글·사진을 수정하면 공개 내용에도 반영돼요.'
            : 'Unchecked entries remain private to your family. Edits to shared text and photos also update the public entry.'}
        </p>
        <Submit label={ko ? '공개 설정 저장' : 'Save sharing settings'} />
      </form>
    </section>
  );
}
