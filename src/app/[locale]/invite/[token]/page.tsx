import { RelationshipField } from '@/features/family/relationship-field';
import { familyJoinPreview } from '@/features/family/join-model';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { acceptInvite } from '@/features/family/actions';
import { BrandImage } from '@/components/brand-image';
import type { Locale } from '@/lib/domain';

export default async function Invitation({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, token } = await params;
  const { error } = await searchParams;
  const ko = locale === 'ko';
  const path = `/${locale}/invite/${token}`;
  const { db, user } = await requireUser(locale);
  const profile = await db
    .from('profiles')
    .select('consented_at')
    .eq('id', user.id)
    .maybeSingle();
  if (profile.error) throw new Error('Invitation profile unavailable');
  if (!profile.data?.consented_at)
    redirect(`/${locale}/onboarding?next=${encodeURIComponent(path)}`);
  const result = /^[a-f0-9]{64}$/.test(token)
    ? await db.rpc('family_join_preview', { p_token: token })
    : null;
  const parsed = familyJoinPreview.safeParse(
    result?.error ? null : result?.data,
  );
  const preview = parsed.success ? parsed.data : null;
  const importing =
    preview?.sources.filter((source) => source.role === 'owner') ?? [];
  const retained =
    preview?.sources.filter((source) => source.role !== 'owner') ?? [];

  return (
    <main className="onboarding-page">
      <section className="onboard-card family-join-review">
        <BrandImage />
        <h1>{ko ? '가족에 참여하기' : 'Join your family'}</h1>
        {!preview ? (
          <p role="alert">
            {ko
              ? '사용할 수 없는 초대입니다. 가족에게 새 초대 링크를 요청해 주세요.'
              : 'This invitation is unavailable. Ask your family for a new link.'}
          </p>
        ) : (
          <>
            <div className="family-join-destination">
              <span className="small muted">
                {ko ? '참여할 가족' : 'Destination family'}
              </span>
              <strong>{preview.target.name}</strong>
              <span>
                {preview.target.child_name} ·{' '}
                {preview.target.role === 'editor'
                  ? ko
                    ? '기록 가능'
                    : 'Can edit'
                  : ko
                    ? '보기 전용'
                    : 'View only'}
              </span>
            </div>
            {importing.length > 0 && (
              <section className="family-join-scope">
                <h2>{ko ? '함께 옮길 아이' : 'Children to bring with you'}</h2>
                {importing.map((source) => (
                  <div key={source.id}>
                    <strong>{source.name}</strong>
                    <ul>
                      {source.children.map((child) => (
                        <li key={child.id}>{child.name}</li>
                      ))}
                    </ul>
                    {source.children.length === 0 && (
                      <p className="small muted">
                        {ko
                          ? '등록된 아이가 없어요.'
                          : 'No registered children.'}
                      </p>
                    )}
                  </div>
                ))}
                <p>
                  {ko
                    ? '아이별 돌봄 기록·일기·사진·일정은 그대로 보존됩니다. 이름과 생일이 같아도 별개의 아이 항목으로 유지합니다.'
                    : 'Care records, diaries, photos and schedules are preserved for each child. Even matching names and birth dates remain separate child entries.'}
                </p>
                <p className="small muted">
                  {ko
                    ? '참여할 가족의 관리자가 옮긴 아이의 정보를 함께 관리하게 됩니다. 주소는 참여할 가족의 설정을 사용하며, 중복 아이의 삭제는 참여 후 가족관리자가 직접 결정합니다.'
                    : 'The destination family administrator will be able to manage these children. The destination family’s address is used. Afterwards, its administrator can review and delete duplicate children manually.'}
                </p>
              </section>
            )}
            {retained.length > 0 && (
              <p className="small muted">
                {ko
                  ? '다른 가족의 보호자로 참여 중인 아이와 접근 권한은 그대로 유지됩니다. 그 가족의 아이를 임의로 옮기지 않습니다.'
                  : 'Your caregiver access in other families stays unchanged. Their children are not moved.'}
              </p>
            )}
            {error && (
              <p role="alert" className="small">
                {error === 'changed'
                  ? ko
                    ? '가족 정보가 변경됐습니다. 아래 아이 목록을 다시 확인해 주세요.'
                    : 'Family information changed. Review the refreshed child list below.'
                  : ko
                    ? '참여하지 못했어요. 기존 아이와 기록은 그대로 유지됩니다. 초대와 가족 상태를 확인해 주세요.'
                    : 'Unable to join. Existing children and records are unchanged. Check the invitation and family status.'}
              </p>
            )}
            {preview.blocked ? (
              <div className="family-join-guidance">
                <p>
                  {preview.target.role === 'viewer'
                    ? ko
                      ? '아이를 함께 옮기려면 기록 가능한 보호자 초대가 필요합니다. 가족관리자에게 새 초대를 요청해 주세요.'
                      : 'An editor invitation is needed to bring children. Ask the administrator for a new invitation.'
                    : ko
                      ? '기존 가족에 다른 보호자가 남아 있습니다. 함께 사용하는 아이를 옮기기 전에 보호자 설정에서 접근 권한을 정리해 주세요.'
                      : 'Other caregivers remain in your existing family. Review their access in caregiver settings before moving shared children.'}
                </p>
                <Link
                  href={`/${locale}/account?panel=family`}
                  className="button secondary"
                >
                  {ko ? '보호자 설정' : 'Caregiver settings'}
                </Link>
              </div>
            ) : (
              <form action={acceptInvite} className="form-stack">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="revision" value={preview.revision} />
                <RelationshipField locale={locale} />
                <label className="check-label">
                  <input type="checkbox" name="confirm" required />
                  {importing.length > 0
                    ? ko
                      ? '기존 기록을 보존해 아이들을 이 가족으로 옮기는 데 동의합니다.'
                      : 'I agree to bring these children into this family with their existing records preserved.'
                    : ko
                      ? '이 가족에 보호자로 참여하는 데 동의합니다.'
                      : 'I agree to join this family as a caregiver.'}
                </label>
                <button className="button primary">
                  {importing.length > 0
                    ? ko
                      ? '아이 정보 보존하고 참여하기'
                      : 'Join and preserve child records'
                    : ko
                      ? '가족에 참여하기'
                      : 'Join family'}
                </button>
              </form>
            )}
          </>
        )}
        <Link href={`/${locale}/today`} className="text-link">
          {ko ? '돌아가기' : 'Back'}
        </Link>
      </section>
    </main>
  );
}
