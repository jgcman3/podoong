begin;
-- The playground is the only friend roster; do not reintroduce the retired profile API.
drop function if exists public.parenting_friends(uuid,text,text,timestamptz,uuid);
notify pgrst,'reload schema';
commit;
