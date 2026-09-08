# Meridian Milestone 1 implementation plan

## Overview

Milestone 1 establishes the local TypeScript workspace, isolated PostgreSQL test environment, Prisma schema, public readiness endpoint and local Caddy routing. The work implements the prerequisites for Milestones 2–4; it does not add authentication, seed data, business rules, Client APIs or deployment automation.

## Architecture decisions

- npm workspaces contain `frontend/` (Next.js) and `backend/` (Express/Prisma) and share the root lockfile and quality commands.
- Next.js and Express run natively on the developer machine. Compose supplies PostgreSQL, an isolated test PostgreSQL profile, and an optional Caddy profile.
- Financial profile values remain nullable and allow zero so later incomplete-data scenarios are representable. Database checks prevent negative values; valid persisted Goals require a positive target and `targetDate > startDate`.
- A `family_relationships` row always uses lexical UUID order. `PARENT` and `CHILD` invert when order is normalized; `SPOUSE` and `SIBLING` do not.
- `/health` checks PostgreSQL with a two-second bound. Dependency failures become a generic `503` error envelope; application failures remain `500`.

## Dependency order

```text
M1-001 → M1-002 → M1-004 → M1-005 → M1-006 → M1-007 → M1-008
       └→ M1-003 ────────────────────────────────────────┴→ M1-009 → M1-010
```

## Checkpoints

- Checkpoint A (M1-001–003): workspace lint/typecheck, backend unit tests, frontend component test and both builds pass.
- Checkpoint B (M1-004–006): Docker starts PostgreSQL and committed migrations apply to an empty database.
- Checkpoint C (M1-007–009): isolated test database migration, health readiness transitions and Caddy routing are verified through live services.

## Current risk and mitigation

| Risk | Status | Mitigation |
|---|---|---|
| Caddy default port 8080 is blocked on this Windows host | Default local origin cannot start here | Set `CADDY_PORT=8081` in `.env`; the same Compose service was verified on that port |
| Prisma migration/schema diff with a disposable shadow database was not run | Both committed migrations applied to clean development and test databases and integration constraints pass | Run `prisma migrate diff` with a shadow database before changing migration history |
| Prisma CLI dependency audit reports one high-severity advisory with three affected package records | Does not block scaffold tests, but must be resolved before a security-gated deployment | Reassess a compatible Prisma upgrade in M6; do not use audit-force during foundation work |

## Definition of done for this milestone

The technical exit criteria have passing evidence: `npm ci`, lint, typecheck, unit tests, build, migrations against development/test databases, repeated integration tests, health recovery and Caddy route checks. M1-010 remains open until this working tree has its own commit SHA and the evidence is associated with it.
