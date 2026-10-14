# Requirements: Training Sessions Workspace

- Task ID: `training-sessions`
- Source: `frontend-accelerator-onboarding/TASK.md`
- Status: Confirmed
- Author role: `requirements-analyst`

## Goal

A trainer opens a small workspace, sees training sessions loaded from a mock
API, narrows the list by one status, and creates a new session (title + future
date/time) that then appears in the list.

## Repository Facts (observed)

| Area | Fact | Evidence |
| --- | --- | --- |
| Application root | Repository root (single frontend app) | `package.json`, `src/`, `index.html` |
| Framework | React 19 + TypeScript 5.8 (`strict: true`) on Vite 7 | `package.json`, `tsconfig.app.json` |
| Package manager | npm | `package-lock.json` |
| Scripts | `dev`, `build`, `lint`, `preview`, `test` (`vitest run`), `test:watch` | `package.json` |
| Test stack | Vitest 3 + jsdom + Testing Library (react, dom, user-event, jest-dom) | `vite.config.ts`, `src/test/setup.ts` |
| Current UI | Unmodified Vite starter (`src/App.tsx` counter demo) | `src/App.tsx` |
| HTTP client | None — no `fetch` wrapper, axios, or API module exists | grep of `src/` |
| Mock mechanism | None — no MSW, `mockServiceWorker.js`, json-server, or fixtures | `package.json`, `public/`, grep of `src/` |
| Routing / state libs | None installed | `package.json` |
| Project rulesets | `rulesets/project/` contains only the placeholder README | `rulesets/project/README.md` |

Consequence: per TASK.md, because no mock mechanism exists, MSW or another
conventional HTTP mock is acceptable. Choosing one is an implementation
decision (see Open Questions / Decisions).

## In Scope

1. Sessions list loaded through a replaceable request boundary backed by a mock.
2. Status filter with an `All` option.
3. Create-session form (title + date/time) with validation.
4. Newly created session shown in the list.
5. At least one behavior-level automated test of the main flow.
6. One manual browser run of list → filter → create, with recorded observation.

## Non-Goals (from TASK.md "Explicitly Optional" and Constraints)

- Session details, drawers, deep links, routing.
- Search, multiple filters, sorting controls, pagination.
- Editing or deleting sessions.
- Real backend service, full API contract, or scenario matrix.
- Persistence across page reloads beyond what the mock provides.
- Exhaustive responsive / accessibility validation, screenshot sets.
- Full test coverage, CI, deployment, public URL.
- Refactoring or reconfiguring unrelated code (lint, tsconfig, Vite config)
  beyond what the mock/test setup strictly requires.

## Acceptance Criteria

### AC-1 Load sessions

- AC-1.1 On opening the app, a request for sessions is issued through the
  request boundary (not by importing mock data directly into UI components).
- AC-1.2 While the request is pending, a visible loading indicator/text is
  shown and the list is not shown.
- AC-1.3 On success, each session shows its **title**, **status**, and
  **start date/time** in a human-readable format.
- AC-1.4 On success with zero sessions, the user sees a non-broken result
  (e.g. a short "No sessions" message) rather than a blank area. *(Assumption
  A-6.)*

### AC-2 Request error (list)

- AC-2.1 If the list request fails, one understandable error message is shown
  instead of the list.
- AC-2.2 The error is recoverable: the user can retry from the UI (e.g. a
  "Retry" button) without reloading the page, and a successful retry shows the
  list.

### AC-3 Filter by status

- AC-3.1 A filter control offers `All` plus status option(s) (see Q-1).
- AC-3.2 `All` is selected by default and shows every loaded session.
- AC-3.3 Selecting a status shows only sessions with that status; selecting
  `All` again restores the full list.
- AC-3.4 If no sessions match the selected status, an empty-result message is
  shown. *(Assumption A-6.)*

### AC-4 Open create form

- AC-4.1 The user can open a create form from the workspace via a visible
  control.
- AC-4.2 The form contains a title input and a date/time input, each with an
  accessible label, plus a submit control.

### AC-5 Validation

- AC-5.1 Title is trimmed before validation and submission; a trimmed length
  < 3 or > 80 is rejected.
- AC-5.2 Date/time is required and must be later than the current moment at
  submission time; past or empty values are rejected.
- AC-5.3 Rejected input shows a useful message tied to the offending field
  (e.g. "Title must be 3–80 characters", "Choose a date and time in the
  future") and no create request is sent.
- AC-5.4 The submitted title is the trimmed value.

### AC-6 Submit and duplicate prevention

- AC-6.1 A valid submission sends one create request through the request
  boundary.
- AC-6.2 While the create request is pending, the submit control is disabled
  (or otherwise inert) so repeated clicks / Enter presses do not send
  additional requests; a pending indication is visible.
- AC-6.3 If the create request fails, an understandable error is shown, the
  entered values are kept, and the user can submit again. *(Assumption A-5.)*

### AC-7 Created session appears

- AC-7.1 After a successful create, the session returned by the mock API
  appears in the visible list with its title, status, and start date/time —
  without a full page reload.
- AC-7.2 After success the form is closed or reset. *(Assumption A-7.)*
- AC-7.3 After a successful create, the status filter resets to `All`, so the
  new session is always visible regardless of the previously selected filter.
  *(Q-3.)*

### AC-8 Mock boundary

- AC-8.1 All session data access (list and create) goes through a single,
  replaceable HTTP client / request module; swapping the mock for a real API
  must not require changes in UI components.
- AC-8.2 Mock data and handlers live outside UI components and are served
  through an HTTP-level mock (MSW or equivalent) or an equivalent replaceable
  boundary.
- AC-8.3 The mock can produce a list failure so AC-2 is demonstrable
  (in tests at minimum; see Q-5 for in-browser).
- AC-8.4 No backend service is implemented.

### AC-9 Automated test

- AC-9.1 At least one behavior-level test (Testing Library, user-visible
  queries) covers the main flow: filtering **or** successful creation
  appearing in the list.
- AC-9.2 `npm test` passes.

### AC-10 Manual check

- AC-10.1 `npm run dev` starts the app.
- AC-10.2 The list, filter, and create flow is exercised once in a browser and
  the actual observation is recorded (not claimed without performing it).

## Assumptions (to be confirmed or overridden)

- A-1 Single user, no authentication or permissions.
- A-2 Session model minimum: `id`, `title`, `status`, `startsAt`
  (ISO 8601 string). No other fields are required.
- A-3 Date/time is entered and displayed in the browser's local time zone;
  transmitted as ISO 8601.
- A-4 New sessions receive a default status assigned by the mock API
  (e.g. `scheduled`); the form does not let the user choose status.
- A-5 Create-request failure handling (AC-6.3) is implied by "useful" behavior
  even though TASK.md only mandates a list error state; one simple message is
  enough.
- A-6 Empty list / empty filter result messages are minimal and not required
  by TASK.md beyond avoiding a broken UI.
- A-7 The form may be inline or a dialog; either satisfies "open a create
  form". Closing/resetting after success is assumed.
- A-8 List order: as returned by the mock; no sorting requirement. New session
  placement (top, bottom, or chronological) is not specified.
- A-9 Mock data is in-memory: created sessions persist for the browser
  session/test only and reset on reload.
- A-10 UI is English-only; no localization.
- A-11 Plain, minimal styling is acceptable; the Vite starter content may be
  replaced in `App.tsx`.

## Open Questions

All open questions are resolved by the developer.

| ID | Question | Resolution |
| --- | --- | --- |
| Q-1 | Which statuses exist, and how does the filter work? | Accepted default: one single-select control with `All`, `Scheduled`, `Completed`, `Cancelled`. |
| Q-2 | What status does a newly created session get? | Accepted default: `scheduled`, assigned by the mock. |
| Q-3 | How does a new session interact with an active filter? | Override: after a successful create, the filter resets to `All` so the new session is always visible (AC-7.3). |
| Q-4 | Which mock mechanism? | MSW. Setup details (handlers, browser worker, test server) are defined in the plan. |
| Q-5 | Should the list error be triggerable in the browser? | No. Tests only. |
| Q-6 | Should the mock add artificial latency? | Yes, about 500 ms in mock handlers. |
| Q-7 | Where is "future date/time" checked? | Client side, at submit time only. The mock does not validate it. |
| Q-8 | Artifact location? | Confirmed: `tasks/training-sessions/`. |

## Gaps and Owning Specialists

- Mock/HTTP boundary shape and MSW vs alternative (Q-4): `architect` decision,
  or resolvable inside `writing-plans` given the small scope.
- Request/response shape for `GET`/`POST` sessions: provisional, owned by
  `api-integration` if a contract is wanted; TASK.md says a complete contract
  is optional, so a minimal shape in the plan is sufficient.
- Visual direction: none required; `ui-designer` not needed.

## Readiness

Ready for `writing-plans`.
