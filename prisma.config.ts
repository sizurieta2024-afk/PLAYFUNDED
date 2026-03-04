import path from "node:path";
import { defineConfig } from "prisma/config";

const datasourceUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: datasourceUrl,
  },
});
