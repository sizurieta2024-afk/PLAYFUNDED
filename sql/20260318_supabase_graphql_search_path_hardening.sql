-- Hardens pg_graphql extension functions flagged by Supabase Security Advisor.
-- Safe to run even if already applied.

begin;

alter function graphql.get_schema_version() set search_path = '';
alter function graphql.increment_schema_version() set search_path = '';

commit;
