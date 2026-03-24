const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const result = await client.query(`
    select c.relname, array_agg(distinct g.grantee order by g.grantee) as grantees
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join information_schema.role_table_grants g
      on g.table_schema = n.nspname
     and g.table_name = c.relname
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false
      and g.grantee in ('anon', 'authenticated')
    group by c.relname
    order by c.relname
  `);

  console.log(JSON.stringify(result.rows, null, 2));
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
