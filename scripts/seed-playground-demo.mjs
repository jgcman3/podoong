import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localSupabase } from './lib/local-supabase-env.mjs';
const statePath = new URL(
  '../.secrets/local-playground-demo.json',
  import.meta.url,
);
function must(result, label) {
  if (result.error) throw Error(`${label}: ${result.error.code ?? 'failed'}`);
  return result.data;
}
export async function seedPlaygroundDemo() {
  const env = localSupabase(),
    db = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  const saved = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, 'utf8'))
    : { users: [] };
  const catalogue = JSON.parse(
    readFileSync(
      new URL('../src/features/family/korean-regions.json', import.meta.url),
      'utf8',
    ),
  );
  const region = catalogue.find(
    ([, name]) => name === '서울특별시 용산구 후암동',
  );
  if (!region) throw Error('Local demo region unavailable');
  const fixtures = [
    ['포둥네', '지혜', 'female', 305, '엄마 손을 잡고 동네 구경 중이에요.'],
    ['햇살네', '보리', 'female', 55, '낮잠 자고 기분이 좋아요.'],
    ['도담네', '도담', 'male', 185, '오늘은 방긋방긋 웃었어요.'],
    ['하루네', '하루', 'female', 310, '거울 속 친구가 신기해요.'],
    ['우주네', '우주', 'male', 650, '놀이터 산책을 좋아해요.'],
    ['연두네', '연두', 'female', 1050, '비눗방울 놀이가 제일 좋아요.'],
    ['콩이네', '콩이', 'male', 1700, '친구랑 장난감을 나눠 놀아요.'],
    ['별이네', '별이', 'female', 2200, '그림책 이야기를 들려줄게요.'],
  ];
  const users = [];
  const children = [];
  for (const [
    index,
    [familyName, childName, sex, age, status],
  ] of fixtures.entries()) {
    const email = `podoong-playground-demo-${index}@example.test`,
      password = saved.users[index]?.password ?? randomUUID();
    let user = saved.users[index]?.id
      ? (await db.auth.admin.getUserById(saved.users[index].id)).data.user
      : null;
    if (!user)
      user = must(
        await db.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
        'Local demo user',
      ).user;
    if (!user) throw Error('Local demo user missing');
    users.push({ id: user.id, email, password });
    const suffix = String(index + 1).padStart(12, '0'),
      family = `b9711000-0000-4000-8000-${suffix}`,
      child = `c9711000-0000-4000-8000-${suffix}`;
    must(
      await db.from('profiles').upsert({
        id: user.id,
        display_name: '로컬 예시 보호자',
        timezone: 'Asia/Seoul',
        consented_at: new Date().toISOString(),
      }),
      'Local profile',
    );
    must(
      await db.from('families').upsert({
        id: family,
        name: familyName,
        residence_country_code: 'KR',
        residence_city: '서울특별시 용산구',
        residence_locality: '후암동',
        residence_region_code: region[0],
      }),
      'Local family',
    );
    must(
      await db.from('family_members').upsert({
        family_id: family,
        user_id: user.id,
        role: 'owner',
        relationship: index % 2 ? 'father' : 'mother',
      }),
      'Local membership',
    );
    const birthday = new Date(Date.now() - age * 86400000)
      .toISOString()
      .slice(0, 10);
    must(
      await db.from('children').upsert({
        id: child,
        family_id: family,
        name: childName,
        sex,
        birth_date: birthday,
      }),
      'Local child',
    );
    must(
      await db.from('parenting_friend_profiles').upsert(
        {
          child_id: child,
          nickname: `${familyName} ${childName}`,
          status,
        },
        { onConflict: 'child_id' },
      ),
      'Local public profile',
    );
    const actor = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false },
    });
    must(
      await actor.auth.signInWithPassword({ email, password }),
      'Local visit sign-in',
    );
    must(
      await actor.rpc('parenting_playground', { p_child: child }),
      'Local arrival',
    );
    children.push(child);
  }
  const state = { users, child: children[0], children };
  mkdirSync(new URL('../.secrets/', import.meta.url), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  console.log('Local-only demo ready: 8 children with one-line statuses.');
  return { env, state };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await seedPlaygroundDemo();
