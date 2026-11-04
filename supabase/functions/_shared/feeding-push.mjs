import { deliverPushBatch } from './push-delivery.mjs';
export { validPushEndpoint } from './push-delivery.mjs';
export function feedingPushPayload(job) {
  const ko = job.locale === 'ko';
  if (job.reference === 'yesterday') {
    const names = ko
      ? { breast: '모유', formula: '분유', solids: '이유식' }
      : { breast: 'breast milk', formula: 'formula', solids: 'solids' };
    const meal = names[job.meal_kind] ?? (ko ? '식사' : 'a feed');
    return {
      title: ko
        ? `어제 이 시간에 ${meal} 먹었어요`
        : `Yesterday at this time: ${meal}`,
      body: ko
        ? '어제의 기록이에요. 오늘 아이의 식사 리듬을 살펴보세요.'
        : 'A reference to yesterday’s record. Check your child’s rhythm today.',
      tag: `feeding:${job.child_id}`,
      url: `/${ko ? 'ko' : 'en'}/today?child=${job.child_id}`,
    };
  }
  return {
    title: ko ? '다음 먹이기 시간이에요' : 'Time for the next feed',
    body: ko
      ? '아기의 식사 시간을 확인해 주세요.'
      : 'Check your baby’s next feeding time.',
    tag: `feeding:${job.child_id}`,
    url: `/${ko ? 'ko' : 'en'}/today?child=${job.child_id}`,
  };
}
export function deliverFeedingPush(db, token, send, report) {
  return deliverPushBatch(db, token, send, {
    claim: 'claim_feeding_push',
    validate: 'validate_feeding_push',
    finish: 'finish_feeding_push',
    payload: feedingPushPayload,
    report,
  });
}
