import { defineConfig } from "drizzle-kit";

// Migrations are generated offline (`pnpm db:generate`) and applied with the unpooled URL
// (`pnpm db:migrate`), per Docs/integration-specs/neon-drizzle.md.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
