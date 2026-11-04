import { deliverPushBatch } from './push-delivery.mjs';
export function playgroundPushPayload(job) {
  const ko = job.locale === 'ko',
    waves = Number(job.wave_count),
    hearts = Number(job.heart_count);
  return {
    title: ko
      ? '동네 친구의 마음이 도착했어요'
      : 'A little kindness from the playground',
    body: ko
      ? [waves ? `인사 ${waves}개` : '', hearts ? `하트 ${hearts}개` : '']
          .filter(Boolean)
          .join(' · ') + '를 받았어요. 놀이터에서 확인해 보세요.'
      : [
          waves ? `${waves} wave${waves === 1 ? '' : 's'}` : '',
          hearts ? `${hearts} heart${hearts === 1 ? '' : 's'}` : '',
        ]
          .filter(Boolean)
          .join(' · ') + '. Open the playground to see who sent them.',
    tag: `playground:${job.child_id}`,
    url: `/${ko ? 'ko' : 'en'}/community/playground?child=${job.child_id}&inbox=1`,
  };
}
export function deliverPlaygroundPush(db, token, send) {
  return deliverPushBatch(db, token, send, {
    claim: 'claim_playground_push',
    validate: 'validate_playground_push',
    finish: 'finish_playground_push',
    payload: playgroundPushPayload,
  });
}
