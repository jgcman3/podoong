begin;
create index care_latest_amount
on public.care_records(child_id,kind,started_at desc,id desc)
where amount_ml is not null;
commit;
