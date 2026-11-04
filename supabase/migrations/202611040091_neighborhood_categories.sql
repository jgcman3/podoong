begin;
alter table public.neighborhood_posts drop constraint neighborhood_posts_category_check;
alter table public.neighborhood_posts add constraint neighborhood_posts_category_check
 check(category in ('play','gear','development','discipline','feeding','solids','birth-supplies','postpartum','health','birth','travel',
 'local-daily','local-friends','local-childcare','local-outings','local-info','local-help'));
-- Keep existing neighborhood stories under the general local-life category.
update public.neighborhood_posts set category='local-daily'
where audience='neighborhood' and category not like 'local-%';
notify pgrst,'reload schema';
commit;
