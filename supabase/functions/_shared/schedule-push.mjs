import { deliverPushBatch } from './push-delivery.mjs';
export function schedulePushPayload(job) {
  const ko = job.locale === 'ko';
  return {
    title: ko ? '오늘의 일정을 확인해 보세요' : 'Your plans for today',
    body: ko
      ? `오늘 일정과 할 일이 ${Number(job.item_count)}개 있어요. 눌러서 확인해 보세요.`
      : `You have ${Number(job.item_count)} plans and tasks today. Open to see them.`,
    tag: `schedule:${job.day}`,
    url: `/${ko ? 'ko' : 'en'}/calendar?agenda=${job.day}`,
  };
}
export async function deliverSchedulePush(db, token, send) {
  const count = { sent: 0, retry: 0, gone: 0, cancelled: 0 };
  const deadline = Date.now() + 60_000;
  do {
    const batch = await deliverPushBatch(db, token, send, {
      claim: 'claim_schedule_push',
      validate: 'validate_schedule_push',
      finish: 'finish_schedule_push',
      payload: schedulePushPayload,
    });
    for (const key of Object.keys(count)) count[key] += batch[key];
    if (batch.retry || Object.values(batch).reduce((sum, n) => sum + n, 0) < 10)
      break;
  } while (Date.now() < deadline);
  return count;
}
