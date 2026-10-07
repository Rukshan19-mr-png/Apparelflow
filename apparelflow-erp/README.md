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

## Demo personas

The sidebar role switcher demonstrates all three personas. It requests a signed, HTTP-only demo session from `POST /api/auth/demo` when the API is available. Demo accounts are seeded with these identities:

| Role | Demo identity | Permission summary |
|---|---|---|
| Cutting Supervisor | `alex@demo.apparelflow.test` | Create cutting orders; inspect own orders; cannot verify or access sewing queue. |
| Cutting Verifier | `maya@demo.apparelflow.test` | Count, approve, or reject pending batches; cannot create orders or access sewing queue. |
| Sewing Supervisor | `jordan@demo.apparelflow.test` | View verified queue and start assembly; cannot access unverified batches. |

The demo endpoint is intentionally a role selector for local evaluation, not a production identity provider. Replace it with a real credential-backed sign-in flow before a public deployment. The UI falls back to browser local storage for visual/offline exploration if no database session is configured. That fallback is not authoritative or shared between users; the server API paths enforce the database workflow.

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

Run the pure domain suite with `npm test`. It covers multiplication, exact-match approval eligibility, shortages, missing/invalid counts, defensive order validation, allowed state transitions, surplus counts, and fabric overage. Endpoint RBAC and database isolation are encoded in handlers; add integration coverage against a configured database before production deployment.

## Remaining deployment setup

The repository has no cloud credentials or hosted database configured. To publish the required live URL, provision managed SQL and hosting, set `DATABASE_URL` and `AUTH_SECRET`, configure the compatible provider and adapter, then run migrations and seed. Production login must be wired to an identity provider and demo role switching disabled. These external accounts and credentials are not present in this workspace.

This workspace has a working local SQLite database and the application has been checked with the included build, lint, domain tests, and API workflow. A live deployment still requires a hosting account, production database, and production identity provider.
