begin;
alter table public.neighborhood_posts drop constraint neighborhood_posts_category_check;
alter table public.neighborhood_posts add constraint neighborhood_posts_category_check
 check(category in ('daily','play','development','discipline','travel','solids','feeding','gear','health','birth-supplies','postpartum','birth','other',
 'local-daily','local-outings','local-info','local-help','local-childcare','local-other'));
notify pgrst,'reload schema';
commit;
