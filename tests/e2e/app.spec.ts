import {
  test,
  webkit,
  devices,
  expect,
  type BrowserContext,
  type Page,
  type Locator,
} from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { connect } from 'node:net';
import { hostname } from 'node:os';
async function expectPhoneFunctionDock(page: Page, rail: Locator) {
  await expect(rail).toBeVisible();
  await expect
    .poll(async () => {
      const bar = (await rail.boundingBox())!,
        nav = (await page.locator('.mobile-nav').boundingBox())!;
      return Math.abs(bar.y + bar.height - nav.y);
    })
    .toBeLessThan(4);
  const initial = (await rail.boundingBox())!,
    scroll = await page.evaluate(() => window.scrollY);
  const target = (await rail.locator('button,a').first().boundingBox())!;
  expect(target.width).toBeGreaterThanOrEqual(44);
  expect(target.height).toBeGreaterThanOrEqual(44);
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant',
    }),
  );
  await expect
    .poll(async () => Math.abs((await rail.boundingBox())!.y - initial.y))
    .toBeLessThan(1);
  if (await page.locator('.quick-history-feed').count()) {
    const padding = await page.locator('.app-content').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom));
    const navHeight = (await page.locator('.mobile-nav').boundingBox())!.height;
    expect(padding).toBeGreaterThanOrEqual(initial.height + navHeight);
  } else {
    const footer = (await page.locator('.app-footer').boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(initial.y);
  }
  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: 'instant' }),
    scroll,
  );
}
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
              url: 'http://127.0.0.1:3188',
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
  if(createdUsers.length) await admin.from('admin_audit_log').delete().in('actor_id',createdUsers);
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
  if(createdUsers.length) await admin.from('admin_audit_log').delete().in('subject_id',createdUsers);
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
  await admin.from('children').insert({sex: 'female',
    id: child,
    family_id: family.id,
    name: '돌봄 아이',
    birth_date: '2026-01-01',
  });
  return { owner, family: family.id, child };
}

function completedSeoulDay() {
  // Recent records can straddle midnight; daily export fixtures need one
  // completed local date containing every feeding and sleep interval.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const now = new Date(`${today}T12:00:00+09:00`);
  now.setUTCDate(now.getUTCDate() - 1);
  return { now, day: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) };
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
  await admin.from('children').insert({sex: 'female',
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
  await admin.from('children').insert({sex: 'female',
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
      readerPanel.getByText('South Korea 서울특별시 강남구 역삼동', {
        exact: true,
      }),
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
  await panel.screenshot({ caret: 'initial', path: 'test-results/family-residence-desktop.png' });
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({ caret: 'initial', path: 'test-results/family-residence-390.png' });
  await panel
    .getByRole('combobox', { name: '국가 / 지역', exact: true })
    .selectOption('US');
  await expect(
    panel.getByRole('combobox', { name: '시·도', exact: true }),
  ).toHaveCount(0);
  await panel.locator('input[name="provinceName"]').fill('California');
  await panel.locator('input[name="cityName"]').fill('San Francisco');
  await panel.locator('input[name="localityName"]').fill('Sunset');
  await panel
    .getByRole('button', { name: '거주지역 저장', exact: true })
    .click();
  await expect(panel.locator('input[name="version"]')).toHaveValue('3');
  await page.reload();
  await expect(
    panel.getByRole('combobox', { name: '국가 / 지역', exact: true }),
  ).toHaveValue('US');
  const overseas = await admin
    .from('families')
    .select(
      'residence_country_code,residence_region_code,residence_city,residence_locality',
    )
    .eq('id', family)
    .single();
  expect(overseas.data).toEqual({
    residence_country_code: 'US',
    residence_region_code: null,
    residence_city: 'San Francisco',
    residence_locality: 'Sunset',
  });

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

test('calendar loads the whole selected month and Today groups all care shortcuts', async ({
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
          service: 'general',
          created_by: owner,
        },
      ])
    ).error,
  ).toBeNull();
  await page.goto(`/ko/calendar?child=${child}&month=2026-12&day=2026-12-15`);
  await expect(page.locator('.month-calendar')).toBeVisible();
  await expect(page.locator('.calendar-event')).toHaveCount(120);
  await expect(page.locator('[data-date="2026-12-15"]')).toHaveAttribute(
    'aria-label',
    '2026-12-15 · 일정 120건',
  );
  await expect(page.getByText('날짜 없는 준비', { exact: true })).toHaveCount(
    0,
  );
  await page
    .locator('.calendar-quick-actions')
    .getByRole('link', { name: '일정', exact: true })
    .click();
  const form = page.locator('.calendar-composer form');
  await form.getByLabel('제목', { exact: true }).fill('목록에서 새 일정');
  await form.getByLabel('날짜', { exact: true }).fill('2026-12-14');
  await form.getByRole('button', { name: '저장하기', exact: true }).click();
  const entry = page
    .locator('.calendar-event')
    .filter({ hasText: '목록에서 새 일정' });
  await expect(entry).toBeVisible();
  await entry.locator('xpath=../..').locator('.swipe-delete button').focus();
  page.once('dialog', (d) => d.accept());
  await entry
    .locator('xpath=../..')
    .getByRole('button', { name: '삭제', exact: true })
    .click();
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
  await expect(page.locator('.events-panel .calendar-event')).toHaveCount(0);
  await expect(page.locator('.quick-grid > *')).toHaveCount(19);
  for (const label of ['수면', '기저귀', '배변'])
    await expect(page.locator('.quick-grid').getByRole('button', { name: label, exact: true })).toBeVisible();
  await page.locator('.quick-grid').getByRole('button', { name: '수면', exact: true }).click();
  const sleepSheet = page.locator('.quick-composer');
  await expect(sleepSheet).toBeVisible();
  await expect(sleepSheet.getByRole('link', { name: '자세히 기록', exact: true })).toHaveCount(0);
  await sleepSheet.getByRole('button', { name: '취소', exact: true }).click();
  await expect(sleepSheet).toBeHidden();
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator('.quick-grid')
    .screenshot({ caret: 'initial', path: 'test-results/quick-care-390.png' });
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
        .getByRole('button', { name: 'Sleep', exact: true }),
    ).toBeDisabled();
    await readerPage.goto(`/en/calendar?child=${child}`);
    await expect(readerPage.locator('.calendar-event')).toHaveCount(1);
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
  await page.goto(`/ko/vaccinations?child=${child}`);
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
  await page.goto(`/ko/calendar?child=${child}&month=2026-10&day=2026-10-21`);
  await expect(
    page.locator('.calendar-event').filter({ hasText: '독감(인플루엔자)' }),
  ).toBeVisible();
  await expect(
    page.locator('.calendar-event').filter({ hasText: '독감(인플루엔자)' }),
  ).toContainText('가족 소아과');
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
  await page.goto(`/ko/vaccinations?child=${child}&tab=planned`);
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
  await page.screenshot({ caret: 'initial',
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
      `/en/vaccinations?child=${child}&tab=completed`,
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
  await expect(page).toHaveURL(/\/ko\/vaccinations/);
  expect(
    (await admin.from('vaccination_records').select('id').eq('id', id)).data,
  ).toHaveLength(0);
});

test('public introduction explains the service on mobile and preserves invitation links across languages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ko');
  await expect(page.getByRole('heading', { name: '함께 돌보는, 포근한 둥지' })).toBeVisible();
  await expect(page.locator('main')).toContainText('예시 화면');
  await expect(page.locator('main')).toContainText('기록이 쌓이면, 우리 아이가 더 잘 보여요.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const preview = page.locator('[aria-label="인사이트 미리보기 선택"]');
  for (const label of ['주간패턴', '통계', '성장곡선', '마일스톤', '가이드', '선물·용돈', '하루패턴']) {
    await preview.getByRole('button', {name:label,exact:true}).click();
    await expect(preview.getByRole('button', {name:label,exact:true})).toHaveAttribute('aria-pressed','true');
  }
  await expect(page.locator('main')).toContainText('같은 D+의 하루는');
  await expect(page.locator('main')).toContainText('어제 이 시간에 분유 먹었어요');
  const examples = page.locator('img[alt*="예시 아이 일러스트"]');
  await expect(examples).toHaveCount(2);
  for (const image of await examples.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  expect(await examples.nth(0).getAttribute('src')).not.toBe(await examples.nth(1).getAttribute('src'));
  const closing = page.getByRole('heading', {name:'오늘부터, 함께 돌봐요.',exact:true}).locator('..');
  const install = closing.getByRole('button', {name:'앱으로 설치',exact:true});
  await install.scrollIntoViewIfNeeded();
  const mainBox = (await closing.getByRole('link', {name:'포둥 시작하기',exact:true}).boundingBox())!;
  const installBox = (await install.boundingBox())!;
  expect(installBox.y - mainBox.y - mainBox.height).toBeGreaterThanOrEqual(12);
  await install.click();
  const installation = page.getByRole('dialog', {name:'앱으로 설치',exact:true});
  expect(await installation.evaluate(node=>node.parentElement?.tagName)).toBe('BODY');
  await installation.getByRole('button', {name:'다음 단계',exact:true}).click();
  await expect(installation.getByRole('img', {name:'2단계 메뉴 위치를 표시한 안내용 재현 화면',exact:true})).toBeVisible();
  await installation.getByRole('button', {name:'확인',exact:true}).click();
  const invitation = '/ko/invite/' + 'a'.repeat(64);
  await page.goto('/ko/intro?next=' + encodeURIComponent(invitation));
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Care together. Grow closer.' })).toBeVisible();
  await page.getByRole('link', { name: 'Start with podoong', exact: true }).first().click();
  await expect(page).toHaveURL(/\/en\/login/);
  expect(new URL(page.url()).searchParams.get('next')).toBe(invitation.replace('/ko/', '/en/'));
  await page.getByRole('link', { name: 'Explore podoong', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/intro/);
  await page.goto('/en/intro?next=https://evil.test');
  expect(await page.getByRole('link', { name: 'Start with podoong', exact: true }).first().getAttribute('href')).toBe('/en/login?next=%2Fen%2Ftoday');
});

test('returning families skip the introduction while the preview remains accessible', async ({ page, context }) => {
  await childCareFamily(context);
  await page.goto('/ko');
  await expect(page).toHaveURL(/\/ko\/today/);
  await page.goto('/ko/intro');
  await expect(page.getByRole('heading', { name: '함께 돌보는, 포근한 둥지' })).toBeVisible();
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
  await page.getByRole('link',{name:'Terms',exact:true}).click();
  await page.getByRole('link',{name:'동의 안내',exact:true}).click();
  await page.getByRole('link',{name:'Back',exact:true}).click();
  await expect(page).toHaveURL(/\/en\/login/);
  expect(new URL(page.url()).searchParams.get('next')).toBe(invitation.replace('/ko/','/en/'));
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
  page.setDefaultTimeout(15000);
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
  await admin.from('children').insert({sex: 'female',
    family_id: family.id,
    name: '첫째',
    birth_date: '2026-09-01',
  });
  await page.goto('/ko/family');
  const form = page
    .locator('form')
    .filter({ has: page.locator('input[name="name"]') });
  await form.getByLabel('아이 이름 또는 닉네임').fill('둘째');
  await expect(form.getByLabel('아이 성별', { exact: true })).toHaveValue('');
  await form.getByLabel('아이 성별', { exact: true }).selectOption('male');
  await expect(form.getByText('출산 예정일')).toHaveCount(0);
  await form.getByLabel('아이 태어난 날').fill('2026-10-01');
  await Promise.all([
    page.waitForURL(/\/ko\/today\?child=/, { timeout: 30000 }),
    form.getByRole('button', { name: '아이 추가', exact: true }).click(),
  ]);
  await expect(page.locator('.topbar-child-info strong')).toHaveText('둘째');
  await page.reload();
  await expect(page.locator('.topbar-child-info strong')).toHaveText('둘째');
  await page
    .locator(
      '.topbar-child-picker:visible summary',
    )
    .click();
  await expect(page.locator('.topbar-child-options a')).toHaveCount(2);
  await page
    .locator('.topbar-child-options:visible')
    .getByRole('link')
    .filter({ hasText: '첫째' })
    .click();
  await expect(page.locator('.topbar-child-info strong')).toHaveText('첫째');
  await expect(page.locator('.topbar .date')).toHaveCount(0);
  await expect(page.locator('.child-bar')).toHaveCount(0);
  await expect(page.locator('.topbar-child-info')).toContainText('생후');
  for (const width of [1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .locator(
        '.topbar-child-picker:visible summary',
      )
      .click();
    await expect(
      page.locator(
        '.topbar-child-options:visible',
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ caret: 'initial',
      path: `test-results/topbar-child-${width}.png`,
      fullPage: false,
    });
    await page.keyboard.press('Escape');
    await expect(
      page.locator(
        '.topbar-child-options:visible',
      ),
    ).not.toBeVisible();
  }
  await page
    .locator(
      '.topbar-child-picker:visible summary',
    )
    .click();
  await page.locator('[data-last-care="sleep"]').click();
  await expect(
    page.locator(
      '.topbar-child-options:visible',
    ),
  ).not.toBeVisible();
  const firstId = new URL(page.url()).searchParams.get('child')!;
  for (const width of [1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of ['calendar', 'family', 'community']) {
      const dateQuery =
        section === 'calendar' ? '&month=2026-11&day=2026-11-05' : '';
      await page.goto(`/ko/${section}?child=${firstId}${dateQuery}`);
      await expect(page.locator('.topbar-child-info strong')).toHaveText(
        '첫째',
      );
      await expect(page.locator('.topbar-child-info')).toContainText('생후');
      await expect(
        page.locator('.child-bar,.child-picker,.topbar .date'),
      ).toHaveCount(0);
      await expect(page.locator('.topbar .language')).toHaveCount(0);
      if (width > 760)
        await expect(page.locator('.topbar .avatar')).toBeVisible();
      else await expect(page.locator('.topbar')).toBeHidden();
      await page
        .locator(
          '.topbar-child-picker:visible summary',
        )
        .click();
      await page
        .locator('.topbar-child-options:visible')
        .getByRole('link')
        .filter({ hasText: '둘째' })
        .click();
      await expect(page.locator('.topbar-child-info strong')).toHaveText(
        '둘째',
      );
      const target = new URL(page.url());
      expect(target.pathname).toBe(`/ko/${section}`);
      expect(target.searchParams.get('child')).not.toBe(firstId);
      if (section === 'calendar') {
        expect(target.searchParams.get('month')).toBe('2026-11');
        expect(target.searchParams.get('day')).toBe('2026-11-05');
      }
      await expect(page.locator('.topbar .avatar')).toHaveAttribute(
        'href',
        `/ko/account?child=${target.searchParams.get('child')}&panel=account`,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({ caret: 'initial',
        path: `test-results/unified-header-${section}-${width}.png`,
        animations: 'disabled',
      });
    }
  }
});

test('LAN local hostname can initialize the development client connection', async () => {
  test.skip(process.env.PODUNG_TEST_PRODUCTION === '1', 'Development server connection only');
  const host = `${hostname().toLowerCase().replace(/\.local$/, '')}.local`;
  const status = await new Promise<string>((resolve, reject) => {
    const socket = connect(3188, '127.0.0.1', () => {
      socket.write([
        'GET /_next/hmr HTTP/1.1',
        'Host: 127.0.0.1:3188',
        'Connection: Upgrade',
        'Upgrade: websocket',
        'Sec-WebSocket-Version: 13',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        `Origin: http://${host}:3188`,
        '', '',
      ].join('\r\n'));
    });
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('Development connection timed out')); });
    socket.once('error', reject);
    socket.once('data', data => { socket.destroy(); resolve(data.toString().split('\r\n')[0]); });
  });
  expect(status).toBe('HTTP/1.1 101 Switching Protocols');
});

test('signup consent remains usable before client JavaScript is available', async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const user = await signIn(context);
    const page = await context.newPage();
    await page.goto('/ko/onboarding');
    await expect(page.locator('.brand-image')).toHaveCSS('background-image', 'none');
    const terms = page.getByRole('checkbox', { name: '[필수] 서비스 이용약관에 동의합니다', exact: true });
    const collection = page.getByRole('checkbox', { name: '[필수] 가입 개인정보 수집·이용에 동의합니다', exact: true });
    const agree = page.getByRole('button', { name: '동의하고 계속하기', exact: true });
    await terms.check();
    await collection.check();
    await expect(agree).toBeEnabled();
    await collection.uncheck();
    await agree.click();
    await expect(page.getByLabel('보호자 이름')).toHaveCount(0);
    expect((await admin.from('signup_agreements').select('kind').eq('user_id', user)).data).toHaveLength(0);
    await collection.check();
    await agree.click();
    await page.getByRole('link', { name: '처음 시작해요' }).click();
    await expect(page.getByLabel('보호자 이름')).toBeVisible();
    const fields = page.locator('.onboard-information input:not([type=hidden]), .onboard-information select');
    expect(await fields.evaluateAll(elements => elements.map(element => element.getAttribute('name')))).toEqual(['family', 'name', 'child', 'sex', 'birth', 'relationship', 'timezone']);
    expect(await fields.evaluateAll(elements => elements.every(element => element.hasAttribute('required')))).toBe(true);
    await expect(page.getByLabel('아이 성별', { exact: true })).toBeVisible();
    await expect(page.getByLabel('아이와 나의 관계')).toBeVisible();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const date = (await page.getByLabel('아이 태어난 날').boundingBox())!;
      const name = (await page.getByLabel('가족 이름').boundingBox())!;
      expect(Math.abs(date.x - name.x)).toBeLessThan(1);
      expect(Math.abs(date.width - name.width)).toBeLessThan(1);
      expect(Math.abs(date.height - name.height)).toBeLessThan(1);
      expect(Math.abs((await page.getByLabel('아이 성별', { exact: true }).boundingBox())!.height - name.height)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: test.info().outputPath('onboarding-mobile-webkit.png'), fullPage: true });
    expect((await admin.from('signup_agreements').select('kind').eq('user_id', user)).data).toHaveLength(2);
  } finally {
    await browser.close();
  }
});

test('onboarding and birth-date confirmation work with a real local DB', async ({
  page,
  context,
}) => {
  const user = await signIn(context);
  await page.goto('/ko/today');
  await expect(page).toHaveURL(/onboarding/);
  await expect(page.getByLabel('보호자 이름')).toHaveCount(0);
  const agree = page.getByRole('button', {name:'동의하고 계속하기',exact:true});
  await agree.click();
  await expect(page.getByRole('checkbox', {name:'[필수] 서비스 이용약관에 동의합니다',exact:true})).toBeFocused();
  await page.getByRole('link', {name:'서비스 이용약관 전문 보기',exact:true}).click();
  await expect(page).toHaveURL(/legal\/terms.*version=signup-/);
  await expect(page.getByRole('heading',{name:'서비스 이용약관',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'돌아가기',exact:true}).click();
  await expect(page).toHaveURL(/onboarding/);
  await expect(page.getByLabel('보호자 이름')).toHaveCount(0);
  for (const width of [320,390]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('checkbox',{name:'[필수] 서비스 이용약관에 동의합니다',exact:true}).check();
  await agree.click();
  await expect(page.getByRole('checkbox',{name:'[필수] 가입 개인정보 수집·이용에 동의합니다',exact:true})).toBeFocused();
  await page.getByRole('checkbox',{name:'[필수] 가입 개인정보 수집·이용에 동의합니다',exact:true}).check();
  await expect(agree).toBeEnabled();
  await agree.click();
  await expect(page.getByRole('link', { name: '가족이 이미 사용 중이에요' })).toBeVisible();
  await page.getByRole('link', { name: '가족이 이미 사용 중이에요' }).click();
  await expect(page.getByLabel('가족 초대 링크 또는 코드')).toBeVisible();
  await expect(page.getByLabel('아이 이름 또는 닉네임')).toHaveCount(0);
  await page.getByRole('link', { name: '돌아가기', exact: true }).click();
  await page.getByRole('link', { name: '처음 시작해요' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.onboard-information')).toHaveAttribute('data-mobile', 'false');
  await expect(page.getByLabel('보호자 이름')).toBeVisible();
  const agreements = await admin.from('signup_agreements').select('kind,version,accepted_at,interface_locale').eq('user_id',user);
  expect(agreements.error).toBeNull();
  expect(agreements.data?.map(row=>row.kind).sort()).toEqual(['account_collection','terms']);
  expect(agreements.data?.every(row=>row.accepted_at&&row.interface_locale==='ko'&&row.version==='signup-2026-10-30-draft.1')).toBe(true);
  expect((await admin.from('profiles').select('id').eq('id',user)).data).toHaveLength(0);
  await page.getByLabel('보호자 이름').fill('테스트 보호자');
  await page.getByLabel('가족 이름').fill('테스트 둥지');
  await page.getByLabel('아이 이름 또는 닉네임').fill('포근이');
  await expect(page.getByLabel('아이 성별', { exact: true })).toHaveAttribute('required', '');
  await page.getByLabel('아이 성별', { exact: true }).selectOption('female');
  await expect(page.getByText('출산 예정일')).toHaveCount(0);
  await page.getByLabel('아이 태어난 날').fill('2026-10-01');
  await expect(page.getByLabel('아이와 나의 관계')).toHaveAttribute('required','');
  await page.getByLabel('아이와 나의 관계').selectOption('father');
  await page.getByRole('button', { name: '우리 가족 시작하기' }).click();
  await expect(page).toHaveURL(/\/ko\/today/);
  await expect(page.locator('.topbar-child-info strong')).toHaveText('포근이');
  const registeredChild = new URL(page.url()).searchParams.get('child')!;
  expect((await admin.from('children').select('sex').eq('id', registeredChild).single()).data?.sex).toBe('female');
  await page.goto(`/ko/family?child=${registeredChild}`);
  await page.getByLabel('아이 태어난 날').first().fill('2026-10-12');
  await page.locator('form').filter({ has: page.locator('input[name="birth"][value="2026-10-01"]') }).getByRole('button', { name: '저장하기' }).click();
  await expect(page.locator('.topbar-child-info')).toContainText('생후');
});

test('mobile onboarding advances one field at a time and preserves input across back and resize', async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Kolkata', baseURL: 'http://127.0.0.1:3188', viewport: { width: 390, height: 844 } });
  try {
    const user = await signIn(context);
    const page = await context.newPage();
    await page.goto('/ko/onboarding');
    await page.locator('.signup-consent input[type=checkbox]').nth(0).check();
    await page.locator('.signup-consent input[type=checkbox]').nth(1).check();
    await page.getByRole('button', { name: '동의하고 계속하기', exact: true }).click();
    await page.getByRole('link', { name: '처음 시작해요' }).click();
    const form = page.locator('.onboard-information');
    const next = page.getByRole('button', { name: '다음', exact: true });
    const back = page.getByRole('button', { name: '이전', exact: true });
    await expect(form).toHaveAttribute('data-mobile', 'true');
    await expect(page.locator('.onboard-step:visible')).toHaveCount(1);
    await next.click();
    await expect(page.getByLabel('가족 이름')).toBeVisible();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const bounds = (await next.boundingBox())!;
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    }
    await page.screenshot({ path: test.info().outputPath('onboarding-mobile-first-step.png'), fullPage: true });
    await page.getByLabel('가족 이름').fill('모바일 둥지');
    await next.click();
    await expect(page.getByLabel('보호자 이름')).toBeVisible();
    await expect(page.getByLabel('보호자 이름')).toBeFocused();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const previousButton = (await back.boundingBox())!;
      const nextButton = (await next.boundingBox())!;
      expect(Math.abs(previousButton.y - nextButton.y)).toBeLessThan(1);
      expect(Math.abs(previousButton.height - nextButton.height)).toBeLessThan(1);
      expect(nextButton.x - previousButton.x - previousButton.width).toBeGreaterThanOrEqual(10);
      expect(await page.locator('.onboard-form-actions button').evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth))).toBe(true);
    }
    await page.screenshot({ path: test.info().outputPath('onboarding-mobile-buttons.png'), animations: 'disabled', fullPage: true });
    await back.click();
    await expect(page.getByLabel('가족 이름')).toHaveValue('모바일 둥지');
    await expect(page.getByLabel('가족 이름')).toBeFocused();
    await next.click();
    await page.getByLabel('보호자 이름').fill('모바일 보호자');
    await page.getByLabel('보호자 이름').press('Enter');
    await expect(page.getByLabel('아이 이름 또는 닉네임')).toBeFocused();
    await page.getByLabel('아이 이름 또는 닉네임').fill('포근이');
    await next.click();
    await next.click();
    await expect(page.getByLabel('아이 성별', { exact: true })).toBeVisible();
    await expect(page.getByLabel('아이 성별', { exact: true })).toBeFocused();
    await page.getByLabel('아이 성별', { exact: true }).selectOption('female');
    await back.click();
    await expect(page.getByLabel('아이 이름 또는 닉네임')).toHaveValue('포근이');
    await next.click();
    await expect(page.getByLabel('아이 성별', { exact: true })).toHaveValue('female');
    await next.click();
    await expect(page.getByLabel('아이 태어난 날')).toBeFocused();
    await page.getByLabel('아이 태어난 날').fill('2026-10-01');
    await page.screenshot({ path: test.info().outputPath('onboarding-mobile-date-step.png'), fullPage: true });
    await next.click();
    await page.getByLabel('아이와 나의 관계').selectOption('mother');
    await next.click();
    const timezone = page.getByRole('combobox', { name: '시간대', exact: true });
    await expect(timezone).toHaveValue(/^Asia\/(Kolkata|Calcutta)$/);
    expect(await timezone.locator('option').count()).toBeGreaterThan(400);
    await timezone.selectOption('Pacific/Auckland');
    await expect(page.getByRole('button', { name: '우리 가족 시작하기', exact: true })).toBeVisible();
    expect((await admin.from('profiles').select('id').eq('id', user)).data).toHaveLength(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(form).toHaveAttribute('data-mobile', 'false');
    await expect(page.locator('.onboard-step:visible')).toHaveCount(7);
    await expect(page.getByLabel('가족 이름')).toHaveValue('모바일 둥지');
    await expect(page.getByLabel('보호자 이름')).toHaveValue('모바일 보호자');
    await expect(page.getByLabel('아이 태어난 날')).toHaveValue('2026-10-01');
    await expect(timezone).toHaveValue('Pacific/Auckland');
    await page.getByLabel('가족 이름').fill('');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(form).toHaveAttribute('data-mobile', 'true');
    await expect(page.locator('.onboard-step:visible')).toHaveCount(1);
    await expect(page.getByRole('combobox', { name: '시간대', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '우리 가족 시작하기', exact: true }).click();
    await expect(page.getByLabel('가족 이름')).toBeVisible();
    await page.getByLabel('가족 이름').fill('모바일 둥지');
    for (let index = 0; index < 6; index++) await next.click();
    await page.getByRole('button', { name: '우리 가족 시작하기', exact: true }).click();
    await expect(page).toHaveURL(/\/ko\/today\?child=/);
    const child = new URL(page.url()).searchParams.get('child')!;
    expect((await admin.from('children').select('name,birth_date,sex').eq('id', child).single()).data).toEqual({ name: '포근이', birth_date: '2026-10-01', sex: 'female' });
    expect((await admin.from('profiles').select('timezone').eq('id', user).single()).data?.timezone).toBe('Pacific/Auckland');
  } finally { await browser.close(); }
});

test('signup agreements support refusal and preserve the English invitation flow', async ({context, browser}) => {
  const own = await childCareFamily(context);
  const legacy = await context.newPage();
  await legacy.goto('/ko/onboarding');
  await expect(legacy.getByLabel('보호자 이름')).toHaveCount(0);
  await legacy.locator('.signup-consent input[type=checkbox]').nth(0).check();
  await legacy.locator('.signup-consent input[type=checkbox]').nth(1).check();
  await legacy.getByRole('button',{name:'동의하고 계속하기',exact:true}).click();
  await expect(legacy).toHaveURL(/\/ko\/today/);
  expect((await admin.from('children').select('id').eq('family_id',own.family)).data).toHaveLength(1);
  await legacy.close();
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const digest = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  expect((await admin.from('invitations').insert({family_id:own.family,child_id:own.child,role:'editor',token_hash:digest,created_by:own.owner,expires_at:new Date(Date.now()+86400000).toISOString()})).error).toBeNull();
  const next = `/en/invite/${token}`;
  const declinedContext = await browser.newContext();
  try {
    const declinedUser = await signIn(declinedContext);
    const declined = await declinedContext.newPage();
    await declined.goto(`/en/onboarding?next=${encodeURIComponent(next)}`);
    await declined.getByRole('button',{name:'Leave without agreeing',exact:true}).click();
    await expect(declined).toHaveURL(/\/en\/login/);
    expect((await admin.from('signup_agreements').select('kind').eq('user_id',declinedUser)).data).toHaveLength(0);
    expect((await admin.from('profiles').select('id').eq('id',declinedUser)).data).toHaveLength(0);
  } finally { await declinedContext.close(); }
  const invitedContext = await browser.newContext({viewport:{width:320,height:740}});
  try {
    const invitedUser = await signIn(invitedContext);
    const invited = await invitedContext.newPage();
    await invited.goto(next);
    await expect(invited.getByRole('heading',{name:'Start with podoong',exact:true})).toBeVisible();
    await expect(invited.getByLabel('Caregiver name')).toHaveCount(0);
    await invited.getByRole('link',{name:'Read the account information collection notice',exact:true}).click();
    await expect(invited.getByRole('heading',{name:'Account Information Collection Notice',exact:true})).toBeVisible();
    await expect(invited.locator('.legal-version')).toContainText('Korean original');
    await invited.getByRole('link',{name:'Back',exact:true}).click();
    await invited.getByRole('link',{name:'Privacy Policy',exact:true}).click();
    await invited.getByRole('link',{name:'동의 문안',exact:true}).click();
    await invited.getByRole('link',{name:'Back',exact:true}).click();
    expect(new URL(invited.url()).searchParams.get('next')).toBe(next);
    await invited.locator('.signup-consent input[type=checkbox]').nth(0).check();
    await invited.locator('.signup-consent input[type=checkbox]').nth(1).check();
    await invited.getByRole('button',{name:'Agree and continue',exact:true}).click();
    await invited.getByLabel('Caregiver name').fill('Invited caregiver');
    await expect(invited.locator('input[name=child]')).toHaveCount(0);
    await invited.getByRole('button',{name:'Confirm invitation and join',exact:true}).click();
    await expect(invited).toHaveURL(new RegExp(`/en/invite/${token}$`));
    await invited.locator('select[name=relationship]').selectOption('maternal_aunt');
    await invited.locator('input[name=confirm]').check();
    await invited.getByRole('button',{name:'Join family',exact:true}).click();
    await expect(invited).toHaveURL(new RegExp(`/en/today\\?child=${own.child}`));
    expect((await admin.from('signup_agreements').select('interface_locale').eq('user_id',invitedUser)).data?.every(row=>row.interface_locale==='en')).toBe(true);
    expect((await admin.from('children').select('id').eq('family_id',own.family)).data).toHaveLength(1);
  } finally { await invitedContext.close(); }
});

test('settings family join preserves both parents child entries and existing records', async ({ context, browser }, testInfo) => {
  const target = await childCareFamily(context);
  const sourceContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const source = await childCareFamily(sourceContext);
    await admin.from('families').update({ name: '아빠의 가족' }).eq('id', target.family);
    await admin.from('families').update({ name: '엄마의 가족' }).eq('id', source.family);
    const record = crypto.randomUUID();
    expect((await admin.from('care_records').insert({ id: record, child_id: source.child, kind: 'formula', started_at: new Date(Date.now() - 3600000).toISOString(), ended_at: new Date(Date.now() - 3000000).toISOString(), amount_ml: 160, created_by: source.owner, updated_by: source.owner })).error).toBeNull();
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
    const digest = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
    expect((await admin.from('invitations').insert({ family_id: target.family, child_id: target.child, role: 'editor', token_hash: digest, created_by: target.owner, expires_at: new Date(Date.now() + 86400000).toISOString() })).error).toBeNull();
    const page = await sourceContext.newPage();
    await page.goto(`/ko/account?child=${source.child}&panel=join`);
    await page.getByLabel('가족 초대 링크 또는 코드').fill(`http://127.0.0.1:3188/ko/invite/${token}`);
    await page.getByRole('button', { name: '초대 확인하기', exact: true }).click();
    await expect(page.locator('.family-join-destination')).toContainText('아빠의 가족');
    await expect(page.locator('.family-join-scope')).toContainText('엄마의 가족');
    await expect(page.locator('.family-join-scope li')).toHaveText('돌봄 아이');
    expect((await admin.from('children').select('family_id').eq('id', source.child).single()).data?.family_id).toBe(source.family);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath('family-join-mobile.png'), fullPage: true });
    await page.getByLabel('아이와의 관계').selectOption('mother');
    await page.locator('input[name=confirm]').check();
    await page.getByRole('button', { name: '아이 정보 보존하고 참여하기', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/ko/today\\?child=${target.child}$`));
    const children = await admin.from('children').select('id').eq('family_id', target.family);
    expect(children.data?.map(child => child.id).sort()).toEqual([source.child, target.child].sort());
    expect((await admin.from('care_records').select('amount_ml,child_id').eq('id', record).single()).data).toEqual({ amount_ml: 160, child_id: source.child });
    await page.goto(`/ko/account?child=${source.child}`);
    await expect(page.locator('.account-child-list > a')).toHaveCount(2);
    const ownerPage = await context.newPage();
    await ownerPage.goto(`/ko/account?child=${target.child}&panel=data`);
    await expect(ownerPage.getByRole('button', { name: '아이 데이터 영구 삭제', exact: true })).toHaveCount(2);
    await ownerPage.close();
  } finally { await sourceContext.close(); }
});

test('responsive dashboard and current navigation remain within the viewport', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
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
    .insert({sex: 'female', family_id: family!.id, name: '도담이', birth_date: '2026-09-01' })
    .select('id')
    .single();
  if (childError || !child) throw new Error('Fixture child creation failed');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/ko/today');
    await expect(
      page.getByRole('heading', { name: '도담이의 하루', exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('.last-care-card')).toHaveCount(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('heading', { name: '마지막 먹이기', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ caret: 'initial',
      path: `test-results/today-${width}.png`,
      fullPage: true,
    });
  }
  await expect(page.locator('.mobile-nav a')).toHaveText([
    '오늘', '일정', '인사이트', '성장 일기', '동네 생활', '도담이',
  ]);
  for (const section of ['today','calendar','insights','community/diaries','community','account']) {
    await page.goto(`/ko/${section}?child=${child.id}`);
    await expect(page.locator('.feature-nav')).toHaveCount(0);
    await expect(page.locator('.mobile-nav > a')).toHaveCount(6);
    await expect(page.locator('.mobile-nav').getByRole('link', { name: '돌봄 기록', exact: true })).toHaveCount(0);
  }
  await page.goto(`/en/community?child=${child.id}`);
  await expect(page.getByText('Parenting chat', { exact: true })).toBeVisible();
  await expect(page.getByText('Kids’ marketplace', { exact: true })).toBeVisible();
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
  await expect(page).toHaveURL(/\/en\/today/);
  const quick = page.locator('.quick-care');
  await expect(quick.locator('.timer')).toBeVisible();
  await quick.getByRole('button', { name: 'Finish record', exact: true }).click();
  await quick
    .locator('.quick-editor-form')
    .getByRole('button', { name: 'Finish record', exact: true })
    .click();
  await expect(quick.locator('.timer')).toHaveCount(0);
});

test('direct community composing, comments and photos obey permissions', async ({
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
    await page.goto(`/ko/community/new?family=${family}&board=locality`);
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
      await page.screenshot({ caret: 'initial',
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
      await page.screenshot({ caret: 'initial',
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
    await readerPage.screenshot({ caret: 'initial',
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
    await expect(readerPage).toHaveURL(/community(?:\/boards)?\?.*notice=saved/);
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
    await page.screenshot({ caret: 'initial',
      path: 'test-results/community-390.png',
      fullPage: true,
    });
    expect(hydration).toEqual([]);
  } finally {
    await readerContext.close();
  }
});

test('local life requires an area and presents the three neighborhood features in both languages', async ({page,context}) => {
  const home = await childCareFamily(context);
  await page.goto(`/ko/community?child=${home.child}`);
  await expect(page.getByRole('heading',{name:'동네 생활',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'우리 동네 신청하기',exact:true})).toBeDisabled();
  await expect(page.locator('.community-hub-card')).toHaveCount(3);
  await setFamilyResidence(home.family,'1168010100');
  await page.reload();
  await expect(page.getByRole('button',{name:'우리 동네 신청하기',exact:true})).toBeEnabled();
  await expect(page.locator('.community-location')).toContainText('강남구 역삼동');
  await page.goto(`/en/community?child=${home.child}`);
  await expect(page.getByRole('heading',{name:'Local life',exact:true})).toBeVisible();
  for(const name of ['Parenting chat','Kids’ marketplace','Government & local support'])
    await expect(page.getByText(name,{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Request our neighborhood',exact:true})).toBeEnabled();
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
      await page.screenshot({ caret: 'initial',
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
        await admin.from('children').insert({sex: 'female',
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
    await admin.from('children').insert({sex: 'female',
      id: disposable,
      family_id: familyId,
      name: 'Delete fixture',
      birth_date: '2026-09-01',
    });
    await page.goto(`/ko/account?panel=account&child=${childId}`);
    await expect(page.getByText('다른 보호자가 있어 탈퇴할 수 없습니다.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: '회원 탈퇴', exact: true })).toHaveCount(0);
    await page.goto(`/ko/account?panel=data&child=${childId}`);
    await expect(page.getByLabel('DELETE CHILD 입력')).toHaveCount(2);
    await expect(page.getByRole('link', { name: /다운로드/ })).toHaveCount(0);
    const childPanel = page.locator('.account-danger-section').filter({
      has: page.getByRole('heading', { name: 'Delete fixture', exact: true }),
    });
    await childPanel.getByLabel('DELETE CHILD 입력').fill('DELETE CHILD');
    await childPanel.getByRole('button', { name: '아이 데이터 영구 삭제' }).click();
    await expect.poll(async () => (await admin.from('children').select('id').eq('id', disposable)).data?.length).toBe(0);
    await page.goto(`/ko/account?panel=data&child=${childId}`);
    const transfer = page
      .locator('form')
      .filter({ has: page.locator('input[name="action"][value="transfer"]') });
    await transfer.getByLabel('새 소유자').selectOption(member);
    await transfer.getByLabel('TRANSFER OWNER 입력').fill('TRANSFER OWNER');
    await transfer
      .getByRole('button', { name: '소유권 이전', exact: true })
      .click();
    await expect(page.getByText('데이터 설정', { exact: true })).toHaveCount(0);
    await page.goto(`/ko/account?panel=account&child=${childId}`);
    await page.getByLabel('DELETE ACCOUNT 입력').fill('DELETE ACCOUNT');
    await page
      .getByRole('button', { name: '회원 탈퇴', exact: true })
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
      memberPage.getByRole('button', { name: 'Permanently delete child data', exact: true }),
    ).toBeVisible();
  } finally {
    await memberContext.close();
  }
});

test('quick care saves typed feeding, timers and diapers in place and preserves input across viewport changes', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(150000);
  // LAN HTTP does not expose randomUUID, unlike localhost's secure context.
  await context.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    });
  });
  const { owner, family, child } = await childCareFamily(context);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(`/ko/today?child=${child}`);
  const quick = page.locator('.quick-care');
  const dialog = quick.locator('dialog.quick-composer');
  await expect(quick.locator('.quick-grid')).not.toHaveCSS('position', 'fixed');
  await expect(quick).toBeVisible();
  await expect(quick.getByText('3초 육아 기록', { exact: true })).toHaveCount(
    0,
  );
  await quick.screenshot({ caret: 'initial', path: 'test-results/quick-care-desktop-empty.png' });
  await quick
    .locator('.quick-grid')
    .getByRole('button', { name: '분유', exact: true })
    .click();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => d.matches(':modal'))).toBe(false);
  const slider = dialog.getByRole('slider', {
    name: '먹인 양 (ml)',
    exact: true,
  });
  await expect(slider).toHaveValue('80');
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.3, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(slider).not.toHaveValue('80');
  await dialog.getByRole('button', { name: '120 ml', exact: true }).click();
  await dialog
    .getByRole('group', { name: '먹인 시간', exact: true })
    .getByRole('button', { name: '15분', exact: true })
    .click();
  await quick.screenshot({ caret: 'initial',
    path: 'test-results/quick-care-desktop-editor.png',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => dialog.evaluate((d) => d.matches(':modal')))
    .toBe(true);
  await expect(quick.locator('.quick-grid')).toBeHidden();
  await expect(slider).toHaveValue('120');
  await expect(
    dialog.getByRole('button', { name: '15분', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/quick-care-mobile-sheet.png',
    fullPage: false,
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect
    .poll(() => dialog.evaluate((d) => d.matches(':modal')))
    .toBe(false);
  await expect(slider).toHaveValue('120');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => dialog.evaluate((d) => d.matches(':modal')))
    .toBe(true);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const selector of [
      '.quick-amount-presets',
      '.quick-feeding-duration .quick-choices',
    ]) {
      const rows = await dialog
        .locator(`${selector} > button`)
        .evaluateAll((buttons) =>
          buttons.map((button) =>
            Math.round(button.getBoundingClientRect().top),
          ),
        );
      expect(new Set(rows).size).toBe(1);
      expect(rows).toHaveLength(7);
    }
    await dialog.screenshot({ caret: 'initial',
      path: `test-results/feeding-presets-${width}.png`,
    });
  }
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(quick.getByRole('status')).toHaveCount(0);
  await expectPhoneFunctionDock(page, quick.locator('.quick-grid'));
  await page.screenshot({ caret: 'initial',
    path: 'test-results/phone-functions-today.png',
    animations: 'disabled',
  });
  await expect(page).toHaveURL(new RegExp(`/ko/today\\?child=${child}`));
  const formula = await admin
    .from('care_records')
    .select('*')
    .eq('child_id', child)
    .eq('kind', 'formula')
    .single();
  expect(formula.error).toBeNull();
  expect(formula.data).toMatchObject({
    amount_ml: 120,
    amount_g: null,
    food_name: '',
    created_by: owner,
  });
  expect(
    Date.parse(formula.data!.ended_at!) - Date.parse(formula.data!.started_at),
  ).toBe(15 * 60000);
  await expect(quick.locator('.quick-timeline')).toContainText('120 ml');
  await expect(page.locator('[data-last-care="feeding"]')).toContainText(
    '분유',
  );
  await expect(page.locator('[data-last-care="feeding"]')).toContainText(
    '120 ml',
  );
  await quick
    .locator('.quick-grid')
    .getByRole('button', { name: '이유식', exact: true })
    .click();
  await dialog.getByRole('button', { name: '80 ml', exact: true }).click();
  await dialog.getByRole('button', { name: '10분', exact: true }).click();
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(quick.locator('.quick-timeline')).toContainText('80 ml');
  await expect(page.locator('[data-last-care="feeding"]')).toContainText(
    '이유식 · 80 ml',
  );
  const solids = await admin
    .from('care_records')
    .select('*')
    .eq('child_id', child)
    .eq('kind', 'solids')
    .single();
  expect(solids.data).toMatchObject({
    amount_g: null,
    amount_ml: 80,
    food_name: '',
  });
  await quick
    .locator('.quick-grid')
    .getByRole('button', { name: '모유', exact: true })
    .click();
  await expect(dialog.getByLabel('메모', { exact: true })).toHaveCount(0);
  const startedAt = Date.now();
  await dialog.getByRole('button', { name: '시작하기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(quick.locator('.quick-running')).toContainText('모유');
  await expect(page.locator('[data-last-care="feeding"]')).toContainText(
    '모유 · 수유 중',
  );
  const running = await admin
    .from('care_records')
    .select('*')
    .eq('child_id', child)
    .eq('kind', 'breast')
    .single();
  expect(running.data!.ended_at).toBeNull();
  expect(Date.parse(running.data!.started_at)).toBeGreaterThanOrEqual(
    startedAt - 2000,
  );
  await quick
    .locator('.quick-running')
    .getByRole('button', { name: '기록 종료', exact: true })
    .click();
  await dialog.getByRole('button', { name: '기록 종료', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const stopped = await admin
    .from('care_records')
    .select('*')
    .eq('id', running.data!.id)
    .single();
  expect(stopped.data).toMatchObject({
    version: 2,
    amount_ml: null,
    note: '',
  });
  expect(Date.parse(stopped.data!.ended_at!)).toBeGreaterThan(
    Date.parse(stopped.data!.started_at),
  );
  await quick
    .locator('.quick-grid')
    .getByRole('button', { name: '수면', exact: true })
    .click();
  await dialog.getByRole('button', { name: '시작하기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(quick.locator('.quick-running')).toContainText('수면');
  await quick
    .locator('.quick-running')
    .getByRole('button', { name: '일어났어요', exact: true })
    .click();
  await dialog.getByRole('button', { name: '일어났어요', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(quick.locator('.quick-running')).toHaveCount(0);
  const sleep = await admin
    .from('child_records')
    .select('*')
    .eq('child_id', child)
    .eq('service', 'sleep')
    .single();
  expect(sleep.data).toMatchObject({ kind: 'nap', version: 2 });
  expect(sleep.data!.ended_at).not.toBeNull();
  await expect(page.locator('[data-last-care="sleep"]')).toContainText('기상');
  await quick
    .locator('.quick-grid')
    .getByRole('button', { name: '기저귀', exact: true })
    .click();
  await dialog.getByRole('button', { name: '소변·대변', exact: true }).click();
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const diaper = await admin
    .from('child_records')
    .select('*')
    .eq('child_id', child)
    .eq('service', 'diaper')
    .single();
  expect(diaper.data).toMatchObject({
    kind: 'diaper_mixed',
    stool_color: null,
    stool_texture: null,
  });
  await expect(quick.locator('.quick-timeline')).toContainText('소변·대변');
  await expect(page.locator('[data-last-care="diaper"] time')).toHaveAttribute(
    'datetime',
    new Date(diaper.data!.occurred_at).toISOString(),
  );
  await expect(page.locator('[data-last-care="diaper"]')).toContainText(
    '소변·대변',
  );
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Quick reader',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      family_id: family,
      child_id: child,
      user_id: reader,
      role: 'viewer',
    });
    const readerPage = await readerContext.newPage();
    await readerPage.goto(`/en/today?child=${child}`);
    await expect(readerPage.locator('.quick-grid button:disabled')).toHaveCount(
      19,
    );
    await expect(readerPage.locator('.quick-grid a')).toHaveCount(0);
    await expect(
      readerPage.locator('.quick-timeline-entry:not(:disabled)'),
    ).toHaveCount(0);
    await expect(readerPage.locator('.quick-timeline')).toContainText('120 ml');
    await expect(readerPage.locator('.quick-care .quick-confirm')).toBeHidden();
  } finally {
    await readerContext.close();
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await quick
    .locator('.quick-grid')
    .getByRole('button', { name: '분유', exact: true })
    .click();
  await page.screenshot({ caret: 'initial',
    path: 'test-results/quick-care-mobile-dark.png',
    fullPage: false,
  });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('today care shows all local-day records and overnight sleep without a last feeding card', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const { owner, family, child } = await childCareFamily(context);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const midnight = Date.parse(`${today}T00:00:00+09:00`);
  const at = (offset: number) => new Date(midnight + offset).toISOString();
  const { error } = await admin.from('care_records').insert([
    ...Array.from({ length: 20 }, (_, i) => ({
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'formula' as const,
      started_at: at(i * 60000),
      ended_at: at(i * 60000 + 30000),
      amount_ml: 80,
      created_by: owner,
      updated_by: owner,
      record_timezone: 'Asia/Seoul',
    })),
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'solids' as const,
      started_at: at(3600000),
      ended_at: at(4200000),
      amount_ml: 60,
      created_by: owner,
      updated_by: owner,
      record_timezone: 'Asia/Seoul',
    },
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'formula' as const,
      started_at: at(-86400000 + 3600000),
      ended_at: at(-86400000 + 4200000),
      amount_ml: 120,
      created_by: owner,
      updated_by: owner,
      record_timezone: 'Asia/Seoul',
    },
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'breast' as const,
      started_at: at(-2 * 86400000),
      ended_at: null,
      created_by: owner,
      updated_by: owner,
      record_timezone: 'Asia/Seoul',
    },
    ...[-86400000, 86400000].map((offset) => ({
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'solids' as const,
      started_at: at(offset + 3600000),
      ended_at: at(offset + 4200000),
      amount_g: 55,
      created_by: owner,
      updated_by: owner,
      record_timezone: 'Asia/Seoul',
    })),
  ]);
  expect(error).toBeNull();
  const sleep = await admin.from('child_records').insert({
    id: crypto.randomUUID(),
    child_id: child,
    service: 'sleep',
    kind: 'night',
    occurred_at: at(-3600000),
    ended_at: at(3600000),
    created_by: owner,
    updated_by: owner,
    record_timezone: 'Asia/Seoul',
  });
  expect(sleep.error).toBeNull();
  await page.goto(`/ko/today?child=${child}`);
  await expect(page.locator('.quick-timeline-heading time')).toHaveAttribute(
    'datetime',
    today,
  );
  await expect(page.locator('.quick-timeline > li')).toHaveCount(22);
  await expect(page.locator('.quick-timeline')).not.toContainText('55 g');
  await expect(page.locator('.quick-day-total')).toHaveText(
    '총 1,660 ml(1,600 + 60)',
  );
  await expect(
    page
      .locator('.quick-timeline-time small')
      .getByText('오늘', { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.quick-timeline-heading')).not.toContainText(
    '오늘 기록',
  );
  await expect(
    page.getByRole('heading', { name: '마지막 먹이기', exact: true }),
  ).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0,10);
  const daySection = (day: string) => page.locator('.quick-day-browser').filter({has: page.locator(`time[datetime="${day}"]`)});
  await page.locator('.quick-history-loader').scrollIntoViewIfNeeded();
  await expect(daySection(yesterday)).toBeVisible();
  await expect(daySection(yesterday).locator('.quick-timeline > li')).toHaveCount(3);
  await expect(daySection(yesterday).locator('.quick-day-total')).toHaveText('총 120 ml(120 + 0)');
  await expect(daySection(yesterday).locator('.quick-timeline')).toContainText('55 g');
  await expect(daySection(today).locator('.quick-timeline > li')).toHaveCount(22);
  await expect(page.getByRole('button',{name:'이전 날짜',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'다음 날짜',exact:true})).toHaveCount(0);
  await expect(page.locator('.quick-running')).toHaveCount(1);

  const readerContext = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'History reader',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      family_id: family,
      child_id: child,
      user_id: reader,
      role: 'viewer',
    });
    const mobilePage = await readerContext.newPage();
    await mobilePage.goto(`/ko/today?child=${child}`);
    await mobilePage.locator('.quick-history-loader').scrollIntoViewIfNeeded();
    const yesterdaySection = mobilePage.locator('.quick-day-browser').filter({has: mobilePage.locator(`time[datetime="${yesterday}"]`)});
    await expect(yesterdaySection).toBeVisible();
    await expect(yesterdaySection.locator('.quick-timeline > li')).toHaveCount(3);
    await expect(mobilePage.locator('.quick-running button')).toHaveCount(0);
    expect(
      await mobilePage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await mobilePage.screenshot({ caret: 'initial',
      path: 'test-results/care-history-mobile.png',
      fullPage: false,
    });
  } finally {
    await readerContext.close();
  }
});

test('daily care picker scrolls by mouse drag and saves the new health and activity records', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const { owner, child } = await childCareFamily(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`/ko/today?child=${child}`);
  const quick = page.locator('.quick-care'),
    rail = quick.locator('.quick-grid'),
    dialog = quick.locator('dialog.quick-composer');
  await expect(rail.locator('.quick-orbit-item')).toHaveText([
    '성장 기록',
    '모유',
    '분유',
    '이유식',
    '기저귀',
    '배변',
    '수면',
    '목욕',
    '병원',
    '예방접종',
    '체온',
    '투약',
    '간식',
    '놀이',
    '터미타임',
    '어린이집',
    '유치원',
    '선물',
    '용돈',
  ]);
  await expect(quick.getByText('3초 육아 기록', { exact: true })).toHaveCount(
    0,
  );
  expect(
    await page.locator('html').evaluate((e) => getComputedStyle(e).colorScheme),
  ).toBe('light');
  const colors = await rail
    .locator('.quick-orbit-icon')
    .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).color));
  expect(new Set(colors).size).toBeGreaterThanOrEqual(14);
  await expect(rail).toHaveCSS('scrollbar-width', 'none');
  await rail.scrollIntoViewIfNeeded();
  const box = (await rail.boundingBox())!;
  await page.mouse.move(box.x + box.width - 80, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 40, { steps: 15 });
  await page.mouse.up();
  expect(await rail.evaluate((e) => e.scrollLeft)).toBeGreaterThan(100);
  await expect(dialog).not.toBeVisible();
  const entries = [
    ['목욕', 'bath'],
    ['병원', 'hospital'],
    ['체온', 'temperature'],
    ['투약', 'medication'],
    ['간식', 'snack'],
    ['놀이', 'play'],
    ['터미타임', 'tummy'],
    ['배변', 'dirty'],
  ] as const;
  for (const [label, kind] of entries) {
    await rail.getByRole('button', { name: label, exact: true }).click();
    if (kind === 'temperature') {
      await dialog.getByRole('button', { name: '37.5°C', exact: true }).click();
      const temperature = dialog.getByRole('slider', { name: '체온 (°C)' });
      await expect(temperature).toHaveValue('37.5');
      await temperature.focus();
      await temperature.press('ArrowUp');
      await expect(temperature).toHaveValue('37.6');
    }
    if (kind === 'medication') {
      await dialog.getByRole('button', { name: '해열제', exact: true }).click();
      await expect(dialog.getByRole('spinbutton')).toHaveCount(0);
    }
    if (kind === 'play' || kind === 'tummy')
      await dialog.getByRole('button', {name:'이미 마쳤어요',exact:true}).click();
    if (['bath', 'play', 'tummy'].includes(kind)) {
      await expect(
        dialog.getByRole('button', { name: '기록 안 함', exact: true }),
      ).toHaveCount(0);
      await dialog.getByRole('button', { name: '5분', exact: true }).click();
    }
    await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const record = await admin
      .from('child_records')
      .select('*')
      .eq('child_id', child)
      .eq('kind', kind)
      .single();
    expect(record.error).toBeNull();
    expect(record.data?.created_by).toBe(owner);
    if (kind === 'temperature') expect(record.data?.temperature_c).toBe(37.6);
    if (kind === 'medication')
      expect(record.data).toMatchObject({
        medicine_name: '해열제',
        dose_amount: null,
        dose_unit: null,
      });
  }
  await expect(quick.locator('.quick-timeline > li')).toHaveCount(8);
  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      quick
        .locator('.quick-timeline-entry')
        .evaluateAll((cards) =>
          cards.every(
            (card) =>
              [getComputedStyle(card).backgroundColor, 'rgba(0, 0, 0, 0)'].includes(
                getComputedStyle(card.querySelector('.quick-entry-icon')!).backgroundColor
              ),
          ),
        ),
    )
    .toBe(true);
  const cardColors = await quick
    .locator('.quick-timeline-entry')
    .evaluateAll((cards) =>
      cards.map((card) => ({
        card: getComputedStyle(card).backgroundColor,
        icon: getComputedStyle(card.querySelector('.quick-entry-icon')!)
          .backgroundColor,
      })),
    );
  expect(cardColors.every((colors) => colors.card === colors.icon || colors.icon === 'rgba(0, 0, 0, 0)')).toBe(true);
  expect(new Set(cardColors.map((colors) => colors.card)).size).toBe(8);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/daily-care-desktop.png',
    fullPage: true,
  });
  await quick
    .locator('.quick-timeline-entry')
    .filter({ hasText: '37.6 °C' })
    .click();
  await expect(page.getByText('37.6 °C', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '36.5°C', exact: true }).click();
  const editTemperature = page.getByRole('slider', { name: '체온 (°C)' });
  await editTemperature.press('ArrowUp');
  await editTemperature.press('ArrowUp');
  await editTemperature.press('ArrowUp');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.getByText('36.8 °C', { exact: true })).toBeVisible();
  await page.goto(`/ko/today?child=${child}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await rail.getByRole('button', { name: '터미타임', exact: true }).click();
  expect(await dialog.evaluate((e) => e.matches(':modal'))).toBe(true);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/daily-care-mobile.png',
    fullPage: false,
  });
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await page.goto(`/ko/services/activity?child=${child}`))!.status()).toBe(404);
  await page.goto(`/ko/today?child=${child}`);
  await expect(page.getByText('36.8 °C', { exact: true })).toBeVisible();
});

test('calendar quick actions save hospital, vaccine, medication and tasks into one shared schedule', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const { family, child } = await childCareFamily(context);
  const base = `/ko/calendar?child=${child}`;
  await page.goto(base);
  const actions = page.locator('.calendar-quick-actions');
  await expect(actions).not.toHaveCSS('position', 'fixed');
  await expect(actions.locator('a')).toHaveText([
    '병원',
    '예방접종',
    '투약',
    '일정',
    '할 일',
  ]);
  await actions.getByRole('link', { name: '병원', exact: true }).click();
  const dialog = page.locator('.calendar-composer');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => node.matches(':modal'))).toBe(false);
  await dialog.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
  const calendarBox = await page.locator('.calendar-workspace').boundingBox();
  const editorBox = await dialog.boundingBox();
  expect(editorBox!.x).toBeGreaterThan(calendarBox!.x + calendarBox!.width);
  expect(Math.abs(editorBox!.y - calendarBox!.y)).toBeLessThan(2);
  await dialog
    .getByLabel('병원·방문 이유 (선택)', { exact: true })
    .fill('창 크기 변경 중 입력');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => dialog.evaluate((node) => node.matches(':modal')))
    .toBe(true);
  await expect(
    dialog.getByLabel('병원·방문 이유 (선택)', { exact: true }),
  ).toHaveValue('창 크기 변경 중 입력');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect
    .poll(() => dialog.evaluate((node) => node.matches(':modal')))
    .toBe(false);
  await expect(
    dialog.getByLabel('병원·방문 이유 (선택)', { exact: true }),
  ).toHaveValue('창 크기 변경 중 입력');
  await page.screenshot({ caret: 'initial',
    path: 'test-results/calendar-inline-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await actions.getByRole('link', { name: '병원', exact: true }).click();
  await dialog
    .getByLabel('병원·방문 이유 (선택)', { exact: true })
    .fill('소아과 정기 검진');
  await dialog.getByLabel('날짜', { exact: true }).fill('2026-11-05');
  await dialog.getByLabel('시간 (선택)', { exact: true }).fill('09:30');
  await dialog.getByText('상세 설정', { exact: true }).click();
  await dialog.getByLabel('메모', { exact: true }).fill('진료 수첩 준비');
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('.calendar-event').filter({ hasText: '소아과 정기 검진' }),
  ).toContainText('09:30');
  await actions.getByRole('link', { name: '투약', exact: true }).click();
  await dialog.getByRole('button', { name: '항생제', exact: true }).click();
  await dialog.getByLabel('날짜', { exact: true }).fill('2026-11-05');
  await dialog.getByLabel('시간 (선택)', { exact: true }).fill('12:00');
  await dialog.getByText('상세 설정', { exact: true }).click();
  await dialog
    .getByLabel('복용량·메모', { exact: true })
    .fill('처방된 복용량 확인');
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await actions.getByRole('link', { name: '예방접종', exact: true }).click();
  await dialog.getByRole('button', { name: '결핵(BCG)', exact: true }).click();
  await dialog.getByLabel('예정일', { exact: true }).fill('2026-11-06');
  await dialog.getByText('상세 설정', { exact: true }).click();
  await dialog.getByLabel('병원·접종 기관', { exact: true }).fill('동네 의원');
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.calendar-kind-vaccination')).toContainText(
    '결핵(BCG)',
  );
  await actions.getByRole('link', { name: '할 일', exact: true }).click();
  await dialog.getByLabel('제목', { exact: true }).fill('검진 서류 챙기기');
  await dialog.getByLabel('날짜', { exact: true }).fill('2026-11-04');
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.calendar-tasks')).toContainText(
    '검진 서류 챙기기',
  );
  expect(
    (await admin.from('events').select('id').eq('child_id', child)).data,
  ).toHaveLength(2);
  expect(
    (await admin.from('child_records').select('id').eq('child_id', child)).data,
  ).toHaveLength(0);
  const plans = await admin
    .from('calendar_entries')
    .select('*')
    .eq('child_id', child);
  expect(plans.error).toBeNull();
  expect(plans.data).toHaveLength(3);
  const vaccine = plans.data!.find((row) => row.source === 'vaccination')!;
  await page.goto(`/ko/today?child=${child}`);
  await expect(
    page
      .locator('.quick-grid')
      .getByRole('button', { name: '예방접종', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.events-panel')).toHaveCount(0);
  await page.goto(`/ko/vaccination/${vaccine.id}/edit?child=${child}`);
  await page.getByLabel('예정일', { exact: true }).fill('2026-11-07');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await page.goto(`${base}&month=2026-11&day=2026-11-07`);
  await expect(page.locator('.calendar-kind-vaccination')).toContainText(
    '결핵(BCG)',
  );
  await expect(page.locator('.calendar-kind-vaccination')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectPhoneFunctionDock(page, actions);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/phone-functions-calendar.png',
    animations: 'disabled',
  });
  await actions.getByRole('link', { name: '투약', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(actions).toBeHidden();
  await expect(dialog.locator('header button')).toHaveCount(0);
  const sheetGeometry = await dialog.evaluate(node => {
    const buttons = [...node.querySelectorAll('button')];
    const cancel = buttons.find(button => button.textContent?.trim() === '취소')!.getBoundingClientRect();
    const save = buttons.find(button => button.textContent?.trim() === '저장하기')!.getBoundingClientRect();
    const title = node.querySelector('.quick-vaccine-choices')!.getBoundingClientRect();
    return {
      cancel: {x: cancel.x, y: cancel.y},
      save: {x: save.x, y: save.y},
      title: {x: title.x, width: title.width},
      controls: [...node.querySelectorAll('.quick-time-control')].map(control => {
        const box = control.getBoundingClientRect();
        return {x: box.x, width: box.width};
      }),
    };
  });
  expect(sheetGeometry.cancel.x).toBeLessThan(sheetGeometry.save.x);
  expect(Math.abs(sheetGeometry.cancel.y - sheetGeometry.save.y)).toBeLessThan(3);
  for (const box of sheetGeometry.controls) {
    expect(Math.abs(box.x - sheetGeometry.title.x)).toBeLessThan(2);
    expect(Math.abs(box.width - sheetGeometry.title.width)).toBeLessThan(2);
  }

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/calendar-quick-mobile.png',
    fullPage: false,
  });
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Calendar reader',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      family_id: family,
      child_id: child,
      user_id: reader,
      role: 'viewer',
    });
    const readerPage = await readerContext.newPage();
    await readerPage.goto(
      `/ko/calendar?child=${child}&month=2026-11&day=2026-11-05&create=hospital`,
    );
    await expect(readerPage.locator('.calendar-quick-actions')).toHaveCount(0);
    await expect(readerPage.locator('.calendar-composer')).toHaveCount(0);
    await expect(readerPage.locator('.swipe-more,.swipe-action')).toHaveCount(
      0,
    );
    await expect(readerPage.locator('.calendar-event')).toHaveCount(2);
    await expect(
      readerPage.locator('.calendar-event .edit-details'),
    ).toHaveCount(0);
  } finally {
    await readerContext.close();
  }
});

test('today vaccination records in the shared sheet without navigating and keeps actual vaccination dates', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const { child } = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${child}`);
  const today = (await page
    .locator('.quick-timeline-heading time')
    .getAttribute('datetime'))!;
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
  const quick = page.locator('.quick-care'),
    dialog = quick.locator('dialog.quick-composer');
  await quick
    .locator('.quick-grid')
    .getByRole('button', { name: '예방접종', exact: true })
    .click();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => node.matches(':modal'))).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/ko/today\\?child=${child}`));
  await expect(
    dialog.getByRole('button', { name: '저장하기', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '결핵(BCG)', exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect
    .poll(() => dialog.evaluate((node) => node.matches(':modal')))
    .toBe(false);
  await expect(
    dialog.getByRole('button', { name: '결핵(BCG)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => dialog.evaluate((node) => node.matches(':modal')))
    .toBe(true);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/quick-vaccination-mobile.png',
    fullPage: false,
  });
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/ko/today\\?child=${child}`));
  await expect(quick.locator('.quick-entry-vaccination')).toContainText(
    '결핵(BCG)',
  );
  const shot = await admin
    .from('vaccination_records')
    .select('*')
    .eq('child_id', child)
    .eq('vaccine', 'bcg')
    .single();
  expect(shot.error).toBeNull();
  expect(shot.data).toMatchObject({
    status: 'completed',
    completed_date: today,
    scheduled_date: null,
    dose: null,
    clinic: '',
    note: '',
  });
  await expect(
    quick
      .locator('.quick-entry-vaccination')
      .locator('xpath=..')
      .locator('time'),
  ).toHaveAttribute('datetime', today);
  await quick
    .locator('.quick-grid')
    .getByRole('button', { name: '예방접종', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: '기타·혼합백신', exact: true })
    .click();
  await dialog.getByLabel('백신 이름', { exact: true }).fill('추가 접종');
  await dialog.locator('.quick-extra summary').click();
  await dialog.getByLabel('접종일', { exact: true }).fill('2099-01-01');
  await expect(
    dialog.getByRole('button', { name: '저장하기', exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel('접종일', { exact: true }).fill(yesterday);
  await dialog.getByLabel('차수 (선택)', { exact: true }).selectOption('2');
  await dialog
    .getByLabel('병원·접종 기관 (선택)', { exact: true })
    .fill('기록 의원');
  await dialog.getByLabel('메모', { exact: true }).fill('접종 후 기록');
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await quick.locator('.quick-history-loader').scrollIntoViewIfNeeded();
  const past=quick.locator('.quick-day-browser').filter({has:page.locator(`time[datetime="${yesterday}"]`)});
  await expect(past.locator('.quick-entry-vaccination')).toHaveCount(1);
  await expect(past.locator('.quick-entry-vaccination')).toContainText('추가 접종');
  await expect(past.locator('.quick-entry-vaccination')).toContainText('2차 · 기록 의원');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await past.locator('.quick-entry-vaccination').click();
  await expect(quick.locator('dialog.quick-composer')).toBeVisible();
  await expect(quick.locator('dialog.quick-composer textarea[name=note]')).toHaveValue(
    '접종 후 기록',
  );
  await page.goto(`/ko/calendar?child=${child}`);
  await expect(page.locator('.calendar-kind-vaccination')).toHaveCount(1);
  await page.locator(`[data-date="${yesterday}"]`).click();
  await expect(page.locator('.calendar-kind-vaccination')).toContainText(
    '추가 접종',
  );
});

test('tasks and events stay in calendar with writable and readonly completion', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const { owner, family, child } = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${child}&create=task`);
  const today = (await page
    .locator('.quick-timeline-heading time')
    .getAttribute('datetime'))!;
  const offset = (n: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000)
      .toISOString()
      .slice(0, 10);
  await expect(
    page.locator('.task-panel,.events-panel,.calendar-composer'),
  ).toHaveCount(0);
  const base = `/ko/calendar?child=${child}`;
  await admin.from('tasks').insert(
    [-1, 1, null].map((n) => ({
      id: crypto.randomUUID(),
      child_id: child,
      title: n === null ? '미지정 할 일' : n < 0 ? '지난 할 일' : '미래 할 일',
      due_date: n === null ? null : offset(n),
      service: 'general',
      status: 'todo',
      created_by: owner,
    })),
  );
  await admin.from('events').insert(
    [-1, 1].map((n) => ({
      id: crypto.randomUUID(),
      child_id: child,
      title: n < 0 ? '지난 일정' : '미래 일정',
      date: offset(n),
      created_by: owner,
    })),
  );
  await page.goto(base);
  await expect(page.locator('.page-heading')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '해야 할 일', exact: true }),
  ).toHaveCount(0);
  const actions = page.locator('.calendar-quick-actions');
  await expect(actions.locator('a')).toHaveText([
    '병원',
    '예방접종',
    '투약',
    '일정',
    '할 일',
  ]);
  const eventsPanel = page.locator('.selected-day-events');
  await expect(eventsPanel).toBeVisible();
  await expect(eventsPanel.locator('.add-details')).toHaveCount(0);
  await actions.getByRole('link', { name: '할 일', exact: true }).click();
  const dialog = page.locator('.calendar-composer');
  await dialog.getByLabel('제목', { exact: true }).fill('오늘 할 일 테스트');
  await dialog.getByLabel('날짜', { exact: true }).fill(today);
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('.calendar-task > .badge,.calendar-task .round-button'),
  ).toHaveCount(0);
  await actions.getByRole('link', { name: '일정', exact: true }).click();
  await dialog.getByLabel('제목', { exact: true }).fill('오늘 일반 일정');
  await dialog.getByLabel('날짜', { exact: true }).fill(today);
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const vaccine = await admin.from('vaccination_records').insert({
    id: crypto.randomUUID(),
    child_id: child,
    vaccine: 'bcg',
    status: 'planned',
    scheduled_date: today,
    record_timezone: 'Asia/Seoul',
    created_by: owner,
    updated_by: owner,
  });
  expect(vaccine.error).toBeNull();
  await page.goto(`/ko/today?child=${child}`);
  await expect(page.locator('.task-panel,.events-panel,.today-agenda')).toHaveCount(0);
  await expect(page.getByText('오늘 할 일 테스트',{exact:true})).toHaveCount(0);
  await page.goto(`${base}&day=${today}`);
  const row=page.locator('.calendar-task').filter({hasText:'오늘 할 일 테스트'});
  const checkbox=row.getByRole('checkbox');
  await expect(checkbox).toHaveAttribute('aria-checked','false');
  await checkbox.click();
  await expect(checkbox).toHaveAttribute('aria-checked','true');
  await expect(page.locator('.selected-day-events')).toContainText('결핵(BCG)');
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Task reader',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      family_id: family,
      child_id: child,
      user_id: reader,
      role: 'viewer',
    });
    const readerPage = await readerContext.newPage();
    await readerPage.goto(`${base}&day=${today}`);
    await expect(
      readerPage.locator('.calendar-task').filter({hasText:'오늘 할 일 테스트'}).getByRole('checkbox'),
    ).toBeDisabled();
    await expect(
      readerPage.locator('.calendar-task').filter({hasText:'오늘 할 일 테스트'}).getByRole('checkbox'),
    ).toHaveAttribute('aria-checked', 'true');
  } finally {
    await readerContext.close();
  }
  await page.goto(`${base}&day=${today}`);
  await expect(page.locator('.calendar-task').filter({hasText:'오늘 할 일 테스트'}).getByRole('checkbox')).toHaveAttribute('aria-checked','true');
});

test('calendar filters tasks by date and full swipes execute edit and delete without menu buttons', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const { owner, child, family } = await childCareFamily(context);
  const base = `/ko/calendar?child=${child}&month=2026-11&day=2026-11-05`;
  const event = crypto.randomUUID(),
    task = crypto.randomUUID(),
    shot = crypto.randomUUID();
  expect(
    (
      await admin.from('events').insert({
        id: event,
        child_id: child,
        title: '스와이프 병원',
        date: '2026-11-05',
        event_kind: 'hospital',
        event_time: '10:30',
        record_timezone: 'Asia/Seoul',
        created_by: owner,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await admin.from('tasks').insert([
        {
          id: task,
          child_id: child,
          title: '스와이프 할 일',
          due_date: '2026-11-05',
          service: 'general',
          created_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          title: '다음날 할 일',
          due_date: '2026-11-06',
          service: 'general',
          created_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          title: '날짜 없는 할 일',
          due_date: null,
          service: 'general',
          created_by: owner,
        },
        ...Array.from({ length: 105 }, (_, i) => ({
          id: crypto.randomUUID(),
          child_id: child,
          title: `앞 날짜 할 일 ${i}`,
          due_date: '2026-11-01',
          service: 'general',
          created_by: owner,
        })),
      ])
    ).error,
  ).toBeNull();
  expect(
    (
      await admin.from('vaccination_records').insert({
        id: shot,
        child_id: child,
        vaccine: 'bcg',
        status: 'planned',
        scheduled_date: '2026-11-05',
        record_timezone: 'Asia/Seoul',
        created_by: owner,
        updated_by: owner,
      })
    ).error,
  ).toBeNull();
  await page.goto(`${base.replace('day=2026-11-05', 'day=2026-11-04')}`);
  await expect(page.locator('.calendar-tasks .calendar-empty')).toHaveText(
    '등록된 할일이 없어요',
  );
  const emptyEventHeight = (await page
    .locator('.selected-day-events')
    .boundingBox())!.height;
  const emptyTaskHeight = (await page.locator('.calendar-tasks').boundingBox())!
    .height;
  expect(Math.abs(emptyEventHeight - emptyTaskHeight)).toBeLessThan(1);
  await page.goto(base);
  await expect(page.locator('.swipe-edit').first()).toHaveText('');
  await expect(page.locator('.swipe-edit').first().locator('svg')).toHaveCount(
    1,
  );
  for (const button of await page.locator('.swipe-delete button').all()) {
    await expect(button).toHaveText('');
    await expect(button.locator('svg')).toHaveCount(1);
    await expect(button).toHaveAccessibleName('삭제');
  }
  await expect(page.locator('.calendar-event')).toHaveCount(2);
  await expect(page.locator('.calendar-task')).toHaveCount(1);
  await expect(page.locator('.calendar-tasks')).toContainText('스와이프 할 일');
  await expect(page.locator('.calendar-tasks')).not.toContainText(
    '다음날 할 일',
  );
  await expect(page.locator('.calendar-tasks')).not.toContainText(
    '날짜 없는 할 일',
  );
  await expect(page.locator('.selected-day-events h2,.swipe-more')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-date="2026-11-05"]')).toHaveAttribute(
    'aria-label',
    '2026-11-05 · 일정 2건 · 할 일 1건',
  );
  const swipe = async (
    target: import('@playwright/test').Locator,
    direction: 1 | -1,
    full = false,
  ) => {
    await target.evaluate((node) =>
      node.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    await target.locator('.swipe-front').evaluate(async (node) => {
      await Promise.allSettled(
        node.getAnimations().map((animation) => animation.finished),
      );
    });
    const box = (await target.boundingBox())!;
    const x = box.x + box.width * (direction === 1 ? 0.3 : 0.85),
      y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(
      x + direction * (full ? Math.min(180, box.width * 0.6) + 18 : 75),
      y,
      { steps: 14 },
    );
    await page.mouse.up();
  };
  const row = page.locator('.swipe-row').filter({ hasText: '스와이프 할 일' });
  await expect(
    page
      .locator('.calendar-tasks')
      .getByRole('heading', { name: '할 일', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('.selected-day-events')
      .getByRole('heading', { name: '일정', exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-date="2026-11-05"]')).toHaveAttribute(
    'aria-current',
    'date',
  );
  const checkbox = row.getByRole('checkbox');
  await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  await checkbox.evaluate((node) =>
    node.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  const scroll = await page.evaluate(() => window.scrollY);
  await checkbox.click();
  await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.calendar-task')).toHaveClass(/is-done/);
  await expect(page).toHaveURL(/month=2026-11&day=2026-11-05/);
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - scroll),
  ).toBeLessThan(80);
  expect(
    (await admin.from('tasks').select('status').eq('id', task).single()).data
      ?.status,
  ).toBe('done');
  await expect(page.locator('.calendar-composer')).toHaveCount(0);
  await checkbox.click();
  await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.calendar-task')).not.toHaveClass(/is-done/);
  await swipe(row, 1);
  await expect(row).toHaveAttribute('data-swipe', 'edit');
  await expect(page.locator('.calendar-composer')).toHaveCount(0);
  await page.keyboard.press('Escape');
  // A vertical gesture never edits or deletes.
  await row.dispatchEvent('pointerdown', {
    pointerId: 10,
    isPrimary: true,
    button: 0,
    clientX: 150,
    clientY: 100,
  });
  await row.dispatchEvent('pointermove', {
    pointerId: 10,
    isPrimary: true,
    clientX: 152,
    clientY: 200,
  });
  await row.dispatchEvent('pointerup', {
    pointerId: 10,
    isPrimary: true,
    button: 0,
    clientX: 152,
    clientY: 200,
  });
  await expect(row).toHaveAttribute('data-swipe', 'closed');
  await swipe(row, 1, true);
  const dialog = page.locator('.calendar-composer');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('제목', { exact: true }).fill('수정된 할 일');
  await dialog
    .getByRole('combobox', { name: '할 일', exact: true })
    .selectOption('done');
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.calendar-task')).toHaveClass(/is-done/);
  const eventRow = page
    .locator('.swipe-row')
    .filter({ hasText: '스와이프 병원' });
  await swipe(eventRow, 1, true);
  await expect(dialog.getByLabel('시간 (선택)', { exact: true })).toHaveValue(
    '10:30',
  );
  await dialog.getByLabel('날짜', { exact: true }).fill('2026-12-02');
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page).toHaveURL(/month=2026-12&day=2026-12-02/);
  await expect(page.locator('.calendar-event')).toHaveCount(1);
  await expect(page.locator('.calendar-task')).toHaveCount(0);
  await page.goto(base);
  const shotRow = page.locator('.swipe-row').filter({ hasText: '결핵(BCG)' });
  await swipe(shotRow, 1, true);
  await dialog.getByLabel('예정일', { exact: true }).fill('2026-11-06');
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page).toHaveURL(/month=2026-11&day=2026-11-06/);
  await expect(page.locator('[data-date="2026-11-06"]')).toHaveAttribute(
    'aria-current',
    'date',
  );
  await expect(
    page.locator('.calendar-day-agenda .selected-day-events'),
  ).toHaveCount(1);
  await expect(
    page.locator('.calendar-day-agenda .calendar-tasks'),
  ).toHaveCount(1);
  await expect(page.locator('.calendar-tasks')).toContainText('다음날 할 일');
  await expect(page.locator('.calendar-tasks')).not.toContainText(
    '수정된 할 일',
  );
  expect(
    (
      await admin
        .from('vaccination_records')
        .select('scheduled_date')
        .eq('id', shot)
        .single()
    ).data?.scheduled_date,
  ).toBe('2026-11-06');
  await page.locator('[data-date="2026-11-01"]').click();
  await expect(page.locator('.calendar-task')).toHaveCount(105);
  await page.locator('[data-date="2026-11-05"]').click();
  await expect(page.locator('.calendar-task')).toHaveCount(1);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/calendar-compact-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  // Full touch swipe deletes directly; a shorter one only reveals the button.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ caret: 'initial',
    path: 'test-results/calendar-compact-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  const movedTask = page
    .locator('.swipe-row')
    .filter({ hasText: '수정된 할 일' });
  await movedTask.evaluate((node) =>
    node.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  const box = (await movedTask.boundingBox())!;
  const x = box.x + box.width * 0.9,
    y = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  const prompts: string[] = [];
  page.on('dialog', async (d) => {
    prompts.push(d.message());
    await d.dismiss();
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 12; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x - i * 18, y }],
    });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(movedTask).toHaveCount(0);
  expect(
    (await admin.from('tasks').select('id').eq('id', task)).data,
  ).toHaveLength(0);
  await page.locator('[data-date="2026-11-06"]').click();
  await expect(shotRow).toBeVisible();
  await swipe(shotRow, -1, true);
  await expect(shotRow).toHaveCount(0);
  expect(
    (await admin.from('vaccination_records').select('id').eq('id', shot)).data,
  ).toHaveLength(0);
  await page.goto(`/ko/calendar?child=${child}&month=2026-12&day=2026-12-02`);
  const remaining = page
    .locator('.swipe-row')
    .filter({ hasText: '스와이프 병원' });
  await swipe(remaining, -1);
  await expect(remaining).toHaveAttribute('data-swipe', 'delete');
  expect(
    (await admin.from('events').select('id').eq('id', event)).data,
  ).toHaveLength(1);
  await page.keyboard.press('Escape');
  await swipe(remaining, -1, true);
  await expect(remaining).toHaveCount(0);
  expect(
    (await admin.from('events').select('id').eq('id', event)).data,
  ).toHaveLength(0);
  expect(prompts).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await cdp.detach();
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Calendar reader',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      family_id: family,
      child_id: child,
      user_id: reader,
      role: 'viewer',
    });
    const readerPage = await readerContext.newPage();
    await readerPage.goto(
      `/en/calendar?child=${child}&month=2026-11&day=2026-11-06&edit=task:${task}`,
    );
    await expect(readerPage.locator('.calendar-task')).toHaveCount(1);
    await expect(
      readerPage.locator('.calendar-task').getByRole('checkbox'),
    ).toBeDisabled();
    await expect(
      readerPage.locator('.calendar-composer,.swipe-action,.swipe-more'),
    ).toHaveCount(0);
  } finally {
    await readerContext.close();
  }
});

test('past calendar tasks remain separate from the vertical Today record history', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const { owner, child } = await childCareFamily(context);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const offset = (n: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000)
      .toISOString()
      .slice(0, 10);
  const yesterday = offset(-1),
    pastTask = crypto.randomUUID();
  expect(
    (
      await admin.from('tasks').insert([
        {
          id: crypto.randomUUID(),
          child_id: child,
          title: '오늘 날짜 준비물',
          due_date: today,
          service: 'general',
          created_by: owner,
        },
        {
          id: pastTask,
          child_id: child,
          title: '지난 날짜 준비물',
          due_date: yesterday,
          service: 'general',
          created_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          title: '미래 날짜 준비물',
          due_date: offset(1),
          service: 'general',
          created_by: owner,
        },
      ])
    ).error,
  ).toBeNull();
  expect(
    (
      await admin.from('events').insert([
        {
          id: crypto.randomUUID(),
          child_id: child,
          title: '오늘 날짜 병원',
          date: today,
          event_kind: 'hospital',
          created_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          title: '지난 날짜 병원',
          date: yesterday,
          event_kind: 'hospital',
          created_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          title: '미래 날짜 병원',
          date: offset(1),
          event_kind: 'hospital',
          created_by: owner,
        },
      ])
    ).error,
  ).toBeNull();
  expect(
    (
      await admin.from('care_records').insert(
        [today, yesterday].map((day, i) => ({
          id: crypto.randomUUID(),
          child_id: child,
          kind: 'formula',
          started_at: new Date(`${day}T00:00:00+09:00`).toISOString(),
          ended_at: new Date(`${day}T00:05:00+09:00`).toISOString(),
          amount_ml: i === 0 ? 50 : 100,
          record_timezone: 'Asia/Seoul',
          created_by: owner,
          updated_by: owner,
        })),
      )
    ).error,
  ).toBeNull();
  await page.goto(`/ko/today?child=${child}`);
  await expect(page.locator('.today-agenda,.task-panel,.events-panel')).toHaveCount(0);
  await page.locator('.quick-history-loader').scrollIntoViewIfNeeded();
  const history=page.locator('.quick-day-browser').filter({has:page.locator(`time[datetime="${yesterday}"]`)});
  await expect(history).toBeVisible();
  await expect(history.locator('.quick-day-total')).toHaveText('총 100 ml(100 + 0)');
  await expect(history.locator('.today-agenda,.calendar-task,.calendar-event')).toHaveCount(0);
  await page.goto(`/ko/calendar?child=${child}&day=${yesterday}`);
  const task=page.locator('.calendar-task').filter({hasText:'지난 날짜 준비물'});
  await task.getByRole('checkbox').click();
  await expect(task.getByRole('checkbox')).toHaveAttribute('aria-checked','true');
  expect((await admin.from('tasks').select('status').eq('id',pastTask).single()).data?.status).toBe('done');
});

test('insights supports rolling seven days, multiple activity patterns and child-level access', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(150000);
  page.setDefaultTimeout(15000);
  const { owner, family, child } = await childCareFamily(context),
    week = '2026-10-12';
  const feeds = [
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'formula',
      started_at: '2026-10-12T02:00:00Z',
      ended_at: '2026-10-12T02:10:00Z',
      amount_ml: 120,
      record_timezone: 'Asia/Seoul',
      created_by: owner,
      updated_by: owner,
    },
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'formula',
      started_at: '2026-10-13T02:00:00Z',
      ended_at: '2026-10-13T02:10:00Z',
      amount_ml: 80,
      record_timezone: 'Asia/Seoul',
      created_by: owner,
      updated_by: owner,
    },
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'formula',
      started_at: '2026-10-13T03:00:00Z',
      ended_at: '2026-10-13T03:10:00Z',
      amount_ml: null,
      record_timezone: 'Asia/Seoul',
      created_by: owner,
      updated_by: owner,
    },
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'formula',
      started_at: '2026-10-14T02:00:00Z',
      ended_at: null,
      amount_ml: 500,
      record_timezone: 'Asia/Seoul',
      created_by: owner,
      updated_by: owner,
    },
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'formula',
      started_at: '2026-10-05T02:00:00Z',
      ended_at: '2026-10-05T02:10:00Z',
      amount_ml: 50,
      record_timezone: 'Asia/Seoul',
      created_by: owner,
      updated_by: owner,
    },
    ...Array.from({ length: 110 }, (_, i) => ({
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'formula',
      started_at: new Date(
        Date.parse('2026-10-14T03:00:00Z') + i * 60000,
      ).toISOString(),
      ended_at: new Date(
        Date.parse('2026-10-14T03:00:00Z') + i * 60000 + 30000,
      ).toISOString(),
      amount_ml: 10,
      record_timezone: 'Asia/Seoul',
      created_by: owner,
      updated_by: owner,
    })),
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'solids',
      started_at: '2026-10-12T02:00:00Z',
      ended_at: '2026-10-12T02:10:00Z',
      amount_ml: null,
      amount_g: 55,
      record_timezone: 'Asia/Seoul',
      created_by: owner,
      updated_by: owner,
    },
    {
      id: crypto.randomUUID(),
      child_id: child,
      kind: 'solids',
      started_at: '2026-10-13T02:00:00Z',
      ended_at: '2026-10-13T02:10:00Z',
      amount_ml: 60,
      record_timezone: 'Asia/Seoul',
      created_by: owner,
      updated_by: owner,
    },
  ];
  expect((await admin.from('care_records').insert(feeds)).error).toBeNull();
  expect(
    (
      await admin.from('child_records').insert([
        {
          id: crypto.randomUUID(),
          child_id: child,
          service: 'sleep',
          kind: 'night',
          occurred_at: '2026-10-12T14:30:00Z',
          ended_at: '2026-10-12T16:00:00Z',
          record_timezone: 'Asia/Seoul',
          created_by: owner,
          updated_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          service: 'growth',
          kind: 'measurement',
          occurred_at: '2026-10-14T02:00:00Z',
          height_cm: 65,
          weight_kg: 7,
          record_timezone: 'Asia/Seoul',
          created_by: owner,
          updated_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          service: 'activity',
          kind: 'temperature',
          occurred_at: '2026-10-12T02:00:00Z',
          temperature_c: 36.5,
          record_timezone: 'Asia/Seoul',
          created_by: owner,
          updated_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          service: 'activity',
          kind: 'temperature',
          occurred_at: '2026-10-13T02:00:00Z',
          temperature_c: 37,
          record_timezone: 'Asia/Seoul',
          created_by: owner,
          updated_by: owner,
        },
      ])
    ).error,
  ).toBeNull();
  expect(
    (
      await admin.from('vaccination_records').insert({
        id: crypto.randomUUID(),
        child_id: child,
        vaccine: 'bcg',
        status: 'completed',
        completed_date: week,
        record_timezone: 'Asia/Seoul',
        created_by: owner,
        updated_by: owner,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await admin.from('care_records').insert({
        id: crypto.randomUUID(),
        child_id: child,
        kind: 'breast',
        started_at: '2026-10-12T04:00:00Z',
        ended_at: '2026-10-12T04:10:00Z',
        record_timezone: 'Asia/Seoul',
        created_by: owner,
        updated_by: owner,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await admin.from('child_records').insert([
        {
          id: crypto.randomUUID(),
          child_id: child,
          service: 'activity',
          kind: 'bath',
          occurred_at: '2026-10-12T03:00:00Z',
          duration_minutes: 5,
          record_timezone: 'Asia/Seoul',
          created_by: owner,
          updated_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          service: 'diaper',
          kind: 'wet',
          occurred_at: '2026-10-12T03:00:00Z',
          record_timezone: 'Asia/Seoul',
          created_by: owner,
          updated_by: owner,
        },
        {
          id: crypto.randomUUID(),
          child_id: child,
          service: 'diaper',
          kind: 'mixed',
          occurred_at: '2026-10-13T03:00:00Z',
          record_timezone: 'Asia/Seoul',
          created_by: owner,
          updated_by: owner,
        },
      ])
    ).error,
  ).toBeNull();
  const base = `/ko/insights?child=${child}&week=${week}`;
  await page.goto(`${base}&kind=formula&pattern=stats`);
  const kinds = page.locator('.insight-kind-rail'),
    feeding = page.locator('[data-statistic="feeding"]');
  await expect(page.locator('.mobile-nav > a')).toHaveCount(6);
  await expect(kinds.getByRole('button')).toHaveCount(16);
  await expect(
    kinds.getByRole('button', { name: '성장', exact: true }),
  ).toHaveCount(0);
  await expect(
    kinds.getByRole('button', { name: '발달', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.insights-heading')).toHaveCount(0);
  await expect(page.locator('.insight-briefing')).toHaveCount(0);
  expect(
    await kinds.evaluate((rail) => getComputedStyle(rail).position),
  ).not.toBe('fixed');
  await expect(feeding.getByTestId('statistic-total')).toHaveText('1,800ml');
  await expect(feeding.locator('.insight-statistic-dates button')).toHaveCount(
    7,
  );
  await kinds.getByRole('button', { name: '이유식', exact: true }).click();
  await kinds.getByRole('button', { name: '모유', exact: true }).click();
  await expect(feeding.getByTestId('statistic-total')).toHaveText('1,860ml');
  await expect(feeding).toContainText('모유 수유 10분');
  await expect(page.locator('[data-statistic]')).toHaveCount(1);
  await expect(feeding.locator('[data-statistic-series]')).toHaveCount(3);
  await feeding
    .getByRole('button', { name: '2026-10-13', exact: true })
    .click();
  await expect(feeding.locator('.insight-statistic-selection')).toContainText(
    '전체 140 ml',
  );
  await expect(feeding.locator('.insight-statistic-selection')).toContainText(
    '분유 80 ml',
  );
  await expect(feeding.locator('.insight-statistic-selection')).toContainText(
    '이유식 60 ml',
  );
  await feeding.getByText('표로 보기', { exact: true }).click();
  await expect(feeding.locator('table')).toContainText('1,600');
  await page.screenshot({ caret: 'initial',
    path: 'test-results/insights-statistics-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: '주단위 (6주기간)', exact: true })
    .click();
  await expect(feeding.locator('.insight-statistic-dates button')).toHaveCount(
    6,
  );
  await expect(feeding.getByTestId('statistic-total')).toHaveText('1,910ml');
  await expect(page.locator('.insight-period-nav')).toHaveCount(0);
  await expect(
    feeding.locator('.insight-statistic-dates button').first(),
  ).toHaveAttribute('aria-label', '2026-09-07–2026-09-13');
  await expect(
    feeding.locator('.insight-statistic-dates button').last(),
  ).toHaveAttribute('aria-label', '2026-10-12–2026-10-18');
  await feeding.getByText('표로 보기', { exact: true }).click();
  await expect(feeding.locator('table')).toContainText('50');
  await expect(
    page.getByText('선택한 기능의 ml 기록만 합산해요.', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      '기록된 자료 기준 · 진행 중 기록과 미입력 수치는 제외해요.',
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(kinds.locator('[aria-pressed="true"]')).toHaveCount(3);
  await expect(
    page.getByRole('button', { name: '통계', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('button', { name: '일단위 (일주일기간)', exact: true })
    .click();
  await expect(feeding.getByTestId('statistic-total')).toHaveText('1,860ml');
  for (const name of ['수면', '기저귀', '배변', '목욕'])
    await kinds.getByRole('button', { name, exact: true }).click();
  await expect(
    page.locator('[data-statistic="sleep"]').getByTestId('statistic-total'),
  ).toHaveText('1.5시간');
  const counts = page.locator('[data-statistic="counts"]');
  await expect(counts.locator('[data-statistic-series]')).toHaveCount(3);
  await expect(counts.locator('[data-count-total="diaper"]')).toHaveText(
    '2 회',
  );
  await expect(counts.locator('[data-count-total="stool"]')).toHaveText('1 회');
  await expect(counts.locator('[data-count-total="bath"]')).toHaveText('1 회');
  await expect(counts.getByTestId('statistic-total')).toHaveCount(0);
  await expect(page.locator('[data-statistic]')).toHaveCount(3);
  await page
    .getByRole('button', { name: '주단위 (6주기간)', exact: true })
    .click();
  await expect(
    page.locator('[data-statistic="feeding"] .insight-statistic-dates button'),
  ).toHaveCount(6);
  await expect(counts.locator('[data-statistic-series]')).toHaveCount(3);
  await page
    .getByRole('button', { name: '일단위 (일주일기간)', exact: true })
    .click();
  await expect(feeding.getByTestId('statistic-total')).toHaveText('1,860ml');
  await expect(page.locator('.insight-statistic-svg rect')).toHaveCount(0);
  await expect(page.locator('.insight-metric-tabs')).toHaveCount(0);
  await page.setViewportSize({ width: 900, height: 900 });
  await kinds.evaluate((rail) => (rail.scrollLeft = 0));
  const selectedBeforeDrag = await kinds
    .locator('[aria-pressed="true"]')
    .allTextContents();
  const railBox = (await kinds.boundingBox())!;
  await page.mouse.move(
    railBox.x + railBox.width * 0.75,
    railBox.y + railBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    railBox.x + railBox.width * 0.25,
    railBox.y + railBox.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  expect(await kinds.evaluate((rail) => rail.scrollLeft)).toBeGreaterThan(80);
  expect(
    await kinds.locator('[aria-pressed="true"]').allTextContents(),
  ).toEqual(selectedBeforeDrag);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectPhoneFunctionDock(page, kinds);
  await kinds.evaluate((rail) => (rail.scrollLeft = 0));
  const functionBox = (await kinds.boundingBox())!,
    functionTouch = await context.newCDPSession(page);
  const functionX = functionBox.x + functionBox.width * 0.8,
    functionY = functionBox.y + functionBox.height / 2;
  await functionTouch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: functionX, y: functionY }],
  });
  for (let i = 1; i <= 10; i++)
    await functionTouch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: functionX - i * 22, y: functionY }],
    });
  await functionTouch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  expect(await kinds.evaluate((rail) => rail.scrollLeft)).toBeGreaterThan(80);
  expect(
    await kinds.locator('[aria-pressed="true"]').allTextContents(),
  ).toEqual(selectedBeforeDrag);
  // A normal tap after a drag still toggles exactly one activity.
  await kinds.getByRole('button', { name: '목욕', exact: true }).click();
  await expect(counts.locator('[data-statistic-series]')).toHaveCount(2);
  await kinds.getByRole('button', { name: '목욕', exact: true }).click();
  await expect(counts.locator('[data-statistic-series]')).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/insights-statistics-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '주간패턴', exact: true }).click();
  await expect(page.locator('[data-statistic]')).toHaveCount(0);
  await expect(page.locator('[data-pattern-kind]')).toHaveCount(7);
  await expect(
    page.locator('.insight-weekly-pattern text').filter({ hasText: /^00$/ }),
  ).toHaveCount(1);
  await expect(page.locator('.insight-weekly-pattern')).not.toContainText('월');
  const firstMark = await page
    .locator('[data-pattern-kind="formula"] [data-pattern-mark]')
    .first()
    .evaluate((line) =>
      ['x1', 'x2', 'stroke-width'].map((name) => line.getAttribute(name)),
    );
  const surface = page.getByRole('group', {
    name: '주간 패턴 넘기기',
    exact: true,
  });
  await surface.scrollIntoViewIfNeeded();
  const box = (await surface.boundingBox())!,
    tx = box.x + box.width * 0.25,
    ty = box.y + box.height / 2;
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: tx, y: ty }],
  });
  for (let i = 1; i <= 10; i++)
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: tx + i * 14, y: ty }],
    });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(
    page.locator('.insight-period-nav time').first(),
  ).toHaveAttribute('datetime', '2026-10-05');
  await expect(kinds.locator('[aria-pressed="true"]')).toHaveCount(7);
  await page.getByRole('button', { name: '다음 7일', exact: true }).click();
  await expect(
    page.locator('.insight-period-nav time').first(),
  ).toHaveAttribute('datetime', '2026-10-12');
  expect(
    await page
      .locator('[data-pattern-kind="formula"] [data-pattern-mark]')
      .first()
      .evaluate((line) =>
        ['x1', 'x2', 'stroke-width'].map((name) => line.getAttribute(name)),
      ),
  ).toEqual(firstMark);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/insights-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '하루패턴', exact: true }).click();
  await expect(page.locator('.insight-daily-pattern')).toBeVisible();
  await expect(page.locator('.insight-day-nav time')).toHaveAttribute(
    'datetime',
    '2026-10-18',
  );
  await expect(page.locator('.insight-clock-center-label')).toHaveCount(0);
  await expect(page.locator('.insight-daily-pattern')).not.toContainText(
    '생후',
  );
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: '이전 하루', exact: true }).click();
    await expect(page.locator('.insight-day-nav time')).toHaveAttribute(
      'datetime',
      `2026-10-${17 - i}`,
    );
  }
  await expect(page.locator('[data-daily-kind="sleep"] path')).not.toHaveCount(
    0,
  );
  await page.screenshot({ caret: 'initial',
    path: 'test-results/insights-daily-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '이전 하루', exact: true }).click();
  await expect(page.locator('.insight-day-nav time')).toHaveAttribute(
    'datetime',
    '2026-10-12',
  );
  await page.getByRole('button', { name: '이전 하루', exact: true }).click();
  await expect(page.locator('.insight-day-nav time')).toHaveAttribute(
    'datetime',
    '2026-10-11',
  );
  await expect(kinds.locator('[aria-pressed="true"]')).toHaveCount(7);
  await page.goto(base + '&kind=formula,sleep&pattern=stats&interval=week');
  const second = await admin
    .from('children')
    .insert({sex: 'female',
      family_id: family,
      name: '빈 기록 아이',
      birth_date: '2026-09-01',
    })
    .select('id')
    .single();
  expect(second.error).toBeNull();
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .locator(
      '.topbar-child-picker:visible summary',
    )
    .click();
  await page
    .locator('.topbar-child-options:visible')
    .getByRole('link')
    .filter({ hasText: '빈 기록 아이' })
    .click();
  await expect(
    page.locator('[data-statistic="feeding"]').getByTestId('statistic-total'),
  ).toHaveText('—ml');
  expect(new URL(page.url()).searchParams.get('week')).toBe(week);
  const englishInsight = new URL(page.url());
  englishInsight.pathname = englishInsight.pathname.replace('/ko/', '/en/');
  await page.goto(englishInsight.toString());
  await expect(
    page.getByRole('button', { name: 'Weekly', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Care insights', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.topbar-child-info strong')).toHaveText(
    '빈 기록 아이',
  );
  expect(new URL(page.url()).searchParams.get('kind')).toBe('formula,sleep');
  await expect(kinds.locator('[aria-pressed="true"]')).toHaveCount(2);
  await expect(page.locator('[data-statistic]')).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get('interval')).toBe('week');
  await expect(
    page.getByRole('button', { name: 'Weekly (6 weeks)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.insight-briefing')).toHaveCount(0);
  const readerContext = await browser.newContext();
  try {
    const reader = await signIn(readerContext);
    await admin.from('profiles').insert({
      id: reader,
      display_name: 'Stats reader',
      consented_at: new Date().toISOString(),
    });
    await admin
      .from('family_members')
      .insert({ family_id: family, user_id: reader, role: 'viewer' });
    await admin.from('child_access').insert({
      family_id: family,
      child_id: child,
      user_id: reader,
      role: 'viewer',
    });
    const p = await readerContext.newPage();
    await p.goto(base + '&kind=formula&pattern=stats');
    await expect(
      p.locator('[data-statistic="feeding"]').getByTestId('statistic-total'),
    ).toHaveText('1,800ml');
    expect(
      (
        await p.goto(`/ko/insights?child=${second.data!.id}&week=${week}`)
      )?.status(),
    ).toBe(404);
  } finally {
    await readerContext.close();
  }
});

test('growth community shares only opted-in diaries with audience-specific fields', async ({
  page,
  context,
  browser,
}) => {
  const own = await childCareFamily(context);
  const readerContext = await browser.newContext();
  try {
    const reader = await childCareFamily(readerContext);
    const other = crypto.randomUUID();
    await admin.from('children').insert({sex: 'female',
      id: other,
      family_id: reader.family,
      name: '다른 생일',
      birth_date: '2025-01-01',
    });
    const record = crypto.randomUUID();
    const saved = await admin.from('child_records').insert({
      id: record,
      child_id: own.child,
      service: 'growth',
      kind: 'measurement',
      occurred_at: '2026-10-25T01:00:00Z',
      record_timezone: 'Asia/Seoul',
      weight_kg: 7.2,
      height_cm: 67,
      head_cm: 42,
      note: '오늘은 활짝 웃었어요.',
      created_by: own.owner,
    });
    expect(saved.error).toBeNull();
    await page.goto(`/ko/community/diaries?child=${own.child}`);
    await page
      .getByRole('button', { name: '일기 관리', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: '편집', exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: '비공개', exact: true }),
    ).toBeChecked();
    await page.locator('dialog[open] input[type="file"]').setInputFiles({
      name: 'diary.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XxY4AAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.locator('.public-diary-body img')).toHaveCount(1);
    const photo = await admin
      .from('child_record_photos')
      .select('*')
      .eq('record_id', record)
      .single();
    expect(photo.error).toBeNull();
    createdChildPhotos.push(photo.data!.path);
    await page.goto(`/ko/community/diaries?child=${own.child}`);
    await expect(page.locator('.diary-tabs a').first()).toHaveText(
      '우리 아이 성장일기',
    );
    await expect(page.locator('.diary-tabs a').first()).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('.public-diary-card')).toContainText(
      '오늘은 활짝 웃었어요.',
    );
    await expect(
      page.locator('.public-diary-card .public-diary-body img'),
    ).toHaveAttribute('src', `/api/care/photos/${photo.data!.id}?size=480`);
    await page.goto(`/ko/community/diaries?child=${own.child}`);
    await page
      .getByRole('button', { name: '일기 관리', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/community\/diaries/);
    const readerPage = await readerContext.newPage();
    await readerPage.goto(`/ko/community/diaries?child=${reader.child}`);
    await expect(readerPage.getByText('아직 성장일기가 없어요.')).toBeVisible();
    await readerPage.goto(
      `/ko/community/diaries?child=${reader.child}&scope=birth&age=297`,
    );
    await expect(
      readerPage.getByText('공개된 성장일기가 없어요.'),
    ).toBeVisible();
    expect(
      (
        await readerPage.request.get(
          `/api/community/diary-photos/${photo.data!.id}`,
        )
      ).status(),
    ).toBe(404);
    // Legacy cohort-only shares remain supported by the database.
    expect(
      (
        await admin
          .from('children')
          .update({ sex: 'female' })
          .eq('id', own.child)
      ).error,
    ).toBeNull();
    expect(
      (
        await admin.from('growth_diary_shares').upsert({
          record_id: record,
          same_birth_date: true,
          everyone: false,
          published_by: own.owner,
        })
      ).error,
    ).toBeNull();
    await readerPage.reload();
    const card = readerPage.locator('.public-diary-card');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('7.2 kg');
    await expect(card).toContainText('67 cm');
    await expect(card).toContainText('42 cm');
    await expect(
      card.getByRole('img', { name: '여아', exact: true }),
    ).toBeVisible();
    await expect(card.locator('.diary-nickname')).toHaveText('돌봄 아이');
    await expect(card.locator('h2:visible,time:visible')).toHaveCount(0);
    await expect(
      card.getByRole('img', { name: '몸무게', exact: true }),
    ).toBeVisible();
    await expect(card).not.toContainText('D+');
    await expect(readerPage.locator('.diary-age-nav')).toContainText('D+297');
    await expect(card).toContainText('오늘은 활짝 웃었어요.');
    await expect(card.locator('img')).toBeVisible();
    expect(
      (
        await readerPage.request.get(
          `/api/community/diary-photos/${photo.data!.id}`,
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await readerPage.request.get(`/api/care/photos/${photo.data!.id}`)
      ).status(),
    ).toBe(404);
    await readerPage
      .getByRole('link', { name: '이전 생후 일수', exact: true })
      .click();
    await expect(readerPage.locator('.diary-age-nav')).toContainText('D+296');
    await expect(card).toHaveCount(0);
    await readerPage
      .getByRole('link', { name: '다음 생후 일수', exact: true })
      .click();
    await expect(card).toHaveCount(1);
    const olderRecord = crypto.randomUUID(),
      privateMeasurement = crypto.randomUUID();
    const olderSaved = await admin.from('child_records').insert([
      {
        id: olderRecord,
        child_id: own.child,
        service: 'growth',
        kind: 'measurement',
        occurred_at: '2026-10-23T01:00:00Z',
        record_timezone: 'Asia/Seoul',
        weight_kg: 6.9,
        height_cm: 66,
        head_cm: 41.5,
        created_by: own.owner,
      },
      {
        id: privateMeasurement,
        child_id: own.child,
        service: 'growth',
        kind: 'measurement',
        occurred_at: '2026-10-22T01:00:00Z',
        record_timezone: 'Asia/Seoul',
        weight_kg: 99,
        created_by: own.owner,
      },
    ]);
    expect(olderSaved.error).toBeNull();
    expect(
      (
        await admin.from('growth_diary_shares').insert({
          record_id: olderRecord,
          same_birth_date: true,
          everyone: false,
          published_by: own.owner,
        })
      ).error,
    ).toBeNull();
    await card.locator('.diary-card-menu summary').click();
    await card
      .getByRole('button', { name: '성장 데이터 보기', exact: true })
      .click();
    const growthDialog = readerPage.getByRole('dialog', {
      name: '돌봄 아이 성장 데이터',
      exact: true,
    });
    await expect(growthDialog.locator('tbody tr')).toHaveCount(2);
    await expect(growthDialog.locator('tbody tr').first()).toContainText(
      'D+295',
    );
    await expect(growthDialog.locator('tbody tr').first()).toContainText('6.9');
    await expect(growthDialog.locator('tbody tr').last()).toContainText(
      'D+297',
    );
    await expect(growthDialog).not.toContainText('99');
    await growthDialog.screenshot({ caret: 'initial',
      path: 'test-results/growth-history-desktop.png',
    });
    await growthDialog
      .getByRole('button', { name: '닫기', exact: true })
      .click();
    await card.locator('.diary-card-menu summary').click();
    await card.getByRole('button', { name: '신고하기', exact: true }).click();
    const reportDialog = readerPage.getByRole('dialog', {
      name: '신고하기',
      exact: true,
    });
    await reportDialog.getByLabel('신고 사유').selectOption('privacy');
    await reportDialog
      .getByLabel('추가 내용 (선택)')
      .fill('예시 개인정보 신고 검증');
    await reportDialog
      .getByRole('button', { name: '신고 접수', exact: true })
      .click();
    await expect(reportDialog.getByRole('status')).toHaveText(
      '신고를 접수했어요.',
    );
    const report = await admin
      .from('community_reports')
      .select('*')
      .eq('diary_record_id', record)
      .single();
    expect(report.error).toBeNull();
    expect(report.data).toMatchObject({
      reporter_id: reader.owner,
      status: 'open',
      diary_note: '오늘은 활짝 웃었어요.',
    });
    await reportDialog
      .getByRole('button', { name: '닫기', exact: true })
      .click();
    await admin.from('community_moderators').insert({ user_id: reader.owner });
    await readerPage.goto('/ko/moderation');
    const reportCard = readerPage
      .locator('article')
      .filter({ hasText: record });
    await expect(reportCard).toContainText('예시 개인정보 신고 검증');
    const hideForm = reportCard.locator('form').filter({
      has: readerPage.getByRole('button', { name: '숨김', exact: true }),
    });
    await hideForm.getByLabel('사유').fill('검토 중');
    await hideForm.getByRole('button', { name: '숨김', exact: true }).click();
    await expect(readerPage).toHaveURL(/notice=saved/);
    expect(
      (
        await admin
          .from('growth_diary_shares')
          .select('hidden')
          .eq('record_id', record)
          .single()
      ).data?.hidden,
    ).toBe(true);
    const unhideForm = reportCard.locator('form').filter({
      has: readerPage.getByRole('button', { name: '숨김 해제', exact: true }),
    });
    await unhideForm.getByLabel('사유').fill('검토 완료');
    await Promise.all([
      readerPage.waitForResponse((r) => r.request().method() === 'POST'),
      unhideForm
        .getByRole('button', { name: '숨김 해제', exact: true })
        .click(),
    ]);
    await readerPage.goto(
      `/ko/community/diaries?child=${reader.child}&scope=birth&age=297`,
    );
    await expect(card).toHaveCount(1);
    const readerClient = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => readerContext.cookies(), setAll: () => {} } },
    );
    const signed = await readerClient.storage
      .from('child-care-photos')
      .createSignedUrl(photo.data!.path, 3600);
    expect(signed.error).not.toBeNull();
    expect(signed.data).toBeNull();
    await readerPage.setViewportSize({ width: 1280, height: 900 });
    await readerPage.screenshot({ caret: 'initial',
      path: 'test-results/growth-community-desktop.png',
      fullPage: true,
    });
    await readerPage.setViewportSize({ width: 390, height: 844 });
    await expect(
      readerPage
        .locator('.mobile-nav')
        .getByRole('link', { name: '성장 일기', exact: true }),
    ).toBeVisible();
    await expect(readerPage.locator('.topbar')).toContainText('돌봄 아이');
    expect(
      await readerPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await card.locator('.diary-card-menu summary').click();
    await card
      .getByRole('button', { name: '성장 데이터 보기', exact: true })
      .click();
    await expect(growthDialog.locator('tbody tr')).toHaveCount(2);
    await growthDialog.screenshot({ caret: 'initial',
      path: 'test-results/growth-history-mobile.png',
    });
    await growthDialog
      .getByRole('button', { name: '닫기', exact: true })
      .click();
    const ageBox = (await readerPage.locator('.diary-age-nav').boundingBox())!;
    await readerPage.mouse.move(ageBox.x + ageBox.width / 2, ageBox.y + 22);
    await readerPage.mouse.down();
    await readerPage.mouse.move(
      ageBox.x + ageBox.width / 2 + 75,
      ageBox.y + 22,
      { steps: 6 },
    );
    await readerPage.mouse.up();
    await expect(readerPage.locator('.diary-age-nav')).toContainText('D+296');
    await expect(card).toHaveCount(0);
    await readerPage
      .getByRole('link', { name: '다음 생후 일수', exact: true })
      .click();
    await expect(card).toHaveCount(1);
    await readerPage.screenshot({ caret: 'initial',
      path: 'test-results/growth-community-mobile.png',
      fullPage: true,
    });
    await readerPage.goto(`/ko/community/diaries?child=${other}&scope=birth`);
    await expect(readerPage.locator('.public-diary-card')).toHaveCount(0);
    await readerPage
      .getByRole('link', { name: '전체 성장일기', exact: true })
      .click();
    await expect(readerPage.locator('.public-diary-card')).toHaveCount(0);
    await page.reload();
    await page
      .getByRole('button', { name: '일기 관리', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: '편집', exact: true }).click();
    await page.getByRole('checkbox', { name: '비공개', exact: true }).uncheck();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await readerPage.reload();
    await expect(card).toHaveCount(1);
    await expect(card.locator('.diary-measurements')).toHaveCount(0);
    await expect(card).not.toContainText('7.2');
    await expect(card).toContainText('D+297');
    await readerPage.goto(
      `/en/community/diaries?child=${reader.child}&scope=all`,
    );
    await expect(
      readerPage.getByRole('link', { name: 'All growth diaries', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      readerPage
        .locator('.public-diary-card')
        .getByRole('img', { name: 'Girl', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: '일기 관리', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: '편집', exact: true }).click();
    await page.getByRole('checkbox', { name: '비공개', exact: true }).check();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await readerPage.reload();
    await expect(card).toHaveCount(0);
    expect(
      (
        await readerPage.request.get(
          `/api/community/diary-photos/${photo.data!.id}`,
        )
      ).status(),
    ).toBe(404);
  } finally {
    await readerContext.close();
  }
});

test('own diary uses a bottom sheet with optional growth measurements', async ({
  page,
  context,
}) => {
  const own = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/community/diaries?child=${own.child}`);
  await expect(
    page.getByRole('link', { name: '부모 게시판', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: '일기 쓰기', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '일기 쓰기', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '일기 쓰기' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('combobox')).toHaveCount(0);
  await expect(sheet.locator('header button')).toHaveCount(0);
  await expect(sheet.locator('h2')).toBeFocused();
  const [cancelBox, saveBox] = await sheet.evaluate((node) =>
    ['.quick-cancel', '.quick-confirm'].map((selector) => {
      const rect = node.querySelector(selector)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width };
    }),
  );
  expect(cancelBox.x + cancelBox.width).toBeLessThan(saveBox.x);
  expect(Math.abs(cancelBox.y - saveBox.y)).toBeLessThan(2);
  await sheet.getByRole('button', { name: '취소', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.getByRole('button', { name: '일기 쓰기', exact: true }).click();
  await page.screenshot({ caret: 'initial', path: '/tmp/podung-diary-composer.png', animations: 'disabled' });
  await expect(
    sheet.getByRole('checkbox', { name: '비공개', exact: true }),
  ).not.toBeChecked();
  await sheet
    .getByRole('textbox', { name: '일기 내용' })
    .fill('글만 남기는 하루');
  await sheet.getByRole('button', { name: '저장', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(
    page.getByText('글만 남기는 하루', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: '전체 성장일기', exact: true }).click();
  await expect(
    page.getByText('글만 남기는 하루', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: '우리 아이 성장일기', exact: true })
    .click();
  await page.getByRole('button', { name: '일기 쓰기', exact: true }).click();
  await sheet
    .getByRole('textbox', { name: '일기 내용' })
    .fill('함께 남긴 성장 수치');
  await sheet.getByRole('checkbox', { name: '비공개', exact: true }).check();
  await sheet
    .getByRole('spinbutton', { name: '몸무게', exact: true })
    .fill('7.5');
  await sheet.getByRole('spinbutton', { name: '키', exact: true }).fill('68');
  await sheet
    .getByRole('spinbutton', { name: '머리둘레', exact: true })
    .fill('42');
  await sheet.getByLabel('사진 추가', { exact: true }).setInputFiles({
    name: 'diary.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XxY4AAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await sheet.getByRole('button', { name: '저장', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  const card = page
    .locator('.public-diary-card')
    .filter({ hasText: '함께 남긴 성장 수치' });
  await expect(card).toContainText('7.5 kg');
  await expect(card).toContainText('68 cm');
  await expect(
    card.getByRole('img', { name: '성장일기 사진 1', exact: true }),
  ).toBeVisible();
  const records = await admin
    .from('child_records')
    .select('id, kind, weight_kg')
    .eq('child_id', own.child);
  expect(records.data).toHaveLength(2);
  expect(
    records.data?.find((row) => row.kind === 'observation')?.weight_kg,
  ).toBeNull();
  expect(
    records.data?.find((row) => row.kind === 'measurement')?.weight_kg,
  ).toBe(7.5);
  const photos = await admin
    .from('child_record_photos')
    .select('path')
    .eq('child_id', own.child);
  expect(photos.error).toBeNull();
  expect(photos.data).toHaveLength(1);
  for (const photo of photos.data ?? []) createdChildPhotos.push(photo.path);
  const privatePhoto = await admin
    .from('child_record_photos')
    .select('id')
    .eq('child_id', own.child)
    .single();
  const privateUrl = `/api/care/photos/${privatePhoto.data!.id}`;
  expect((await page.request.get(privateUrl)).status()).toBe(200);
  const exported = await page.request.get(
    `/api/data/export?child=${own.child}`,
  );
  const exportData = await exported.json();
  expect(exportData.child_records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ weight_kg: 7.5, height_cm: 68, head_cm: 42 }),
    ]),
  );
  expect(exportData.child_photos[0]).not.toHaveProperty('path');
  expect(exportData.child_photos[0]).not.toHaveProperty('uploaded_by');
  await expect(card.locator('.diary-nickname, .diary-sex')).toHaveCount(0);
  await card.getByRole('button', { name: '일기 관리', exact: true }).click();
  const manager = page.getByRole('dialog', { name: '일기 관리', exact: true });
  const menu = card.getByRole('group', { name: '일기 관리', exact: true });
  await expect(manager).not.toBeVisible();
  await expect(menu.getByRole('button', { name: '편집', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: '삭제', exact: true })).toBeVisible();
  const menuBox = (await menu.boundingBox())!;
  expect(menuBox.x).toBeGreaterThanOrEqual(0);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(card.getByRole('button', { name: '일기 관리', exact: true })).toBeFocused();
  await card.getByRole('button', { name: '일기 관리', exact: true }).click();
  await page.screenshot({ caret: 'initial',path: '/tmp/podung-diary-manage.png', animations: 'disabled'});
  await menu.getByRole('button', { name: '편집', exact: true }).click();
  await expect(manager.getByRole('textbox', { name: '일기 내용' })).toHaveValue(
    '함께 남긴 성장 수치',
  );
  await expect(
    manager.getByRole('checkbox', { name: '비공개', exact: true }),
  ).toBeChecked();
  await manager
    .getByRole('spinbutton', { name: '몸무게', exact: true })
    .fill('7.6');
  await manager.getByRole('button', { name: '저장', exact: true }).click();
  await expect(manager).not.toBeVisible();
  await expect(card).toContainText('7.6 kg');
  await expect(
    card.getByRole('img', { name: '성장일기 사진 1', exact: true }),
  ).toBeVisible();
  await page.goto(`/ko/today?child=${own.child}`);
  await page
    .locator('.quick-entry-growth')
    .filter({ hasText: '성장 기록' })
    .first()
    .click();
  const todayDiary = page.getByRole('dialog', {
    name: '일기 관리',
    exact: true,
  });
  await expect(
    todayDiary.getByRole('textbox', { name: '일기 내용' }),
  ).toHaveValue('함께 남긴 성장 수치');
  await expect(
    todayDiary.getByRole('checkbox', { name: '비공개', exact: true }),
  ).toBeChecked();
  await todayDiary
    .getByRole('spinbutton', { name: '몸무게', exact: true })
    .fill('7.7');
  await todayDiary.getByRole('button', { name: '저장', exact: true }).click();
  await expect(todayDiary).toBeHidden();
  await expect(page).toHaveURL(/\/ko\/today/);
  await page.goto(`/ko/community/diaries?child=${own.child}`);
  await expect(card).toContainText('7.7 kg');
  await expect(
    card.getByRole('img', { name: '성장일기 사진 1', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: '전체 성장일기', exact: true }).click();
  await expect(
    page.getByText('함께 남긴 성장 수치', { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('link', { name: '우리 아이 성장일기', exact: true })
    .click();
  await card.getByRole('button', { name: '일기 관리', exact: true }).click();
  await menu.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(card).toBeVisible();
  await menu.getByRole('button', { name: '삭제 확인', exact: true }).click();
  await expect(card).toHaveCount(0);
  expect((await page.request.get(privateUrl)).status()).toBe(404);
  const deleted = await admin
    .from('child_records')
    .select('id')
    .eq('id', records.data!.find((row) => row.kind === 'measurement')!.id);
  expect(deleted.data).toHaveLength(0);

  await page.getByRole('link', { name: '전체 성장일기', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '일기 쓰기', exact: true }),
  ).toHaveCount(0);
});

test('development guide hides the activity dock and preserves pattern selections', async ({
  page,
  context,
}) => {
  const own = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/ko/insights?child=${own.child}&kind=formula,sleep&pattern=guide`,
  );
  await expect(
    page.getByRole('button', { name: '가이드', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.insight-kind-rail')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '발달 살펴보기' }),
  ).toBeVisible();
  const age = page.locator('.development-age-nav strong');
  const initial = parseInt(await age.innerText(), 10);
  await page.getByRole('button', { name: '이전 월령' }).click();
  await expect(age).toHaveText(`${initial - 1}개월`);
  await page.getByRole('button', { name: '다음 월령' }).click();
  await expect(age).toHaveText(`${initial}개월`);
  await page.screenshot({ caret: 'initial',
    path: '/tmp/podung-development-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '주간패턴', exact: true }).click();
  await expect(page.locator('.insight-kind-rail')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('kind')).toBe('formula,sleep');
  await page.getByRole('button', { name: '가이드', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.insight-kind-rail')).toHaveCount(0);
  await page.screenshot({ caret: 'initial',
    path: '/tmp/podung-development-desktop.png',
    fullPage: true,
  });
  await page.goto(`/en/insights?child=${own.child}&kind=&pattern=guide`);
  await expect(
    page.getByRole('heading', { name: 'Development', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.insight-kind-rail')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await expect(page.getByText('Select activities to compare.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Guide', exact: true }),
  ).toBeVisible();
});

test('growth curves use private measurements and milestone checks persist by child', async ({
  page,
  context,
}) => {
  const graphWarnings: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /growth-reference|growth-child-point/.test(message.text())
    )
      graphWarnings.push(message.text());
  });
  const own = await childCareFamily(context);
  await admin.from('children').update({ sex: 'female' }).eq('id', own.child);
  const record = await admin.from('child_records').insert({
    id: crypto.randomUUID(),
    child_id: own.child,
    service: 'growth',
    kind: 'measurement',
    occurred_at: '2026-07-13T01:00:00Z',
    record_timezone: 'Asia/Seoul',
    weight_kg: 8.3,
    height_cm: 67,
    head_cm: 42,
    created_by: own.owner,
  });
  expect(record.error).toBeNull();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/insights?child=${own.child}&pattern=curve`);
  await expect(page.locator('.insight-kind-rail')).toHaveCount(0);
  await expect(page.locator('.growth-metric-chart')).toHaveCount(3);
  await expect(page.locator('.growth-selected').nth(0)).toContainText('8.3 kg');
  await expect(page.locator('.growth-selected').nth(0)).toContainText('D+193');
  await expect(page.locator('.growth-reference')).toHaveCount(21);
  await expect(page.locator('.growth-selected').nth(0)).toContainText('백분위');
  await expect(page.locator('.growth-selected').nth(1)).toContainText('67 cm');
  await expect(page.locator('.growth-selected').nth(2)).toContainText('42 cm');
  await expect(page.getByRole('button', { name: '몸무게', exact: true })).toHaveCount(0);
  const referenceOptions = page.getByRole('group', { name: '비교 기준', exact: true });
  await expect(referenceOptions.getByRole('button', { name: '여아' })).toHaveAttribute('aria-pressed', 'true');
  await referenceOptions.getByRole('button', { name: '남아' }).click();
  await expect(referenceOptions.getByRole('button', { name: '남아' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: '기간', exact: true }).getByRole('button', { name: '0–2세' }).click();
  for (const chart of await page.locator('.growth-svg').all()) await expect(chart).toContainText('730');
  await referenceOptions.getByRole('button', { name: '여아' }).click();
  await page.getByRole('button', { name: '0–1세', exact: true }).click();
  await page.screenshot({ caret: 'initial',
    path: '/tmp/podung-growth-curve-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '마일스톤', exact: true }).click();
  await expect(page.locator('.insight-kind-rail')).toHaveCount(0);
  const checkbox = page.getByRole('checkbox', {
    name: '도움 없이 앉아요',
    exact: true,
  });
  const rowHeight = await checkbox.locator('..').evaluate((el) => el.getBoundingClientRect().height);
  expect(rowHeight).toBeGreaterThanOrEqual(44);
  expect(rowHeight).toBeLessThanOrEqual(48);
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeEnabled();
  await expect(
    page.locator('.milestones-panel').getByRole('alert'),
  ).toHaveCount(0);
  await page.reload();
  await expect(checkbox).toBeChecked();
  await page.screenshot({ caret: 'initial',
    path: '/tmp/podung-milestones-mobile.png',
    fullPage: true,
  });
  const stored = await admin
    .from('child_milestones')
    .select('*')
    .eq('child_id', own.child);
  expect(stored.data?.map((row) => row.milestone_key)).toEqual([
    'cdc-v1-9-sit',
  ]);
  await page.getByRole('button', { name: '다음 발달 월령' }).click();
  await expect(page.locator('.development-age-nav')).toContainText('12개월');
  await page.getByRole('button', { name: '이전 발달 월령' }).click();
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeEnabled();
  await page.reload();
  await expect(checkbox).not.toBeChecked();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '성장곡선', exact: true }).click();
  await page.screenshot({ caret: 'initial',
    path: '/tmp/podung-growth-curve-desktop.png',
    fullPage: true,
  });
  await page.goto(`/en/insights?child=${own.child}&pattern=milestones`);
  await expect(
    page.getByRole('heading', { name: 'Movement', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Sits without support', exact: true }),
  ).not.toBeChecked();
  expect(graphWarnings).toEqual([]);
});

test('compact mobile navigation switches children and opens language settings', async ({
  page,
  context,
}) => {
  const { child, family } = await childCareFamily(context);
  const second = await admin
    .from('children')
    .insert({sex: 'female', family_id: family, name: '둘째', birth_date: '2026-09-01' })
    .select('id')
    .single();
  expect(second.error).toBeNull();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/ko/today?child=${child}`);
    await expect(page.locator('.topbar')).toBeHidden();
    const picker = page.locator('.mobile-child-link');
    await expect(page.locator('.mobile-nav > a')).toHaveCount(6);
    await expect(page.locator('.mobile-nav > :last-child')).toHaveClass(/mobile-child-link/);
    await picker.click();
    await expect(page.getByRole('heading', { name: '아이와 설정' })).toHaveCount(0);
    await page.locator('.account-child-list').getByRole('link', { name: /둘째/ }).click();
    await expect(page).toHaveURL(new RegExp(`child=${second.data!.id}`));
    await expect(picker).toContainText('둘째');
    for (const section of ['today', 'calendar', 'insights']) {
      await page.goto(`/ko/${section}?child=${child}`);
      const rail = page.locator('.mobile-function-rail');
      await expect(rail).toBeVisible();
      const box = await rail.boundingBox();
      expect(box!.height).toBeLessThanOrEqual(68);
      await page.screenshot({ caret: 'initial',
        path: `test-results/compact-${section}-${width}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({ caret: 'initial', path: `test-results/compact-mobile-${width}.png` });
  }
  await page.locator('.mobile-child-link').click();
  await page.locator('summary').filter({ hasText: '보호자 설정' }).click();
  await expect(page).toHaveURL(new RegExp(`/ko/account\\?child=${child}`));
  await expect(page.locator('.mobile-child-link')).toHaveClass(/active/);
  await page.locator('.mobile-child-link').click();
  await page.locator('summary').filter({ hasText: '아이 설정' }).click();
  await expect(page).toHaveURL(/\/ko\/account/);
  await expect(page.locator('#child-info')).toBeInViewport();
  await page.locator('.mobile-child-link').click();
  await page.locator('summary').filter({ hasText: '언어 설정' }).click();
  await page.locator('.settings-language').getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/en/account\\?child=${child}`));
  await expect(page.locator('.settings-language')).toContainText('Language');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/ko/today?child=${child}`);
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.mobile-nav')).toBeHidden();
});

test.describe('quick feeding across midnight', () => {
  test.use({timezoneId:'UTC'});
test('quick feeding remembers each kind across days and allows direct start-time edits', async ({
  page,
  context,
}) => {
  const { child, owner } = await childCareFamily(context);
  const old = Date.now() - 10 * 86400000;
  const rows = [
    ['formula', 170],
    ['solids', 90],
  ].map(([kind, amount], i) => ({
    id: crypto.randomUUID(),
    child_id: child,
    kind: String(kind),
    amount_ml: Number(amount),
    started_at: new Date(old + i * 3600000).toISOString(),
    ended_at: new Date(old + i * 3600000 + 600000).toISOString(),
    created_by: owner,
    updated_by: owner,
  }));
  expect((await admin.from('care_records').insert(rows)).error).toBeNull();
  const seoulDay = new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Seoul'});
  await page.clock.setFixedTime(new Date(`${seoulDay}T01:55:00+09:00`));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${child}`);
  const quick = page.locator('.quick-care');
  const dialog = quick.locator('dialog.quick-composer');
  for (const [name, amount] of [
    ['분유', '170'],
    ['이유식', '90'],
  ]) {
    await quick
      .locator('.quick-grid')
      .getByRole('button', { name, exact: true })
      .click();
    await expect(dialog.getByRole('slider')).toHaveValue(amount);
    await expect(
      dialog.getByRole('link', { name: '자세히 기록', exact: true }),
    ).toHaveCount(0);
    await expect(dialog.locator('.quick-time-edit input')).toBeVisible();
    const timeBox = await dialog.locator('.quick-time-control').boundingBox();
    const rulerBox = await dialog.locator('.quick-ruler').boundingBox();
    expect(Math.abs(timeBox!.x - rulerBox!.x)).toBeLessThan(2);
    expect(Math.abs(timeBox!.width - rulerBox!.width)).toBeLessThan(2);
    const cancelBox = await dialog
      .getByRole('button', { name: '취소', exact: true })
      .boundingBox();
    const saveBox = await dialog
      .getByRole('button', { name: '저장하기', exact: true })
      .boundingBox();
    expect(cancelBox!.x).toBeLessThan(saveBox!.x);
    await expect(dialog.locator('textarea')).toHaveCount(0);
    await expect(dialog.locator('.quick-composer-heading button')).toHaveCount(
      0,
    );

    await dialog.getByRole('button', { name: '취소', exact: true }).click();
  }
  await quick
    .locator('.quick-grid')
    .getByRole('button', { name: '분유', exact: true })
    .click();
  const start = await page.evaluate(() => {
    const date = new Date(Date.now() - 7200000);
    date.setSeconds(0, 0);
    const value = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    return { value, iso: date.toISOString() };
  });
  await dialog
    .locator('.quick-time-edit input')
    .fill(start.value.slice(11, 16));
  await dialog.getByRole('button', { name: '15분', exact: true }).click();
  await expect(dialog.locator('.quick-time-edit input')).toHaveValue(
    start.value.slice(11, 16),
  );
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toBeHidden();
  const latest = await admin
    .from('care_records')
    .select('started_at,amount_ml')
    .eq('child_id', child)
    .eq('kind', 'formula')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();
  expect(latest.error).toBeNull();
  expect(latest.data!.amount_ml).toBe(170);
  expect(new Date(latest.data!.started_at).toISOString()).toBe(start.iso);
  await expect(quick.locator('.quick-timeline-entry').filter({hasText:'170 ml'})).toHaveCount(2);
  const recordedDay = quick.locator('.quick-day-browser').filter({
    has: page.locator(`.quick-timeline-heading time[datetime="${new Date(start.iso).toLocaleDateString('en-CA', {timeZone:'Asia/Seoul'})}"]`),
  });
  await recordedDay
    .locator('.quick-timeline-entry')
    .filter({ hasText: '170 ml' })
    .click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('slider')).toHaveValue('170');
  await expect(
    dialog.getByRole('button', { name: '15분', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: '200 ml', exact: true }).click();
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp('/ko/today'));
  const edited = await admin
    .from('care_records')
    .select('amount_ml,version')
    .eq('child_id', child)
    .eq('started_at', start.iso)
    .single();
  expect(edited.error).toBeNull();
  expect(edited.data!.amount_ml).toBe(200);
  expect(edited.data!.version).toBe(2);
  await recordedDay
    .locator('.quick-timeline-entry')
    .filter({ hasText: '200 ml' })
    .click();
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    quick.locator('.quick-timeline-entry').filter({ hasText: '200 ml' }),
  ).toHaveCount(0);
});

});

test('quick record subtitles and control gaps stay consistent across mobile and desktop', async ({
  page,
  context,
}) => {
  const { child } = await childCareFamily(context);
  await page.goto(`/ko/today?child=${child}`);
  const quick = page.locator('.quick-care');
  const dialog = quick.locator('dialog.quick-composer');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const kind of ['분유', '이유식', '기저귀', '체온']) {
      await quick
        .locator('.quick-grid')
        .getByRole('button', { name: kind, exact: true })
        .click();
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('#quick-composer-title')).toBeFocused();
      for (const selector of [
        '.quick-composer-heading',
        '#quick-composer-title',
      ]) {
        await expect(dialog.locator(selector)).toHaveCSS(
          'outline-style',
          'none',
        );
        await expect(dialog.locator(selector)).toHaveCSS('box-shadow', 'none');
      }
      const subtitles = dialog.locator(
        '.quick-amount-label > span, .quick-duration legend > span, .quick-time-edit label > span:first-child',
      );
      for (const title of await subtitles.all()) {
        await expect(title).toHaveCSS('font-size', '12px');
        await expect(title).toHaveCSS('font-weight', '600');
        await expect(title).toHaveCSS('line-height', '18px');
      }
      for (const selector of [
        '.quick-amount-presets',
        '.quick-feeding-duration .quick-choices',
      ]) {
        const buttons = dialog.locator(`${selector} > button`);
        if (await buttons.count()) {
          const tops = await buttons.evaluateAll((nodes) =>
            nodes.map((node) => node.getBoundingClientRect().top),
          );
          expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
        }
      }
      const timeWidth = (await dialog
        .locator('.quick-time-control')
        .boundingBox())!.width;
      const fieldWidth = (await dialog.locator('.quick-fields').boundingBox())!
        .width;
      expect(Math.abs(timeWidth - fieldWidth)).toBeLessThan(1);
      const gaps = await dialog.evaluate((node) => {
        const pairs = [
          [
            '.quick-amount-label',
            '.quick-amount-presets, .quick-temperature-presets',
          ],
          ['.quick-duration legend', '.quick-duration .quick-choices'],
          ['.quick-time-edit label > span:first-child', '.quick-time-control'],
        ];
        return pairs.flatMap(([titleSelector, controlSelector]) => {
          const title = node.querySelector(titleSelector);
          const control = node.querySelector(controlSelector);
          if (!title || !control) return [];
          // Legend padding is the spacing before its controls.
          const padding = parseFloat(getComputedStyle(title).paddingBottom);
          return [
            control.getBoundingClientRect().top -
              title.getBoundingClientRect().bottom +
              padding,
          ];
        });
      });
      for (const gap of gaps) expect(Math.abs(gap - 10)).toBeLessThan(1);
      expect(
        await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
      if (width === 390 && ['분유', '체온'].includes(kind)) {
        await page.screenshot({ caret: 'initial',
          path: `test-results/quick-subtitles-${kind === '분유' ? 'formula' : 'temperature'}.png`,
        });
      }
      await dialog.getByRole('button', { name: '취소', exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
  }
});

test('home screen install exposes manifest, manual guidance and browser installation actions', async ({
  page,
  context,
}) => {
  const { child } = await childCareFamily(context);
  const manifestResponse = await page.request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('/');
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/account?child=${child}`);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(
    page.locator('meta[name="mobile-web-app-capable"]'),
  ).toHaveAttribute('content', 'yes');
  const install = page.getByRole('button', {
    name: '앱으로 설치',
    exact: true,
  });
  await install.click();
  const guide = page.getByRole('dialog', { name: '앱으로 설치' });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('페이지를 앱으로 설치');
  await guide.getByRole('button', { name: '확인' }).click();
  await expect(guide).not.toBeVisible();
  // Native browser prompts cannot be operated by Playwright; exercise the
  // browser event boundary and ensure a dismissed prompt is never reused.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.installPromptCount = '1';
      },
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);
  });
  await install.click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-install-prompt-count',
    '1',
  );
  await install.click();
  await expect(guide).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(install).toHaveCount(0);
});

test('iPhone home screen guidance works from account settings without a native install prompt', async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1',
    }),
  );
  const { child } = await childCareFamily(context);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/ko/settings?child=${child}`);
  await page
    .getByRole('button', { name: '홈 화면에 추가', exact: true })
    .click();
  const guide = page.getByRole('dialog', { name: '홈 화면에 추가' });
  await expect(guide).toContainText('Safari');
  await expect(guide).toContainText('웹 앱으로 열기');
  await expect(guide.getByRole('img', {name:'1단계 메뉴 위치를 표시한 안내용 재현 화면',exact:true})).toBeVisible();
  await guide.getByRole('button', {name:'다음 단계',exact:true}).click();
  await expect(guide.getByRole('img', {name:'2단계 메뉴 위치를 표시한 안내용 재현 화면',exact:true})).toBeVisible();
  await guide.getByRole('button', {name:'다음 단계',exact:true}).click();
  await expect(guide.getByRole('img', {name:'3단계 메뉴 위치를 표시한 안내용 재현 화면',exact:true})).toBeVisible();
  await guide.getByRole('button', {name:'이전 단계',exact:true}).click();
  expect(
    await guide.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({ caret: 'initial', path: 'test-results/install-iphone-guide.png' });
  await guide.getByRole('button', { name: '확인' }).click();
  await expect(guide).not.toBeVisible();
});

test('Android and PC show platform-specific installation and notification guidance', async ({ page, context }) => {
  const { child } = await childCareFamily(context);
  for (const sample of [
    { ua: 'Mozilla/5.0 (Linux; Android 16) Chrome/130.0 Mobile Safari/537.36', button: '홈 화면에 추가', platform: '안드로이드', install: 'Chrome에서', notification: '안드로이드의 Chrome 앱 알림' },
    { ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130', button: '앱으로 설치', platform: 'PC', install: 'Chrome 또는 Edge', notification: '운영체제의 브라우저' },
    { ua: 'Mozilla/5.0 (Macintosh) Version/26.0 Safari/605.1', button: '앱으로 설치', platform: 'Mac · Safari', install: 'Dock에 추가', notification: '운영체제의 브라우저' },
  ]) {
    const target = await context.newPage();
    await target.addInitScript(ua => Object.defineProperty(navigator, 'userAgent', {value: ua}), sample.ua);
    await target.goto(`/ko/account?child=${child}`);
    await target.getByRole('button', { name: sample.button, exact: true }).click();
    const dialog = target.getByRole('dialog', {name: sample.button, exact: true});
    await expect(dialog).toContainText(sample.platform);
    await expect(dialog).toContainText(sample.install);
    await dialog.getByRole('button', {name:'확인',exact:true}).click();
    await target.goto(`/ko/account?child=${child}&panel=notifications`);
    const guide = target.locator('.feeding-push-settings .device-guide');
    await guide.locator('summary').click();
    await expect(guide).toContainText('설치 없이도');
    await expect(guide).toContainText(sample.notification);
    await target.close();
  }
  await page.close();
});

test('past records edit in place, preserve hidden data and reject stale edits', async ({
  page,
  context,
}) => {
  const { child, owner } = await childCareFamily(context);
  const yesterday = new Date(Date.now() - 86400000);
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(yesterday);
  const id = crypto.randomUUID();
  const start = `${day}T01:00:00.000Z`;
  expect(
    (
      await admin.from('care_records').insert({
        id,
        child_id: child,
        kind: 'formula',
        amount_ml: 120,
        started_at: start,
        ended_at: `${day}T01:10:00.000Z`,
        note: 'Preserved note',
        created_by: owner,
        updated_by: owner,
      })
    ).error,
  ).toBeNull();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${child}`);
  await page.locator('.quick-history-loader').scrollIntoViewIfNeeded();
  const historyDay = page.locator('.quick-day-browser').filter({ has: page.locator(`time[datetime="${day}"]`) });
  await expect(historyDay).toBeVisible();
  const quick = page.locator('.quick-care'),
    sheet = quick.locator('dialog.quick-composer');
  await quick
    .locator('.quick-timeline-entry')
    .filter({ hasText: '120 ml' })
    .click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '160 ml', exact: true }).click();
  await sheet.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(historyDay.locator('.quick-timeline-heading time')).toHaveAttribute(
    'datetime',
    day,
  );
  await expect(historyDay.locator('.quick-timeline-entry').filter({hasText:'160 ml'})).toBeVisible();
  const saved = await admin
    .from('care_records')
    .select('*')
    .eq('id', id)
    .single();
  expect(saved.data!.note).toBe('Preserved note');
  expect(new Date(saved.data!.started_at).toISOString()).toBe(start);
  expect(saved.data!.version).toBe(2);
  await historyDay.locator('.quick-timeline-entry').filter({hasText:'160 ml'}).click();
  await admin
    .from('care_records')
    .update({ version: 3, amount_ml: 200 })
    .eq('id', id);
  await sheet.getByRole('button', { name: '240 ml', exact: true }).click();
  await sheet.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(sheet.getByRole('alert')).toBeVisible();
  const conflicted = await admin
    .from('care_records')
    .select('amount_ml')
    .eq('id', id)
    .single();
  expect(conflicted.data!.amount_ml).toBe(200);
});

test('today and insights share mobile activity order, geometry and native dragging', async ({
  page,
  context,
}) => {
  const { child } = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  const touch = await context.newCDPSession(page);
  let todayGeometry: unknown;
  const expected = [
    '모유',
    '분유',
    '이유식',
    '기저귀',
    '배변',
    '수면',
    '목욕',
    '병원',
    '예방접종',
    '체온',
    '투약',
    '간식',
    '놀이',
    '터미타임',
  ];
  for (const section of ['today', 'insights']) {
    await page.goto(`/ko/${section}?child=${child}`);
    const rail = page.locator(
      section === 'today' ? '.quick-care .quick-grid' : '.insight-kind-rail',
    );
    await expect(rail.getByRole('button')).toHaveText(section === 'today' ? ['성장 기록', ...expected, '어린이집', '유치원', '선물', '용돈'] : [...expected, '어린이집', '유치원']);
    await expect(rail).toHaveCSS('border-top-left-radius', '0px');
    await expect(rail).toHaveCSS('border-top-right-radius', '0px');
    const geometry = await rail.evaluate((node) => {
      const button = node.querySelector('button')!,
        icon = button.querySelector('.quick-orbit-icon')!;
      const r = getComputedStyle(node),
        b = button.getBoundingClientRect(),
        i = icon.getBoundingClientRect();
      return {
        height: node.getBoundingClientRect().height,
        gap: r.gap,
        padding: r.padding,
        buttonWidth: b.width,
        buttonHeight: b.height,
        iconWidth: i.width,
        iconHeight: i.height,
      };
    });
    if (section === 'today') todayGeometry = geometry;
    else expect(geometry).toEqual(todayGeometry);
    const selection = await rail
      .locator('[aria-pressed=true]')
      .allTextContents();
    const box = (await rail.boundingBox())!,
      x = box.x + box.width * 0.8,
      y = box.y + box.height / 2;
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 10; i++)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x - i * 22, y }],
      });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect
      .poll(() => rail.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(80);
    expect(await rail.locator('[aria-pressed=true]').allTextContents()).toEqual(
      selection,
    );
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await rail.evaluate((node) => {
      node.scrollLeft = 0;
    });
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 200, y, { steps: 12 });
    await page.mouse.up();
    await expect
      .poll(() => rail.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(80);
    expect(await rail.locator('[aria-pressed=true]').allTextContents()).toEqual(
      selection,
    );
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await rail.getByRole('button', { name: '목욕', exact: true }).click();
    if (section === 'today')
      await expect(page.locator('.quick-care dialog.quick-composer')).toBeVisible();
    else
      await expect(
        rail.getByRole('button', { name: '목욕', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
  }
});

test('mobile patterns keep compact dates and enlarge daily and weekly graphs', async ({
  page,
  context,
}) => {
  const hydration: string[] = [];
  page.on('console', (message) => {
    if (/hydrated|hydration/i.test(message.text()))
      hydration.push(message.text());
  });
  const { child } = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['daily', 'weekly']) {
    await page.goto(`/ko/insights?child=${child}&pattern=${mode}`);
    const kinds = page.locator('.insight-kind-rail');
    await expect(kinds.getByRole('button',{name:'이유식',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(kinds.getByRole('button',{name:'배변',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(kinds.getByRole('button',{name:'기저귀',exact:true})).toHaveAttribute('aria-pressed','true');
    expect(await kinds.locator('.quick-color-diaper').evaluate(node=>getComputedStyle(node).getPropertyValue('--care-ink').trim())).toBe('#a58a08');
    expect(await kinds.locator('.quick-color-solids').evaluate(node=>getComputedStyle(node).getPropertyValue('--care-ink').trim())).toBe('#33815b');
    expect(await kinds.locator('.quick-color-stool').evaluate(node=>getComputedStyle(node).getPropertyValue('--care-ink').trim())).toBe('#b77522');
    const panel = page.locator('.insight-pattern-panel');
    const chart = panel.locator(
      mode === 'daily' ? '.insight-daily-pattern' : '.insight-weekly-pattern',
    );
    await expect(chart).toHaveAttribute(
      'viewBox',
      mode === 'daily' ? '8 8 364 364' : '0 0 544 898',
    );
    const dateBox = (await panel.locator('.insight-period-nav').boundingBox())!,
      graphBox = (await chart.boundingBox())!;
    expect(dateBox.height).toBeLessThanOrEqual(44);
    expect(dateBox.width).toBeLessThan(graphBox.width);
    expect(graphBox.width).toBeGreaterThan(330);
    if (mode === 'weekly') expect(graphBox.height).toBeGreaterThan(540);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ caret: 'initial',
      path: `test-results/mobile-${mode}-expanded.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
  }
  expect(hydration).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.insight-weekly-pattern')).toHaveAttribute(
    'viewBox',
    '0 0 544 490',
  );
});

test('insight presentation changes reuse loaded records', async ({
  page,
  context,
}, testInfo) => {
  const own = await childCareFamily(context);
  const sibling = await admin
    .from('children')
    .insert({sex: 'female',
      family_id: own.family,
      name: '다른 아이',
      birth_date: '2026-01-02',
    })
    .select('id')
    .single();
  expect(sibling.error).toBeNull();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/ko/insights?child=${own.child}&week=2026-10-12&kind=formula&pattern=weekly`,
  );
  const rail = page.getByRole('group', { name: '기능별 분석', exact: true });
  await expect(rail).toBeVisible();
  const requests: string[] = [];
  page.on('request', (request) => {
    if (
      request.headers().rsc === '1' &&
      new URL(request.url()).pathname.endsWith('/insights') &&
      new URL(request.url()).searchParams.has('week')
    )
      requests.push(request.url());
  });
  const historyLength = await page.evaluate(() => history.length);
  const started = Date.now();
  await rail.getByRole('button', { name: '이유식', exact: true }).click();
  await expect(
    rail.getByRole('button', { name: '이유식', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const filterMs = Date.now() - started;
  await page.getByRole('button', { name: '하루패턴', exact: true }).click();
  await expect(page.locator('.insight-daily-pattern')).toBeVisible();
  await page.getByRole('button', { name: '이전 하루', exact: true }).click();
  await expect(page).toHaveURL(/day=2026-10-17/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(rail.locator('[aria-pressed="true"]')).toHaveCount(2);
  await page.getByRole('button', { name: '통계', exact: true }).click();
  await expect(page.locator('[data-statistic="feeding"]')).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: '주간패턴', exact: true }).click();
  await page.getByRole('button', { name: '이전 7일', exact: true }).click();
  await expect(page).toHaveURL(/week=2026-10-05/);
  await expect(rail.locator('[aria-pressed="true"]')).toHaveCount(2);
  expect(requests.length).toBeGreaterThan(0);
  await testInfo.attach('interaction-metrics', {
    body: JSON.stringify({
      filterMs,
      presentationServerRequests: 0,
      periodServerRequests: requests.length,
    }),
    contentType: 'application/json',
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('.topbar-child-picker summary').click();
  await page
    .locator('.topbar-child-options')
    .getByRole('link')
    .filter({ hasText: '다른 아이' })
    .click();
  await expect(page).toHaveURL(new RegExp(`child=${sibling.data!.id}`));
  await expect(rail.locator('[aria-pressed="true"]')).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get('kind')).toBe('formula,solids');
  expect(new URL(page.url()).searchParams.get('week')).toBe('2026-10-05');
  await page.reload();
  await expect(rail.locator('[aria-pressed="true"]')).toHaveCount(2);
});

test('menu navigation responds before server data arrives', async ({
  page,
  context,
}) => {
  const own = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${own.child}`);
  // Hold the route response so feedback is verified independently of network speed.
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/ko/calendar?**', async (route) => {
    if (route.request().headers().rsc === '1') await hold;
    await route.continue();
  });
  try {
    await page
      .locator('.mobile-nav')
      .getByRole('link', { name: '일정', exact: true })
      .click();
    await expect(page.locator('.mobile-nav .navigation-pending')).toBeVisible();
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/ko\/calendar/);
  await expect(page.locator('.navigation-pending')).toHaveCount(0);
});

test('mobile diaries have a compact header, top composer and five authorized thumbnails', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(90000);
  const own = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/community/diaries?child=${own.child}`);
  await page.getByRole('button', { name: '일기 쓰기', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '일기 쓰기', exact: true });
  const png = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: '#f4c8a8' },
  })
    .png()
    .toBuffer();
  const portrait = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#e9eadc' } }).png().toBuffer();
  const small = await sharp({ create: { width: 160, height: 100, channels: 3, background: '#eadcdd' } }).png().toBuffer();
  const files = Array.from({ length: 5 }, (_, i) => ({
    name: `photo-${i}.png`,
    mimeType: 'image/png',
    buffer: i === 1 ? portrait : i === 2 ? small : png,
  }));
  const input = sheet.getByLabel('사진 추가', { exact: true });
  await input.setInputFiles([...files, ...files]);
  await expect(sheet.getByRole('alert')).toContainText('최대 9장');
  await input.setInputFiles(files);
  await expect(sheet.locator('.diary-photo-count')).toHaveText('5/9');
  await sheet
    .getByRole('textbox', { name: '일기 내용' })
    .fill(
      '사진 다섯 장의 하루. ' +
        '아이가 웃고 놀며 즐겁게 보낸 하루를 기억해요. '.repeat(12),
    );
  await sheet
    .getByRole('spinbutton', { name: '몸무게', exact: true })
    .fill('7.25');
  await sheet.getByRole('spinbutton', { name: '키', exact: true }).fill('68.5');
  await sheet
    .getByRole('spinbutton', { name: '머리둘레', exact: true })
    .fill('42.25');
  await sheet.getByRole('button', { name: '저장', exact: true }).click();
  await expect(sheet).toBeHidden();
  const card = page
    .locator('.public-diary-card')
    .filter({ hasText: '사진 다섯 장의 하루' });
  await expect(card.locator('.public-diary-body img')).toHaveCount(5);
  const photos = await admin
    .from('child_record_photos')
    .select('id,path')
    .eq('child_id', own.child);
  expect(photos.data).toHaveLength(5);
  for (const photo of photos.data ?? []) createdChildPhotos.push(photo.path);
  const write = (await page
    .getByRole('button', { name: '일기 쓰기', exact: true })
    .boundingBox())!;
  const cardBox = (await card.boundingBox())!;
  expect(write.y + write.height).toBeLessThanOrEqual(cardBox.y);
  expect(
    (await card.locator(':scope > header').boundingBox())!.height,
  ).toBeLessThanOrEqual(49);
  expect(
    (await card
      .getByRole('button', { name: '일기 관리', exact: true })
      .boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  const story = card.locator('.diary-story');
  expect((await story.boundingBox())!.height).toBeLessThanOrEqual(260);
  const metricTops = await card
    .locator('.diary-measurements dd')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().top),
    );
  expect(new Set(metricTops).size).toBe(1);
  await card.getByRole('button', { name: '더보기', exact: true }).click();
  await expect(
    card.getByRole('button', { name: '접기', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  expect((await story.boundingBox())!.height).toBeLessThanOrEqual(260);
  await card.getByRole('button', { name: '접기', exact: true }).click();
  const carousel = card.locator('.diary-photo-carousel');
  const box = (await carousel.boundingBox())!;
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width * 0.85, y: box.y + 65 }],
  });
  for (let step = 1; step <= 8; step++)
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: box.x + box.width * (0.85 - (0.7 * step) / 8), y: box.y + 65 },
      ],
    });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(card.locator('.diary-photo-position')).not.toHaveText('1 / 5');
  await touch.detach();
  expect(context.pages()).toHaveLength(1);
  await card.getByRole('button', { name: '일기 보기', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '성장일기', exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.locator('time')).toBeVisible();
  await expect(detail.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  await expect(detail.locator('.diary-back-label')).toBeHidden();
  const detailPhoto = detail.locator('img').first();
  await expect(detailPhoto).toHaveAttribute('src', /size=1600$/);
  const fullPhoto = await page.request.get((await detailPhoto.getAttribute('src'))!);
  expect(fullPhoto.status()).toBe(200);
  expect([160, 600, 1600]).toContain((await sharp(await fullPhoto.body()).metadata()).width);
  expect(fullPhoto.headers().etag).toContain('1600-webp');
  await detail.getByRole('button', { name: '돌아가기' }).click();
  await page.getByRole('button', { name: '일기 공유', exact: true }).click();
  const sharing = page.getByRole('dialog', { name: '일기 공유', exact: true });
  await sharing.getByRole('button', { name: '공유 링크 만들기', exact: true }).click();
  const linkInput = sharing.getByRole('textbox', { name: '공유 링크', exact: true });
  await expect(linkInput).toHaveValue(/\/ko\/share\/diary\/[a-f0-9]{64}$/);
  const firstLink = await linkInput.inputValue();
  const olderDiary = crypto.randomUUID();
  const extraRecord = await admin.from('child_records').insert({
    id: olderDiary, child_id: own.child, service: 'growth', kind: 'observation',
    occurred_at: new Date(Date.now() - 86400000).toISOString(), record_timezone: 'Asia/Seoul',
    note: '작은 손으로 내 손가락을 꼭 잡았다. 오늘도 함께 자라는 우리.',
    title: '', created_by: own.owner,
  });
  expect(extraRecord.error).toBeNull();
  const extraShare = await admin.from('growth_diary_shares').insert({ record_id: olderDiary, everyone: true, published_by: own.owner });
  expect(extraShare.error).toBeNull();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const guest = await guestContext.newPage();
    const response = await guest.goto(firstLink);
    expect(response?.status()).toBe(200);
    await expect(guest.locator('.shared-diary-note').first()).toContainText('사진 다섯 장의 하루.');
    await expect(guest.getByRole('link', { name: '포둥 시작하기', exact: true })).toBeVisible();
    await expect(guest.getByRole('img', { name: '아기 사진 1', exact: true })).toBeVisible();
    const publicPhoto = await guest.getByRole('img', { name: '아기 사진 1', exact: true }).getAttribute('src');
    const image = await guest.request.get(new URL(publicPhoto!, firstLink).href);
    expect(image.status()).toBe(200);
    expect(image.headers()['cache-control']).toContain('no-store');
    expect([160, 600, 1600]).toContain((await sharp(await image.body()).metadata()).width);
    const firstSharedImage = guest.getByRole('img', { name: '아기 사진 1', exact: true });
    await expect(firstSharedImage).toHaveAttribute('draggable', 'false');
    expect(await firstSharedImage.evaluate(node => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      node.dispatchEvent(event);
      return event.defaultPrevented;
    })).toBe(true);
    expect(await firstSharedImage.evaluate(node => {
      const event = new Event('dragstart', { bubbles: true, cancelable: true });
      node.dispatchEvent(event);
      return event.defaultPrevented;
    })).toBe(true);
    expect(await guest.evaluate(() => {
      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    })).toBe(true);
    const sharedGallery = guest.locator('.shared-diary-gallery');
    const naturalWidths: number[] = [];
    for (let index = 0; index < 5; index++) {
      await sharedGallery.evaluate((node, i) => node.scrollTo({ left: node.clientWidth * i, behavior: 'instant' }), index);
      const photo = sharedGallery.locator('img').nth(index);
      const natural = await photo.evaluate(async image => {
        const img = image as HTMLImageElement;
        await img.decode();
        return { width: img.naturalWidth, height: img.naturalHeight };
      });
      naturalWidths.push(natural.width);
      await expect.poll(async () => {
        const box = (await photo.boundingBox())!;
        return Math.abs(box.height / box.width - natural.height / natural.width);
      }).toBeLessThan(.01);
      await expect.poll(async () => Math.abs((await sharedGallery.boundingBox())!.height - (await photo.boundingBox())!.height)).toBeLessThan(2);
      if (natural.width === 160) expect((await photo.boundingBox())!.width).toBe(160);
    }
    expect(naturalWidths).toContain(160);
    expect(naturalWidths).toContain(600);
    expect(naturalWidths).toContain(1600);
    await sharedGallery.evaluate(node => node.scrollTo({ left: 0, behavior: 'instant' }));
    const bannerBox = (await guest.locator('.shared-diary-invite-compact').boundingBox())!;
    expect(bannerBox.y + bannerBox.height).toBeLessThan((await guest.locator('.shared-diary-card').first().boundingBox())!.y);

    expect((await guest.request.get(`/api/care/photos/${photos.data![0].id}`)).status()).toBe(401);
    await guest.evaluate(() => document.fonts.ready);
    const sharedAppearance = () => guest.evaluate(() => {
      const selectors = ['.shared-diary-scene', '.shared-diary-brand', '.diary-hero-icon', '.shared-diary-title'];
      return selectors.map(selector => {
        const node = document.querySelector(selector)!;
        const style = getComputedStyle(node);
        return { font: style.fontFamily, size: style.fontSize, color: style.color, background: style.backgroundColor, padding: style.padding, radius: style.borderRadius, icon: node.querySelector('svg')?.outerHTML };
      });
    });
    const normalAppearance = await sharedAppearance();
    const entries = guest.locator('.shared-diary-card');
    await expect(entries).toHaveCount(2);
    const firstEntry = (await entries.nth(0).boundingBox())!;
    const secondEntry = (await entries.nth(1).boundingBox())!;
    expect(secondEntry.y - firstEntry.y - firstEntry.height).toBeGreaterThanOrEqual(48);
    await guest.screenshot({ caret: 'initial', path: 'test-results/shared-diary-mobile.png', fullPage: true });
    await guest.setViewportSize({ width: 1280, height: 900 });
    await guest.screenshot({ caret: 'initial', path: 'test-results/shared-diary-desktop.png', fullPage: true });
    await guest.setViewportSize({ width: 390, height: 844 });
    await sharing.getByRole('button', { name: '공유 링크 끄기', exact: true }).click();
    await expect(linkInput).toHaveCount(0);
    expect((await guest.request.get(new URL(publicPhoto!, firstLink).href)).status()).toBe(404);
    await guest.goto(firstLink);
    await expect(guest.getByRole('heading', { name: '공유가 종료되었거나 없는 일기예요' })).toBeVisible();
    await expect(guest.getByRole('link', { name: '포둥 시작하기', exact: true })).toBeVisible();
    await guest.evaluate(() => document.fonts.ready);
    expect(await sharedAppearance()).toEqual(normalAppearance);
    await guest.reload();
    await guest.evaluate(() => document.fonts.ready);
    expect(await sharedAppearance()).toEqual(normalAppearance);
    await guest.screenshot({ caret: 'initial', path: 'test-results/shared-diary-closed-mobile.png', fullPage: true });
    await guest.getByRole('link', { name: 'Switch to English', exact: true }).click();
    await expect(guest.getByRole('heading', { name: 'This diary link is no longer available' })).toBeVisible();
    await guest.getByRole('link', { name: '한국어로 보기', exact: true }).click();
    await expect(guest.getByRole('heading', { name: '공유가 종료되었거나 없는 일기예요' })).toBeVisible();

    await sharing.getByRole('button', { name: '공유 링크 만들기', exact: true }).click();
    await expect(linkInput).toBeVisible();
    expect(await linkInput.inputValue()).not.toBe(firstLink);
    await guest.goto(await linkInput.inputValue());
    await expect(guest.locator('.shared-diary-note').first()).toContainText('사진 다섯 장의 하루.');
    await expect(guest.getByText('함께 돌보는, 포근한 둥지', { exact: true })).toBeVisible();
    await guest.getByRole('link', { name: 'Switch to English', exact: true }).click();
    await expect(guest.locator('.shared-diary-title')).toContainText('growth diary');
    await expect(guest.getByRole('link', { name: 'Get started with podoong', exact: true })).toHaveAttribute('href', '/en/login');
    await expect(guest.locator('.shared-diary-note').first()).toContainText('사진 다섯 장의 하루.');
  } finally { await guestContext.close(); }
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => sessionStorage.setItem('diary-link-shared', JSON.stringify(data)) }));
  await sharing.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '일기 공유', exact: true }).click();
  await expect(linkInput).toBeVisible();
  await sharing.getByRole('button', { name: '앱으로 공유', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('diary-link-shared')!).url)).toBe(await linkInput.inputValue());
  await sharing.getByRole('button', { name: '닫기', exact: true }).click();
  await card.getByRole('button', { name: '일기 보기', exact: true }).click();
  await expect(detail.locator('.diary-detail-copy p:not(.diary-detail-author)')).toContainText('사진 다섯 장의 하루.');
  const detailGallery = detail.getByRole('region', { name: '일기 사진' });
  await detailGallery.evaluate((node) => { node.scrollLeft = 0; });
  await expect(detail.locator('header > span')).toHaveText('1 / 5');
  await detailGallery.focus();
  await page.keyboard.press('ArrowRight');
  await expect(detail.locator('header > span')).toHaveText('2 / 5');
  const detailBounds = (await detailGallery.boundingBox())!;
  const detailTouch = await context.newCDPSession(page);
  await detailTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: detailBounds.x + detailBounds.width * .85, y: detailBounds.y + 100 }] });
  for (let step = 1; step <= 8; step++) {
    await detailTouch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: detailBounds.x + detailBounds.width * (.85 - .7 * step / 8), y: detailBounds.y + 100 }] });
  }
  await detailTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(detail.locator('header > span')).not.toHaveText('2 / 5');
  await detailTouch.detach();
  await expect.poll(() => detail.locator('img').nth(2).evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await detail.evaluate(node => {
    const gallery = node.querySelector('.diary-detail-gallery')!.getBoundingClientRect();
    const copy = node.querySelector('.diary-detail-copy')!.getBoundingClientRect();
    return copy.top >= gallery.bottom;
  })).toBe(true);
  await page.screenshot({ caret: 'initial', path: 'test-results/diary-detail-mobile.png' });
  await detail.getByRole('button', { name: '돌아가기' }).click();
  await expect(detail).toHaveCount(0);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '일기 보기', exact: true }).click();
  await expect(detail).toBeVisible();
  await page.goBack();
  await expect(detail).toHaveCount(0);
  await expect(card).toBeVisible();
  const url = `/api/community/diary-photos/${photos.data![0].id}?size=480`;
  const thumbnail = await page.request.get(url);
  expect(thumbnail.status()).toBe(200);
  expect(thumbnail.headers()['content-type']).toBe('image/webp');
  expect((await thumbnail.body()).length).toBeLessThan(png.length);
  expect(
    (await sharp(await thumbnail.body()).metadata()).width,
  ).toBeLessThanOrEqual(480);
  const etag = thumbnail.headers().etag;
  expect(
    (
      await page.request.get(url, { headers: { 'If-None-Match': etag } })
    ).status(),
  ).toBe(304);
  const original = await page.request.get(
    `/api/care/photos/${photos.data![0].id}`,
  );
  expect([160, 600, 1800]).toContain((await sharp(await original.body()).metadata()).width);
  await page.screenshot({ caret: 'initial',
    path: 'test-results/diary-five-photos-mobile.png',
    fullPage: true,
  });
  const age = (await card.locator('.diary-entry-age').innerText()).replace(
    'D+',
    '',
  );
  const geometry = async () => {
    await expect(card.getByRole('button', { name: '더보기', exact: true })).toBeVisible();
    const selectors = [
      ':scope > header',
      '.diary-story',
      '.diary-photo-carousel',
    ];
    return Promise.all(
      selectors.map(async (selector) => {
        const bounds = (await card.locator(selector).boundingBox())!;
        return { width: bounds.width, height: bounds.height };
      }),
    );
  };
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const expected = await geometry();
    for (const scope of ['birth', 'all', 'mine']) {
      await page.goto(
        `/ko/community/diaries?child=${own.child}&scope=${scope}&age=${age}`,
      );
      await expect(card).toBeVisible();
      const actual = await geometry();
      actual.forEach((box, i) => {
        expect(Math.abs(box.width - expected[i].width)).toBeLessThan(1);
        expect(Math.abs(box.height - expected[i].height), `scope=${scope} width=${width} part=${i} actual=${box.height} expected=${expected[i].height}`).toBeLessThan(1);
      });
      if (scope !== 'mine') {
        if (scope === 'all') await expect(card.locator('.diary-measurements')).toHaveCount(0);
        await card.getByRole('button', { name: '일기 보기', exact: true }).click();
        await expect(detail.getByRole('button', { name: '일기 공유', exact: true })).toHaveCount(0);
        await detail.getByRole('button', { name: '돌아가기', exact: true }).click();
        await expect(detail).toHaveCount(0);
      }
    }
  }
  await card.getByRole('button', { name: '일기 관리', exact: true }).click();
  const manager = page.getByRole('dialog', { name: '일기 관리', exact: true });
  await page.getByRole('group', { name: '일기 관리', exact: true }).getByRole('button', { name: '편집', exact: true }).click();
  await expect(manager.getByLabel('사진 추가', { exact: true })).toBeEnabled();
  await manager.getByRole('checkbox', { name: '비공개', exact: true }).check();
  await manager.getByRole('button', { name: '저장', exact: true }).click();
  await expect(manager).toBeHidden();
  expect(
    (
      await page.request.get(url, { headers: { 'If-None-Match': etag } })
    ).status(),
  ).toBe(404);
});


test('menu, calendar and diary filters replace browser history', async ({ page, context }) => {
  const own = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${own.child}`);
  const initial = await page.evaluate(() => history.length);
  const expectSameHistory = async () => expect(await page.evaluate(() => history.length)).toBe(initial);
  await page.locator('.mobile-nav a').filter({ hasText: '일정' }).click();
  await expect(page.locator('.month-calendar')).toBeVisible();
  await expectSameHistory();
  await page.getByRole('link', { name: '이전 달', exact: true }).click();
  await expect(page).toHaveURL(/day=/);
  await page.locator('.month-day:not(.other-month)').nth(5).click();
  await expectSameHistory();
  await page.locator('.mobile-nav a').filter({ hasText: '인사이트' }).click();
  await expect(page.locator('.insight-navigation')).toBeVisible();
  await page.getByRole('button', { name: '하루패턴', exact: true }).click();
  await expect(page).toHaveURL(/pattern=daily/);
  await expectSameHistory();
  await page.locator('.mobile-nav a').filter({ hasText: '성장 일기' }).click();
  await expect(page.locator('.diary-tabs')).toBeVisible();
  await page.getByRole('link', { name: '출생일별 성장일기', exact: true }).click();
  await expect(page).toHaveURL(/scope=birth/);
  await page.getByRole('link', { name: '이전 생후 일수', exact: true }).click();
  await expectSameHistory();
  await page.getByRole('link', { name: '전체 성장일기', exact: true }).click();
  await expect(page).toHaveURL(/scope=all/);
  await expectSameHistory();
});

test('zoom gesture guard only applies to installed web apps', async ({ page }) => {
  await page.goto('/ko/login');
  await expect(page.locator('html')).not.toHaveAttribute('data-standalone');
  expect(await page.evaluate(() => document.dispatchEvent(new Event('gesturestart', { cancelable: true })))).toBe(true);
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { configurable: true, value: true }));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-standalone', '');
  expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).toBe('pan-x pan-y');
  expect(await page.evaluate(() => document.dispatchEvent(new Event('gesturestart', { cancelable: true })))).toBe(false);
  expect(await page.evaluate(() => document.dispatchEvent(new Event('gesturechange', { cancelable: true })))).toBe(false);
});


test('calendar hospital reason is optional and medicine selection survives editing', async ({ page, context }) => {
  const { child } = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/calendar?child=${child}&create=hospital`);
  const dialog = page.locator('.calendar-composer');
  await expect(dialog.getByLabel('병원·방문 이유 (선택)', { exact: true })).not.toHaveAttribute('required');
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const hospital = await admin.from('events').select('title').eq('child_id', child).single();
  expect(hospital.data?.title).toBe('병원');
  await page.locator('.calendar-quick-actions').getByRole('link', { name: '투약', exact: true }).click();
  await expect(dialog.locator('.quick-vaccine-choices button')).toHaveText(['해열제', '감기약', '항생제', '알레르기약', '소화기약', '기타']);
  await dialog.getByRole('button', { name: '해열제', exact: true }).click();
  await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const medication = await admin.from('events').select('id,title').eq('child_id', child).eq('title', '해열제').single();
  expect(medication.error).toBeNull();
  await page.goto(`/ko/calendar?child=${child}&edit=event:${medication.data!.id}`);
  await expect(dialog.getByRole('button', { name: '해열제', exact: true })).toHaveAttribute('aria-pressed', 'true');
});


test('shared diary loads older public entries as the visitor scrolls', async ({ context, browser }) => {
  const own = await childCareFamily(context);
  const records = Array.from({ length: 22 }, (_, i) => ({
    id: crypto.randomUUID(), child_id: own.child, service: 'growth', kind: 'observation',
    occurred_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(), record_timezone: 'Asia/Seoul',
    note: `Progressive diary ${i + 1}`, title: '', created_by: own.owner,
  }));
  expect((await admin.from('child_records').insert(records)).error).toBeNull();
  expect((await admin.from('growth_diary_shares').insert(records.map((r, i) => ({ record_id: r.id, everyone: i < 21, published_by: own.owner })))).error).toBeNull();
  const ownerPage = await context.newPage();
  await ownerPage.goto(`/en/community/diaries?child=${own.child}`);
  await ownerPage.getByRole('button', { name: 'Share diary', exact: true }).click();
  const dialog = ownerPage.getByRole('dialog', { name: 'Share diary', exact: true });
  await dialog.getByRole('button', { name: 'Create share link', exact: true }).click();
  const input = dialog.getByRole('textbox', { name: 'Share link', exact: true });
  await expect(input).toHaveValue(/\/en\/share\/diary\/[a-f0-9]{64}$/);
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await guest.newPage();
    await page.goto(await input.inputValue());
    await expect(page.locator('.shared-diary-card')).toHaveCount(20);
    await page.locator('.shared-diary-load').scrollIntoViewIfNeeded();
    await expect(page.locator('.shared-diary-card')).toHaveCount(21);
    await expect(page.locator('.shared-diary-card').last()).toContainText('Progressive diary 21');
    await expect(page.getByText('Progressive diary 22', { exact: true })).toHaveCount(0);
    await expect(page.locator('.shared-diary-load')).toHaveCount(0);
  } finally { await guest.close(); await ownerPage.close(); }
});


test('postbirth service catalog removes retired services and requires birth dates', async ({ page, context }) => {
  const own = await childCareFamily(context);
  await page.goto(`/ko/services?child=${own.child}`);
  for (const title of ['임신 관리', '출산 준비', '출생 후 행정', '산후 회복과 돌봄', '초등학교 입학 준비']) {
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  }
  for (const service of ['pregnancy', 'birth', 'administration', 'postpartum', 'school']) {
    const response = await page.goto(`/ko/services/${service}?child=${own.child}`);
    expect(response?.status()).toBe(404);
  }
  await page.goto(`/ko/family?child=${own.child}`);
  await expect(page.getByText('출산 예정일', { exact: true })).toHaveCount(0);
  for (const field of await page.getByLabel('아이 태어난 날', { exact: true }).all()) {
    await expect(field).toHaveAttribute('required', '');
  }
  await page.goto(`/en/family?child=${own.child}`);
  await expect(page.getByText('Due date', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Child’s date of birth', { exact: true }).first()).toBeVisible();
});

test('child bottom navigation opens a main page with child selection and settings', async ({ page, context }) => {
  const own = await childCareFamily(context);
  const { data: second, error } = await admin.from('children').insert({ family_id: own.family, name: '둘째', birth_date: '2026-10-01', sex: 'male' }).select('id').single();
  expect(error).toBeNull();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${own.child}`);
  await page.locator('.mobile-nav').getByRole('link', { name: '돌봄 아이', exact: true }).click();
  await expect(page).toHaveURL(/\/ko\/account/);
  await expect(page.getByRole('heading', { name: '아이와 설정' })).toHaveCount(0);
  await expect(page.locator('.bottom-child-picker, .family-menu-scrim')).toHaveCount(0);
  await expect(page.locator('.mobile-child-link')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.account-child-list > a')).toHaveCount(2);
  await expect(page.locator('.account-settings-section > summary > span')).toHaveText(['기존 가족에 참여하기','언어 설정','화면 설정','계정 설정','알림 설정','개발자에게 요청하기','서비스 정보','아이 설정가족관리자 전용','주소 설정가족관리자 전용','보호자 설정가족관리자 전용','데이터 설정가족관리자 전용']);
  await page.locator('summary').filter({hasText:'아이 설정'}).click();
  await page.locator('.account-child-list').getByRole('link', { name: /둘째/ }).click();
  await expect(page).toHaveURL(new RegExp(`child=${second!.id}`));
  await expect(page.locator('.mobile-child-link')).toHaveText('둘째');
  await expect(page.locator('.account-child-list a[aria-current=true]')).toContainText('둘째');
  await page.locator('summary').filter({ hasText: '아이 설정' }).click();
  const childForm = page.locator('#child-info');
  await childForm.locator('input[name=name]').fill('둘째 수정');
  await childForm.locator('select[name=sex]').selectOption('female');
  await childForm.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page).toHaveURL(/\/ko\/account\?panel=child/);
  await expect(page.locator('.mobile-child-link')).toHaveText('둘째 수정');
  const saved = await admin.from('children').select('name,sex').eq('id', second!.id).single();
  expect(saved.data).toEqual({ name: '둘째 수정', sex: 'female' });
  await page.locator('summary').filter({ hasText: '주소 설정' }).click();
  await expect(page.locator('.family-residence')).toBeVisible();
  await page.locator('.family-residence select[name=countryCode]').selectOption('US');
  await page.locator('input[name=provinceName]').fill('California');
  await page.locator('input[name=cityName]').fill('Palo Alto');
  await page.locator('input[name=localityName]').fill('Downtown');
  await page.locator('.family-residence button[type=submit], .family-residence button.primary').click();
  await expect(page).toHaveURL(/\/ko\/account\?panel=residence/);
  const residence = await admin.from('families').select('residence_country_code').eq('id', own.family).single();
  expect(residence.data?.residence_country_code).toBe('US');
  await page.locator('summary').filter({ hasText: '아이 설정' }).click();
  await expect(page.locator('#add-child input[name=name]')).toBeVisible();
  await page.locator('#add-child input[name=name]').fill('새 아이');
  await page.locator('#add-child select[name=sex]').selectOption('female');
  await page.locator('#add-child input[name=birth]').fill('2026-10-01');
  await page.locator('#add-child').getByRole('button', { name: '아이 추가', exact: true }).click();
  await expect(page).toHaveURL(/\/ko\/account\?child=/);
  await expect(page.locator('.mobile-child-link')).toHaveText('새 아이');
  await expect(page.locator('.account-child-list > a')).toHaveCount(3);
  await page.locator('summary').filter({ hasText: '보호자 설정' }).click();
  await page.getByRole('button', { name: '초대 링크 만들기', exact: true }).click();
  await expect(page).toHaveURL(/\/ko\/account\?panel=family/);
  await expect(page.getByRole('textbox', { name: '초대 링크', exact: true })).toBeVisible();
  await page.locator('summary').filter({hasText:'아이 설정'}).click();
  await page.locator('.account-child-list').getByRole('link', { name: /둘째 수정/ }).click();
  await expect(page).toHaveURL(new RegExp(`child=${second!.id}`));
  await expect(page.locator('.mobile-child-link')).toHaveText('둘째 수정');

  await page.locator('summary').filter({hasText:'언어 설정'}).click();
  await page.locator('.settings-language').getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/account\\?child=${second!.id}`));
  await expect(page.getByRole('heading', { name: 'Children & settings' })).toHaveCount(0);
  await page.locator('summary').filter({hasText:'Account settings'}).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ caret: 'initial', path: '/tmp/podung-child-account.png', fullPage: true });
});

test('formula and solids can save without duration', async ({ page, context }) => {
  const { child } = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${child}`);
  for (const [label, kind] of [['분유', 'formula'], ['이유식', 'solids']]) {
    const quick = page.locator('.quick-care');
    await quick.locator('.quick-grid').getByRole('button', { name: label, exact: true }).click();
    const dialog = quick.locator('dialog.quick-composer');
    await expect(dialog.getByRole('button', { name: '저장하기', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: '저장하기', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const result = await admin.from('care_records').select('ended_at,amount_ml').eq('child_id', child).eq('kind', kind).single();
    expect(result.error).toBeNull();
    expect(result.data?.ended_at).toBeNull();
    expect(result.data?.amount_ml).toBeGreaterThan(0);
  }
});

test('today history loads earlier dates vertically and opens past records', async ({ page, context }) => {
  const { child, owner } = await childCareFamily(context);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const previous = new Date(`${today}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const day = previous.toISOString().slice(0, 10);
  const result = await admin.from('care_records').insert({ id: crypto.randomUUID(), child_id: child, kind: 'formula', started_at: `${day}T03:00:00Z`, ended_at: `${day}T03:10:00Z`, amount_ml: 130, created_by: owner, updated_by: owner });
  expect(result.error).toBeNull();
  expect((await admin.from('tasks').insert({ id: crypto.randomUUID(), child_id: child, title: '준비물 확인', service: 'general', due_date: day, status: 'todo', created_by: owner })).error).toBeNull();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${child}`);
  await expect(page.getByRole('button', { name: '이전 날짜', exact: true })).toHaveCount(0);
  const touch = await context.newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  for (let swipe = 0; swipe < 3; swipe++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 540 }] });
    for (let y = 520; y >= 200; y -= 40) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  const past = page.locator('.quick-day-browser').filter({ has: page.locator(`time[datetime="${day}"]`) });
  await expect(past).toBeVisible();
  await expect(page.locator(`.quick-day-browser time[datetime="${today}"]`)).toBeAttached();
  await expect(past.locator('.quick-day-total strong')).toContainText('130 ml');
  const todayAge = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse('2026-01-01T00:00:00Z')) / 86400000);
  await expect(past.locator('.quick-day-age')).toHaveText(`· D+${todayAge - 1}`);
  const todaySection = page.locator('.quick-day-browser').filter({has:page.locator(`time[datetime="${today}"]`)});
  await expect(todaySection.locator('.quick-day-age')).toHaveText(`· D+${todayAge}`);
  const dateAlignment = await todaySection.evaluate(node => {
    const date = node.querySelector('h3 time')!.getBoundingClientRect();
    const age = node.querySelector('.quick-day-age')!.getBoundingClientRect();
    return Math.abs(date.y + date.height / 2 - age.y - age.height / 2);
  });
  expect(dateAlignment).toBeLessThan(5);
  for (const width of [320,390]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const feedingCard = past.locator('.quick-timeline-entry').first();
  await expect(past).not.toContainText('준비물 확인');
  await expect(page.locator('.quick-agenda-timeline')).toHaveCount(0);
  await feedingCard.click();
  await expect(page.locator('.quick-care dialog.quick-composer')).toBeVisible();
});

test('returning to today reuses its recent page without another data request', async ({ page, context }) => {
  test.skip(process.env.PODUNG_TEST_PRODUCTION !== '1', 'Router cache reuse requires the production navigation runtime.');
  const { child } = await childCareFamily(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ko/today?child=${child}`);
  await expect(page.locator('.quick-care')).toBeVisible();
  await page.locator('.mobile-nav a[href*="/community?"]').click();
  await expect(page).toHaveURL(/\/community/);
  await expect(page.locator('.community-hub')).toBeVisible();
  await page.locator('.mobile-nav a[href*="/today?"]').click();
  await expect(page.locator('.quick-care')).toBeVisible();
  await page.locator('.mobile-nav a[href*="/community?"]').click();
  await expect(page).toHaveURL(/\/community/);
  await expect(page.locator('.community-hub')).toBeVisible();
  const requests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/ko/today' && url.searchParams.has('_rsc')) requests.push(url.pathname);
  });
  const started = Date.now();
  await page.locator('.mobile-nav a[href*="/today?"]').click();
  await expect(page.locator('.quick-care')).toBeVisible();
  console.log(`Return to today: ${Date.now() - started}ms, ${requests.length} RSC requests`);
  expect(requests).toHaveLength(0);
});

test('diary composer attaches a daily pattern as a photo', async ({page, context}) => {
 const {child, owner} = await childCareFamily(context);
 const {now, day} = completedSeoulDay();
 expect((await admin.from('care_records').insert({ id: crypto.randomUUID(), child_id: child, kind: 'formula', started_at: new Date(now.getTime() - 600000).toISOString(), ended_at: now.toISOString(), amount_ml: 120, created_by: owner, updated_by: owner })).error).toBeNull();
 expect((await admin.from('child_records').insert({id:crypto.randomUUID(),child_id:child,service:'diaper',kind:'dirty',occurred_at:now.toISOString(),record_timezone:'Asia/Seoul',created_by:owner,updated_by:owner})).error).toBeNull();
 await page.addInitScript(() => {
   const original = CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
     const draws = JSON.parse(sessionStorage.getItem('pattern-draws') ?? '[]');
     draws.push({text,x,y}); sessionStorage.setItem('pattern-draws', JSON.stringify(draws));
     if (maxWidth === undefined) original.call(this,text,x,y);
     else original.call(this,text,x,y,maxWidth);
   };
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/community/diaries?child=${child}`);
 await page.getByRole('button', {name:'일기 쓰기',exact:true}).click();
 const sheet = page.getByRole('dialog', {name:'일기 쓰기',exact:true});
 await sheet.getByRole('button', {name:'하루 패턴 올리기',exact:true}).click();
 for (const width of [320,390]) {
   await page.setViewportSize({width,height:844});
   const note = (await sheet.getByRole('textbox',{name:'일기 내용'}).boundingBox())!;
   const weight = (await sheet.getByRole('spinbutton',{name:'몸무게',exact:true}).boundingBox())!;
   const privacy = (await sheet.getByRole('checkbox',{name:'비공개',exact:true}).boundingBox())!;
   expect(weight.y).toBeLessThan(note.y);
   expect(privacy.y).toBeLessThan(note.y);
   expect(await sheet.evaluate(node=>node.scrollWidth <= node.clientWidth)).toBe(true);
   const photo = (await sheet.locator('.diary-photo-picker').boundingBox())!;
   const pattern = (await sheet.getByRole('button',{name:'하루 패턴 올리기',exact:true}).boundingBox())!;
   expect(Math.abs(photo.y-pattern.y)).toBeLessThan(1);
 }
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-compact-diary-composer.png'});
 await sheet.getByLabel('패턴 날짜').fill(day);
 await sheet.getByRole('button', {name:'첨부',exact:true}).click();
 await expect(sheet.getByRole('img', {name:'첨부 사진 1',exact:true})).toBeVisible();
 await expect(sheet.locator('.diary-photo-count')).toHaveText('1/9');
 const patternBytes = await sheet.getByRole('img',{name:'첨부 사진 1',exact:true}).evaluate(async img => Array.from(new Uint8Array(await (await fetch((img as HTMLImageElement).src)).arrayBuffer())));
 const draws = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pattern-draws') ?? '[]') as {text:string,x:number,y:number}[]);
 expect(draws.some(item=>item.text==='기저귀')).toBe(false);
 expect(draws.some(item=>item.text==='분유')).toBe(true);
 expect(draws.filter(item=>item.text==='배변')).toHaveLength(1); // Legend only; no individual record list.
 expect(draws.some(item=>/^\d{2}:\d{2}$/.test(item.text))).toBe(false);
 for (const label of ['총 먹은 양','120 ml','배변 횟수','1회','총 수면 시간','0분']) expect(draws.some(item=>item.text===label)).toBe(true);
 expect(draws.find(item=>/^D\+\d+$/.test(item.text))?.x).toBe(900);
 expect(draws.some(item=>item.text==='24시간')).toBe(false);
 expect(draws.some(item=>item.text==='하루 패턴')).toBe(false);
 const patternMeta = await sharp(Buffer.from(patternBytes)).metadata();
 expect([patternMeta.width,patternMeta.height]).toEqual([1800,2400]);
 writeFileSync('/tmp/podung-diary-pattern.png', Buffer.from(patternBytes));
 const png = await sharp({create:{width:32,height:32,channels:3,background:'#ffeedd'}}).png().toBuffer();
 const files = Array.from({length:8}, (_,i) => ({name:`photo-${i}.png`,mimeType:'image/png',buffer:png}));
 await sheet.getByLabel('사진 추가',{exact:true}).setInputFiles(files);
 await expect(sheet.locator('.diary-attachment img')).toHaveCount(9);
 await expect(sheet.locator('.diary-photo-count')).toHaveText('9/9');
 await expect(sheet.getByRole('button',{name:'하루 패턴 올리기',exact:true})).toBeDisabled();
 await sheet.getByRole('button',{name:'1번 사진 뒤로',exact:true}).click();
 await sheet.locator('.diary-attachment-grid').scrollIntoViewIfNeeded();
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-diary-attachments.png'});
 await sheet.getByRole('button', {name:'저장',exact:true}).click();
 await expect(sheet).not.toBeVisible();
 const photos = await admin.from('child_record_photos').select('id').eq('child_id',child);
 expect(photos.error).toBeNull(); expect(photos.data).toHaveLength(9);
 const ordered = await admin.from('child_record_photos').select('id,record_id,sort_order').eq('child_id',child).order('sort_order');
 expect(ordered.data?.map(p=>p.sort_order)).toEqual([0,1,2,3,4,5,6,7,8]);
 await page.getByRole('button',{name:'일기 관리',exact:true}).click();
 const edit = page.getByRole('dialog',{name:'일기 관리',exact:true});
 await page.getByRole('group',{name:'일기 관리',exact:true}).getByRole('button',{name:'편집',exact:true}).click();
 await expect(edit.locator('.diary-attachment img')).toHaveCount(9);
 await edit.getByRole('button',{name:'1번 사진 뒤로',exact:true}).click();
 await edit.getByRole('button',{name:'저장',exact:true}).click();
 await expect(edit).not.toBeVisible();
 const reordered = await admin.from('child_record_photos').select('id').eq('child_id',child).order('sort_order');
 expect(reordered.data?.[0].id).toBe(ordered.data?.[1].id);
 expect(reordered.data?.[1].id).toBe(ordered.data?.[0].id);
 await expect(page.locator('.public-diary-body img').first()).toHaveAttribute('src', new RegExp(reordered.data![0].id));
 await page.getByRole('button',{name:'성장일기 사진 1 크게 보기',exact:true}).click();
 const detail = page.getByRole('dialog',{name:'성장일기',exact:true});
 const gallery = detail.locator('.diary-detail-gallery');
 await expect.poll(()=>gallery.locator('img').first().evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 const before = await gallery.evaluate(node=>node.getBoundingClientRect().height);
 await gallery.evaluate(node=>{
   node.dispatchEvent(new Event('touchstart'));
   node.scrollLeft = node.clientWidth;
 });
 // Pause with the finger held: resizing must wait until the gesture settles.
 await page.waitForTimeout(350);
 expect(await gallery.evaluate(node=>node.getBoundingClientRect().height)).toBeCloseTo(before,0);
 await gallery.dispatchEvent('touchend');
 await expect(detail.locator('header > span')).toHaveText('2 / 9');
 await expect.poll(()=>gallery.evaluate(node=>node.getBoundingClientRect().height)).toBeLessThan(before);
 await detail.getByRole('button',{name:'돌아가기',exact:true}).click();

});

test('today starts with growth record and labels diary entries consistently', async ({page,context}) => {
 const {child} = await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/today?child=${child}`);
 const rail = page.locator('.quick-care .quick-grid');
 await expect(rail.getByRole('button').first()).toHaveAccessibleName('성장 기록');
 await rail.getByRole('button',{name:'성장 기록',exact:true}).click();
 const dialog = page.getByRole('dialog',{name:'일기 쓰기',exact:true});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('textbox',{name:'일기 내용'}).fill('오늘 처음으로 웃었어요.');
 await dialog.getByRole('button',{name:'저장',exact:true}).click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator('.quick-timeline-entry strong').filter({hasText:'성장 기록'}).first()).toBeVisible();
 await expect(page.locator('.quick-timeline')).not.toContainText('발달 관찰·일기');
 await page.locator('.quick-timeline-entry').filter({hasText:'성장 기록'}).first().click();
 await expect(page.getByRole('dialog',{name:'일기 관리',exact:true})).toBeVisible();
});

test.describe('diary actions on mobile Safari', () => {
  test('edit and delete remain actionable when tapping the card menu', async () => {
    const browser = await webkit.launch();
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3188', isMobile: true, hasTouch: true, viewport: {width:390,height:844} });
    const page = await context.newPage();
    try {
    const { child, owner } = await childCareFamily(context);
    const id = crypto.randomUUID();
    expect((await admin.from('child_records').insert({
      id, child_id: child, service: 'growth', kind: 'observation',
      occurred_at: new Date().toISOString(), record_timezone: 'Asia/Seoul',
      note: '모바일 메뉴 터치 확인', created_by: owner,
    })).error).toBeNull();
    await page.goto(`/ko/community/diaries?child=${child}`);
    const card = page.locator('.public-diary-card').filter({ hasText: '모바일 메뉴 터치 확인' });
    const more = card.getByRole('button', { name: '일기 관리', exact: true });
    const menu = card.getByRole('group', { name: '일기 관리', exact: true });
    await more.tap();
    await menu.getByRole('button', { name: '편집', exact: true }).tap();
    const editor = page.getByRole('dialog', { name: '일기 관리', exact: true });
    await expect(editor).toBeVisible();
    await editor.getByRole('textbox', { name: '일기 내용' }).fill('모바일 메뉴 터치 확인 수정');
    await editor.getByRole('button', { name: '저장', exact: true }).tap();
    await expect(editor).toBeHidden();
    await expect(card).toContainText('모바일 메뉴 터치 확인 수정');
    await more.tap();
    await menu.getByRole('button', { name: '삭제', exact: true }).tap();
    await expect(card).toBeVisible();
    await menu.getByRole('button', { name: '삭제 확인', exact: true }).tap();
    await expect(card).toHaveCount(0);
    expect((await admin.from('child_records').select('id').eq('id', id)).data).toEqual([]);
    } finally { await browser.close(); }
  });
});


test('diaper dirty and mixed choices remain diaper records after saving and editing', async ({page,context}) => {
  const {child} = await childCareFamily(context);
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/ko/today?child=${child}`);
  const quick = page.locator('.quick-care');
  const sheet = quick.locator('dialog.quick-composer');
  for (const [label,kind] of [['대변','diaper_dirty'],['소변·대변','diaper_mixed']]) {
    await quick.locator('.quick-grid').getByRole('button',{name:'기저귀',exact:true}).click();
    await expect(sheet.getByRole('button',{name:'단순 교체',exact:true})).toHaveCount(0);
    await sheet.getByRole('button',{name:label,exact:true}).click();
    await sheet.getByRole('button',{name:'저장하기',exact:true}).click();
    await expect(sheet).toBeHidden();
    const saved = await admin.from('child_records').select('id,kind').eq('child_id',child).eq('kind',kind);
    expect(saved.error).toBeNull();
    expect(saved.data).toHaveLength(1);
    const entry = quick.locator('.quick-timeline-entry.quick-color-diaper').filter({has:page.getByText(label,{exact:true})});
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(sheet.locator('h3')).toHaveText('기저귀');
    await expect(sheet.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
    await sheet.getByRole('button',{name:'저장하기',exact:true}).click();
    await expect(sheet).toBeHidden();
  }
  await expect(quick.locator('.quick-timeline-entry.quick-color-stool')).toHaveCount(0);
  await quick.locator('.quick-grid').getByRole('button',{name:'배변',exact:true}).click();
  await sheet.getByRole('button',{name:'대변',exact:true}).click();
  await sheet.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(sheet).toBeHidden();
  await expect(quick.locator('.quick-timeline-entry.quick-color-stool')).toHaveCount(1);
});

test('diary photo removal supports saved photos and cancellation', async ({page,context}) => {
  const {child} = await childCareFamily(context);
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/ko/community/diaries?child=${child}`);
  await page.getByRole('button',{name:'일기 쓰기',exact:true}).click();
  const compose = page.getByRole('dialog',{name:'일기 쓰기',exact:true});
  await compose.getByRole('textbox',{name:'일기 내용'}).fill('사진 제거 확인');
  const png = await sharp({create:{width:32,height:32,channels:3,background:'#ffeedd'}}).png().toBuffer();
  await compose.getByLabel('사진 추가',{exact:true}).setInputFiles([1,2].map(i=>({name:`photo-${i}.png`,mimeType:'image/png',buffer:png})));
  await compose.getByRole('button',{name:'2번 사진 제거',exact:true}).click();
  await expect(compose.locator('.diary-attachment img')).toHaveCount(1);
  await compose.getByRole('button',{name:'저장',exact:true}).click();
  await expect(compose).toBeHidden();
  const photos = await admin.from('child_record_photos').select('id,path').eq('child_id',child);
  expect(photos.data).toHaveLength(1);
  createdChildPhotos.push(photos.data![0].path);
  const photoId = photos.data![0].id;
  const card = page.locator('.public-diary-card').filter({hasText:'사진 제거 확인'});
  const openEdit = async () => {
    await card.getByRole('button',{name:'일기 관리',exact:true}).click();
    await card.getByRole('group',{name:'일기 관리',exact:true}).getByRole('button',{name:'편집',exact:true}).click();
  };
  const edit = page.getByRole('dialog',{name:'일기 관리',exact:true});
  await openEdit();
  await edit.getByRole('button',{name:'1번 사진 제거',exact:true}).click();
  await edit.getByRole('button',{name:'취소',exact:true}).click();
  await openEdit();
  await expect(edit.locator('.diary-attachment img')).toHaveCount(1);
  await edit.getByRole('button',{name:'1번 사진 제거',exact:true}).click();
  await edit.getByRole('button',{name:'저장',exact:true}).click();
  await expect(edit).toBeHidden();
  await expect(card.locator('.public-diary-body img')).toHaveCount(0);
  expect((await admin.from('child_record_photos').select('id').eq('id',photoId)).data).toEqual([]);
  expect((await page.request.get(`/api/care/photos/${photoId}?size=480`)).status()).toBe(404);
});


test('insights defaults to daily and feeding reminders appear inside the child account', async ({page,context}) => {
 const {child} = await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/insights?child=${child}`);
 await expect(page.locator('.insight-daily-pattern')).toBeVisible();
 await expect(page.locator('.insight-weekly-pattern')).toHaveCount(0);
 await page.goto(`/ko/account?child=${child}`);
 await page.locator('summary').filter({hasText:'알림 설정'}).click();
 const settings = page.locator('details').filter({has:page.locator('summary').filter({hasText:'알림 설정'})});
 await expect(settings.getByRole('heading',{name:'식사 알림',exact:true})).toBeVisible();
 await settings.getByRole('button',{name:'4시간',exact:true}).click();
 await expect(settings.getByRole('button',{name:'4시간',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('status')).toHaveCount(0);
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-account-settings.png',fullPage:true});
});


test('child settings match on desktop and Safari mobile with aligned date inputs and signed-in identity', async () => {
 const browser = await webkit.launch();
 const context = await browser.newContext({baseURL:'http://127.0.0.1:3188',viewport:{width:1440,height:900}});
 try {
  const {child} = await childCareFamily(context);
  const page = await context.newPage();
  await page.goto(`/ko/today?child=${child}`);
  const nav = page.locator('.sidebar nav');
  await expect(nav.locator('a').last()).toHaveText('돌봄 아이');
  await nav.getByRole('link',{name:'돌봄 아이',exact:true}).click();
  await expect(page).toHaveURL(/account/);
  await expect(page.getByRole('heading',{name:'아이와 설정'})).toHaveCount(0);
  const labels = ['기존 가족에 참여하기','언어 설정','화면 설정','계정 설정','알림 설정','개발자에게 요청하기','서비스 정보','아이 설정가족관리자 전용','주소 설정가족관리자 전용','보호자 설정가족관리자 전용','데이터 설정가족관리자 전용'];
  await expect(page.locator('.account-settings-section > summary > span')).toHaveText(labels);
  await page.locator('summary').filter({hasText:'계정 설정'}).click();
  await expect(page.locator('.account-signed-in')).toContainText('Care test');
  await expect(page.locator('.account-signed-in')).toContainText('로그인한 계정');
  await page.locator('summary').filter({hasText:'아이 설정'}).click();
  for (const width of [390,320]) {
   await page.setViewportSize({width,height:844});
   await expect(page.locator('.account-settings-section > summary > span')).toHaveText(labels);
   for (const selector of ['#child-info','#add-child']) {
    const form = page.locator(selector);
    const name = (await form.locator('input[name=name]').boundingBox())!;
    const date = (await form.locator('input[name=birth]').boundingBox())!;
    const sex = (await form.locator('select[name=sex]').boundingBox())!;
    expect(Math.abs(name.x-date.x)).toBeLessThan(1);
    expect(Math.abs(name.width-date.width)).toBeLessThan(1);
    expect(Math.abs(name.width-sex.width)).toBeLessThan(1);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ caret: 'initial',path:'/tmp/podung-account-mobile-widths.png',fullPage:true});
 } finally {await browser.close();}
});

test('caregivers can switch children without administrator settings or service shortcuts', async ({ page, context, browser }) => {
  const own = await childCareFamily(context);
  const second = crypto.randomUUID();
  expect((await admin.from('children').insert({id:second,family_id:own.family,name:'선택할 아이',sex:'male',birth_date:'2026-10-01'})).error).toBeNull();
  const memberContext = await browser.newContext({baseURL:'http://127.0.0.1:3188'});
  try {
    const member = await signIn(memberContext);
    expect((await admin.from('profiles').insert({id:member,display_name:'Caregiver',consented_at:new Date().toISOString()})).error).toBeNull();
    expect((await admin.from('family_members').insert({family_id:own.family,user_id:member,role:'editor'})).error).toBeNull();
    expect((await admin.from('child_access').insert([own.child,second].map(child_id=>({child_id,family_id:own.family,user_id:member,role:'editor'})))).error).toBeNull();
    const memberPage = await memberContext.newPage();
    for (const width of [390,1440]) {
      await memberPage.setViewportSize({width,height:900});
      await memberPage.goto(`/ko/account?child=${own.child}&panel=child`);
      await expect(memberPage.locator('.account-settings-section > summary > span')).toHaveText(['기존 가족에 참여하기','언어 설정','화면 설정','계정 설정','알림 설정','개발자에게 요청하기','서비스 정보']);
      await expect(memberPage.locator('.account-admin-badge')).toHaveCount(0);
      await expect(memberPage.locator('#child-info,#add-child')).toHaveCount(0);
      await expect(memberPage.locator('.account-child-list a')).toHaveCount(2);
      await memberPage.locator('.account-child-list').getByRole('link',{name:/선택할 아이/}).click();
      await expect(memberPage).toHaveURL(new RegExp(`child=${second}`));
      await expect(memberPage.locator('.account-child-list a[aria-current=true]')).toContainText('선택할 아이');
    }
    await page.goto(`/ko/services?child=${own.child}`);
    await expect(page.locator('.service-card[href="/ko/notifications"], .service-card[href="/ko/data"]')).toHaveCount(0);
  } finally {await memberContext.close();}
});

test('child settings edit all managed children without changing the selected child', async ({page,context}) => {
  const own = await childCareFamily(context);
  const second = crypto.randomUUID();
  expect((await admin.from('children').insert({id:second,family_id:own.family,name:'둘째 정보',sex:'male',birth_date:'2026-10-01'})).error).toBeNull();
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/ko/account?child=${own.child}&panel=child`);
  const cards = page.locator('.account-child-details');
  await expect(cards).toHaveCount(2);
  const form = page.locator(`.account-child-details[data-child-id="${second}"]`);
  await expect(form.getByRole('heading',{name:'둘째 정보'})).toBeVisible();
  await form.locator('input[name=name]').fill('둘째 수정');
  await form.locator('select[name=sex]').selectOption('female');
  await form.locator('input[name=birth]').fill('2026-09-30');
  await form.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`child=${own.child}`));
  await expect(page.locator('.account-child-list a[aria-current=true]')).toContainText('돌봄 아이');
  await expect(form.getByRole('heading',{name:'둘째 수정'})).toBeVisible();
  const saved = await admin.from('children').select('name,sex,birth_date').eq('id',second).single();
  expect(saved.data).toEqual({name:'둘째 수정',sex:'female',birth_date:'2026-09-30'});
  await page.locator('.account-child-list').getByRole('link',{name:/둘째 수정/}).click();
  await page.locator('summary').filter({hasText:'아이 설정'}).click();
  await expect(cards).toHaveCount(2);
  for(const width of [320,1440]) {
    await page.setViewportSize({width,height:900});
    await expect(cards).toHaveCount(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('invited caregiver must select relationship and diaries retain author relationship without displaying it', async ({page,context,browser}) => {
  const own = await childCareFamily(context);
  await admin.from('family_members').update({relationship:'father'}).eq('family_id',own.family).eq('user_id',own.owner);
  await page.goto(`/ko/account?child=${own.child}&panel=family`);
  await page.getByRole('button',{name:'초대 링크 만들기',exact:true}).click();
  const link = await page.getByRole('textbox',{name:'초대 링크',exact:true}).inputValue();
  const invited = await browser.newContext({baseURL:'http://127.0.0.1:3188',viewport:{width:390,height:844}});
  try {
    const member = await signIn(invited);
    await admin.from('profiles').insert({id:member,display_name:'이모 보호자',consented_at:new Date().toISOString()});
    const memberPage = await invited.newPage();
    await memberPage.goto(new URL(link).pathname);
    await expect(memberPage.getByLabel('아이와의 관계')).toHaveAttribute('required','');
    await memberPage.getByLabel('아이와의 관계').selectOption('maternal_aunt');
    await memberPage.getByRole('checkbox').check();
    await memberPage.locator('form button[type=submit], form button.button.primary').click();
    await expect(memberPage).toHaveURL(/today/);
    expect((await admin.from('family_members').select('relationship').eq('family_id',own.family).eq('user_id',member).single()).data?.relationship).toBe('maternal_aunt');
    await memberPage.goto(`/ko/community/diaries?child=${own.child}`);
    await memberPage.getByRole('button',{name:'일기 쓰기',exact:true}).click();
    const sheet = memberPage.getByRole('dialog',{name:'일기 쓰기',exact:true});
    await sheet.getByRole('textbox',{name:'일기 내용'}).fill('이모가 남긴 오늘의 추억');
    await sheet.getByRole('button',{name:'저장',exact:true}).click();
    await expect(sheet).not.toBeVisible();
    await expect(memberPage.locator('.public-diary-card .diary-author')).toHaveCount(0);
    await memberPage.locator('.public-diary-card').first().getByRole('button',{name:'일기 보기',exact:true}).click();
    await expect(memberPage.locator('.diary-detail-author')).toHaveText('by 이모');
    await memberPage.getByRole('button',{name:'돌아가기',exact:true}).click();
    await memberPage.goto(`/en/community/diaries?child=${own.child}&scope=all`);
    await expect(memberPage.locator('.public-diary-card .diary-author')).toHaveCount(0);
    await memberPage.goto(`/ko/account?child=${own.child}&panel=account`);
    await memberPage.getByLabel('아이와의 관계').selectOption('mother');
    await memberPage.locator('.account-relationship-form').getByRole('button',{name:'저장하기',exact:true}).click();
    await expect(memberPage.getByLabel('아이와의 관계')).toHaveValue('mother');
    await memberPage.goto(`/ko/community/diaries?child=${own.child}`);
    await expect(memberPage.locator('.public-diary-card .diary-author')).toHaveCount(0);
    const stored = await admin.from('child_records').select('author_relationship').eq('child_id',own.child).eq('created_by',member).single();
    expect(stored.data?.author_relationship).toBe('maternal_aunt');
  } finally { await invited.close(); }
});

test('diary upload stores display variants and serves them without the original', async ({page,context,browser}) => {
 const {child} = await childCareFamily(context);
 await page.goto(`/ko/community/diaries?child=${child}`);
 await page.getByRole('button',{name:'일기 쓰기',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'일기 쓰기',exact:true});
 const original=await sharp({create:{width:1800,height:2400,channels:3,background:'#f4d5bc'}}).jpeg().toBuffer();
 await sheet.getByRole('textbox',{name:'일기 내용'}).fill('표시용 사진 검증');
 await sheet.getByLabel('사진 추가',{exact:true}).setInputFiles({name:'photo.jpg',mimeType:'image/jpeg',buffer:original});
 await sheet.getByRole('button',{name:'저장',exact:true}).click();
 await expect(sheet).toBeHidden();
 const {data:photo,error}=await admin.from('child_record_photos').select('id,path,variants_ready').eq('child_id',child).single();
 expect(error).toBeNull(); expect(photo?.variants_ready).toBe(true);
 for(const path of [photo!.path,`${photo!.path}.display-v1-480.webp`,`${photo!.path}.display-v1-1600.webp`]) createdChildPhotos.push(path);
 // A successful resized response with the source removed proves the request uses the stored variant.
 expect((await admin.storage.from('child-care-photos').remove([photo!.path])).error).toBeNull();
 for(const size of [480,1600]) {
  for(const route of ['care/photos','community/diary-photos']) {
   const response=await page.request.get(`/api/${route}/${photo!.id}?size=${size}`);
   expect(response.status()).toBe(200);
   const meta=await sharp(await response.body()).metadata();
   expect(Math.max(meta.width!,meta.height!)).toBe(size);
  }
 }
 await page.getByRole('button',{name:'일기 공유',exact:true}).click();
 const share=page.getByRole('dialog',{name:'일기 공유',exact:true});
 await share.getByRole('button',{name:'공유 링크 만들기',exact:true}).click();
 const token=(await share.getByRole('textbox',{name:'공유 링크',exact:true}).inputValue()).split('/').pop()!;
 const guest=await browser.newContext({baseURL:'http://127.0.0.1:3188'});
 try {
  const response=await guest.request.get(`/api/share/diary/${token}/photos/${photo!.id}`);
  expect(response.status()).toBe(200);
  expect((await sharp(await response.body()).metadata()).height).toBe(1600);
  expect((await guest.request.get(`/api/care/photos/${photo!.id}?size=480`)).status()).toBe(401);
  await admin.from('growth_diary_shares').update({everyone:false,same_birth_date:false}).eq('record_id',(await admin.from('child_records').select('id').eq('child_id',child).single()).data!.id);
  expect((await guest.request.get(`/api/share/diary/${token}/photos/${photo!.id}`)).status()).toBe(404);
 } finally {await guest.close();}
});

test('diary previews reuse session memory on menu return without another photo request', async ({page,context}) => {
 const {child}=await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/community/diaries?child=${child}`);
 await page.getByRole('button',{name:'일기 쓰기',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'일기 쓰기',exact:true});
 const png=await sharp({create:{width:800,height:600,channels:3,background:'#edcbbb'}}).png().toBuffer();
 await sheet.getByRole('textbox',{name:'일기 내용'}).fill('미리보기 재방문 확인');
 await sheet.getByLabel('사진 추가',{exact:true}).setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
 await sheet.getByRole('button',{name:'저장',exact:true}).click();
 await expect(sheet).toBeHidden();
 const photo=(await admin.from('child_record_photos').select('id,path').eq('child_id',child).single()).data!;
 createdChildPhotos.push(photo.path,`${photo.path}.display-v1-480.webp`,`${photo.path}.display-v1-1600.webp`);
 const img=page.locator('.public-diary-card img').first();
 await expect.poll(()=>img.evaluate(node=>(node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 const nav=page.locator('.mobile-nav');
 await nav.locator('a[href*="/today?"]').click();
 await expect(page).toHaveURL(/today/);
 const requests:string[]=[];
 page.on('request',request=>{if(request.url().includes(`/api/care/photos/${photo.id}`)) requests.push(request.url());});
 await nav.locator('a[href*="/community/diaries?"]').click();
 await expect(img).toHaveAttribute('src',/^data:image\/webp;base64,/);
 await expect.poll(()=>img.evaluate(node=>(node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 expect(requests).toHaveLength(0);
 // Browser memory reuse must not weaken the actual API's revocation check.
 await admin.from('child_record_photos').delete().eq('id',photo.id);
 expect((await page.request.get(`/api/care/photos/${photo.id}?size=480`,{headers:{'If-None-Match':`"${photo.id}-480-webp-v1"`}})).status()).toBe(404);
});

test('daycare and kindergarten record start and duration and can finish an ongoing stay',async({page,context})=>{
 const {child}=await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/today?child=${child}`);
 for(const [label,kind] of [['어린이집','daycare'],['유치원','kindergarten']]) {
  const button=page.locator('.quick-grid').getByRole('button',{name:label,exact:true});
  await button.scrollIntoViewIfNeeded(); await button.click();
  const dialog=page.locator('dialog.quick-composer');
  await expect(dialog).toBeVisible();
  await dialog.locator('.quick-mode button').last().click();
  await dialog.getByRole('button',{name:'180분',exact:true}).click();
  await dialog.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(dialog).toBeHidden();
  const record=(await admin.from('child_records').select('id,occurred_at,ended_at').eq('child_id',child).eq('kind',kind).single()).data!;
  expect((Date.parse(record.ended_at!)-Date.parse(record.occurred_at))/60000).toBe(180);
  // Overnight stays appear in both daily sections; both open this same record.
  await page.locator(`.quick-timeline-entry.quick-color-${kind}`).first().click();
  await expect(dialog.getByRole('button',{name:'180분',exact:true})).toHaveAttribute('aria-pressed','true');
  await dialog.getByRole('button',{name:'120분',exact:true}).click();
  await dialog.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(dialog).toBeHidden();
 }
 await page.locator('.quick-grid').getByRole('button',{name:'어린이집',exact:true}).click();
 const dialog=page.locator('dialog.quick-composer');
 await dialog.locator('button.quick-confirm').click();
 await expect(dialog).toBeHidden();
 const running=page.locator('.quick-running.quick-color-daycare');
 await expect(running).toContainText('머무는 중');
 await running.getByRole('button',{name:'귀가',exact:true}).click();
 await dialog.locator('button.quick-confirm').click();
 await expect(dialog).toBeHidden();
 await expect(running).toHaveCount(0);
});

test('local life requests count once per family and persist on revisit',async({page,context})=>{
 const {child,family}=await childCareFamily(context);
 await admin.from('families').update({residence_country_code:'KR',residence_locality:'테스트동',residence_city:`지역-${family}`}).eq('id',family);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/today?child=${child}`);
 await page.locator('.mobile-nav').getByRole('link',{name:'동네 생활',exact:true}).click();
 await expect(page.getByRole('heading',{name:'동네 생활',exact:true})).toBeVisible();
 const card=page.locator('.neighborhood-join');
 await expect(card).toContainText('0/10 가족 신청');
 await expect(page.locator('.community-hub-card')).toHaveCount(3);
 await expect(page.getByText('10가족 신청 시 오픈 예정',{exact:true})).toHaveCount(3);
 const cards=page.locator('.community-hub-card');
 const first=(await cards.nth(0).boundingBox())!,second=(await cards.nth(1).boundingBox())!;
 expect(Math.round(second.y-first.y-first.height)).toBe(12);
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-local-life-compact.png',fullPage:true});
 await card.getByRole('button',{name:'우리 동네 신청하기',exact:true}).click();
 await expect(card).toContainText('1/10 가족 신청');
 await expect(card.getByRole('button',{name:'신청 완료',exact:true})).toBeDisabled();
 await page.reload();
 await expect(card).toContainText('1/10 가족 신청');
 await expect(page.getByRole('button',{name:'신청 완료',exact:true})).toHaveCount(1);
 await page.goto(`/en/community?child=${child}`);
 await expect(page.getByRole('heading',{name:'Local life',exact:true})).toBeVisible();
});

test('overseas address registration is reusable by another family',async({page,context,browser})=>{
 const own=await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/account?child=${own.child}&panel=residence`);
 await page.locator('select[name=countryCode]').selectOption('US');
 await page.locator('input[name=provinceName]').fill('California');
 await page.locator('input[name=cityName]').fill('Palo Alto');
 await page.locator('input[name=localityName]').fill('Downtown');
 await page.locator('.family-residence button.primary').click();
 await expect(page).toHaveURL(/panel=residence/);
 await expect(page.locator('input[name=provinceName]')).toHaveValue('California');
 await expect.poll(async()=>(await admin.from('families').select('residence_province').eq('id',own.family).single()).data?.residence_province).toBe('California');
 const saved=(await admin.from('families').select('residence_province,residence_city,residence_locality,global_place_id').eq('id',own.family).single()).data!;
 expect(saved.residence_province).toBe('California');expect(saved.global_place_id).toBeTruthy();
 const another=await browser.newContext({baseURL:'http://127.0.0.1:3188'});
 try {
  const other=await childCareFamily(another);const second=await another.newPage();
  await second.goto(`/ko/account?child=${other.child}&panel=residence`);
  await second.locator('select[name=countryCode]').selectOption('US');
  await expect(second.locator('datalist option[value="California"]')).toHaveCount(1);
  await second.locator('input[name=provinceName]').fill('California');
  await expect(second.locator('datalist option[value="Palo Alto"]')).toHaveCount(1);
  await second.locator('input[name=cityName]').fill('Palo Alto');
  await expect(second.locator('datalist option[value="Downtown"]')).toHaveCount(1);
  await second.locator('input[name=localityName]').fill('Downtown');
  await second.locator('.family-residence button.primary').click();
  await expect(second.locator('input[name=localityName]')).toHaveValue('Downtown');
  await expect.poll(async()=>(await admin.from('families').select('global_place_id').eq('id',other.family).single()).data?.global_place_id).toBe(saved.global_place_id);
 }finally{await another.close();}
});

test('account page accepts developer requests without navigating away',async({page,context})=>{
 const {child,owner}=await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/account?child=${child}`);
 await page.locator('summary').filter({hasText:'개발자에게 요청하기'}).click();
 const form=page.locator('.developer-request-form');
 await form.getByLabel('요청 종류').selectOption('bug');
 await form.getByLabel('요청 내용').fill('모바일 화면 개선 테스트 요청');
 await form.getByRole('button',{name:'요청 보내기',exact:true}).click();
 await expect(form.getByRole('button',{name:'접수 완료',exact:true})).toBeDisabled();
 await expect(page).toHaveURL(new RegExp(`/account\\?child=${child}`));
 const saved=await admin.from('developer_requests').select('category,body,status').eq('user_id',owner).single();
 expect(saved.data).toEqual({category:'bug',body:'모바일 화면 개선 테스트 요청',status:'received'});
 await form.getByLabel('요청 내용').fill('두 번째 기능 제안');
 await expect(form.getByRole('button',{name:'요청 보내기',exact:true})).toBeEnabled();
});

test('appearance preference switches dark mode and persists through navigation and reload', async ({page,context})=>{
 test.setTimeout(120000);
 const {child}=await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/account?child=${child}&panel=appearance`);
 const mode=page.getByRole('group',{name:'화면 모드',exact:true});
 await mode.getByRole('button',{name:'어둡게',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.goto(`/ko/today?child=${child}`);
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(20, 26, 35)');
 await page.locator('.quick-grid').getByRole('button',{name:'분유',exact:true}).click();
 const sheet=page.locator('dialog.quick-composer');await expect(sheet).toBeVisible();
 expect(await sheet.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe('rgb(255, 255, 255)');
 await sheet.getByRole('button',{name:'취소',exact:true}).click();
 for(const section of ['calendar','insights','community/diaries','community']) {
   await page.goto(`/ko/${section}?child=${child}`);
   await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(section==='insights')await page.screenshot({ caret: 'initial',path:'/tmp/podung-insights-dark-mobile.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(`/ko/today?child=${child}`);await page.screenshot({ caret: 'initial',path:'/tmp/podung-today-dark-desktop.png',fullPage:true});
 await page.goto(`/ko/account?child=${child}&panel=appearance`);
 await page.emulateMedia({colorScheme:'dark'});
 await page.getByRole('group',{name:'화면 모드',exact:true}).getByRole('button',{name:'기기 설정',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({colorScheme:'light'});
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('group',{name:'화면 모드',exact:true}).getByRole('button',{name:'밝게',exact:true}).click();
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('gifts and allowance save in quick sheets and appear in child-scoped insight lists',async({page,context})=>{
 test.setTimeout(120000);
 const {child,owner}=await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/today?child=${child}`);
 const quick=page.locator('.quick-grid'),sheet=page.locator('dialog.quick-composer');
 const gift=quick.getByRole('button',{name:'선물',exact:true});await gift.scrollIntoViewIfNeeded();await gift.click();
 await expect(sheet).toBeVisible();await sheet.getByRole('textbox',{name:'준 사람',exact:true}).fill('할머니');await sheet.getByRole('textbox',{name:'선물 이름',exact:true}).fill('첫 그림책');
 await sheet.getByRole('button',{name:'저장하기',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
 const giftRow=page.locator('.quick-color-gift.quick-timeline-entry').filter({hasText:'첫 그림책'});await expect(giftRow).toContainText('할머니');await giftRow.click();
 await expect(sheet.getByRole('textbox',{name:'선물 이름',exact:true})).toHaveValue('첫 그림책');await sheet.getByRole('textbox',{name:'선물 이름',exact:true}).fill('할머니의 그림책');await sheet.getByRole('button',{name:'저장하기',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
 const allowance=quick.getByRole('button',{name:'용돈',exact:true});await allowance.scrollIntoViewIfNeeded();await allowance.click();
 await sheet.getByRole('textbox',{name:'준 사람',exact:true}).fill('이모');await sheet.getByRole('spinbutton',{name:'받은 금액',exact:true}).fill('12000');await sheet.getByRole('combobox',{name:'통화',exact:true}).selectOption('KRW');await sheet.getByRole('button',{name:'저장하기',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
 const saved=await admin.from('child_records').select('kind,title,sender_name,received_amount,received_currency').eq('child_id',child).in('kind',['gift','allowance']);expect(saved.error).toBeNull();expect(saved.data).toHaveLength(2);expect(saved.data).toContainEqual({kind:'allowance',title:'',sender_name:'이모',received_amount:12000,received_currency:'KRW'});
 const olderAt=new Date(Date.now()-86400000).toISOString();
 const older=Array.from({length:21},(_,i)=>({id:crypto.randomUUID(),child_id:child,service:'activity',kind:'gift',title:`이전 선물 ${i+1}`,sender_name:'친구',occurred_at:olderAt,record_timezone:'Asia/Seoul',created_by:owner,updated_by:owner}));
 expect((await admin.from('child_records').insert(older)).error).toBeNull();
 await page.goto(`/ko/insights?child=${child}`);await page.getByRole('button',{name:'선물·용돈',exact:true}).click();
 const gifts=page.getByRole('region',{name:'받은 선물',exact:true}),cash=page.getByRole('region',{name:'받은 용돈',exact:true});await expect(gifts).toContainText('할머니의 그림책');await expect(gifts).toContainText('할머니');await expect(cash).toContainText('12,000');await expect(cash).toContainText('이모');
 await expect(gifts.locator('li')).toHaveCount(1);
 const friends=gifts.locator('.gift-sender-group').filter({has:page.locator('summary strong',{hasText:'친구'})});
 await friends.locator('summary').click();await expect(friends.locator('li')).toHaveCount(20);
 await friends.getByRole('button',{name:'더 보기',exact:true}).click();await expect(gifts.locator('li')).toHaveCount(22);
 expect((await gifts.locator('.received-row-copy strong').allTextContents()).sort()).toEqual(['할머니의 그림책',...older.map(r=>r.title)].sort());
 await expect(gifts.getByRole('button',{name:'더 보기',exact:true})).toHaveCount(0);
 await expect(page.locator('.insight-kind-rail')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto(`/en/insights?child=${child}&pattern=received`);await expect(page.getByRole('region',{name:'Gifts received'})).toContainText('할머니의 그림책');
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-received-mobile.png',fullPage:true});
 await page.goto(`/ko/account?child=${child}&panel=appearance`);await page.getByRole('group',{name:'화면 모드',exact:true}).getByRole('button',{name:'어둡게',exact:true}).click();
 await page.goto(`/ko/insights?child=${child}&pattern=received`);await page.screenshot({ caret: 'initial',path:'/tmp/podung-received-dark-mobile.png',fullPage:true});
});

test('gift photo is previewed, stored privately, replaced and removed with its record',async({page,context})=>{
 test.setTimeout(120000);
 const {child}=await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/today?child=${child}`);
 const sheet=page.locator('dialog.quick-composer');
 const gift=page.locator('.quick-grid').getByRole('button',{name:'선물',exact:true});
 await gift.scrollIntoViewIfNeeded();await gift.click();
 await sheet.getByRole('textbox',{name:'준 사람',exact:true}).fill('할아버지');
 await sheet.getByRole('textbox',{name:'선물 이름',exact:true}).fill('곰 인형');
 const png=await sharp({create:{width:160,height:120,channels:3,background:'#f4b88a'}}).png().toBuffer();
 const upload=async()=>sheet.getByLabel('선물 사진 추가',{exact:true}).setInputFiles({name:'gift.png',mimeType:'image/png',buffer:png});
 await upload();await expect(sheet.getByRole('img',{name:'선물 사진',exact:true})).toBeVisible();
 await sheet.getByRole('button',{name:'저장하기',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
 const record=await admin.from('child_records').select('id').eq('child_id',child).eq('kind','gift').single();expect(record.error).toBeNull();
 async function photos(){const result=await admin.from('child_record_photos').select('id,path,variants_ready').eq('record_id',record.data!.id);expect(result.error).toBeNull();for(const photo of result.data??[])createdChildPhotos.push(photo.path,`${photo.path}.display-v1-480.webp`,`${photo.path}.display-v1-1600.webp`);return result.data!;}
 const first=await photos();expect(first).toHaveLength(1);expect(first[0].variants_ready).toBe(true);
 const image=await page.request.get(`/api/care/photos/${first[0].id}?size=480`);expect(image.status()).toBe(200);expect(image.headers()['content-type']).toContain('image/webp');
 const anonymous=await context.browser()!.newContext();const response=await anonymous.request.get(`http://127.0.0.1:3188/api/care/photos/${first[0].id}?size=480`);expect([401,404]).toContain(response.status());await anonymous.close();
 const row=page.locator('.quick-color-gift.quick-timeline-entry').filter({hasText:'곰 인형'});await row.click();await expect(sheet.getByRole('img',{name:'선물 사진',exact:true})).toBeVisible();
 await upload();await sheet.getByRole('button',{name:'저장하기',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
 const second=await photos();expect(second).toHaveLength(1);expect(second[0].id).not.toBe(first[0].id);
 await page.goto(`/ko/insights?child=${child}&pattern=received`);await expect(page.getByRole('region',{name:'받은 선물',exact:true}).getByRole('img',{name:'곰 인형',exact:true})).toBeVisible();
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-gift-photo-mobile.png',fullPage:true});
 await page.goto(`/ko/today?child=${child}`);await page.locator('.quick-color-gift.quick-timeline-entry').filter({hasText:'곰 인형'}).click();
 await sheet.getByRole('button',{name:'선물 사진 제거',exact:true}).click();await sheet.getByRole('button',{name:'취소',exact:true}).click();expect(await photos()).toHaveLength(1);
 await row.click();await sheet.getByRole('button',{name:'선물 사진 제거',exact:true}).click();await sheet.getByRole('button',{name:'저장하기',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});expect(await photos()).toHaveLength(0);
});

test('service documents are readable from account settings and retain the child on return',async({page,context})=>{
 const {child}=await childCareFamily(context);
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/account?child=${child}&panel=service`);
 await page.getByRole('link',{name:/이용약관/}).click();
 await expect(page.getByRole('heading',{name:'서비스 이용약관',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('검토용 초안');await expect(page.locator('main')).toContainText('정경철');
 await page.getByRole('link',{name:'돌아가기',exact:true}).click();await expect(page).toHaveURL(new RegExp(`account\\?panel=service&child=${child}`));
 await page.getByRole('link',{name:/개인정보 처리방침/}).click();await expect(page.getByRole('heading',{name:'개인정보 처리방침',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-legal-mobile.png',fullPage:true});
 const anonymous=await context.browser()!.newContext();const reader=await anonymous.newPage();await reader.goto('http://127.0.0.1:3188/en/legal/terms');await expect(reader.getByRole('heading',{name:'Terms of Service',exact:true})).toBeVisible();await expect(reader.locator('main')).toContainText('Draft');await anonymous.close();
});

test('sleep editing supports ten hours and preserves a duration beyond the quick presets',async({page,context})=>{
 const {child,owner}=await childCareFamily(context);
 const start=completedSeoulDay().now.toISOString();
 const id=crypto.randomUUID();
 expect((await admin.from('child_records').insert({id,child_id:child,service:'sleep',kind:'night',occurred_at:start,ended_at:new Date(Date.parse(start)+9*3600000+17*60000+43500).toISOString(),record_timezone:'Asia/Seoul',created_by:owner,updated_by:owner})).error).toBeNull();
 await page.setViewportSize({width:390,height:844});await page.goto(`/ko/today?child=${child}`);
 const row=page.locator(`.quick-timeline-entry[data-record-id="${id}"]`);
 const target=await row.count()?row:page.locator('.quick-color-sleep.quick-timeline-entry').first();await target.click();
 const sheet=page.locator('dialog.quick-composer');
 const end=new Date(Math.floor(Date.parse(start)/60000)*60000+615*60000);
 const endClock=`${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`;
 await expect(sheet.getByRole('spinbutton')).toHaveCount(0);
 await sheet.getByLabel('종료 시각',{exact:true}).fill(endClock);
 await expect(sheet.locator('.quick-sleep-total')).toContainText('10시간 15분');
 let releaseHistory!: () => void;
 const historyGate = new Promise<void>(resolve => { releaseHistory = resolve; });
 await page.route('**/api/care/history?**', async route => { await historyGate; await route.continue(); });
 try {
 await sheet.getByRole('button',{name:'저장하기',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
 const saved=await admin.from('child_records').select('occurred_at,ended_at').eq('id',id).single();expect(saved.error).toBeNull();expect(Date.parse(saved.data!.ended_at!)-Date.parse(saved.data!.occurred_at)).toBe(615*60000);
 await target.click();await expect(sheet.getByLabel('종료 시각',{exact:true})).toHaveValue(endClock);await expect(sheet.locator('.quick-sleep-total')).toContainText('10시간 15분');
 await expect(target).toContainText('10시간 15분');
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-sleep-end-mobile.png',fullPage:true});
 } finally { releaseHistory(); }
});

test('feeding reminders opt in per device, save interval and quiet hours, and can be disabled',async({page,context})=>{
 const {child,owner}=await childCareFamily(context);
 const config = await admin.from('feeding_push_config').select('singleton').maybeSingle();
 expect(config.error).toBeNull();
 const fixtureId = crypto.randomUUID();
 if (!config.data) {
  const setup = await admin.from('feeding_push_config').insert({ public_key:'B'.repeat(87), worker_url:'https://example.invalid', token_secret_id:fixtureId });
  expect(setup.error).toBeNull();
 }
 try {
 await context.grantPermissions(['notifications']);
 await page.addInitScript(()=>{
  Object.defineProperty(Notification,'permission',{get:()=> 'granted'});
  Notification.requestPermission=async()=> 'granted';
  PushManager.prototype.getSubscription=async()=>null;
  PushManager.prototype.subscribe=async()=>({toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/local-browser-fixture',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}}),unsubscribe:async()=>true}) as unknown as PushSubscription;
 });
 await page.setViewportSize({width:390,height:844});await page.goto(`/ko/account?child=${child}&panel=notifications`);
 const settings=page.locator('.feeding-push-settings');await expect(settings.getByRole('heading',{name:'식사 알림',exact:true})).toBeVisible();
 await settings.getByRole('button',{name:'4시간',exact:true}).click();await settings.getByRole('button',{name:'이 기기에서 알림 켜기',exact:true}).click();
 await expect(settings.getByRole('button',{name:'이 기기 알림 끄기',exact:true})).toBeVisible({timeout:15000});
 const prefs=await admin.from('notification_preferences').select('feeding_enabled,feeding_interval_minutes,quiet_start').eq('user_id',owner).single();expect(prefs.data).toMatchObject({feeding_enabled:true,feeding_interval_minutes:240,quiet_start:'22:00:00'});
 expect((await admin.from('web_push_subscriptions').select('id').eq('user_id',owner)).data).toHaveLength(1);
 const sw=await page.request.get('/sw.js');expect(sw.status()).toBe(200);expect(await sw.text()).toContain("self.addEventListener('push'");
 await page.reload();await settings.getByRole('button',{name:'2시간',exact:true}).click();await settings.getByRole('checkbox',{name:'밤에는 쉬기 (22:00–07:00)',exact:true}).uncheck();await settings.getByRole('button',{name:'설정 저장',exact:true}).click();
 await expect.poll(async()=>(await admin.from('notification_preferences').select('feeding_interval_minutes').eq('user_id',owner).single()).data?.feeding_interval_minutes).toBe(120);
 await expect(page.getByRole('status')).toHaveCount(0);
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-feeding-reminder-mobile.png',fullPage:true});
 await settings.getByRole('button',{name:'어제 식사 시간',exact:true}).click();
 await expect(settings.getByRole('button',{name:'2시간',exact:true})).toHaveCount(0);
 await settings.getByRole('button',{name:'설정 저장',exact:true}).click();
 await expect.poll(async()=>(await admin.from('notification_preferences').select('feeding_reference').eq('user_id',owner).single()).data?.feeding_reference).toBe('yesterday');
 await page.reload();await expect(settings.getByRole('button',{name:'어제 식사 시간',exact:true})).toHaveAttribute('aria-pressed','true');
 await settings.getByRole('button',{name:'끄기',exact:true}).click();await settings.getByRole('button',{name:'설정 저장',exact:true}).click();
 await expect.poll(async()=>(await admin.from('notification_preferences').select('feeding_enabled').eq('user_id',owner).single()).data?.feeding_enabled).toBe(false);
 await page.reload();await expect(settings.getByRole('button',{name:'끄기',exact:true})).toHaveAttribute('aria-pressed','true');
 await settings.getByRole('button',{name:'간격 기준',exact:true}).click();await settings.getByRole('button',{name:'설정 저장',exact:true}).click();
 await expect.poll(async()=>(await admin.from('notification_preferences').select('feeding_enabled,feeding_reference').eq('user_id',owner).single()).data).toMatchObject({feeding_enabled:true,feeding_reference:'interval'});
 await settings.getByRole('button',{name:'이 기기 알림 끄기',exact:true}).click();await expect(settings.getByRole('button',{name:'이 기기에서 알림 켜기',exact:true})).toBeVisible();
 expect((await admin.from('web_push_subscriptions').select('id').eq('user_id',owner)).data).toHaveLength(0);
 } finally {
  if (!config.data) await admin.from('feeding_push_config').delete().eq('token_secret_id',fixtureId);
 }
});

test('feeding reminder settings explain HTTPS and iPhone installation requirements before asking permission',async({page,context})=>{
 const {child}=await childCareFamily(context);
 await page.addInitScript(()=>Object.defineProperty(window,'isSecureContext',{value:false}));
 await page.goto(`/ko/account?child=${child}&panel=notifications`);await expect(page.locator('.feeding-push-settings')).toContainText('HTTPS 주소');await expect(page.getByRole('button',{name:'이 기기에서 알림 켜기',exact:true})).toBeDisabled();
 const iphone=await context.newPage();await iphone.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'}));
 await iphone.goto(`/ko/account?child=${child}&panel=notifications`);await expect(iphone.locator('.feeding-push-settings')).toContainText('홈 화면에 추가');await expect(iphone.getByRole('button',{name:'이 기기에서 알림 켜기',exact:true})).toBeDisabled();await iphone.close();
});

test('play and tummy time can start, survive reload and stop without changing legacy records',async({page,context})=>{
 const {child,owner}=await childCareFamily(context);
 const legacy=crypto.randomUUID();expect((await admin.from('child_records').insert({id:legacy,child_id:child,service:'activity',kind:'play',duration_minutes:10,occurred_at:new Date().toISOString(),record_timezone:'Asia/Seoul',created_by:owner,updated_by:owner})).error).toBeNull();
 await page.setViewportSize({width:390,height:844});await page.goto(`/ko/today?child=${child}`);
 const sheet=page.locator('dialog.quick-composer'),quick=page.locator('.quick-grid');
 await expect(page.locator('.quick-running')).toHaveCount(0);
 for(const [label,kind] of [['놀이','play'],['터미타임','tummy']]){
  const button=quick.getByRole('button',{name:label,exact:true});await button.scrollIntoViewIfNeeded();await button.click();
  await expect(sheet.getByRole('button',{name:'시작하기',exact:true})).toBeEnabled();await expect(sheet.getByText('방금 먹였어요',{exact:true})).toHaveCount(0);
  await sheet.getByRole('button',{name:'시작하기',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
  const saved=await admin.from('child_records').select('id,timer_started,ended_at').eq('child_id',child).eq('kind',kind).eq('timer_started',true).single();expect(saved.error).toBeNull();expect(saved.data!.ended_at).toBeNull();
  await page.reload();const running=page.locator('.quick-running').filter({hasText:label});await expect(running).toBeVisible();
  await running.getByRole('button',{name:'기록 종료',exact:true}).click();await sheet.getByRole('button',{name:'기록 종료',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
  const ended=await admin.from('child_records').select('occurred_at,ended_at,timer_started,duration_minutes').eq('id',saved.data!.id).single();expect(ended.error).toBeNull();expect(ended.data!.timer_started).toBe(true);expect(ended.data!.ended_at).not.toBeNull();expect(ended.data!.duration_minutes).toBeNull();
 }
 const play=quick.getByRole('button',{name:'놀이',exact:true});await play.scrollIntoViewIfNeeded();await play.click();
 await sheet.getByRole('button',{name:'이미 마쳤어요',exact:true}).click();await sheet.getByRole('button',{name:'3분',exact:true}).click();await sheet.getByRole('button',{name:'저장하기',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
 const completed=await admin.from('child_records').select('occurred_at,ended_at').eq('child_id',child).eq('kind','play').eq('timer_started',true);expect(completed.error).toBeNull();expect(completed.data!.some(record=>record.ended_at&&Date.parse(record.ended_at)-Date.parse(record.occurred_at)===180000)).toBe(true);
 const old=await admin.from('child_records').select('timer_started,duration_minutes,ended_at').eq('id',legacy).single();expect(old.data).toEqual({timer_started:false,duration_minutes:10,ended_at:null});
});


async function enterServiceAdmin(page:Page,owner:string){
 expect((await admin.from('service_admins').insert({user_id:owner})).error).toBeNull();
 await page.goto('/ko/admin');await expect(page).toHaveURL(/\/ko\/admin$/);
 await expect(page.getByRole('heading',{name:'대시보드',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'관리자 2단계 인증',exact:true})).toHaveCount(0);
}

test('service admin requires a designated login without an extra verification step',async({page,context})=>{
 test.setTimeout(120000);const own=await childCareFamily(context),request=crypto.randomUUID();
 expect((await admin.from('developer_requests').insert({id:request,user_id:own.owner,category:'feature',body:'관리자 테스트: 수면 기록을 쉽게 고치고 싶어요.'})).error).toBeNull();
 await page.goto('/ko/admin');await expect(page.locator('.admin-main')).toHaveCount(0);
 await enterServiceAdmin(page,own.owner);
 await expect(page.locator('.mobile-nav')).toHaveCount(0);
 await page.screenshot({ caret: 'initial',path:'/tmp/podung-admin-desktop.png',fullPage:true});
 const routeCheck=await page.request.get('/ko/admin/requests',{timeout:20000});expect(routeCheck.status()).toBe(200);
 await page.locator('.admin-nav').getByRole('link',{name:'개발 요청',exact:true}).click();
 const card=page.locator('.admin-request-card').filter({hasText:'관리자 테스트:'});await card.locator('summary').click();
 await card.getByRole('combobox',{name:'처리 상태',exact:true}).selectOption('in_progress');await card.getByRole('combobox',{name:'우선순위',exact:true}).selectOption('high');await card.getByRole('textbox',{name:'운영자 메모 · 사용자에게 보이지 않음',exact:true}).fill('테스트 운영 메모');
 await card.getByRole('button',{name:'변경 저장',exact:true}).click();
 await expect.poll(async()=>(await admin.from('developer_requests').select('status').eq('id',request).single()).data?.status).toBe('in_progress');
 expect((await admin.from('admin_request_details').select('priority,internal_note,version').eq('request_id',request).single()).data).toEqual({priority:'high',internal_note:'테스트 운영 메모',version:1});
 await page.setViewportSize({width:390,height:844});
 for(const label of ['대시보드','개발 요청','이용 분석','사용자·가족','동네 현황','운영 상태','작업 이력']){
  await page.locator('.admin-nav').getByRole('link',{name:label,exact:true}).click();await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await expect(page.locator('.admin-table')).toContainText('개발 요청 변경');
 await page.locator('.admin-nav').getByRole('link',{name:'이용 분석',exact:true}).click();await expect(page.getByRole('heading',{name:'이용 분석',exact:true})).toBeVisible();await page.screenshot({ caret: 'initial',path:'/tmp/podung-admin-analytics-mobile.png',fullPage:true});
 await page.goto(`/ko/account?child=${own.child}&panel=service`);await expect(page.getByRole('link',{name:'관리자 사이트',exact:true})).toBeVisible();
});

test('service admin resolves sanitized errors and loses access when its role is revoked',async({page,context})=>{
 test.setTimeout(120000);const own=await childCareFamily(context),error=crypto.randomUUID();await enterServiceAdmin(page,own.owner);
 expect((await admin.from('service_error_events').insert({id:error,user_id:own.owner,section:'today',code:'render_failed',digest:'123456789'})).error).toBeNull();
 await page.goto('/ko/admin/operations');const row=page.locator('tr').filter({hasText:'123456789'});await row.getByRole('button',{name:'해결 표시',exact:true}).click();await expect(row).toHaveCount(0);
 await page.getByRole('link',{name:'해결 포함',exact:true}).click();await expect(page.locator('tr').filter({hasText:'123456789'})).toContainText('해결');
 expect((await admin.from('admin_audit_log').select('id').eq('actor_id',own.owner).eq('action','error_resolve')).data).toHaveLength(1);
 expect((await admin.from('service_admins').delete().eq('user_id',own.owner)).error).toBeNull();
 await page.goto('/ko/admin');await expect(page.locator('.admin-main')).toHaveCount(0);
});

test('diary composer attaches daily records alongside a pattern with the child age', async ({page, context}) => {
 const {child, owner} = await childCareFamily(context);
 const {now, day} = completedSeoulDay();
 expect((await admin.from('care_records').insert({id:crypto.randomUUID(),child_id:child,kind:'formula',started_at:new Date(now.getTime()-600000).toISOString(),amount_ml:140,created_by:owner,updated_by:owner})).error).toBeNull();
 expect((await admin.from('child_records').insert({id:crypto.randomUUID(),child_id:child,service:'diaper',kind:'dirty',occurred_at:now.toISOString(),record_timezone:'Asia/Seoul',created_by:owner,updated_by:owner})).error).toBeNull();
 expect((await admin.from('child_records').insert({id:crypto.randomUUID(),child_id:child,service:'sleep',kind:'nap',occurred_at:new Date(now.getTime()-7200000).toISOString(),ended_at:new Date(now.getTime()-3000000).toISOString(),record_timezone:'Asia/Seoul',created_by:owner,updated_by:owner})).error).toBeNull();
 await page.goto(`/ko/today?child=${child}`);
 await page.locator('.quick-history-loader').scrollIntoViewIfNeeded();
 await expect(page.locator('.quick-color-sleep.quick-timeline-entry').first()).toContainText('1시간 10분');
 await page.addInitScript(() => {
  const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){
   const draws=JSON.parse(sessionStorage.getItem('diary-image-draws')??'[]');draws.push({text,x,y});sessionStorage.setItem('diary-image-draws',JSON.stringify(draws));
   if(maxWidth===undefined)original.call(this,text,x,y);else original.call(this,text,x,y,maxWidth);
  };
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto(`/ko/community/diaries?child=${child}`);
 await page.getByRole('button',{name:'일기 쓰기',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'일기 쓰기',exact:true});
 await sheet.getByRole('button',{name:'하루 기록 올리기',exact:true}).click();
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  const photo=(await sheet.locator('.diary-photo-picker').boundingBox())!,records=(await sheet.getByRole('button',{name:'하루 기록 올리기',exact:true}).boundingBox())!,pattern=(await sheet.getByRole('button',{name:'하루 패턴 올리기',exact:true}).boundingBox())!;
  expect(Math.abs(photo.y-records.y)).toBeLessThan(1);expect(Math.abs(pattern.y-records.y)).toBeLessThan(1);
  for(const name of ['하루 패턴 올리기','하루 기록 올리기'])expect(await sheet.getByRole('button',{name,exact:true}).evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('nowrap');
  expect(await sheet.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
 }
 await sheet.getByLabel('기록 날짜',{exact:true}).fill(day);await sheet.getByRole('button',{name:'첨부',exact:true}).click();
 await expect(sheet.getByRole('img',{name:'첨부 사진 1',exact:true})).toBeVisible();
 const draws=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('diary-image-draws')??'[]') as {text:string,x:number,y:number}[]);
 for(const value of ['분유','140 ml','대변','1시간 10분','podoong'])expect(draws.some(draw=>draw.text===value)).toBe(true);
 expect(draws.some(draw=>/^\d{2}:\d{2}$/.test(draw.text))).toBe(true);
 const bytes=await sheet.getByRole('img',{name:'첨부 사진 1',exact:true}).evaluate(async img=>Array.from(new Uint8Array(await(await fetch((img as HTMLImageElement).src)).arrayBuffer())));
 const meta=await sharp(Buffer.from(bytes)).metadata();expect(meta.width).toBe(1800);expect(meta.height).toBeGreaterThan(500);writeFileSync('/tmp/podung-diary-records.png',Buffer.from(bytes));
 await sheet.getByRole('button',{name:'하루 패턴 올리기',exact:true}).click();await sheet.getByLabel('패턴 날짜').fill(day);await sheet.getByRole('button',{name:'첨부',exact:true}).click();
 await expect(sheet.locator('.diary-photo-count')).toHaveText('2/9');
 const combined=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('diary-image-draws')??'[]') as {text:string,x:number,y:number}[]);
 expect(combined.some(draw=>/^D\+\d+$/.test(draw.text)&&draw.x===900)).toBe(true);
 await sheet.getByRole('button',{name:'2번 사진 앞으로',exact:true}).click();await sheet.getByRole('button',{name:'저장',exact:true}).click();await expect(sheet).toBeHidden({timeout:15000});
 const photos=await admin.from('child_record_photos').select('id,sort_order').eq('child_id',child).order('sort_order');expect(photos.error).toBeNull();expect(photos.data?.map(photo=>photo.sort_order)).toEqual([0,1]);
 await page.goto(`/ko/community?child=${child}`);await expect(page.getByText('육아 소통',{exact:true})).toBeVisible();await expect(page.getByText('육아맘 커뮤니티',{exact:true})).toHaveCount(0);
});

test('service admin legacy verification route redirects and logout blocks access',async({page,context})=>{
 const own=await childCareFamily(context);await enterServiceAdmin(page,own.owner);
 await page.goto('/ko/admin/verify');await expect(page).toHaveURL(/\/ko\/admin$/);
 await page.getByRole('button',{name:'관리자 로그아웃',exact:true}).click();await expect(page).toHaveURL(/\/ko\/login/);
 await page.goto('/ko/admin');await expect(page).toHaveURL(/\/ko\/login/);await expect(page.locator('.admin-main')).toHaveCount(0);
});
