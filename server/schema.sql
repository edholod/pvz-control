-- Only the verified Edge Function may access these tables.
create table if not exists public.pvz_control_states (
 user_id bigint primary key check(user_id > 0),
 revision bigint not null default 0,
 data jsonb not null,
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 5000000)
);
create table if not exists public.pvz_control_backups (
 user_id bigint not null, revision bigint not null, data jsonb not null,
 created_at timestamptz not null default now(), primary key(user_id, revision)
);
alter table public.pvz_control_states enable row level security;
alter table public.pvz_control_backups enable row level security;
revoke all on public.pvz_control_states, public.pvz_control_backups from anon, authenticated;
grant select,insert,update on public.pvz_control_states to service_role;
grant select,insert,delete on public.pvz_control_backups to service_role;
create or replace function public.pvz_control_write(p_user bigint, p_revision bigint, p_data jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare old public.pvz_control_states; fresh public.pvz_control_states;
begin
 perform pg_advisory_xact_lock(p_user);
 select * into old from public.pvz_control_states where user_id=p_user for update;
 if old.user_id is null then
  if p_revision <> 0 then return jsonb_build_object('conflict',true); end if;
  insert into public.pvz_control_states(user_id,revision,data) values(p_user,1,p_data) returning * into fresh;
 else
  if old.revision <> p_revision then return jsonb_build_object('conflict',true); end if;
  insert into public.pvz_control_backups(user_id,revision,data) values(p_user,old.revision,old.data) on conflict do nothing;
  update public.pvz_control_states set data=p_data,revision=revision+1,updated_at=now() where user_id=p_user returning * into fresh;
  delete from public.pvz_control_backups where user_id=p_user and revision not in
   (select revision from public.pvz_control_backups where user_id=p_user order by revision desc limit 30);
 end if;
 return jsonb_build_object('revision',fresh.revision,'updated_at',fresh.updated_at);
end $$;
revoke all on function public.pvz_control_write(bigint,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.pvz_control_write(bigint,bigint,jsonb) to service_role;
