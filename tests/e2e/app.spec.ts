import { test, expect, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const fileEnv = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((v) => v && !v.startsWith('#'))
    .map((v) => {
      const i = v.indexOf('=');
      return [v.slice(0, i), v.slice(i + 1)];
    }),
);
const env = { ...fileEnv, ...process.env };
if (env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:55321')
  throw new Error('E2E tests only mutate the local podung database');
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const createdUsers: string[] = [];
const createdFamilies: string[] = [];
const createdPolls: string[] = [];
const createdPhotos: string[] = [];
const createdChildPhotos: string[] = [];

async function signIn(context: BrowserContext) {
  const email = `test-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error('Local test user creation failed');
  createdUsers.push(data.user.id);
  // Await cookie writes explicitly after the password session is created.
  const cookies: Array<{
    name: string;
    value: string;
    url: string;
    sameSite: 'Lax';
  }> = [];
  const sessionClient = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: (values) => {
          cookies.push(
            ...values.map((c) => ({
              name: c.name,
              value: c.value,
              url: 'http://127.0.0.1:3187',
              sameSite: 'Lax' as const,
            })),
          );
        },
      },
    },
  );
  const result = await sessionClient.auth.signInWithPassword({
    email,
    password,
  });
  if (result.error) throw new Error('Local test sign-in failed');
  await context.addCookies(cookies);
  return data.user.id;
}
test.afterEach(async () => {
  if (createdChildPhotos.length)
    await admin.storage.from('child-care-photos').remove(createdChildPhotos);
  createdChildPhotos.length = 0;
  if (createdPhotos.length)
    await admin.storage.from('community-photos').remove(createdPhotos);
  for (const id of createdPolls)
    await admin.from('daily_polls').delete().eq('id', id);
  createdPhotos.length = 0;
  createdPolls.length = 0;
  for (const user of createdUsers) {
    const { data } = await admin
      .from('family_members')
      .select('family_id')
      .eq('user_id', user)
      .eq('role', 'owner');
    createdFamilies.push(...(data ?? []).map((v) => v.family_id));
  }
  for (const id of new Set(createdFamilies))
    await admin.from('families').delete().eq('id', id);
  for (const id of createdUsers) {
    const photos = await admin
      .from('community_photos')
      .select('path')
      .eq('owner_id', id);
    if (photos.data?.length)
      await admin.storage
        .from('community-photos')
        .remove(photos.data.map((photo) => photo.path));
    await admin.auth.admin.deleteUser(id);
  }
  createdUsers.length = 0;
  createdFamilies.length = 0;
});

async function childCareFamily(context: BrowserContext) {
  const owner = await signIn(context);
  await admin.from('profiles').insert({
    id: owner,
    display_name: 'Care test',
    consented_at: new Date().toISOString(),
  });
  const { data: family, error } = await admin
    .from('families')
    .insert({ name: 'Care test family' })
    .select('id')
    .single();
  if (error || !family) throw new Error('Family fixture failed');
  createdFamilies.push(family.id);
  await admin
    .from('family_members')
    .insert({ family_id: family.id, user_id: owner, role: 'owner' });
  const child = crypto.randomUUID();
  await admin.from('children').insert({
    id: child,
    family_id: family.id,
    name: '돌봄 아이',
    birth_date: '2026-01-01',
  });
  return { owner, family: family.id, child };
}

async function setFamilyResidence(family: string, code: string) {
  const region = await admin
    .from('residence_regions')
    .select('city_name,locality_name')
    .eq('country_code', 'KR')
    .eq('code', code)
    .single();
  if (region.error) throw new Error('Region fixture missing');
  const result = await admin
    .from('families')
    .update({
      residence_country_code: 'KR',
      residence_region_code: code,
      residence_city: region.data.city_name,
      residence_locality: region.data.locality_name,
    })
    .eq('id', family);
  if (result.error) throw new Error('Residence fixture failed');
}

test('family residence persists across children and sessions, respects family roles and can be cleared', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const { child, family, owner } = await childCareFamily(context);
  await page.goto(`/ko/family?child=${child}`);
  const panel = page.locator('.family-residence');
  await expect(
    panel.getByRole('combobox', { name: '시·군·구', exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole('combobox', { name: '시·도', exact: true })
    .selectOption('11');
  await panel
    .getByRole('combobox', { name: '시·군·구', exact: true })
    .selectOption('11680');
  await panel
    .getByRole('combobox', { name: '읍·면·동', exact: true })
    .selectOption('1168010100');
  await panel
    .getByRole('button', { name: '거주지역 저장', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('저장했어요.');
  await page.reload();
  await expect(
    panel.getByRole('combobox', { name: '시·군·구', exact: true }),
  ).toHaveValue('11680');
  await expect(
    panel.getByRole('combobox', { name: '읍·면·동', exact: true }),
  ).toHaveValue('1168010100');
  const stored = await admin
    .from('families')
    .select(
      'residence_city,residence_locality,residence_version,residence_country_code,residence_region_code',
    )
    .eq('id', family)
    .single();
  expect(stored.data).toEqual({
    residence_city: '서울특별시 강남구',
    residence_locality: '역삼동',
    residence_version: 1,
    residence_country_code: 'KR',
    residence_region_code: '1168010100',
  });
  const sibling = crypto.randomUUID();
  await admin.from('children').insert({
    id: sibling,
    family_id: family,
    name: '둘째',
    birth_date: '2026-01-01',
  });
  await page.goto(`/ko/family?child=${sibling}`);
  await expect(
    panel.getByRole('combobox', { name: '읍·면·동', exact: true }),
  ).toHaveValue('1168010100');
  const otherFamily = crypto.randomUUID();
  const otherChild = crypto.randomUUID();
  createdFamilies.push(otherFamily);
  await admin
    .from('families')
    .insert({ id: otherFamily, name: 'Other family' });
  await admin
    .from('family_members')
    .insert({ family_id: otherFamily, user_id: owner, role: 'owner' });
  await admin.from('children').insert({
    id: otherChild,
    family_id: otherFamily,
    name: 'Other child',
    birth_date: '2026-01-01',
  });
  await page.goto(`/ko/family?child=${otherChild}`);
  await expect(
    panel.getByRole('combobox', { name: '시·군·구', exact: true }),
  ).toHaveValue('');
  await expect(
    panel.getByRole('combobox', { name: '읍·면·동', exact: true }),
  ).toHaveValue('');
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Location viewer',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      child_id: child,
      family_id: family,
      user_id: reader,
      role: 'viewer',
    });
    const readerPage = await readerContext.newPage();
    await readerPage.goto(`/en/family?child=${child}`);
    const readerPanel = readerPage.locator('.family-residence');
    await expect(
      readerPanel.getByText('서울특별시 강남구 역삼동', { exact: true }),
    ).toBeVisible();
    await expect(readerPanel.locator('input')).toHaveCount(0);
    await expect(
      readerPanel.getByRole('button', { name: 'Save residence', exact: true }),
    ).toHaveCount(0);
  } finally {
    await readerContext.close();
  }
  await page.goto(`/ko/family?child=${child}`);
  await panel
    .getByRole('combobox', { name: '시·도', exact: true })
    .selectOption('41');
  await expect(
    panel.getByRole('combobox', { name: '시·군·구', exact: true }),
  ).toHaveValue('');
  await expect(
    panel.getByRole('combobox', { name: '읍·면·동', exact: true }),
  ).toHaveValue('');
  await expect(
    panel.getByRole('button', { name: '거주지역 저장', exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole('combobox', { name: '시·군·구', exact: true })
    .selectOption('41830');
  await panel
    .getByRole('combobox', { name: '읍·면·동', exact: true })
    .selectOption('4183033000');
  await panel
    .getByRole('button', { name: '거주지역 저장', exact: true })
    .click();
  await expect(
    panel.getByRole('combobox', { name: '읍·면·동', exact: true }),
  ).toHaveValue('4183033000');
  await expect(panel.locator('input[name="version"]')).toHaveValue('2');
  await panel.screenshot({ path: 'test-results/family-residence-desktop.png' });
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({ path: 'test-results/family-residence-390.png' });
  await panel
    .getByRole('button', { name: '거주지역 삭제', exact: true })
    .click();
  await panel
    .getByRole('button', { name: '거주지역 저장', exact: true })
    .click();
  await expect
    .poll(async () => {
      const result = await admin
        .from('families')
        .select('residence_city,residence_locality')
        .eq('id', family)
        .single();
      return result.data;
    })
    .toEqual({ residence_city: null, residence_locality: null });
});

test('calendar uses paged lists and Today groups all care shortcuts with relative dates', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const { child, family, owner } = await childCareFamily(context);
  const events = Array.from({ length: 120 }, (_, i) => ({
    id: crypto.randomUUID(),
    child_id: child,
    title: `목록 일정 ${i + 1}`,
    date: '2026-12-15',
    created_by: owner,
  }));
  expect((await admin.from('events').insert(events)).error).toBeNull();
  expect(
    (
      await admin.from('tasks').insert([
        {
          id: crypto.randomUUID(),
          child_id: child,
          title: '날짜 없는 준비',
          service: 'birth',
          created_by: owner,
        },
      ])
    ).error,
  ).toBeNull();
  await page.goto(`/ko/calendar?child=${child}&month=2026-12&day=2026-12-15`);
  await expect(page.locator('.month-calendar')).toHaveCount(0);
  await expect(page.locator('.calendar-event')).toHaveCount(100);
  await expect(page.getByText('날짜 없는 준비', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '다음 기록', exact: true }).click();
  await expect(page.locator('.calendar-event')).toHaveCount(20);
  await page.getByRole('link', { name: '이전 기록', exact: true }).click();
  await page.getByText('일정 추가', { exact: true }).click();
  const form = page
    .locator('.add-details form')
    .filter({ has: page.locator('textarea[name="note"]') });
  await form.getByLabel('제목', { exact: true }).fill('목록에서 새 일정');
  await form.getByLabel('날짜', { exact: true }).fill('2026-12-14');
  await form.getByRole('button', { name: '저장하기', exact: true }).click();
  const entry = page
    .locator('.calendar-event')
    .filter({ hasText: '목록에서 새 일정' });
  await expect(entry).toBeVisible();
  await entry.getByText('수정', { exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await entry.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByText('목록에서 새 일정', { exact: true })).toHaveCount(
    0,
  );
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const offset = (days: number) =>
    new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000)
      .toISOString()
      .slice(0, 10);
  await admin.from('events').delete().eq('child_id', child);
  await admin.from('events').insert(
    [0, 1, 3].map((n) => ({
      id: crypto.randomUUID(),
      child_id: child,
      title: `남은 날 ${n}`,
      date: offset(n),
      created_by: owner,
    })),
  );
  await page.goto(`/ko/today?child=${child}`);
  for (const [n, label] of [
    [0, '오늘'],
    [1, '내일'],
    [3, '3일 후'],
  ] as const)
    await expect(
      page
        .locator('.event-tile')
        .filter({ hasText: `남은 날 ${n}` })
        .locator('.event-countdown'),
    ).toHaveText(label);
  await expect(page.locator('.quick-grid a')).toHaveCount(6);
  await expect(
    page.getByRole('heading', { name: '최근 돌봄', exact: true }),
  ).toHaveCount(0);
  for (const [label, service] of [
    ['수면', 'sleep'],
    ['기저귀·배변', 'diaper'],
    ['성장·발달', 'growth'],
  ] as const)
    await expect(
      page
        .locator('.quick-grid')
        .getByRole('link', { name: label, exact: true }),
    ).toHaveAttribute('href', `/ko/care/${service}/new?child=${child}`);
  await page
    .locator('.quick-grid')
    .getByRole('link', { name: '수면', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '수면 · 기록하기', exact: true }),
  ).toBeVisible();
  await page.goto(`/ko/today?child=${child}`);
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator('.quick-grid')
    .screenshot({ path: 'test-results/quick-care-390.png' });
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Care reader',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      child_id: child,
      family_id: family,
      user_id: reader,
      role: 'viewer',
    });
    const readerPage = await readerContext.newPage();
    await readerPage.goto(`/en/today?child=${child}`);
    await expect(
      readerPage
        .locator('.quick-grid')
        .getByRole('link', { name: 'Sleep', exact: true }),
    ).toHaveAttribute('href', `/en/services/sleep?child=${child}`);
    await readerPage.goto(`/en/calendar?child=${child}`);
    await expect(readerPage.locator('.calendar-event')).toHaveCount(3);
    await expect(readerPage.locator('.add-details')).toHaveCount(0);
  } finally {
    await readerContext.close();
  }
});

test('vaccination plans, completion history, official guidance and readonly access work together', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  const { child, family } = await childCareFamily(context);
  await page.goto(`/ko/services/vaccination?child=${child}`);
  await expect(
    page.getByRole('heading', { name: '예방접종·독감', exact: true }),
  ).toBeVisible();
  await expect(page.locator('input[name="scheduled"]')).toHaveCount(0);
  await page.getByRole('link', { name: '접종 기록하기', exact: true }).click();
  await page.getByLabel('독감 절기', { exact: true }).fill('2026-2027');
  await page
    .getByRole('combobox', { name: '차수', exact: true })
    .selectOption('1');
  await page.getByLabel('예정일', { exact: true }).fill('2026-10-21');
  await page.getByLabel('병원·접종 기관', { exact: true }).fill('가족 소아과');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '독감(인플루엔자)', exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  const stored = await admin
    .from('vaccination_records')
    .select('*')
    .eq('id', id)
    .single();
  expect(stored.data).toMatchObject({
    child_id: child,
    vaccine: 'influenza',
    season: '2026-2027',
    dose: 1,
    status: 'planned',
    scheduled_date: '2026-10-21',
    completed_date: null,
  });
  await page.goto(`/ko/today?child=${child}`);
  await expect(
    page.getByRole('link', {
      name: '2026-10-21 · 독감(인플루엔자)',
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`/ko/calendar?child=${child}`);
  await expect(
    page.getByRole('link', {
      name: '2026-10-21 · 독감(인플루엔자)',
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`/ko/vaccination/${id}?child=${child}`);
  await page.getByRole('link', { name: '수정', exact: true }).click();
  await page
    .getByRole('combobox', { name: '상태', exact: true })
    .selectOption('completed');
  await page.getByLabel('실제 접종일', { exact: true }).fill('2026-10-01');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/ko/vaccination/${id}\\?`));
  await page.getByRole('link', { name: '기록 목록', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '독감(인플루엔자)', exact: true }),
  ).toBeVisible();
  await page.goto(`/ko/services/vaccination?child=${child}&tab=planned`);
  await expect(
    page.getByRole('heading', { name: '독감(인플루엔자)', exact: true }),
  ).toHaveCount(0);
  const exported = await (
    await page.request.get(`/api/data/export?child=${child}`)
  ).json();
  expect(exported.vaccinations).toEqual([
    expect.objectContaining({
      id,
      status: 'completed',
      completed_date: '2026-10-01',
    }),
  ]);
  expect(exported.vaccinations[0]).not.toHaveProperty('created_by');
  await page.getByRole('link', { name: '공식 안내', exact: true }).click();
  await expect(
    page.getByRole('link', { name: '표준 예방접종 일정표 ↗', exact: true }),
  ).toHaveAttribute('href', /menuCd=115/);
  await expect(
    page.getByRole('heading', {
      name: '독감은 절기별로 확인해요',
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/vaccination-guide-390.png',
    fullPage: true,
  });
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Vaccine viewer',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      child_id: child,
      family_id: family,
      user_id: reader,
      role: 'viewer',
    });
    const readerPage = await readerContext.newPage();
    await readerPage.goto(
      `/en/services/vaccination?child=${child}&tab=completed`,
    );
    await expect(
      readerPage.getByRole('heading', { name: 'Influenza (flu)', exact: true }),
    ).toBeVisible();
    await expect(
      readerPage.getByRole('link', { name: 'Add vaccination', exact: true }),
    ).toHaveCount(0);
    await readerPage.goto(`/en/vaccination/${id}?child=${child}`);
    await expect(
      readerPage.getByRole('link', { name: 'Edit', exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await readerPage.goto(`/en/vaccination/${id}/edit?child=${child}`)
      )?.status(),
    ).toBe(404);
  } finally {
    await readerContext.close();
  }
  await page.goto(`/ko/vaccination/${id}?child=${child}`);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page).toHaveURL(/\/ko\/services\/vaccination/);
  expect(
    (await admin.from('vaccination_records').select('id').eq('id', id)).data,
  ).toHaveLength(0);
});

test('sleep list leads to separate recording, rejects overlap and shares one timer per child', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const { child } = await childCareFamily(context);
  await page.goto(`/ko/services/sleep?child=${child}`);
  await expect(
    page.getByRole('heading', { name: '수면', exact: true }),
  ).toBeVisible();
  await expect(page.locator('input[name="occurredAt"]')).toHaveCount(0);
  await page.getByRole('link', { name: '기록하기', exact: true }).click();
  await page.getByLabel('잠든 시각').fill('2026-10-13T23:30');
  await page.getByLabel('잠잔 시간 (분)').fill('90');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '낮잠', exact: true }),
  ).toBeVisible();
  const napId = new URL(page.url()).pathname.split('/').at(-1)!;
  const stored = await admin
    .from('child_records')
    .select('*')
    .eq('id', napId)
    .single();
  expect(
    Date.parse(stored.data!.ended_at!) - Date.parse(stored.data!.occurred_at),
  ).toBe(90 * 60000);
  await page.goto(`/ko/care/sleep/new?child=${child}`);
  await page.getByLabel('잠든 시각').fill('2026-10-13T23:45');
  await page.getByLabel('잠잔 시간 (분)').fill('30');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.locator('.flash[role="alert"]')).toContainText(
    '시간이 겹칩니다',
  );
  await page.goto(`/ko/care/sleep/new?child=${child}`);
  await page.getByLabel('기록 종류').selectOption('night');
  await page.getByLabel('지금 자는 중').check();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '밤잠', exact: true }),
  ).toBeVisible();
  const timerId = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.goto(`/ko/care/sleep/new?child=${child}`);
  await page.getByLabel('지금 자는 중').check();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.locator('.flash[role="alert"]')).toContainText(
    '이미 진행 중',
  );
  await page.goto(`/ko/services/sleep?child=${child}`);
  await page.getByRole('link', { name: '잠 깨기', exact: true }).click();
  await page.getByRole('button', { name: '잠 깨기', exact: true }).click();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST', {
      timeout: 30000,
    }),
    page.getByRole('button', { name: '저장하기', exact: true }).click(),
  ]);
  await expect(page).toHaveURL(new RegExp(`/ko/care/sleep/${timerId}\\?`));
  const finished = await admin
    .from('child_records')
    .select('ended_at,version')
    .eq('id', timerId)
    .single();
  expect(finished.data!.ended_at).not.toBeNull();
  expect(finished.data!.version).toBe(2);
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/en/care/sleep/${timerId}\\?`));
  await expect(
    page.getByRole('heading', { name: 'Night sleep', exact: true }),
  ).toBeVisible();
});

test('diaper records persist stool observations, edit and delete through the family-scoped list', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const { child } = await childCareFamily(context);
  await page.goto(`/ko/services/diaper?child=${child}`);
  await expect(page.locator('textarea')).toHaveCount(0);
  await page.getByRole('link', { name: '기록하기', exact: true }).click();
  await page.getByLabel('기록 종류').selectOption('mixed');
  await page.getByLabel('대변 색').selectOption('brown');
  await page.getByLabel('대변 상태').selectOption('soft');
  await page.getByLabel('메모').fill('교체 후 편안해요');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '소변·대변', exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  const stored = await admin
    .from('child_records')
    .select('*')
    .eq('id', id)
    .single();
  expect(stored.data).toMatchObject({
    service: 'diaper',
    kind: 'mixed',
    stool_color: 'brown',
    stool_texture: 'soft',
  });
  await page.getByRole('link', { name: '수정', exact: true }).click();
  await page.getByLabel('기록 종류').selectOption('wet');
  await page.getByLabel('메모').fill('소변으로 수정');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '소변', exact: true }),
  ).toBeVisible();
  const changed = await admin
    .from('child_records')
    .select('*')
    .eq('id', id)
    .single();
  expect(changed.data).toMatchObject({
    kind: 'wet',
    stool_color: null,
    stool_texture: null,
    version: 2,
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page).toHaveURL(/\/ko\/services\/diaper/);
  expect(
    (await admin.from('child_records').select('id').eq('id', id)).data,
  ).toHaveLength(0);
});

test('growth measurements and diary photos remain private to the child and are cleaned on deletion', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(180000);
  const { child, family } = await childCareFamily(context);
  await page.goto(`/ko/services/growth?child=${child}`);
  await page.getByRole('link', { name: '기록하기', exact: true }).click();
  await page.getByLabel('키 (cm)').fill('63.5');
  await page.getByLabel('몸무게 (kg)').fill('6.35');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '신체 측정', exact: true }),
  ).toBeVisible();
  await page.goto(`/ko/care/growth/new?child=${child}`);
  await page.getByLabel('기록 종류').selectOption('observation');
  await page.getByLabel('제목').fill('옆으로 돌아누웠어요');
  await page.getByLabel('메모').fill('오전 놀이 중 관찰');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '발달 관찰·일기', exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.locator('input[type="file"]').setInputFiles({
    name: 'growth.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XxY4AAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST', {
      timeout: 30000,
    }),
    page.getByRole('button', { name: '사진 추가', exact: true }).click(),
  ]);
  await expect(
    page.getByRole('img', { name: '옆으로 돌아누웠어요', exact: true }),
  ).toBeVisible();
  const photo = await admin
    .from('child_record_photos')
    .select('*')
    .eq('record_id', id)
    .single();
  if (!photo.data) throw new Error('Photo fixture not saved');
  createdChildPhotos.push(photo.data.path);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/ko/services/growth?child=${child}`);
    const entry = page.locator('.growth-diary').filter({
      has: page.getByRole('heading', {
        name: '옆으로 돌아누웠어요',
        exact: true,
      }),
    });
    const preview = entry.getByRole('img', {
      name: '옆으로 돌아누웠어요',
      exact: true,
    });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute(
      'src',
      `/api/care/photos/${photo.data.id}`,
    );
    await expect
      .poll(() =>
        preview.evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    const textBox = await entry.locator('.growth-diary-text').boundingBox();
    const imageBox = await entry.locator('.growth-diary-picture').boundingBox();
    expect(imageBox!.x).toBeGreaterThan(textBox!.x + textBox!.width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('.growth-diary-no-photo')).toHaveCount(1);
    await page
      .locator('.child-record-list')
      .screenshot({ path: `test-results/growth-diary-${width}.png` });
  }
  await page
    .locator('.growth-diary')
    .filter({
      has: page.getByRole('heading', {
        name: '옆으로 돌아누웠어요',
        exact: true,
      }),
    })
    .getByRole('link')
    .click();
  await expect(page).toHaveURL(new RegExp(`/ko/care/growth/${id}\\?`));
  const url = `/api/care/photos/${photo.data.id}`;
  expect((await page.request.get(url)).status()).toBe(200);
  const guest = await browser.newContext();
  try {
    expect(
      (await guest.request.get(`http://127.0.0.1:3187${url}`)).status(),
    ).toBe(401);
  } finally {
    await guest.close();
  }
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Care reader',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      child_id: child,
      family_id: family,
      user_id: reader,
      role: 'viewer',
    });
    const readerPage = await readerContext.newPage();
    await readerPage.goto(`/en/services/growth?child=${child}`);
    await expect(
      readerPage.getByRole('img', { name: '옆으로 돌아누웠어요', exact: true }),
    ).toBeVisible();
    await expect(
      readerPage.getByRole('link', { name: 'Add record', exact: true }),
    ).toHaveCount(0);
    await readerPage.goto(`/en/care/growth/${id}?child=${child}`);
    await expect(
      readerPage.getByRole('img', { name: '옆으로 돌아누웠어요', exact: true }),
    ).toBeVisible();
    expect((await readerPage.request.get(url)).status()).toBe(200);
    await expect(readerPage.locator('input[type="file"]')).toHaveCount(0);
    expect(
      (await readerPage.goto(`/en/care/growth/new?child=${child}`))?.status(),
    ).toBe(404);
    await admin
      .from('child_access')
      .delete()
      .eq('child_id', child)
      .eq('user_id', reader);
    expect((await readerPage.request.get(url)).status()).toBe(404);
  } finally {
    await readerContext.close();
  }
  const exported = await page.request.get(`/api/data/export?child=${child}`);
  const data = await exported.json();
  expect(data.child_records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'measurement',
        height_cm: 63.5,
        weight_kg: 6.35,
        head_cm: null,
      }),
      expect.objectContaining({ title: '옆으로 돌아누웠어요' }),
    ]),
  );
  expect(data.child_photos[0]).not.toHaveProperty('path');
  expect(data.child_photos[0]).not.toHaveProperty('uploaded_by');
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/growth-390.png',
    fullPage: true,
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page).toHaveURL(/\/ko\/services\/growth/);
  expect((await page.request.get(url)).status()).toBe(404);
  const worker = spawnSync('node', ['scripts/process-operations.mjs'], {
    env: {
      ...process.env,
      OPERATIONS_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      OPERATIONS_SUPABASE_SECRET_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    encoding: 'utf8',
  });
  expect(worker.status, 'Local photo cleanup worker should succeed').toBe(0);
  expect(
    (await admin.storage.from('child-care-photos').download(photo.data.path))
      .error,
  ).not.toBeNull();
});

test('signed-out users see three social choices and preserve safe invitation routes', async ({
  page,
}) => {
  await page.goto('/ko/today');
  await expect(page).toHaveURL(/\/ko\/login/);
  await expect(
    page.getByRole('button', { name: '카카오로 계속하기' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '네이버로 계속하기' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '구글로 계속하기' }),
  ).toBeVisible();
  const invitation = '/ko/invite/' + 'a'.repeat(64);
  await page.goto('/ko/login?next=' + encodeURIComponent(invitation));
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/login/);
  expect(new URL(page.url()).searchParams.get('next')).toBe(
    invitation.replace('/ko/', '/en/'),
  );
  await page.goto(
    '/auth/callback?locale=en&next=' +
      encodeURIComponent(invitation.replace('/ko/', '/en/')),
  );
  expect(new URL(page.url()).searchParams.get('next')).toBe(
    invitation.replace('/ko/', '/en/'),
  );
  await page.goto('/auth/callback?locale=en&next=https://evil.test');
  await expect(page).toHaveURL(/\/en\/login\?error=auth/);
  await expect(page.locator('.flash[role="alert"]')).toContainText(
    "Sign-in wasn't completed",
  );
});

test('family owner can add another child and read both children after saving', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const userId = await signIn(context);
  await admin.from('profiles').insert({
    id: userId,
    display_name: '아이 추가 테스트',
    consented_at: new Date().toISOString(),
  });
  const { data: family, error } = await admin
    .from('families')
    .insert({ name: '아이 추가 테스트 가족' })
    .select('id')
    .single();
  if (error || !family) throw new Error('Fixture family creation failed');
  createdFamilies.push(family.id);
  await admin.from('family_members').insert({
    family_id: family.id,
    user_id: userId,
    role: 'owner',
  });
  await admin.from('children').insert({
    family_id: family.id,
    name: '첫째',
    birth_date: '2026-09-01',
  });
  await page.goto('/ko/family');
  const form = page
    .locator('form')
    .filter({ has: page.locator('input[name="name"]') });
  await form.getByLabel('아이 이름 또는 태명').fill('둘째');
  await form.getByLabel('출산 예정일').fill('2027-03-01');
  await Promise.all([
    page.waitForURL(/\/ko\/today\?child=/, { timeout: 30000 }),
    form.getByRole('button', { name: '아이 추가', exact: true }).click(),
  ]);
  await expect(page.locator('.child-bar strong')).toHaveText('둘째');
  await page.reload();
  await expect(page.locator('.child-bar strong')).toHaveText('둘째');
  await page.locator('.child-picker summary').click();
  await expect(page.locator('.child-options a')).toHaveCount(2);
  await page.getByRole('link', { name: '첫째', exact: true }).click();
  await expect(page.locator('.child-bar strong')).toHaveText('첫째');
});

test('today saves per-child meal times in the DB and shares them with a read-only caregiver', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  const owner = await signIn(context);
  await admin.from('profiles').insert({
    id: owner,
    display_name: 'Meal owner',
    consented_at: new Date().toISOString(),
  });
  const { data: family } = await admin
    .from('families')
    .insert({ name: 'Meal family' })
    .select('id')
    .single();
  if (!family) throw new Error('Fixture family creation failed');
  createdFamilies.push(family.id);
  await admin
    .from('family_members')
    .insert({ family_id: family.id, user_id: owner, role: 'owner' });
  const child = crypto.randomUUID();
  const sibling = crypto.randomUUID();
  await admin.from('children').insert([
    {
      id: child,
      family_id: family.id,
      name: '식사 아이',
      birth_date: '2026-01-01',
    },
    {
      id: sibling,
      family_id: family.id,
      name: '다른 아이',
      birth_date: '2026-01-01',
    },
  ]);
  const end = Math.floor((Date.now() - 3600000) / 60000) * 60000;
  const feed = await admin.from('care_records').insert({
    id: crypto.randomUUID(),
    child_id: child,
    kind: 'formula',
    started_at: new Date(end - 600000).toISOString(),
    ended_at: new Date(end).toISOString(),
    created_by: owner,
    updated_by: owner,
  });
  if (feed.error) throw new Error(`Fixture feeding failed: ${feed.error.code}`);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`/ko/today?child=${child}`);
  await expect(page.locator('.next-meals form')).toHaveCount(0);
  await expect(page.locator('.next-meals details')).toHaveCount(0);
  await page.getByRole('link', { name: '먹이기 기록·시간 설정' }).click();
  await expect(page).toHaveURL(/\/ko\/records/);
  await page.getByText('다음 먹이기 시간 설정', { exact: true }).click();
  await expect(
    page.locator('.meal-settings input[type="checkbox"]'),
  ).toHaveCount(0);
  await page.getByLabel('수유 간격 (분)').fill('180');
  const saveTimes = async () => {
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === 'POST',
        { timeout: 30000 },
      ),
      page.getByRole('button', { name: '시간 저장', exact: true }).click(),
    ]);
    await expect(page).toHaveURL(/\/ko\/records.*notice=saved/);
    await expect(page.locator('.meal-settings')).not.toHaveAttribute(
      'open',
      '',
    );
  };
  await saveTimes();
  await page.getByText('다음 먹이기 시간 설정', { exact: true }).click();
  await page.getByLabel('먹이기 종류').selectOption('solids');
  await page.locator('input[name="solids"]').nth(0).fill('08:00');
  await page.locator('input[name="solids"]').nth(1).fill('12:00');
  await saveTimes();
  await page.goto(`/ko/today?child=${child}`);
  await expect(page.locator('.last-panel .next-meals')).toHaveCount(0);
  await expect(page.locator('.today-hero + .next-meals.panel')).toHaveCount(1);
  await expect(page.locator('.next-meal-primary')).toHaveCount(1);
  const expected = new Date(end + 180 * 60000).toISOString();
  await expect(page.locator('[data-meal="feeding"] time')).toHaveAttribute(
    'dateTime',
    expected,
  );
  await expect(page.locator('[data-meal="solids"] time')).toBeVisible();
  await expect(page.locator('[data-meal="meals"]')).toHaveCount(0);
  const stored = await admin
    .from('child_meal_plans')
    .select('*')
    .eq('child_id', child)
    .single();
  expect(stored.data).toMatchObject({
    feeding_minutes: 180,
    solids_times: ['08:00', '12:00'],
    timezone: 'Asia/Seoul',
  });
  await page.reload();
  await expect(page.locator('[data-meal="feeding"] time')).toHaveAttribute(
    'dateTime',
    expected,
  );
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Meal reader',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family.id, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      child_id: child,
      family_id: family.id,
      user_id: reader,
      role: 'viewer',
    });
    const readerPage = await readerContext.newPage();
    await readerPage.goto(`/en/today?child=${child}`);
    await expect(
      readerPage.locator('[data-meal="feeding"] time'),
    ).toHaveAttribute('dateTime', expected);
    await expect(
      readerPage.getByText('Schedule settings', { exact: true }),
    ).toHaveCount(0);
    await readerPage.goto(`/en/records?child=${child}`);
    await expect(readerPage.locator('.meal-settings')).toHaveCount(0);
    const exported = await page.request.get(`/api/data/export?child=${child}`);
    expect(exported.status()).toBe(200);
    expect((await exported.json()).meal_plan.feeding_minutes).toBe(180);
  } finally {
    await readerContext.close();
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/next-meals-390.png',
    fullPage: true,
  });
  await page.goto(`/ko/today?child=${sibling}`);
  await expect(page.locator('.next-meals time')).toHaveCount(0);
  expect(
    errors.filter((message) => /hydration|hydrated/i.test(message)),
  ).toHaveLength(0);
});

test('three feeding types use start and duration, and last feeding includes solids', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const owner = await signIn(context);
  await admin.from('profiles').insert({
    id: owner,
    display_name: 'Feeding test',
    consented_at: new Date().toISOString(),
  });
  const { data: family } = await admin
    .from('families')
    .insert({ name: 'Feeding test' })
    .select('id')
    .single();
  if (!family) throw new Error('Fixture family creation failed');
  createdFamilies.push(family.id);
  await admin
    .from('family_members')
    .insert({ family_id: family.id, user_id: owner, role: 'owner' });
  const child = crypto.randomUUID();
  await admin.from('children').insert({
    id: child,
    family_id: family.id,
    name: '먹이기 아이',
    birth_date: '2026-01-01',
  });
  for (const entry of [
    { label: '분유 수유', kind: 'formula', amount: '120' },
    { label: '이유식', kind: 'solids', amount: '80' },
  ]) {
    await page.goto(`/ko/today?child=${child}`);
    await expect(page.locator('.quick-grid a')).toHaveCount(6);
    await expect(
      page
        .locator('.quick-grid')
        .getByRole('link', { name: '유축 기록', exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .locator('.quick-grid')
        .getByRole('link', { name: '유축 모유 먹이기', exact: true }),
    ).toHaveCount(0);
    await page
      .locator('.quick-grid')
      .getByRole('link', { name: entry.label, exact: true })
      .click();
    await expect(page.getByLabel('기록 종류')).toHaveValue(entry.kind);
    await expect(page.getByLabel('종료 시각')).toHaveCount(0);
    await page
      .getByLabel('시작 시각')
      .fill(
        `2026-10-13T${entry.kind === 'formula' ? '10' : entry.kind === 'solids' ? '11' : '12'}:00`,
      );
    await page
      .getByRole('group', { name: '먹인 시간 (분)', exact: true })
      .getByRole('button', { name: '10분', exact: true })
      .click();
    await page
      .getByLabel(entry.kind === 'solids' ? '먹은 양 (g)' : '양 (ml)')
      .selectOption(entry.amount);
    await expect(page.getByLabel('음식 이름')).toHaveCount(0);
    await expect(
      page.locator(
        'input[name="amount"][type="number"],input[name="duration"][type="number"]',
      ),
    ).toHaveCount(0);
    await page.getByRole('button', { name: '저장하기', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('저장했어요.');
  }
  const stored = await admin
    .from('care_records')
    .select(
      'kind,amount_ml,amount_g,food_name,record_timezone,started_at,ended_at',
    )
    .eq('child_id', child);
  expect(stored.error).toBeNull();
  expect(stored.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'formula',
        amount_ml: 120,
        amount_g: null,
        food_name: '',
      }),
      expect.objectContaining({
        kind: 'solids',
        amount_ml: null,
        amount_g: 80,
        food_name: '',
      }),
    ]),
  );
  expect(stored.data?.every((record) => Boolean(record.record_timezone))).toBe(
    true,
  );
  expect(
    stored.data?.every(
      (record) =>
        Date.parse(record.ended_at!) - Date.parse(record.started_at) === 600000,
    ),
  ).toBe(true);
  await page.goto(`/ko/today?child=${child}`);
  await expect(
    page.getByRole('heading', { name: '마지막 먹이기' }),
  ).toBeVisible();
  await expect(page.locator('.last-kind')).toHaveText('이유식');
  await expect(page.locator('.last-detail')).toHaveText('80 g');
  await page
    .locator('.quick-grid')
    .getByRole('link', { name: '모유 수유', exact: true })
    .click();
  await expect(page.getByLabel('양 (ml)')).toHaveCount(0);
  await page
    .getByRole('group', { name: '먹인 시간 (분)', exact: true })
    .getByRole('button', { name: '15분', exact: true })
    .click();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('저장했어요.');
  const exported = await page.request.get(`/api/data/export?child=${child}`);
  expect((await exported.json()).records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'solids',
        amount_g: 80,
        food_name: '',
      }),
    ]),
  );
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`/ko/today?child=${child}`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const legacyId = crypto.randomUUID();
  const legacy = await admin.from('care_records').insert({
    id: legacyId,
    child_id: child,
    kind: 'solids',
    started_at: '2026-10-13T13:00:00Z',
    ended_at: '2026-10-13T13:07:30Z',
    amount_g: 83.5,
    food_name: '기존 음식',
    created_by: owner,
  });
  expect(legacy.error).toBeNull();
  await page.goto(`/en/records?child=${child}&edit=${legacyId}`);
  await expect(
    page.getByRole('button', { name: '7.5 min', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByLabel('Amount eaten (g)', { exact: true }),
  ).toHaveValue('83.5');
  await expect(page.getByLabel('Food name', { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  const preserved = await admin
    .from('care_records')
    .select('amount_g,food_name,started_at,ended_at')
    .eq('id', legacyId)
    .single();
  expect(preserved.data).toMatchObject({
    amount_g: 83.5,
    food_name: '기존 음식',
  });
  expect(
    Date.parse(preserved.data!.ended_at!) -
      Date.parse(preserved.data!.started_at),
  ).toBe(450000);
  await page.screenshot({
    path: 'test-results/feeding-390.png',
    fullPage: true,
  });
});

test('onboarding, records, timer, tasks and birth-date confirmation work with a real local DB', async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto('/ko/today');
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel('보호자 이름').fill('테스트 보호자');
  await page.getByLabel('가족 이름').fill('테스트 둥지');
  await page.getByLabel('아이 이름 또는 태명').fill('포근이');
  await page.getByLabel('출산 예정일').fill('2026-11-10');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '우리 가족 시작하기' }).click();
  await expect(page).toHaveURL(/\/ko\/today/);
  await expect(page.getByText('포근이', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '분유 수유', exact: true }).click();
  await expect(page.getByLabel('기록 종류')).toHaveValue('formula');
  await page.getByLabel('양 (ml)').selectOption('90');
  await page
    .getByRole('group', { name: '먹인 시간 (분)', exact: true })
    .getByRole('button', { name: '10분', exact: true })
    .click();
  await page.getByLabel('메모').fill('아침 수유');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('저장했어요.');
  await expect(page.getByText('아침 수유', { exact: true })).toBeVisible();
  await page.getByLabel('메모').fill('두 번째 수유');
  await page
    .getByRole('group', { name: '먹인 시간 (분)', exact: true })
    .getByRole('button', { name: '10분', exact: true })
    .click();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.getByText('두 번째 수유', { exact: true })).toBeVisible();
  await expect(page.getByText('아침 수유', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: '타이머 시작' }).check();
  await page.getByRole('button', { name: '타이머 시작', exact: true }).click();
  await page.reload();
  await expect(page.locator('.timer')).toBeVisible();
  await page.getByRole('link', { name: '타이머 종료' }).click();
  await page.getByRole('button', { name: '타이머 종료' }).click();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.locator('.timer')).toHaveCount(0);
  await expect(page.locator('.record-row')).toHaveCount(3);
  await page
    .getByRole('link', { name: '일정과 할 일', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: '기본 준비 목록 추가' }).click();
  await expect(
    page.getByText('출산 가방 목록 확인', { exact: true }),
  ).toBeVisible();
  await page.getByText('할 일 추가', { exact: true }).click();
  const taskForm = page
    .locator('form')
    .filter({ has: page.locator('input[name="title"]') })
    .first();
  await taskForm.getByLabel('제목').fill('우리 가족 약속');
  await taskForm.getByLabel('날짜').fill('2026-11-01');
  await taskForm.getByRole('button', { name: '저장하기' }).click();
  await expect(page.getByText('우리 가족 약속', { exact: true })).toBeVisible();
  await page
    .getByRole('link', { name: '우리 가족', exact: true })
    .first()
    .click();
  await page.getByLabel('아이 생일').first().fill('2026-10-12');
  await page.getByRole('button', { name: '변경 내용 확인' }).click();
  await expect(
    page.getByRole('heading', { name: '일정 변경 확인' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '확인하고 날짜 변경' }).click();
  await expect(page.getByText(/생후/)).toBeVisible();
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Our family', exact: true }),
  ).toBeVisible();
});

test('responsive dashboard and bilingual service catalog remain within the viewport', async ({
  page,
  context,
}) => {
  const id = await signIn(context);
  await admin.from('profiles').insert({
    id,
    display_name: 'Preview',
    consented_at: new Date().toISOString(),
  });
  const { data: family } = await admin
    .from('families')
    .insert({ name: 'Preview family' })
    .select('id')
    .single();
  createdFamilies.push(family!.id);
  await admin
    .from('family_members')
    .insert({ family_id: family!.id, user_id: id, role: 'owner' });
  const { data: child, error: childError } = await admin
    .from('children')
    .insert({ family_id: family!.id, name: '도담이', birth_date: '2026-09-01' })
    .select('id')
    .single();
  if (childError || !child) throw new Error('Fixture child creation failed');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/ko/today');
    await expect(
      page.getByRole('heading', { name: '오늘도 함께, 차근차근' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('heading', { name: '마지막 먹이기', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/today-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto('/en/services');
  await expect(page.locator('.service-card')).toHaveCount(16);
  await expect(
    page
      .locator('.service-card')
      .getByRole('heading', { name: 'Solids', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Breastfeeding, formula & solids' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Government & local support/ }).click();
  await expect(
    page.getByText("We're reviewing the official guidance"),
  ).toBeVisible();
  // A running timer must remain reachable beyond the first history page.
  const records = Array.from({ length: 101 }, (_, index) => ({
    id: crypto.randomUUID(),
    child_id: child.id,
    kind: 'formula',
    started_at: new Date(
      Date.parse('2026-10-10T00:00Z') + index * 60000,
    ).toISOString(),
    ended_at: new Date(
      Date.parse('2026-10-10T00:00Z') + index * 60000 + 30000,
    ).toISOString(),
    created_by: id,
    updated_by: id,
    note: `History ${index}`,
  }));
  const { error: recordsError } = await admin.from('care_records').insert([
    ...records,
    {
      child_id: child.id,
      id: crypto.randomUUID(),
      kind: 'breast',
      started_at: '2026-10-01T00:00Z',
      ended_at: null,
      created_by: id,
      updated_by: id,
      note: 'Older running timer',
    },
  ]);
  if (recordsError) throw new Error('Fixture records creation failed');
  await page.goto('/en/records');
  await expect(
    page.getByText('Older running timer', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.timer')).toBeVisible();
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page.getByText('History 0', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Older running timer', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Stop timer', exact: true }).click();
  await page.getByRole('button', { name: 'Stop timer', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.timer')).toHaveCount(0);
});

test('community uses separate list and writing screens; comments and photos obey permissions', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  const { owner: author, family } = await childCareFamily(context);
  await setFamilyResidence(family, '1168010100');
  await admin.from('community_moderators').insert({ user_id: author });
  const readerContext = await browser.newContext();
  try {
    const { family: readerFamily } = await childCareFamily(readerContext);
    await setFamilyResidence(readerFamily, '1168010100');
    const readerPage = await readerContext.newPage();
    const hydration: string[] = [];
    page.on('console', (message) => {
      if (/hydrated|hydration/i.test(message.text()))
        hydration.push(message.text());
    });
    await page.goto('/ko/community');
    await expect(page.locator('textarea[name="body"]')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '차단 목록', exact: true }),
    ).toHaveCount(0);
    await page.locator('summary').filter({ hasText: '지역별 게시판' }).click();
    await page
      .getByRole('navigation', { name: '지역별 게시판' })
      .getByRole('link', {
        name: '역삼동 게시판',
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('heading', {
        name: '역삼동 게시판',
      }),
    ).toBeVisible();
    await page.getByRole('link', { name: '글 쓰기', exact: true }).click();
    await page.waitForURL(/community\/new/, { timeout: 30000 });
    await expect(
      page.getByRole('combobox', { name: '게시판', exact: true }),
    ).toHaveValue('locality');
    const form = page
      .locator('form')
      .filter({ has: page.locator('textarea[name="body"]') });
    await form.getByLabel('제목', { exact: true }).fill('브라우저 검증 글');
    await form
      .getByLabel('내용', { exact: true })
      .fill('공개 범위를 확인하는 시험 글');
    await expect(form.locator('input[name=region]')).toHaveCount(0);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/ko/community/new',
        { timeout: 30000 },
      ),
      form.getByRole('button', { name: '저장', exact: true }).click(),
    ]);
    await expect(
      page.getByRole('heading', { name: '브라우저 검증 글', exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/community\/[a-f0-9-]{36}/);
    const detail = page.url(),
      postId = new URL(detail).pathname.split('/').at(-1)!;
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const contrast = await page
        .getByRole('button', { name: '공감', exact: true })
        .evaluate((button) => {
          const style = getComputedStyle(button);
          const luminance = (css: string) => {
            const channels = css
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((v) => v / 255)
              .map((v) =>
                v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
              );
            return (
              channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
            );
          };
          const foreground = luminance(style.color),
            background = luminance(style.backgroundColor);
          return (
            (Math.max(foreground, background) + 0.05) /
            (Math.min(foreground, background) + 0.05)
          );
        });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({
        path: `test-results/community-detail-${colorScheme}-desktop.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 900 });
      const reactionButton = await page
        .getByRole('button', { name: '공감', exact: true })
        .boundingBox();
      const savedButton = await page
        .getByRole('button', { name: '저장한 글', exact: true })
        .boundingBox();
      expect(Math.abs(reactionButton!.y - savedButton!.y)).toBeLessThan(2);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/community-detail-${colorScheme}-390.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await expect(page.getByLabel('사유', { exact: true })).toHaveCount(0);
    await page.locator('.community-photo-editor > summary').click();
    await page.getByLabel(/사진 \(JPEG/).setInputFiles({
      name: 'fixture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1X8AAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.getByRole('button', { name: '사진 추가', exact: true }).click();
    await expect(
      page.locator('img[src^="/api/community/photos/"]'),
    ).toHaveCount(1);
    const photo = await admin
      .from('community_photos')
      .select('id,path')
      .eq('post_id', postId)
      .single();
    expect(photo.error).toBeNull();
    createdPhotos.push(photo.data!.path);
    await readerPage.emulateMedia({ colorScheme: 'dark' });
    await readerPage.goto(detail);
    await readerPage.screenshot({
      path: 'test-results/community-detail-reader-dark.png',
      fullPage: true,
    });
    await expect(
      readerPage.getByLabel('사유', { exact: true }),
    ).not.toBeVisible();
    await readerPage.locator('.community-report > summary').first().click();
    await readerPage
      .getByLabel('사유', { exact: true })
      .fill('로컬 검증용 신고');
    await readerPage
      .locator('.community-report[open] form')
      .getByRole('button', { name: '신고', exact: true })
      .click();
    await expect(readerPage.getByRole('status')).toHaveText('처리했습니다.');
    await readerPage
      .getByLabel('댓글 남기기', { exact: true })
      .fill('댓글 기능 확인');
    await Promise.all([
      readerPage.waitForResponse(
        (response) => response.request().method() === 'POST',
      ),
      readerPage
        .locator('form')
        .filter({ has: readerPage.locator('textarea[name="body"]') })
        .getByRole('button', { name: '저장', exact: true })
        .click(),
    ]);
    await expect(
      readerPage.locator('article p').filter({ hasText: '댓글 기능 확인' }),
    ).toBeVisible();
    expect(
      (
        await readerPage.request.get(`/api/community/photos/${photo.data!.id}`)
      ).status(),
    ).toBe(200);
    await expect(
      readerPage.getByRole('textbox', { name: '수정', exact: true }),
    ).toHaveCount(0);
    await readerPage.locator('.community-comment-edit > summary').click();
    await readerPage
      .getByRole('textbox', { name: '수정', exact: true })
      .fill('댓글 수정 기능 확인');
    await readerPage
      .locator('.community-comment-edit[open] form')
      .getByRole('button', { name: '저장', exact: true })
      .click();
    await expect(
      readerPage
        .locator('.community-comment-body')
        .filter({ hasText: '댓글 수정 기능 확인' }),
    ).toBeVisible();
    await setFamilyResidence(readerFamily, '1168010600');
    expect(
      (
        await readerPage.request.get(`/api/community/photos/${photo.data!.id}`)
      ).status(),
    ).toBe(404);
    expect((await readerPage.goto(detail))!.status()).toBe(404);
    await setFamilyResidence(readerFamily, '1168010100');
    await readerPage.goto(detail);
    await readerPage
      .getByRole('button', { name: '작성자 차단', exact: true })
      .first()
      .click();
    await expect(readerPage).toHaveURL(/community\?.*notice=saved/);
    expect(
      (
        await readerPage.request.get(`/api/community/photos/${photo.data!.id}`)
      ).status(),
    ).toBe(404);
    expect((await readerPage.goto('/ko/operations'))!.status()).toBe(404);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(detail);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: 'test-results/community-390.png',
      fullPage: true,
    });
    expect(hydration).toEqual([]);
  } finally {
    await readerContext.close();
  }
});

test('home boards show local titles, separate neighborhoods and share national topics', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  const home = await childCareFamily(context);
  await page.goto(`/ko/community?family=${home.family}`);
  await expect(
    page.getByText(
      '가족이 사는 곳을 등록하면 지역·동네 게시판과 같은 국가의 주제별 게시판을 이용할 수 있어요.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: '글 쓰기', exact: true }),
  ).toHaveCount(0);
  await setFamilyResidence(home.family, '1168010100');
  const posts: Record<string, string> = {};
  for (const [board, title] of [
    ['district', '강남구 공통 글'],
    ['locality', '역삼동 동네 글'],
    ['topic:feeding', '대한민국 먹이기 글'],
  ]) {
    await page.goto(`/ko/community/new?family=${home.family}&board=${board}`);
    await page.getByLabel('제목', { exact: true }).fill(title);
    await page
      .getByLabel('내용', { exact: true })
      .fill('게시판 범위를 검증합니다.');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
    posts[board] = page.url();
  }
  const neighborContext = await browser.newContext(),
    distantContext = await browser.newContext();
  try {
    const neighbor = await childCareFamily(neighborContext),
      distant = await childCareFamily(distantContext);
    await setFamilyResidence(neighbor.family, '1168010600');
    await setFamilyResidence(distant.family, '1171010100');
    const neighborPage = await neighborContext.newPage(),
      distantPage = await distantContext.newPage();
    await neighborPage.goto(
      `/ko/community?family=${neighbor.family}&board=district`,
    );
    await expect(
      neighborPage.getByRole('heading', {
        name: '강남구 게시판',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      neighborPage.getByRole('link', { name: '강남구 공통 글', exact: true }),
    ).toBeVisible();
    await expect(
      neighborPage.getByRole('link', { name: '역삼동 동네 글', exact: true }),
    ).toHaveCount(0);
    expect(
      (await neighborPage.goto(new URL(posts.locality).pathname))!.status(),
    ).toBe(404);
    await neighborPage.goto(
      `/ko/community?family=${neighbor.family}&board=locality`,
    );
    await expect(
      neighborPage.getByRole('heading', {
        name: '대치동 게시판',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await distantPage.goto(new URL(posts.district).pathname))!.status(),
    ).toBe(404);
    await distantPage.goto(
      `/ko/community?family=${distant.family}&board=topic:feeding`,
    );
    await expect(
      distantPage.getByRole('heading', {
        name: '먹이기 게시판',
        exact: true,
      }),
    ).toBeVisible();
    await distantPage
      .getByRole('link', { name: '대한민국 먹이기 글', exact: true })
      .click();
    await distantPage
      .getByLabel('댓글 남기기', { exact: true })
      .fill('다른 지역에서도 함께 이야기해요.');
    await distantPage
      .getByRole('button', { name: '저장', exact: true })
      .click();
    await expect(
      distantPage
        .locator('article > p')
        .filter({ hasText: '다른 지역에서도 함께 이야기해요.' }),
    ).toBeVisible();
    await admin
      .from('families')
      .update({ name: '송파 가족' })
      .eq('id', distant.family);
    await admin.from('family_members').insert({
      family_id: distant.family,
      user_id: home.owner,
      role: 'viewer',
    });
    await page.goto(`/ko/community?family=${home.family}&board=district`);
    await page
      .getByRole('navigation', { name: '가족 선택', exact: true })
      .getByRole('link', { name: '송파 가족', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: '송파구 게시판',
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(posts.locality);
    await page.getByRole('button', { name: '저장한 글', exact: true }).click();
    await page.goto(
      `/ko/community?family=${home.family}&board=locality&saved=1`,
    );
    await expect(
      page.getByRole('link', { name: '역삼동 동네 글', exact: true }),
    ).toBeVisible();
    await page.goto(
      `/ko/community?family=${home.family}&board=district&saved=1`,
    );
    await expect(
      page.getByRole('link', { name: '강남구 공통 글', exact: true }),
    ).toHaveCount(0);
    await page.goto(`/ko/community?family=${home.family}&board=locality`);
    await page.screenshot({
      path: 'test-results/community-boards-desktop.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: 'test-results/community-boards-390.png',
      fullPage: true,
    });
    await page.getByRole('link', { name: 'English', exact: true }).click();
    await expect(
      page.getByRole('heading', {
        name: '역삼동 board',
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await neighborContext.close();
    await distantContext.close();
  }
});

test('daily polls, previews and inbox work in both languages', async ({
  page,
  context,
}) => {
  const author = await signIn(context);
  await admin.from('profiles').insert({
    id: author,
    display_name: 'Poll fixture',
    consented_at: new Date().toISOString(),
  });
  await admin.from('community_moderators').insert({ user_id: author });
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const existing = await admin
    .from('daily_polls')
    .select('id')
    .eq('day', day)
    .maybeSingle();
  let pollId = existing.data?.id;
  if (!pollId) {
    const count = await admin
      .from('daily_polls')
      .select('id', { count: 'exact', head: true })
      .eq('hidden', false)
      .lte('day', day);
    if (count.count === 0) {
      await page.goto('/ko/polls');
      await expect(page.getByText('미리보기:', { exact: false })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: '지난 투표 목록', exact: true }),
      ).toBeVisible();
      await expect(page.locator('article')).toHaveCount(4);
      await expect(
        page.getByRole('button', { name: '선택 저장', exact: true }),
      ).toHaveCount(0);
      await page.screenshot({
        path: 'test-results/polls-preview.png',
        fullPage: true,
      });
    }
    pollId = crypto.randomUUID();
    createdPolls.push(pollId);
    const result = await admin.from('daily_polls').insert({
      id: pollId,
      day,
      question_ko: '시험 질문',
      question_en: 'Fixture question',
      options: [
        { ko: '첫 번째', en: 'First' },
        { ko: '두 번째', en: 'Second' },
      ],
    });
    expect(result.error).toBeNull();
  }
  await page.goto('/ko/polls');
  await page.locator('input[name="option"][value="0"]').first().check();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/ko/polls',
    ),
    page
      .getByRole('button', { name: '선택 저장', exact: true })
      .first()
      .click(),
  ]);
  await expect(page.getByRole('status')).toHaveText('저장했습니다.');
  await page.locator('input[name="option"][value="1"]').first().check();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/ko/polls',
    ),
    page
      .getByRole('button', { name: '선택 저장', exact: true })
      .first()
      .click(),
  ]);
  await expect(
    page.locator('input[name="option"][value="1"]').first(),
  ).toBeChecked();
  const votes = await admin
    .from('daily_poll_votes')
    .select('option_index')
    .eq('poll_id', pollId)
    .eq('user_id', author);
  expect(votes.data).toEqual([{ option_index: 1 }]);
  await page.goto('/en/polls');
  await expect(
    page.getByRole('heading', { name: 'Daily question', exact: true }),
  ).toBeVisible();
  await page.goto('/ko/notifications');
  await page.getByRole('button', { name: '설정 저장', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('저장했습니다.');
  await page.goto('/en/notifications');
  await expect(
    page.getByRole('heading', { name: 'Notifications', exact: true }),
  ).toBeVisible();
});

test('data export includes every record; ownership transfer and account deletion preserve shared history', async ({
  page,
  context,
  browser,
}) => {
  const owner = await signIn(context);
  const memberContext = await browser.newContext();
  try {
    const member = await signIn(memberContext);
    for (const id of [owner, member])
      await admin.from('profiles').insert({
        id,
        display_name: 'Data fixture',
        consented_at: new Date().toISOString(),
      });
    const familyId = crypto.randomUUID(),
      childId = crypto.randomUUID();
    createdFamilies.push(familyId);
    expect(
      (
        await admin
          .from('families')
          .insert({ id: familyId, name: 'Data fixture family' })
      ).error,
    ).toBeNull();
    expect(
      (
        await admin.from('family_members').insert([
          { family_id: familyId, user_id: owner, role: 'owner' },
          { family_id: familyId, user_id: member, role: 'editor' },
        ])
      ).error,
    ).toBeNull();
    expect(
      (
        await admin.from('children').insert({
          id: childId,
          family_id: familyId,
          name: 'Export fixture',
          birth_date: '2026-09-01',
        })
      ).error,
    ).toBeNull();
    const rows = Array.from({ length: 101 }, () => ({
      id: crypto.randomUUID(),
      child_id: childId,
      kind: 'formula',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      created_by: owner,
      updated_by: owner,
    }));
    expect((await admin.from('care_records').insert(rows)).error).toBeNull();
    await page.goto('/ko/data');
    const response = await page.request.get(
      `/api/data/export?child=${childId}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('private, no-store');
    const exported = await response.json();
    expect(exported.records).toHaveLength(101);
    expect(exported.records[0]).not.toHaveProperty('created_by');
    expect(exported.child).not.toHaveProperty('family_id');
    const memberPage = await memberContext.newPage();
    expect(
      (
        await memberPage.request.get(`/api/data/export?child=${childId}`)
      ).status(),
    ).toBe(403);
    const disposable = crypto.randomUUID();
    await admin.from('children').insert({
      id: disposable,
      family_id: familyId,
      name: 'Delete fixture',
      birth_date: '2026-09-01',
    });
    await page.reload();
    const childPanel = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Delete fixture', exact: true }),
    });
    await childPanel.getByLabel('DELETE CHILD 입력').fill('DELETE CHILD');
    await childPanel
      .getByRole('button', { name: '아이 데이터 영구 삭제' })
      .click();
    await expect(childPanel).toHaveCount(0);
    const transfer = page
      .locator('form')
      .filter({ has: page.locator('input[name="action"][value="transfer"]') });
    await transfer.getByLabel('새 소유자').selectOption(member);
    await transfer.getByLabel('TRANSFER OWNER 입력').fill('TRANSFER OWNER');
    await transfer
      .getByRole('button', { name: '소유권 이전', exact: true })
      .click();
    await expect(page.getByRole('status')).toHaveText('처리했습니다.');
    await page.getByLabel('DELETE ACCOUNT 입력').fill('DELETE ACCOUNT');
    await page
      .getByRole('button', { name: '계정 삭제 요청', exact: true })
      .click();
    await expect(page).toHaveURL(/login\?notice=deletion-requested/);
    const records = await admin
      .from('care_records')
      .select('created_by,updated_by')
      .eq('child_id', childId);
    expect(records.data).toHaveLength(101);
    expect(
      records.data!.every(
        (r) => r.created_by === null && r.updated_by === null,
      ),
    ).toBe(true);
    const { spawnSync } = await import('node:child_process');
    const worker = spawnSync('node', ['scripts/process-operations.mjs'], {
      env: {
        ...process.env,
        OPERATIONS_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL!,
        OPERATIONS_SUPABASE_SECRET_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      },
      encoding: 'utf8',
    });
    expect(worker.status, 'local deletion worker').toBe(0);
    expect((await admin.auth.admin.getUserById(owner)).error).not.toBeNull();
    const job = await admin
      .from('data_operation_jobs')
      .select('status')
      .eq('user_id', owner)
      .single();
    expect(job.data?.status).toBe('complete');
    await admin.from('data_operation_jobs').delete().eq('user_id', owner);
    await memberPage.goto('/en/data');
    await expect(
      memberPage.getByRole('heading', { name: 'Data controls', exact: true }),
    ).toBeVisible();
  } finally {
    await memberContext.close();
  }
});
