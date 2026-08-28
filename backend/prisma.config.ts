import "dotenv/config";
import dotenv from "dotenv";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Keep Prisma CLI on the same environment as the backend runtime.
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
