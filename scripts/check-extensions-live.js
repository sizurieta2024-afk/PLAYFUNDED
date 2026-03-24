const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const result = await client.query(`
    select
      e.extname,
      n.nspname as schema,
      r.rolname as owner
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    join pg_roles r on r.oid = e.extowner
    order by e.extname
  `);

  console.log(JSON.stringify(result.rows, null, 2));
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
