-- Explicit opt-in demo content; never part of automatic migrations or seeding.
begin;
do $$
declare
 demo_user constant uuid := 'd17a0000-47f0-4abc-8abd-000000000001';
 demo_family constant uuid := 'd17a0000-47f0-4abc-8abd-000000000002';
 birthday date;
begin
 select birth_date into birthday from public.children
 where family_id<>demo_family and birth_date is not null and birth_date<=current_date
 order by created_at,id limit 1;
 if birthday is null then raise exception 'A born child is required for same-birthday examples'; end if;
 insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,banned_until,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(demo_user,'authenticated','authenticated','growth-diary-demo@example.invalid','',now(),'infinity',
 '{"provider":"email","providers":[]}'::jsonb,'{"demo":"growth-community"}'::jsonb,now(),now())
 on conflict(id) do nothing;
 insert into public.profiles(id,display_name,consented_at) values(demo_user,'예시 성장일기',now()) on conflict(id) do nothing;
 insert into public.families(id,name) values(demo_family,'[예시] 성장일기 가족') on conflict(id) do nothing;
 insert into public.children(id,family_id,name,birth_date,sex) values
 ('d17a0000-47f0-4abc-8abd-000000000011',demo_family,'[예시] 봄이',birthday,'female'),
 ('d17a0000-47f0-4abc-8abd-000000000012',demo_family,'[예시] 하늘이',birthday,'male'),
 ('d17a0000-47f0-4abc-8abd-000000000013',demo_family,'[예시] 별이',current_date-100,'female')
 on conflict(id) do nothing;
 insert into public.child_records(id,child_id,service,kind,occurred_at,record_timezone,title,note,weight_kg,height_cm,head_cm,created_by) values
 ('d17a0000-47f0-4abc-8abd-000000000021','d17a0000-47f0-4abc-8abd-000000000011','growth','measurement',now()-interval '5 minutes','Asia/Seoul','[예시] 웃음으로 시작한 하루',E'화면 확인용 가상 성장일기입니다. 신체 수치는 예시이며 성장 기준이 아닙니다.\n\n아침에 눈을 마주치니 방긋 웃어 주었어요. 좋아하는 장난감을 보며 손도 쭉 뻗었답니다. 오늘의 작은 순간을 남겨 봅니다.',6.8,65,42,demo_user),
 ('d17a0000-47f0-4abc-8abd-000000000022','d17a0000-47f0-4abc-8abd-000000000012','growth','measurement',now()-interval '15 minutes','Asia/Seoul','[예시] 산책하며 만난 가을',E'화면 확인용 가상 성장일기입니다. 신체 수치는 예시이며 성장 기준이 아닙니다.\n\n유모차를 타고 동네를 한 바퀴 돌았어요. 나뭇잎이 움직일 때마다 한참 바라보더라고요. 집에 와서는 품에 안겨 편안하게 쉬었어요.',7.1,66.2,42.3,demo_user),
 ('d17a0000-47f0-4abc-8abd-000000000023','d17a0000-47f0-4abc-8abd-000000000011','growth','observation',now()-interval '25 minutes','Asia/Seoul','[예시] 작은 손으로 꼭 잡았어요',E'화면 확인용 가상 성장일기입니다.\n\n손가락을 내밀었더니 작은 손으로 꼭 잡아 주었어요. 특별한 일이 없어도 함께 보낸 시간이 참 소중하게 느껴지는 하루였어요.\n\n이 글은 신체 수치를 입력하지 않은 일기의 예시입니다.',null,null,null,demo_user),
 ('d17a0000-47f0-4abc-8abd-000000000024','d17a0000-47f0-4abc-8abd-000000000013','growth','observation',now()-interval '35 minutes','Asia/Seoul','[예시] 어느새 백일, 함께한 시간',E'화면 확인용 가상 성장일기입니다.\n\n처음 만났던 날이 엊그제 같은데 어느새 백일이 되었어요. 좋아하는 담요를 덮고 가족과 느긋한 오후를 보냈답니다. 앞으로의 하루하루도 천천히 남겨 보려고 해요.',null,null,null,demo_user)
 on conflict(id) do nothing;
 insert into public.growth_diary_shares(record_id,same_birth_date,everyone,published_by)
 select id,id<>'d17a0000-47f0-4abc-8abd-000000000024'::uuid,true,demo_user
 from public.child_records where id in ('d17a0000-47f0-4abc-8abd-000000000021','d17a0000-47f0-4abc-8abd-000000000022','d17a0000-47f0-4abc-8abd-000000000023','d17a0000-47f0-4abc-8abd-000000000024')
 on conflict(record_id) do nothing;
end $$;
commit;
select count(*)::int as example_diaries from public.growth_diary_shares where published_by='d17a0000-47f0-4abc-8abd-000000000001';
