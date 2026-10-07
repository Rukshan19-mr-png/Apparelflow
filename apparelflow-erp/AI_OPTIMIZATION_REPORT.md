# AI Optimization Report

## 1. Tools & Prompting

OpenAI Codex was used as an AI coding assistant in this implementation session to inspect the challenge brief and repository, draft the production dashboard, and help implement domain rules, API handlers, database setup, seed data, and documentation. The task prompt was to complete the ApparelFlow ERP practical challenge in the existing Next.js project. The PDF brief and existing source were used as inputs. No other AI tool was used in this session.

## 2. Flawed / Broken AI Code

The original repository contained an unguarded `GET /api/test` that instantiated a fresh Prisma client, returned every user (including password hashes), and exposed stack traces on failure. It was unsafe to expose; the route has been removed.

The original approval helper alone could not protect the workflow: a caller could submit arbitrary component rows or client-provided identities if a route trusted the request. The implementation was hardened so the verifier role and user ID come from a signed HTTP-only session, expected quantities and component membership come from the stored order, and approval writes are transactional. The client also cannot set status, verifier attribution, or audit time.

The original `/api/test` route exposes all user records (including password hashes) and raw exception details. It must not be used as an application diagnostic endpoint; remove it before production.

The starter app included dark-mode defaults and generic framework form styles. Those defaults can make controls difficult to read on light production surfaces. The replacement explicitly styles input, select, textarea, focus, placeholder, and dropdown option colors and uses visible focus rings.

## 3. Human Refactoring

Domain behavior was separated into pure helpers in `lib/engine.ts`, keeping count evaluation testable without rendering the UI. Request validation rejects string coercion, fractional counts, negative values, absent components, duplicate IDs, invalid transitions, and empty rejection reasons. The approval handler re-reads stored order data and updates component rows, audit log, and status in one transaction. The queue handler filters `VERIFIED` at the database query and uses a conditional update to prevent stale state transitions.

The repository uses Prisma ORM 7, whose SQL clients require driver adapters. The SQLite runtime adapter and URL are configured explicitly, and a relational migration and idempotent seed script are included. Recipe/component seed IDs match the UI catalog, rejected batches can be resubmitted by their owning supervisor, and approval logs snapshot per-component variance. The web screen has a localStorage preview path for offline visual exploration, but database/API mode is distinct and server handlers remain the authority.

## 4. Defensive Architecture

Every mutating API verifies the signed session, then checks the role and legal source state. Supervisors create pending orders only; verifiers can approve/reject only pending orders; sewing supervisors see verified queue rows and can start only verified batches. The API ignores client-supplied verifier IDs and timestamps. Component counts are bound to stored recipe component IDs and expected counts; any absent, invalid, or short count returns 422. Rejection requires a reason. Audit events record verifier identity, server timestamp, decision, reason, and fabric overage; component quantities and green/yellow statuses are persisted with the same approval transaction. Queue reads apply `WHERE status = 'VERIFIED'` in the database.

The challenge asks for a deployed production service. This workspace has no cloud account, managed database, deployment token, or production identity-provider configuration. The code supplies the application and deployment setup instructions but does not claim a live URL, production authentication, endpoint integration tests, or production readiness. The role-switch endpoint is explicitly a local evaluation mechanism and must be replaced or disabled before public deployment.
