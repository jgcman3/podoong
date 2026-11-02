begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id) select ('a9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,5)i;
insert into profiles(id,display_name,consented_at) select id,'Fixture',now() from auth.users where id::text like 'a9670000-%';
insert into families(id,name,residence_country_code,residence_province,residence_city,residence_locality) values
('b9670000-0000-4000-8000-000000000001','Fixture','KR',null,'서울특별시 강남구','역삼동'),
('b9670000-0000-4000-8000-000000000002','Fixture','KR',null,'서울특별시 강남구','역삼동'),
('b9670000-0000-4000-8000-000000000003','Fixture','KR',null,'서울특별시 서초구','서초동'),
('b9670000-0000-4000-8000-000000000004','Fixture','US','California','San Francisco','Downtown'),
('b9670000-0000-4000-8000-000000000005','Fixture','KR',null,'서울특별시 강남구','논현동');
insert into family_members(family_id,user_id,role,relationship) select ('b9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'owner','father' from generate_series(1,5)i;
insert into children(id,family_id,name,birth_date,sex) select ('c9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b9670000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Fixture child',current_date,'female' from generate_series(1,5)i;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select save_parenting_post('b9670000-0000-4000-8000-000000000001','play','Poll post','Body #play',p_child=>'c9670000-0000-4000-8000-000000000001',p_poll=>' {"question":"Which?","options":["A","B"]}') as post \gset
select parenting_post_interact(:'post','c9670000-0000-4000-8000-000000000001','comment','Root comment')->>'id' as root \gset
select parenting_comment_interact(:'root','c9670000-0000-4000-8000-000000000001','like','on');
select parenting_comment_interact(:'root','c9670000-0000-4000-8000-000000000001','like','on');
select is((parenting_post_comments_page(:'post')->0->>'likes')::int,1,'comment like retry is idempotent');
select parenting_comment_interact(:'root','c9670000-0000-4000-8000-000000000001','reply','First reply')->'comment'->>'id' as reply \gset
select is(jsonb_array_length(parenting_post_comments_page(:'post')),1,'root page excludes replies');
select is(jsonb_array_length(parenting_comment_replies(:'root')),1,'thread shows its reply');
select is(parenting_comment_replies(:'root')->0->>'parent_id',:'root','reply belongs to the correct parent');
select parenting_comment_interact(:'reply','c9670000-0000-4000-8000-000000000001','reply','Reply to reply');
select is((parenting_post_comments_page(:'post')->0->>'reply_count')::int,2,'reply to reply remains in one thread');
select parenting_comment_interact(:'reply','c9670000-0000-4000-8000-000000000001','like','on');
select is((select (v->>'likes')::int from jsonb_array_elements(parenting_comment_replies(:'root')) v where v->>'id'=:'reply'),1,'replies can be liked');
select parenting_comment_interact(:'root','c9670000-0000-4000-8000-000000000001','like','off');
select is((parenting_post_comments_page(:'post')->0->>'likes')::int,0,'comment likes can be removed');
reset role;
select set_config('request.jwt.claims','{"sub":"a9670000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok(format('select parenting_comment_replies(%L)',:'root'),'42501','forbidden','other country cannot read replies');
select throws_ok(format('select parenting_comment_interact(%L,%L,%L,%L)',:'root','c9670000-0000-4000-8000-000000000004','like','on'),'42501','forbidden','other country cannot like comments');
reset role;
select * from finish();rollback;
