# Changelog

All notable changes to the Freight Management Platform.

## Unreleased

### Fixed

- **Bug #9** — `PATCH /api/organizations/[id]` returned HTTP 500 when an
  organization settings form left **License Number** or **Tax ID** blank.
  Both fields are `@unique` in Prisma, so an empty-string update collided
  with other rows that also had `""`, raising a `P2002` constraint violation
  that surfaced as `Internal server error`. The org settings form was
  effectively unsavable for any user who hadn't filled both fields.

  **Lifetime in production**: ~3.5 months (introduced 2025-12-24 in commit
  `49634c8`, fixed 2026-04-07 in commit `33da950`).

  **Fix**: Added a Zod transform on both fields that coerces `""` to
  `undefined` before the update, so empty inputs are simply skipped on
  PATCH instead of being written.

  **Regression test**: `__tests__/api/regression/bug-9-and-10.test.ts`
  (3 cases) plus the e2e mobile shipper company-edit flow (`SXP3-1`).

- **Bug #10** — Admin could not cancel trips stuck in `EXCEPTION` state.
  The `/admin/trips/[id]` UI's Cancel button silently failed because the
  handler sent `{status:"CANCELLED"}` without `cancelReason`, but the API
  enforces `cancelReason is required when cancelling a trip` (Blueprint
  v1.6 §7 audit field). The 400 error was swallowed by the React component's
  state and never shown to the admin. Trips in `EXCEPTION` could only be
  cleared by direct database access.

  **Lifetime in production**: ~1 month (introduced 2026-03-09 in commit
  `caf91ef`, fixed 2026-04-07 in commit `335cee6`).

  **Fix**: The admin handler now prompts for a cancellation reason via
  `window.prompt()` before submitting and includes it in the PATCH body.

  **Regression test**: `__tests__/api/regression/bug-9-and-10.test.ts`
  (2 cases) plus the e2e admin flow (`AF-4`).

  **Production cleanup**: Run `scripts/cleanup-stuck-exception-trips.ts`
  after deploying this fix to walk any pre-existing stuck `EXCEPTION` trips
  through to `CANCELLED` with the audit reason
  `Backfill: Bug #10 cleanup`.

### Test infrastructure

- Added `npm run test:e2e:functional` script and
  `.github/workflows/e2e-functional.yml` GitHub Actions workflow that runs
  the 47 web functional UI→DB regression tests on every PR to `main` and
  `develop`. Mobile-expo tests run locally only for now.
- `playwright.config.ts` now uses `headless` + `retries: 2` + zero `slowMo`
  when `process.env.CI` is set.
- New `.github/PULL_REQUEST_TEMPLATE.md` with a checkbox reminding
  contributors to run `npm run test:e2e:functional` if they touch a UI flow
  covered by `e2e/**/deep-*-functional.spec.ts`.
