-- Targeted Supabase RLS hardening for public tables flagged by Security Advisor.
-- Safe to run on the live project SQL editor.

begin;

alter table if exists public."Tier" enable row level security;
alter table if exists public."OddsCache" enable row level security;
alter table if exists public."RateLimitBucket" enable row level security;
alter table if exists public."_prisma_migrations" enable row level security;

revoke all on table public."Tier" from public, anon, authenticated;
revoke all on table public."OddsCache" from public, anon, authenticated;
revoke all on table public."RateLimitBucket" from public, anon, authenticated;
revoke all on table public."_prisma_migrations" from public, anon, authenticated;

grant all on table public."Tier" to service_role;
grant all on table public."OddsCache" to service_role;
grant all on table public."RateLimitBucket" to service_role;
grant all on table public."_prisma_migrations" to service_role;

drop policy if exists "service_full_access" on public."Tier";
create policy "service_full_access" on public."Tier"
for all to service_role
using (true)
with check (true);

drop policy if exists "service_full_access" on public."OddsCache";
create policy "service_full_access" on public."OddsCache"
for all to service_role
using (true)
with check (true);

drop policy if exists "service_full_access" on public."RateLimitBucket";
create policy "service_full_access" on public."RateLimitBucket"
for all to service_role
using (true)
with check (true);

drop policy if exists "service_full_access" on public."_prisma_migrations";
create policy "service_full_access" on public."_prisma_migrations"
for all to service_role
using (true)
with check (true);

commit;
