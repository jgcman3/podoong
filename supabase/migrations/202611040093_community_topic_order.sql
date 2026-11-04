begin;
alter table public.neighborhood_posts drop constraint neighborhood_posts_category_check;
update public.neighborhood_posts set category='local-other' where category='local-friends';
alter table public.neighborhood_posts add constraint neighborhood_posts_category_check
 check(category in ('daily','play','development','discipline','travel','solids','feeding','gear','health','birth-supplies','postpartum','birth','other',
 'local-daily','local-outings','local-childcare','local-info','local-help','local-other'));
-- Topics now follow the editorial order; no weekly popularity aggregation is needed.
drop function public.parenting_topics(uuid);
notify pgrst,'reload schema';
commit;
