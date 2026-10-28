begin;
-- Recreating the feed in 045 inherited the platform's default anon grant.
-- Public diary links have their own token-scoped RPC; the member feed does not.
revoke execute on function public.growth_diary_feed(uuid,text,integer,integer) from anon;
commit;
