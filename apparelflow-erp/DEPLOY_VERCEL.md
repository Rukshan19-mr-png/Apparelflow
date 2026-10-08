# Deploy ApparelFlow ERP to Vercel with Prisma Postgres

The live deployment is [apparelflow-erp-sigma.vercel.app](https://apparelflow-erp-sigma.vercel.app), connected to the `apparelflow-erp` Vercel project. Production uses a managed Prisma Postgres database; local development uses SQLite. Vercel builds select `prisma/schema.postgresql.prisma` and `prisma/migrations-postgresql`.

## 1. Push the project to GitHub

Commit and push the project changes. The application root is the `apparelflow-erp` directory inside the repository.

## 2. Create the Vercel project

1. In Vercel, choose **Add New → Project**, then import the GitHub repository.
2. Set **Root Directory** to `apparelflow-erp` and confirm Next.js is detected.
3. Keep the default install/build settings. The `postinstall` script generates the Prisma client during install.
4. Do not deploy until the managed PostgreSQL resource and environment variables are configured.

## 3. Provision PostgreSQL from Vercel

For a new project, use the Prisma Postgres integration from Vercel Marketplace (or another supported managed PostgreSQL provider). Connect it to the ApparelFlow Vercel project and choose a region close to the deployment.

The production project has `DATABASE_URL`, `PRISMA_DATABASE_URL`, and `POSTGRES_URL` provider variables. Keep secrets in Vercel environment settings and ignored local files only.

## 4. Configure the migration connection and application secret

Use the provider's direct connection string for Prisma migrations when the provider offers one. Confirm that `DIRECT_URL` is direct and non-pooled; do not assume the pooled runtime URL is suitable for migrations.

In Vercel, open **Project → Settings → Environment Variables** and configure:

| Key | Purpose | Environment |
|---|---|---|
| `DATABASE_URL` | Runtime PostgreSQL connection | Production |
| `DIRECT_URL` | Direct connection for migrations, if provided by the provider | Production |
| `AUTH_SECRET` | Unique random secret, at least 32 random bytes | Production (use a separate secret for Preview) |
| `NEXT_PUBLIC_APP_URL` | Canonical public URL, if used by the application | Production |

Generate a secret locally in PowerShell with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Paste the result into Vercel as a Secret. Never commit actual database URLs or secrets. The active URL is `https://apparelflow-erp-sigma.vercel.app`; update `NEXT_PUBLIC_APP_URL` only if the canonical domain changes and the application uses it.

## 5. Create the database schema and seed demo records

Use Vercel CLI from the linked repository root and pull Production variables to a local-only file:

```powershell
npx vercel login
npx vercel link
npx vercel env pull .\apparelflow-erp\.env.production.local --environment=production
Set-Location .\apparelflow-erp
```

Confirm that `.env.production.local` contains `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET`. Then, in the same PowerShell window:

```powershell
$env:VERCEL = "1"
$env:DOTENV_CONFIG_PATH = ".env.production.local"
npx prisma migrate deploy
npx tsx prisma/seed.ts
Remove-Item Env:VERCEL
Remove-Item Env:DOTENV_CONFIG_PATH
```

These commands use the dedicated PostgreSQL schema and migration directory. Keep `.env.production.local` private; it contains production credentials and must not be committed.

## 6. Deploy and verify

Deploy through the connected Vercel project. Verify build logs, then open the production URL and test all three demo roles and the create → verify → sew workflow. Configure a custom domain from **Project → Settings → Domains** if desired.

## Preview database safety

Do not use production database variables for Preview deployments. Connect a separate database/branch to Preview and set its own `DATABASE_URL` and `DIRECT_URL` values, or leave database-backed actions disabled for Preview. This prevents a preview deployment or migration from modifying production data.
