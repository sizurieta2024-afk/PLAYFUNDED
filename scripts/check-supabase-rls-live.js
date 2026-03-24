const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const tables = ["Tier", "OddsCache", "RateLimitBucket", "_prisma_migrations"];

  const rls = await client.query(
    `
      select c.relname, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = any($1::text[])
      order by c.relname
    `,
    [tables],
  );

  const policies = await client.query(
    `
      select tablename, policyname, permissive, roles, cmd
      from pg_policies
      where schemaname = 'public'
        and tablename = any($1::text[])
      order by tablename, policyname
    `,
    [tables],
  );

  const grants = await client.query(
    `
      select table_name, grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = any($1::text[])
        and grantee in ('anon', 'authenticated', 'service_role', 'public')
      order by table_name, grantee, privilege_type
    `,
    [tables],
  );

  console.log(
    JSON.stringify(
      { rls: rls.rows, policies: policies.rows, grants: grants.rows },
      null,
      2,
    ),
  );
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
