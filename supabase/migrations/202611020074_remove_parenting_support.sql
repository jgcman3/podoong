begin;
-- Only retire the public benefits catalogue; family records remain untouched.
select cron.unschedule(jobid) from cron.job where jobname='podoong-parenting-support';
delete from vault.secrets where name='podoong_support_worker' or id in(select token_secret_id from public.parenting_support_config);
drop function public.configure_parenting_support(text,text);
drop function public.dispatch_parenting_support();
drop function public.publish_parenting_support(uuid,jsonb);
drop function public.begin_parenting_support_sync();
drop table public.parenting_support_config,public.parenting_support,public.parenting_support_sync;
commit;
