import type { Locale } from '@/lib/domain';
export function familyInviteCopy(locale: Locale) {
  return locale === 'ko'
    ? {
        title: '가족을 초대합니다 · 포둥',
        description:
          '언제 먹었는지, 얼마나 잤는지. 포둥에서 같은 기록을 보고 함께 돌봐요.',
        security: '한 사람만 참여할 수 있는 1회용 링크예요. 7일 뒤 만료되며, 초대할 가족에게만 보내주세요.',
        benefits: [
          '최근 식사·수면을 함께 확인해요.',
          '누가 남긴 기록인지, 메모와 함께 봐요.',
          '함께 돌본 하루를 성장일기로 남겨요.',
        ],
      }
    : {
        title: 'You’re invited to join your family · podoong',
        description:
          'See the latest feeding and sleep records, take turns caring, and remember those days together on podoong.',
        security: 'This link can be accepted once by one person and expires in 7 days. Send it only to the family member you want to invite.',
        benefits: [
          'Check the latest feeding and sleep records.',
          'See who recorded each moment and their notes.',
          'Keep your shared days in a growth diary.',
        ],
      };
}
