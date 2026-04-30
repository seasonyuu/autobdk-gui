# Capability Gap Map

## Reader And Action

This map is for a future maintainer or product owner landing after the M001 baseline work. After reading it, they should be able to choose the next focused milestone without redoing the audit or confusing deferred product work with completed baseline hardening.

## Current Baseline

M001 established a safer local baseline rather than expanding product scope.

Completed baseline:

- The local quality gate passes: lint, build, TypeScript typecheck, and static contract tests.
- Renderer-facing Electron, Cookie, attendance, and approval boundaries use shared typed result and payload shapes.
- Privileged IPC handlers have a visible trusted-sender baseline and consistent unauthorized rejection behavior.
- The remote login WebView is constrained to the current login origin with popup/navigation guards and explicit remote-content isolation attributes.
- Check-in config and malformed attendance-detail failures now produce stable non-secret diagnostics.
- Verification remained non-destructive: no real retroactive sign-in submission, no confirmation-click verification, and no live Cookie or CSRF value inspection.

M001 did not claim to solve every product, security, or test gap. The sections below are follow-up candidates.

## Priority 1: User-Configurable Check-In Strategy

Problem:

The check-in analyzer still uses fixed default times for generated retroactive sign-in suggestions. That may not match different companies, schedules, time ranges, or user preferences.

Why it matters:

A technically successful approval request can still be wrong for the user if the suggested time is based on a hardcoded assumption.

Candidate milestone:

- Add a settings surface for default start/end times and strategy choices.
- Prefer existing attendance schedule data when available, with user-configured fallback values.
- Show the chosen strategy in the preview before any user-confirmed submission.
- Keep verification non-destructive by testing payload construction with fixtures, not live approval submission.

Acceptance direction:

A user can understand and adjust how suggested approval times are chosen before confirming a check-in action.

## Priority 1: Check-In History, Resumability, And Recovery

Problem:

The current check-in flow tracks progress in memory. If the app closes, a network failure occurs, or only some items succeed, there is no durable history or recovery path.

Why it matters:

Retroactive sign-in is a multi-item workflow. Users need to know what happened and whether they can safely retry without duplicate or missing submissions.

Candidate milestone:

- Persist a redacted operation record for each check-in batch.
- Track item-level status, retry count, final error category, and timestamps.
- Provide a resume/retry view that distinguishes completed, failed, and skipped items.
- Keep Cookie, CSRF, request bodies, and approval payloads out of persisted diagnostics.

Acceptance direction:

A user can close and reopen the app, inspect the last check-in batch, and decide what to retry without guessing from transient UI state.

## Priority 1: Dependency Upgrade Campaign

Problem:

The baseline audit found dependency vulnerabilities. M001 intentionally avoided a broad upgrade campaign because Electron, packaging, Vite, and transitive dependency changes need deliberate batching and verification.

Why it matters:

Security and packaging risk will remain until dependency upgrades are handled as their own controlled project.

Candidate milestone:

- Inventory outdated and vulnerable packages.
- Batch upgrades by risk: dev patches/minors first, runtime patches next, majors one at a time.
- Verify each batch with lint, build, typecheck, static tests, and package-building checks.
- Keep audit output visible when a fix is deferred because it requires a larger migration.

Acceptance direction:

The project has an auditable upgrade sequence with resolved or explicitly deferred advisories and repeatable packaging verification.

## Priority 2: Diagnostics And Support Surface

Problem:

Diagnostics are mostly console-based. M001 added stable non-secret diagnostics, but there is no user/support-facing view for recent auth, Cookie, attendance API, WebView, or check-in failures.

Why it matters:

Future users and maintainers need enough context to diagnose failures without asking for screenshots of sensitive data or raw console output.

Candidate milestone:

- Add a local diagnostics panel or exportable redacted support bundle.
- Include recent failure class, timestamp, phase, retry count, and safe origin/date information.
- Exclude Cookie values, CSRF tokens, request bodies, approval payloads, company names, and employee names unless explicitly redacted.
- Add static redaction tests before exposing diagnostics in the UI.

Acceptance direction:

A user can share a redacted diagnostic summary that explains where a flow failed without leaking session material or live account data.

## Priority 2: Safer Credential And Cookie Storage

Problem:

The app persists WebView cookies locally. M001 improved boundary typing and redaction behavior but did not move session material into OS-backed encrypted storage.

Why it matters:

Cookie storage is sensitive. A migration needs compatibility planning, failure handling, and rollback behavior; it should not be hidden inside unrelated feature work.

Candidate milestone:

- Choose an OS-appropriate secure storage approach.
- Design migration from existing local cookie persistence.
- Define fallback behavior when secure storage is unavailable or corrupted.
- Verify redaction and recovery paths without printing Cookie or CSRF values.

Acceptance direction:

Session persistence uses a safer storage strategy with clear migration and failure behavior.

## Priority 2: Full Automated Tests With Mocked External APIs

Problem:

M001 added static contract tests but did not introduce a full mocked API or Electron end-to-end test framework.

Why it matters:

Static tests protect boundaries, but they cannot fully prove analyzer/executor behavior across malformed upstream responses, duplicate approval handling, UI confirmation flows, or packaged Electron behavior.

Candidate milestone:

- Add a lightweight unit test framework for pure analyzer/executor logic.
- Mock Electron API calls and external attendance responses.
- Add tests for empty config, malformed detail responses, duplicate-submission retry behavior, and redaction constraints.
- Add Electron smoke tests only after the mocked unit layer is stable.

Acceptance direction:

A future change to check-in logic can be tested without live credentials, live attendance data, or real approval submission.

## Priority 3: Attendance Export And Reporting

Problem:

Attendance data is displayed in the app, but there is no export or reporting capability for users who need to review or share records outside the desktop UI.

Why it matters:

Once records are already loaded and visualized, export/reporting is a natural next product extension.

Candidate milestone:

- Define export formats such as CSV or a printable summary.
- Decide whether exports include raw records, normalized summaries, or anomaly-only views.
- Add redaction rules for user identity and sensitive authentication state.
- Keep export generation separate from live check-in mutation flows.

Acceptance direction:

A user can produce a useful attendance report without exposing session credentials or modifying external attendance state.

## Priority 3: CI Quality Gate Reinforcement

Problem:

Local scripts now pass, and static contract scripts exist. CI packaging should eventually run the relevant local quality gates before producing artifacts.

Why it matters:

A package artifact should not be produced from code that fails the restored local baseline.

Candidate milestone:

- Add lint, typecheck, and static contract tests to CI before packaging.
- Keep package matrix behavior unchanged until the quality gate is stable.
- Do not add fake tests; only run scripts that exist and prove real behavior.

Acceptance direction:

CI rejects changes that break the restored M001 local baseline before packaging starts.

## Explicit Non-Goals From M001

These are not done by M001 and should not be treated as complete:

- Full Electron CSP, fuses, permission policy, or comprehensive navigation allowlists.
- OS-backed encrypted Cookie or credential storage.
- Durable check-in operation history or resumability.
- User-configurable check-in strategy/settings.
- Attendance export/reporting.
- Full mocked external API tests or Electron end-to-end tests.
- Broad renderer/check-in rewrite or backend/API replacement.
- Dependency vulnerability remediation campaign.

## Verification Rules For Follow-Up Work

Follow-up milestones should preserve the M001 verification boundary:

- Do not submit real retroactive sign-in requests during automated verification.
- Do not click a real check-in confirmation path as a test.
- Do not log or persist Cookie values, CSRF tokens, full request bodies, approval payloads, company names, or employee names in diagnostics.
- Prefer fixture-based, mocked, or static verification for approval payloads and external attendance API behavior.
- Keep lint, build, typecheck, and static contract tests green before claiming completion.
