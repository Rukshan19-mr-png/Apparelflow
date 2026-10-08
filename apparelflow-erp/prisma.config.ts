import "dotenv/config";
import { defineConfig } from "prisma/config";

const isVercelDeployment = process.env["VERCEL"] === "1" || process.env["NODE_ENV"] === "production";

export default defineConfig({
  schema: process.env["PRISMA_SCHEMA"] ?? (isVercelDeployment ? "prisma/schema.postgresql.prisma" : "prisma/schema.prisma"),
  migrations: {
    path: isVercelDeployment ? "prisma/migrations-postgresql" : "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: isVercelDeployment
      ? process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? ""
      : process.env["DATABASE_URL"] ?? "file:./dev.db",
  },
});
