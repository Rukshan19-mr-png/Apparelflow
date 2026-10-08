# ApparelFlow ERP — Production Verification Terminal

A focused manufacturing ERP slice for recipe-based cutting orders, independent component inspection, auditable verifier sign-off, and controlled release to the sewing floor.

## Run locally

Requires Node.js 20+. Install dependencies, configure the environment, and initialize the SQLite database:

```powershell
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev
```

The supplied `.env.example` uses `file:./dev.db` with Prisma's libSQL adapter. Set `AUTH_SECRET` to a long, random value before use. Production hosting needs a persistent database volume or managed SQL database; an ephemeral serverless file system will not preserve SQLite data. For a multi-instance deployment, configure a managed PostgreSQL database and the matching Prisma provider/adapter instead of SQLite.

## Deploy to Vercel

Vercel Postgres is no longer available for new projects. The deployed project uses a managed Prisma Postgres database. Local development continues to use SQLite; Vercel selects the PostgreSQL Prisma schema and its separate migration history.

The live Vercel deployment is [apparelflow-erp-sigma.vercel.app](https://apparelflow-erp-sigma.vercel.app). The app was deployed from the connected Vercel project; its project root is `apparelflow-erp`. For setup, environment variables, and migration guidance, see [Vercel deployment setup](./DEPLOY_VERCEL.md).

## Demo personas

The sidebar role switcher demonstrates all three personas. It requests a signed, HTTP-only demo session from `POST /api/auth/demo` when the API is available. Demo accounts are seeded with these identities:

| Role | Demo identity | Permission summary |
|---|---|---|
| Cutting Supervisor | **Maleesha Rukshan** (`alex@demo.apparelflow.test`) | Create cutting orders; inspect own orders; cannot verify or access sewing queue. |
| Cutting Verifier | **Maya Bandara** (`maya@demo.apparelflow.test`) | Count, approve, or reject pending batches; cannot create orders or access sewing queue. |
| Sewing Supervisor | **Sugath Lokuge** (`jordan@demo.apparelflow.test`) | View verified queue and start assembly; cannot access unverified batches. |

The demo endpoint is intentionally a role selector for evaluation, not a production identity provider. It can issue a signed session for any demo role without proving a person's identity. Do not use this configuration for sensitive or public production workloads; replace it with credential-backed authentication and authorization before treating the app as production-secure. The UI falls back to browser local storage for visual/offline exploration if no database session is configured. That fallback is not authoritative or shared between users; server API paths enforce database workflows.

## Project structure

`apparelflow-erp` is the project root. The application follows a conventional Next.js `src/` layout, with Prisma and tests at the root:

```text
apparelflow-erp/
├── prisma/                   # Schema, migrations, seed, DB preparation
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/                  # Login, role pages, API routes
│   ├── components/           # Shared React UI
│   ├── lib/                  # Prisma, auth, verification logic
│   └── types/                # Shared TypeScript types
├── tests/                    # Backend/domain tests
├── public/                   # Static assets
├── .env
├── README.md
├── AI_OPTIMIZATION_REPORT.md
├── package.json
└── tsconfig.json
```

The dashboard is implemented in `src/components/Dashboard.tsx`. Role workspaces live under `src/app/`, and API handlers are implemented directly in `src/app/api/`.

## Architecture

- `src/components/Dashboard.tsx`: responsive production dashboard and role workspaces.
- `src/lib/verification.ts`: recipe multipliers, QC statuses, fabric overage, input validation, eligibility, and state-transition rules.
- `src/lib/auth.ts`: signed 12-hour JWT session in an HTTP-only, SameSite cookie.
- `src/app/login/page.tsx`: demo role sign-in that creates the same server session used by the API.
- `src/app/dashboard`, `src/app/supervisor`, `src/app/verifier`, and `src/app/sewing`: role workspace routes.
- `src/app/api/orders`: role-scoped reads and supervisor-only batch creation.
- `src/app/api/orders/[id]/verify`: verifier-only decisions, server-loaded expected counts, strict component matching, shortage/missing-count hard stop, and atomic count/log/status write.
- `src/app/api/sewing/queue`: sewing-role-only queue with a database `status = VERIFIED` filter and guarded state transition.
- `prisma/schema.prisma`: relational recipe, component, user, order, verification item, and append-only verification log models.

The unsafe starter `/api/test` route has been removed.

The browser cannot set verifier ID, timestamp, expected quantities, audit data, or state transitions. Those derive from the verified session, stored recipe/order state, and server clock. Every state-changing route checks its allowed role and source state. An approval transaction writes component counts and verifier audit before exposing the batch as verified. Rejection requires a meaningful note. The queue query only returns `VERIFIED` batches.

## Database model

```text
User 1 ── * CuttingOrder * ── 1 Recipe 1 ── * RecipeComponent
User 1 ── * VerificationLog * ── 1 CuttingOrder
RecipeComponent 1 ── * VerificationItem * ── 1 CuttingOrder
```

The initial seed includes Casual Blouse (`REC-BL01`, 1.8 yards, 5% cap) and Crop Top (`REC-CT02`, 1.1 yards, 8% cap), including all components and piece multipliers in the challenge.

## API contract

- `POST /api/auth/demo` — issue a local signed session for a demo role; `DELETE` clears it.
- `GET /api/auth/session` — return current session identity.
- `GET /api/recipes` — list stored recipes and components.
- `GET /api/orders` — list batches permitted for the signed-in role.
- `POST /api/orders` — supervisor-only order creation; expected component quantities are derived server-side.
- `POST /api/orders/:id/verify` — verifier-only `{ decision: "APPROVED", items: [{componentId, actualQty}] }` or `{ decision: "REJECTED", rejectionNote }`. Approval with any shortage, missing component, duplicate/foreign ID, negative/decimal count, or uncounted piece returns 422.
- `POST /api/orders/:id/resubmit` — owner supervisor-only recut resubmission; resets component counts and returns a rejected batch to QC.
- `GET /api/sewing/queue` — sewing-supervisor-only query constrained to `VERIFIED` in SQL.
- `POST /api/sewing/queue` — transition one verified batch to `SEWING_STARTED`.

Verification logs store a component-by-component JSON snapshot of expected, actual, and variance values together with the verifier identity and database timestamp.

## Tests

Run the test suite with `npm test`. It covers domain calculations, count validation, transitions, API role boundaries, and the approval hard stop. The route tests mock database access, so they do not replace end-to-end tests against a separately provisioned test database.

## Current deployment and production caveats

The Vercel deployment and managed PostgreSQL database are configured. Production builds use `prisma/schema.postgresql.prisma` and the PostgreSQL migration history; local development uses SQLite. Keep production secrets in Vercel's environment settings and in ignored local env files only. Verify environment variables and deployment logs in the Vercel dashboard rather than copying credentials into source control.

The hosted demo is an evaluation deployment, not an invitation to use real personal or production manufacturing data. Demo role switching is deliberately enabled for marking and is not identity verification. Restrict access or replace the demo flow with real authentication before public or business use.
