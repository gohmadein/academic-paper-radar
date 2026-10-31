-- DRAFT: administrator runs only after project/owner/auth configuration approval.
-- No owner is automatically assigned. Until an admin seeds the allowlist, nobody
-- can mutate the public reading list. No client secrets or sample account IDs.
begin;

create schema if not exists private;
create table if not exists private.paper_signal_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  singleton boolean not null default true check (singleton),
  unique (singleton)
);
revoke all on table private.paper_signal_owners from public, anon, authenticated;
alter table private.paper_signal_owners enable row level security;
grant usage on schema private to authenticated;

create or replace function private.paper_signal_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from private.paper_signal_owners
    where user_id = (select auth.uid())
  );
$$;
revoke all on function private.paper_signal_is_owner() from public, anon;
grant execute on function private.paper_signal_is_owner() to authenticated;

-- Exposed RPC is an invoker wrapper, not a privileged public function.
create or replace function public.paper_signal_is_owner()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.paper_signal_is_owner(); $$;
revoke all on function public.paper_signal_is_owner() from public, anon;
grant execute on function public.paper_signal_is_owner() to authenticated;

create table if not exists public.paper_signal_bookmarks (
  paper_id text primary key check (paper_id ~ '^[a-z0-9][a-z0-9-]{0,99}$' and paper_id !~ '^demo-'),
  created_at timestamptz not null default now()
);
alter table public.paper_signal_bookmarks enable row level security;
alter table public.paper_signal_bookmarks force row level security;
revoke all on table public.paper_signal_bookmarks from public, anon, authenticated;
grant select on table public.paper_signal_bookmarks to anon, authenticated;
grant insert, delete on table public.paper_signal_bookmarks to authenticated;

create policy "public reading list is readable by everyone"
  on public.paper_signal_bookmarks for select to anon, authenticated
  using (true);
create policy "only allowlisted owner may add"
  on public.paper_signal_bookmarks for insert to authenticated
  with check ((select private.paper_signal_is_owner()));
create policy "only allowlisted owner may remove"
  on public.paper_signal_bookmarks for delete to authenticated
  using ((select private.paper_signal_is_owner()));

commit;

-- Separately, an administrator verifies the intended auth.users UUID and runs:
-- insert into private.paper_signal_owners (user_id) values ('VERIFIED-OWNER-UUID');
-- Do not use auth metadata, first-login ownership, signup triggers or an
-- application-provided UUID to self-enroll. Never expose a service_role key.
