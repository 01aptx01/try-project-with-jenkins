# Meridian Milestone 2 Implementation Plan: Financial Rules and Boundaries

## Overview

Milestone 2 delivers deterministic pure functions for Financial Health Score, Goal Progress, Primary Goal selection, Next Best Action (NBA) recommendation with rule explainability, templated Thai Client Summary, and priority comparison. All functions are pure, testable without database or network connections, and take an explicit UTC date (`asOfDate`).

Milestone 2 covers FR-07, FR-08, FR-09, FR-10, FR-12, NFR-05, and NFR-07, as well as the calculation components of BR-09 and BR-10. Authentication, authorization, database queries, pagination, seed data, UI, deployment gates (BR-07), and Prisma CLI advisories belong to other milestones.

## Architecture Decisions & Calculation Conventions

- **Pure Domain Boundary:** All domain logic resides in `backend/src/domain/financial/` with tests in `backend/tests/unit/financial/`. Code must never import Express, `@prisma/client`, or read runtime environment variables/clock.
- **Explicit UTC Evaluation Date:** Functions take `asOfDate` formatted as `YYYY-MM-DD`. Dates are validated against the actual Gregorian calendar (including leap years); invalid dates like `2026-02-30` are rejected as errors.
- **Precision and Money Primitives:** Currency inputs are accepted as decimal strings consistent with `Decimal(18,2)`. Calculations use integer satang (100 satang = 1 unit) and exact rational ratios to prevent floating-point inaccuracies at boundaries (`0`, `0.01`, etc.).
- **Rounding Rules:** Only the final Goals component score is rounded half-up to 2 decimal places before summing. Message formatting does not alter calculation outcomes.
- **Incomplete vs Invalid Data:** Missing or non-positive financial parameters yield `INSUFFICIENT_DATA` with explanatory `missingFields` without re-normalizing weights. Invalid `asOfDate` or code errors throw exceptions.
- **Serialized Output:** Public outputs use camelCase, numeric scores (`number | null`), decimal strings for currency, and no BigInt types.
- **Language Convention:** Summaries and rule explanations are in Thai, while action names and enum identifiers remain in English as specified in the business rules.

## Dependency Order

```text
M2-001 → M2-002 → M2-003 ───────┐
               └→ M2-004 → M2-005 ┴→ M2-007 → M2-008 → M2-009 → M2-010
                       └→ M2-006 ─┘
```

- M2-005 depends on both M2-003 and M2-004.
- M2-006 depends on M2-004.
- M2-007 depends on M2-005 and M2-006.

## Checkpoints

- **Checkpoint A (M2-001–003):** Contracts and primitives ready; 4 financial component scores pass table-driven boundary tests without database.
- **Checkpoint B (M2-004–006):** Consistent Health and Primary Goal results, covering incomplete data, negative/invalid goals, and pre-start dates.
- **Checkpoint C (M2-007–009):** Unified `evaluateClient` entrypoint produces matching Health/NBA/Summary with deterministic priority comparison ready for M3.

## Navigation & Tracking

- Task checklist: [todo.md](todo.md)
- Milestone 1 plan: [tasks/milestone-1/plan.md](../milestone-1/plan.md)
- Milestone 1 tickets: [tasks/milestone-1/todo.md](../milestone-1/todo.md)
- Milestone 3 plan: [tasks/milestone-3/plan.md](../milestone-3/plan.md)
- Milestone 3 tickets: [tasks/milestone-3/todo.md](../milestone-3/todo.md)

