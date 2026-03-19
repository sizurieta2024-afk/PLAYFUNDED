const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const result = await client.query(`
    select
      n.nspname as schema,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args,
      coalesce(array_to_string(p.proconfig, ','), '') as proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef = true
      and coalesce(array_to_string(p.proconfig, ','), '') = ''
    order by n.nspname, p.proname
  `);

  console.log(JSON.stringify(result.rows, null, 2));
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
