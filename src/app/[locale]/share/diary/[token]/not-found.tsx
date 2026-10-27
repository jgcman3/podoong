'use client';
import { useParams } from 'next/navigation';
import {
  SharedDiaryFrame,
  SharedDiaryHeading,
} from '@/features/growth-community/shared-diary-frame';
import { SharedDiaryInvite } from '@/features/growth-community/shared-diary-invite';
export default function MissingDiary() {
  const { locale } = useParams<{ locale: string }>();
  const ko = locale !== 'en';
  return (
    <SharedDiaryFrame ko={ko}>
      <SharedDiaryHeading
        title={
          ko
            ? '공유가 종료되었거나 없는 일기예요'
            : 'This diary link is no longer available'
        }
        description={
          ko
            ? '이 일기의 공유가 종료되었어요. 새로운 공유 링크를 확인해 주세요.'
            : 'Sharing has ended. Please ask for a new link.'
        }
      />
      <SharedDiaryInvite ko={ko} />
    </SharedDiaryFrame>
  );
}
