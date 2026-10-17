import { defineConfig } from "drizzle-kit";

// `pnpm db:migrate` needs a direct or session connection string (not the transaction pooler).
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
