import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load local development environment first.
// Existing shell/Vercel environment variables are not overwritten.
config({ path: ".env.local" });

// Fall back to .env if it exists.
config();

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx --tsconfig tsconfig.json prisma/seed.ts",
  },

  datasource: {
    url: process.env.DIRECT_URL?.trim() || env("DATABASE_URL"),
  },
});