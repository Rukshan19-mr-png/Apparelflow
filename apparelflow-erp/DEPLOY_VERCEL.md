# Deploy ApparelFlow ERP to Vercel with Neon Postgres

Vercel Postgres is no longer offered for new projects. The current Vercel Marketplace Postgres option is Neon. This app uses SQLite for local development and a distinct PostgreSQL schema/migration history in production.

## 1. Push the project to GitHub

Commit and push the project changes. The application root is the `apparelflow-erp` directory inside the repository.

## 2. Create the Vercel project

1. In Vercel, choose **Add New → Project**, then import the GitHub repository.
2. Set **Root Directory** to `apparelflow-erp` and confirm Next.js is detected.
3. Keep the default install/build settings. The `postinstall` script generates the Prisma client during install.
4. Do not deploy until the Neon database and environment variables are configured.

## 3. Provision Neon from Vercel

1. In the Vercel dashboard, open **Integrations → Browse Marketplace**.
2. Find and install **Neon Postgres** (the Vercel-Managed integration is suitable for a new Neon account and bills through Vercel).
3. Create a database and connect it to the ApparelFlow Vercel project.
4. Choose a region close to the Vercel project's primary region.

The integration adds `DATABASE_URL` to the project. Keep this value for the app's runtime connection. The serverless/pooled connection is appropriate for normal application queries.

## 4. Add the direct connection for Prisma migrations

Prisma migrations should use a direct (non-pooled) Neon connection.

1. In Neon, open the database's **Connect** dialog and select the production branch, database, and role.
2. Copy the direct connection string (disable the pooler if the dialog offers that option).
3. In Vercel, open **Project → Settings → Environment Variables** and add:
   - **Key:** `DIRECT_URL`
   - **Value:** the direct Neon connection string
   - **Environment:** Production
4. Add the same variable to Preview only if Preview deployments use a separate preview database/branch. Do not point Preview migrations at the production database.

Also add:

| Key | Value | Environment |
|---|---|---|
| `AUTH_SECRET` | A unique random secret, at least 32 random bytes | Production (and a separate secret for Preview) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-production-domain>` | Production |

Generate a secret locally in PowerShell with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Paste the result into Vercel as a Secret. Do not commit actual database URLs or secrets.

## 5. Create the database schema and seed demo records

After the Vercel project is connected to Neon, use Vercel CLI from the `apparelflow-erp` directory. Pull the production variables to a local-only file:

```powershell
npx vercel login
npx vercel link
npx vercel env pull .env.production.local --environment=production
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

Deploy the `main` branch from Vercel. Verify the deployment's build logs, then open the provided `*.vercel.app` URL and test login plus each demo role. Configure a custom domain from **Project → Settings → Domains** if desired, and update `NEXT_PUBLIC_APP_URL` to match it before redeploying.

## Preview database safety

Do not use production database variables for Preview deployments. Connect a separate Neon branch/database to Preview and set its own `DATABASE_URL` and `DIRECT_URL` values, or leave database-backed actions disabled for Preview. This prevents a preview build or migration from modifying production data.
