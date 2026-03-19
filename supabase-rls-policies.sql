-- Playfunded RLS hardening for public application tables.
-- Safe to re-run. Intended for development/staging first.

begin;

create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select "id"
  from public."User"
  where "supabaseId" = auth.uid()::text
  limit 1
$$;

revoke all on function public.current_app_user_id() from public;
grant execute on function public.current_app_user_id() to authenticated, service_role;

alter table public."Challenge" enable row level security;
alter table public."Pick" enable row level security;
alter table public."ParlayLeg" enable row level security;
alter table public."Payment" enable row level security;
alter table public."Payout" enable row level security;
alter table public."PayoutProfile" enable row level security;
alter table public."KycSubmission" enable row level security;
alter table public."Affiliate" enable row level security;
alter table public."AffiliateClick" enable row level security;
alter table public."MarketRequest" enable row level security;
alter table public."Follow" enable row level security;
alter table public."AuditLog" enable row level security;
alter table public."CountryPolicyOverride" enable row level security;
alter table public."OpsEventLog" enable row level security;
alter table public."Tier" enable row level security;
alter table public."OddsCache" enable row level security;
alter table public."RateLimitBucket" enable row level security;
alter table public."_prisma_migrations" enable row level security;

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

drop policy if exists "service_full_access" on public."Challenge";
create policy "service_full_access" on public."Challenge"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_challenges" on public."Challenge";
create policy "users_select_own_challenges" on public."Challenge"
for select to authenticated
using ("userId" = public.current_app_user_id());

drop policy if exists "service_full_access" on public."Pick";
create policy "service_full_access" on public."Pick"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_picks" on public."Pick";
create policy "users_select_own_picks" on public."Pick"
for select to authenticated
using ("userId" = public.current_app_user_id());

drop policy if exists "service_full_access" on public."ParlayLeg";
create policy "service_full_access" on public."ParlayLeg"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_parlay_legs" on public."ParlayLeg";
create policy "users_select_own_parlay_legs" on public."ParlayLeg"
for select to authenticated
using (
  exists (
    select 1
    from public."Pick" p
    where p."id" = "ParlayLeg"."pickId"
      and p."userId" = public.current_app_user_id()
  )
);

drop policy if exists "service_full_access" on public."Payment";
create policy "service_full_access" on public."Payment"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_payments" on public."Payment";
create policy "users_select_own_payments" on public."Payment"
for select to authenticated
using ("userId" = public.current_app_user_id());

drop policy if exists "service_full_access" on public."Payout";
create policy "service_full_access" on public."Payout"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_payouts" on public."Payout";
create policy "users_select_own_payouts" on public."Payout"
for select to authenticated
using ("userId" = public.current_app_user_id());

drop policy if exists "service_full_access" on public."PayoutProfile";
create policy "service_full_access" on public."PayoutProfile"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_payout_profile" on public."PayoutProfile";
create policy "users_select_own_payout_profile" on public."PayoutProfile"
for select to authenticated
using ("userId" = public.current_app_user_id());

drop policy if exists "users_insert_own_payout_profile" on public."PayoutProfile";
create policy "users_insert_own_payout_profile" on public."PayoutProfile"
for insert to authenticated
with check ("userId" = public.current_app_user_id());

drop policy if exists "users_update_own_payout_profile" on public."PayoutProfile";
create policy "users_update_own_payout_profile" on public."PayoutProfile"
for update to authenticated
using ("userId" = public.current_app_user_id())
with check ("userId" = public.current_app_user_id());

drop policy if exists "service_full_access" on public."KycSubmission";
create policy "service_full_access" on public."KycSubmission"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_kyc_submission" on public."KycSubmission";
create policy "users_select_own_kyc_submission" on public."KycSubmission"
for select to authenticated
using ("userId" = public.current_app_user_id());

drop policy if exists "service_full_access" on public."Affiliate";
create policy "service_full_access" on public."Affiliate"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_affiliate" on public."Affiliate";
create policy "users_select_own_affiliate" on public."Affiliate"
for select to authenticated
using ("userId" = public.current_app_user_id());

drop policy if exists "service_full_access" on public."AffiliateClick";
create policy "service_full_access" on public."AffiliateClick"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_affiliate_clicks" on public."AffiliateClick";
create policy "users_select_own_affiliate_clicks" on public."AffiliateClick"
for select to authenticated
using (
  exists (
    select 1
    from public."Affiliate" a
    where a."id" = "AffiliateClick"."affiliateId"
      and a."userId" = public.current_app_user_id()
  )
);

drop policy if exists "service_full_access" on public."MarketRequest";
create policy "service_full_access" on public."MarketRequest"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_market_requests" on public."MarketRequest";
create policy "users_select_own_market_requests" on public."MarketRequest"
for select to authenticated
using ("userId" = public.current_app_user_id());

drop policy if exists "users_insert_own_market_requests" on public."MarketRequest";
create policy "users_insert_own_market_requests" on public."MarketRequest"
for insert to authenticated
with check (
  "userId" = public.current_app_user_id()
  and "status" = 'pending'
  and "adminNote" is null
);

drop policy if exists "service_full_access" on public."Follow";
create policy "service_full_access" on public."Follow"
for all to service_role
using (true)
with check (true);

drop policy if exists "users_select_own_follows" on public."Follow";
create policy "users_select_own_follows" on public."Follow"
for select to authenticated
using (
  "followerId" = public.current_app_user_id()
  or "followingId" = public.current_app_user_id()
);

drop policy if exists "users_insert_own_follows" on public."Follow";
create policy "users_insert_own_follows" on public."Follow"
for insert to authenticated
with check (
  "followerId" = public.current_app_user_id()
  and "followerId" <> "followingId"
);

drop policy if exists "users_delete_own_follows" on public."Follow";
create policy "users_delete_own_follows" on public."Follow"
for delete to authenticated
using ("followerId" = public.current_app_user_id());

drop policy if exists "service_full_access" on public."AuditLog";
create policy "service_full_access" on public."AuditLog"
for all to service_role
using (true)
with check (true);

drop policy if exists "service_full_access" on public."CountryPolicyOverride";
create policy "service_full_access" on public."CountryPolicyOverride"
for all to service_role
using (true)
with check (true);

drop policy if exists "service_full_access" on public."OpsEventLog";
create policy "service_full_access" on public."OpsEventLog"
for all to service_role
using (true)
with check (true);

commit;
