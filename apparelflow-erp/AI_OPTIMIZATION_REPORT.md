# AI Optimization Report

## 1. Tools & Prompting

An AI coding assistant in VS Code was used to inspect the existing ApparelFlow ERP repository, help implement and refine the dashboard, domain rules, API handlers, tests, and deployment documentation. Generated suggestions were checked against the repository, existing Prisma/Next.js versions, and the required manufacturing workflow; linting, type-checking, tests, builds, and live role/workflow checks were used as verification. This report describes the project state at the time of writing; it does not claim AI output was accepted without review.

## 2. Flawed / Broken AI Code

The starter repository contained an unguarded diagnostic route that exposed user records and stack traces. That route was removed rather than reusing it as a diagnostic endpoint.

The original approval helper alone could not protect the workflow: a caller could submit arbitrary component rows or client-provided identities if a route trusted the request. The implementation was hardened so the verifier role and user ID come from a signed HTTP-only session, expected quantities and component membership come from the stored order, and approval writes are transactional. The client also cannot set status, verifier attribution, or audit time.

The starter app included dark-mode defaults and generic framework form styles. Those defaults can make controls difficult to read on light production surfaces. The replacement explicitly styles input, select, textarea, focus, placeholder, and dropdown option colors and uses visible focus rings.

## 3. Human Refactoring

Domain behavior is implemented as pure helpers in `src/lib/verification.ts`, keeping count evaluation testable without rendering the UI. Request validation rejects string coercion, fractional counts, negative values, absent components, duplicate IDs, invalid transitions, and empty rejection reasons. The approval handler re-reads stored order data and updates component rows, audit log, and status in one transaction. The queue handler filters `VERIFIED` at the database query and uses a conditional update to prevent stale state transitions.

The repository uses Prisma ORM 7, whose SQL clients require driver adapters. The SQLite runtime adapter and URL are configured explicitly, and a relational migration and idempotent seed script are included. Recipe/component seed IDs match the UI catalog, rejected batches can be resubmitted by their owning supervisor, and approval logs snapshot per-component variance. The web screen has a localStorage preview path for offline visual exploration, but database/API mode is distinct and server handlers remain the authority.

## 4. Defensive Architecture

Every mutating API verifies the signed session, then checks the role and legal source state. Supervisors create pending orders only; verifiers can approve/reject only pending orders; sewing supervisors see verified queue rows and can start only verified batches. The API ignores client-supplied verifier IDs and timestamps. Component counts are bound to stored recipe component IDs and expected counts; any absent, invalid, or short count returns 422. Rejection requires a reason. Audit events record verifier identity, server timestamp, decision, reason, and fabric overage; component quantities and green/yellow statuses are persisted with the same approval transaction. Queue reads apply `WHERE status = 'VERIFIED'` in the database.

The application is deployed at [apparelflow-erp-sigma.vercel.app](https://apparelflow-erp-sigma.vercel.app) and uses the PostgreSQL schema in production; local development uses SQLite. The demo role selector remains enabled for evaluation. It permits choosing any demo persona without authenticating that person's identity, so it is not a production identity provider and must be replaced or access-restricted before handling sensitive or real business data.

Automated coverage includes pure domain tests plus route-level tests for unauthenticated/incorrect-role requests and the server-side shortage approval gate. Route-level tests mock Prisma, so database behavior should additionally be exercised with an isolated test database for high-assurance changes. A live evaluation workflow was checked by creating a demo order, confirming a shortage is rejected, approving valid counts, and releasing the verified order to sewing.
