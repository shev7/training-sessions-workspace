# Implementation Plan: Training Sessions Workspace

- Task ID: `training-sessions`
- Input: `tasks/training-sessions/requirements.md` (Status: Confirmed)
- Author role: `writing-plans`
- Status: Draft, ready for developer review
- Application root: repository root (`package.json`, `src/`, `index.html`)

## 1. Context and Constraints

Observed repository state (read for this plan):

| Area | Fact | Evidence |
| --- | --- | --- |
| UI | Vite starter counter, `export default App` | `src/App.tsx` |
| Entry | `createRoot(document.getElementById('root')!)`, default import of `App` | `src/main.tsx` |
| Tests | Vitest 3, `environment: "jsdom"`, `setupFiles: ["./src/test/setup.ts"]`, **no `globals: true`** | `vite.config.ts` |
| Test setup | Only `import "@testing-library/jest-dom/vitest";` | `src/test/setup.ts` |
| TS | `strict`, `noUnusedLocals`, `noUnusedParameters`, **`erasableSyntaxOnly`**, `verbatimModuleSyntax`; `src` included in `tsconfig.app.json` (tests are type-checked by `tsc -b`) | `tsconfig.app.json` |
| Lint | flat config for `**/*.{ts,tsx}`: js recommended, typescript-eslint recommended, react-hooks `recommended-latest`, `react-refresh` vite | `eslint.config.js` |
| Deps | Only `react`, `react-dom` at runtime; no HTTP client, no data library, no schema library, no MSW | `package.json` |
| Project rules | Placeholder only | `rulesets/project/README.md` |

Applied rules: `rulesets/common/coder/*`, `rulesets/common/api-integration/rules/client-behavior.md`,
`rulesets/common/architect/rules/*`, `rulesets/framework/coder/INDEX.md`
(conditional rendering, early exit, derived state, functional setState),
`rulesets/framework/test-generator/rules/react-behavior-testing.md`, user
global code style (arrow functions, named exports, double quotes, semicolons,
80 columns, 2-space indent, blank lines around `if`/loops/`return`/function
definitions, single object argument for > 3 params, `type` over `interface`,
no `any`, no `as` except `as const`, no `!`, discriminated unions for states).

Out of scope (unchanged from requirements): routing, details, search,
sorting, pagination, multiple filters, edit/delete, real backend, persistence
beyond in-memory mock, CI, browser-triggerable list error.

## 2. Dependency and Generated-File Changes

Requires developer approval before execution (dependency + generated file).

| Change | Command | Result |
| --- | --- | --- |
| Add MSW v2 as dev dependency | `npm install --save-dev msw@^2` | `package.json` `devDependencies.msw`, `package-lock.json` updated |
| Generate service worker | `npx msw init public/ --save` | Creates `public/mockServiceWorker.js`; adds `"msw": { "workerDirectory": ["public"] }` to `package.json` |

No other dependency is added (no axios, no TanStack Query, no Zod). See
risks R-3 and R-4.

No changes to `vite.config.ts`, `tsconfig*.json`, or `eslint.config.js` are
planned. See R-6 for the only conditional config touch.

## 3. Target File Layout

```text
public/
  mockServiceWorker.js                 (generated, AC-8.2)
src/
  main.tsx                             (change: enable mocking before render)
  App.tsx                              (rewrite: named export, renders workspace)
  App.css                              (rewrite: minimal styles)
  App.test.tsx                         (new: behavior tests, AC-9)
  assets/react.svg                     (delete: unused after rewrite)
  test/setup.ts                        (change: MSW server lifecycle + cleanup)
  shared/api/
    httpClient.ts                      (new: fetch wrapper, HttpError)
  features/sessions/
    model/session.ts                   (new: types, statuses, labels, guards)
    model/validateSessionForm.ts       (new: pure validation)
    model/validateSessionForm.test.ts  (new: unit boundary tests)
    model/formatStartsAt.ts            (new: date display)
    model/toStartsAtIso.ts             (new: datetime-local -> ISO)
    api/sessionsApi.ts                 (new: GET/POST /api/sessions)
    hooks/useSessions.ts               (new: list remote state + retry)
    hooks/useCreateSessionForm.ts      (new: form state, submit, pending)
    components/SessionsWorkspace.tsx   (new: composition + filter state)
    components/SessionStatusFilter.tsx (new)
    components/SessionsPanel.tsx       (new: loading/error/empty/list)
    components/SessionList.tsx         (new)
    components/CreateSessionForm.tsx   (new)
  mocks/
    sessionsSeed.ts                    (new: seed data)
    sessionsStore.ts                   (new: in-memory store)
    handlers.ts                        (new: createSessionHandlers)
    browser.ts                         (new: setupWorker, dev only)
    server.ts                          (new: setupServer, tests only)
```

Dependency direction: `components -> hooks -> api -> shared/api/httpClient`;
`components/hooks/api -> model`. UI never imports from `src/mocks/`.
`src/mocks/` may import `model/session.ts` types and guards only.

## 4. Domain Model (`src/features/sessions/model/session.ts`)

```ts
export const SESSION_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export type Session = {
  id: string;
  title: string;
  status: SessionStatus;
  startsAt: string; // ISO 8601
};

export type CreateSessionInput = Pick<Session, "title" | "startsAt">;

export type StatusFilterValue = SessionStatus | "all";

export const STATUS_LABELS: Record<SessionStatus, string> = { ... };
// scheduled -> "Scheduled", completed -> "Completed", cancelled -> "Cancelled"
```

Type guards (no `as`): `isSessionStatus(value: unknown)`,
`isSession(value: unknown)`, `isSessionList(value: unknown)`,
`isCreateSessionInput(value: unknown)`. Each is a small arrow function using
`typeof` checks and `SESSION_STATUSES.some(...)` / `includes` narrowing.
`enum` is not used because `erasableSyntaxOnly` rejects it (R-5).

## 5. Request Boundary (AC-1.1, AC-8.1)

### 5.1 `src/shared/api/httpClient.ts`

- `export class HttpError extends Error` with `status: number` (assigned in the
  constructor body, not a parameter property, because of
  `erasableSyntaxOnly`).
- `buildUrl(path: string): string` returns
  `new URL(path, window.location.origin).toString()` so the same code works in
  the browser and in jsdom (R-2).
- `export const requestJson = async (path: string, init?: RequestInit):
  Promise<unknown>`:
  - calls `fetch(buildUrl(path), { ...init, headers: { "Content-Type":
    "application/json", ...init?.headers } })`;
  - early-throws `new HttpError(response.status)` when `!response.ok`;
  - returns `await response.json()` typed as `unknown`.
- Network errors (`TypeError` from `fetch`) and `AbortError` propagate
  unchanged; callers decide.

### 5.2 `src/features/sessions/api/sessionsApi.ts`

- `SESSIONS_PATH = "/api/sessions"` (module-private constant).
- `export const fetchSessions = async (signal?: AbortSignal):
  Promise<Session[]>` – GET, validates with `isSessionList`, throws
  `new Error("Malformed sessions response")` otherwise.
- `export const createSession = async (input: CreateSessionInput):
  Promise<Session>` – POST with `JSON.stringify(input)`, validates with
  `isSession`, throws `Error` on malformed data.

### 5.3 Minimal HTTP shapes

| Request | Body | Success | Failure |
| --- | --- | --- | --- |
| `GET /api/sessions` | none | `200`, `Session[]` | any non-2xx, body `{ "message": string }` (not shown to user) |
| `POST /api/sessions` | `{ "title": string, "startsAt": string }` (trimmed title, ISO 8601 UTC) | `201`, `Session` with mock-assigned `id` and `status: "scheduled"` | `400` `{ "message": "Invalid session" }` if body fails `isCreateSessionInput`; any non-2xx |

The mock does not validate future dates (Q-7). UI shows fixed copy for every
failure; server messages are never rendered.

## 6. MSW Mock (AC-8.2, AC-8.3, AC-8.4)

### 6.1 `src/mocks/sessionsSeed.ts`

`export const SESSIONS_SEED: readonly Session[]` with four fixed sessions,
all statuses represented:

| id | title | status | startsAt |
| --- | --- | --- | --- |
| `session-1` | Morning Yoga | scheduled | 2026-11-02T07:30:00.000Z |
| `session-2` | Strength Basics | completed | 2026-09-15T16:00:00.000Z |
| `session-3` | HIIT Express | cancelled | 2026-10-01T12:00:00.000Z |
| `session-4` | Mobility Flow | scheduled | 2026-11-10T18:00:00.000Z |

### 6.2 `src/mocks/sessionsStore.ts`

Module-level in-memory store (A-9):

- `listSessions(): Session[]` – returns a copy.
- `insertSession(input: CreateSessionInput): Session` – builds
  `{ id: \`session-${nextId}\`, status: "scheduled", ...input }`, appends,
  increments counter (deterministic ids, no `crypto.randomUUID`).
- `resetSessionsStore(): void` – restores seed and counter (called in tests).

### 6.3 `src/mocks/handlers.ts`

```ts
type HandlerOptions = { delayMs: number };
export const createSessionHandlers = ({ delayMs }: HandlerOptions) => [
  http.get("/api/sessions", async () => { ... }),
  http.post("/api/sessions", async ({ request }) => { ... }),
];
export const MOCK_DELAY_MS = 500;
```

- GET: `await delay(delayMs)`, `HttpResponse.json(listSessions())`.
- POST: `await delay(delayMs)`, `const body: unknown = await request.json()`,
  early-return `HttpResponse.json({ message: "Invalid session" }, { status:
  400 })` when `!isCreateSessionInput(body)`, else
  `HttpResponse.json(insertSession(body), { status: 201 })`.
- No error-producing handler ships in the browser set (Q-5).

### 6.4 Browser: `src/mocks/browser.ts` + `src/main.tsx`

- `browser.ts`: `export const worker = setupWorker(...createSessionHandlers({
  delayMs: MOCK_DELAY_MS }));`
- `main.tsx` (rewritten in user style):
  - `enableMocking = async (): Promise<void>` – early-return when
    `!import.meta.env.DEV`; otherwise `const { worker } = await
    import("./mocks/browser");` and `await worker.start({
    onUnhandledRequest: "bypass" });` (bypass so Vite HMR/asset requests are
    not warned about).
  - `renderApp = (): void` – reads `document.getElementById("root")`;
    early-throws `new Error("Root element #root not found")` if null (no `!`).
  - Top level: `enableMocking().then(renderApp);` – the worker is ready before
    the first `GET /api/sessions`.
  - Import becomes `import { App } from "./App";`.
- Dynamic import keeps MSW out of the production bundle; production/preview
  has no API (R-7).

### 6.5 Tests: `src/mocks/server.ts` + `src/test/setup.ts`

- `server.ts`: `export const server = setupServer(...createSessionHandlers({
  delayMs: 0 }));` – the 500 ms delay is **avoided** in tests by injecting
  `delayMs: 0`; no env checks inside handlers, no fake timers.
- `setup.ts` (imports `afterAll`, `afterEach`, `beforeAll` from `vitest`,
  since `globals` is off):

  ```ts
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    cleanup();                      // RTL auto-cleanup needs globals; add it
    server.resetHandlers();         // drop per-test overrides
    server.events.removeAllListeners();
    resetSessionsStore();           // isolate created sessions
  });
  afterAll(() => server.close());
  ```

- Per-test overrides use `server.use(...)` with MSW `http` / `HttpResponse`:
  - List failure once (AC-2, AC-8.3):
    `server.use(http.get("/api/sessions", () => HttpResponse.json({ message:
    "Boom" }, { status: 500 }), { once: true }))` – first GET fails, retry hits
    the default handler and succeeds.
  - Empty list: `http.get(..., () => HttpResponse.json([]))`.
  - Create failure once: `http.post(..., () => HttpResponse.json(..., {
    status: 500 }), { once: true })`.
  - Pending create (AC-6.2): an override that awaits a test-controlled
    deferred promise (`Promise.withResolvers` is ES2024 and not in `lib`;
    use a small local `createDeferred` helper inside the test file), then
    inserts via `insertSession` and returns 201.
  - Request observation: `server.events.on("request:start", ({ request }) =>
    ...)` collects `method` and `await request.clone().json()` for POSTs, to
    assert request count and trimmed body without mocking the API module.

## 7. State and Hooks

### 7.1 `useSessions` (`hooks/useSessions.ts`) – AC-1, AC-2, AC-7.1

```ts
type SessionsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; sessions: Session[] };

export const useSessions = (): {
  state: SessionsState;
  retry: () => void;
  addSession: (session: Session) => void;
};
```

- `useState<SessionsState>({ status: "loading" })` and
  `useState(0)` `attempt` counter.
- `useEffect` keyed on `attempt`: creates `AbortController`, calls
  `fetchSessions(controller.signal)`, sets success; in `catch`, early-return
  if `controller.signal.aborted`, else sets `{ status: "error" }`; cleanup
  aborts (handles StrictMode double mount; R-4).
- `retry` (event handler): `setState({ status: "loading" })`,
  `setAttempt((value) => value + 1)`.
- `addSession`: functional update; early-return previous state when not
  `success`; else append (A-8: appended at end).

### 7.2 `useCreateSessionForm` (`hooks/useCreateSessionForm.ts`) – AC-5, AC-6

```ts
type UseCreateSessionFormOptions = { onCreated: (session: Session) => void };
type SubmitState = { status: "idle" } | { status: "pending" } | { status: "error" };
```

- Holds `title`, `startsAtLocal` (raw `datetime-local` string),
  `fieldErrors: Partial<Record<"title" | "startsAt", string>>`, `submitState`,
  and a `useRef(false)` in-flight guard.
- `handleSubmit(event)`:
  1. `event.preventDefault()`;
  2. early-return if in-flight ref is `true` (blocks a second Enter/click in
     the same tick before re-render);
  3. `const result = validateSessionForm({ title, startsAtLocal, now: new
     Date() })`; early-return after `setFieldErrors(result.errors)` when
     invalid (no request, AC-5.3);
  4. set ref + `{ status: "pending" }`; `await createSession(result.value)`;
  5. on success: reset fields/errors, `{ status: "idle" }`, `onCreated(session)`;
  6. on failure: `{ status: "error" }`, keep values (AC-6.3);
  7. `finally` clears the ref.
- Returns values, setters as `handleTitleChange` / `handleStartsAtChange`,
  `fieldErrors`, `submitState`, `handleSubmit`.

### 7.3 Pure model helpers

- `validateSessionForm({ title, startsAtLocal, now })` returns
  `{ isValid: true; value: CreateSessionInput } | { isValid: false; errors }`.
  - title: `trim()`; length `< 3` or `> 80` ->
    `"Title must be 3–80 characters"` (AC-5.1).
  - startsAt: empty -> `"Choose a date and time in the future"`; parsed
    `new Date(startsAtLocal)` invalid or `<= now` -> same message (AC-5.2).
  - `value.title` is the trimmed title (AC-5.4); `value.startsAt` from
    `toStartsAtIso`.
- `toStartsAtIso(local: string): string` – `new Date(local).toISOString()`
  (local wall time -> UTC ISO, A-3).
- `formatStartsAt(iso: string): string` – module-level
  `Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short"
  })` (hoisted), `.format(new Date(iso))` (AC-1.3).

## 8. Components

All arrow-function components, `type` props, named exports, no component
file exports non-component values (`react-refresh/only-export-components`).

| File | Responsibility | Key accessible output |
| --- | --- | --- |
| `App.tsx` | `export const App = () => <SessionsWorkspace />` inside `<main>` with `<h1>Training sessions</h1>` | heading "Training sessions" |
| `SessionsWorkspace.tsx` | Owns `statusFilter: StatusFilterValue` (default `"all"`) and `isFormOpen`; calls `useSessions`; derives `visibleSessions` during render (no extra state); `handleSessionCreated = (session) => { addSession(session); setStatusFilter("all"); setIsFormOpen(false); }` (AC-7.1–7.3) | "New session" button (hidden while form open) |
| `SessionStatusFilter.tsx` | Props `value`, `onChange`; `<label>` "Status" + `<select>` with options All / Scheduled / Completed / Cancelled built from `SESSION_STATUSES` + `STATUS_LABELS`; maps the select value back through `isSessionStatus` (no `as`) | combobox "Status" (AC-3.1, 3.2) |
| `SessionsPanel.tsx` | Early returns: loading -> `<p role="status">Loading sessions…</p>`; error -> `<div role="alert">Could not load sessions.<button>Retry</button></div>`; `sessions.length === 0` -> "No sessions yet."; `visibleSessions.length === 0` -> "No sessions match this status."; else `<SessionList>` | AC-1.2, 1.4, 2.1, 2.2, 3.4 |
| `SessionList.tsx` | `<ul aria-label="Sessions">`, `<li key={session.id}>` with title, `STATUS_LABELS[status]`, `<time dateTime={startsAt}>{formatStartsAt(startsAt)}</time>` | list "Sessions" (AC-1.3, 3.3, 7.1) |
| `CreateSessionForm.tsx` | Props `onCreated`; uses `useCreateSessionForm`; `<form aria-label="Create session" noValidate>`; inputs `Title` (`type="text"`) and `Start date and time` (`type="datetime-local"`) with `<label htmlFor>`, `aria-invalid`, `aria-describedby` pointing at the error `<p>`; submit button text "Create session" / "Creating…" with `disabled` while pending; create failure `<p role="alert">Could not create the session. Please try again.</p>` | AC-4.2, 5.3, 6.2, 6.3 |

Filter is shown only when the list loaded successfully (it has nothing to act
on otherwise). The create control is available regardless of list state.

`App.css` is replaced with a few layout rules (spacing, field errors in a
visible color); `src/assets/react.svg` is deleted as dead code;
`public/vite.svg` stays (favicon in `index.html`).

## 9. Tests

### 9.1 Behavior tests – `src/App.test.tsx`

Render `<App />` (no providers needed); use `userEvent.setup()`; query by
role/label/text only; scope list assertions with
`within(screen.getByRole("list", { name: "Sessions" }))`.

Date input entry: use `user.type` on the `datetime-local` input with a full
value; if jsdom/user-event does not accept it, fall back to
`fireEvent.change(input, { target: { value } })` for that input only (R-8).
Future value: `"2099-01-01T10:00"`; past value: `"2000-01-01T10:00"`.

| ID | Scenario steps | Assertions | AC |
| --- | --- | --- | --- |
| T-1 Load and filter (main flow) | Render. Wait for list. Select "Completed" in "Status". Select "All". | `status` "Loading sessions…" visible first and no list; then 4 items, each shows title, status label and `formatStartsAt(seed.startsAt)`; after "Completed": only "Strength Basics"; after "All": 4 items again; select default value is All | 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 8.1, 9.1 |
| T-2 Create appears, pending, reset filter | Register `request:start` recorder. Override POST with deferred gate. Render, wait for list, select "Cancelled". Click "New session". Type `"  Evening Stretch  "` and future date. Click "Create session", then press Enter / click again. Resolve gate. | Form has labelled "Title" and "Start date and time"; while pending button is disabled and shows "Creating…"; exactly one POST recorded; POST body `title === "Evening Stretch"` and `startsAt` is ISO; after resolve: "Evening Stretch" visible in list with "Scheduled"; filter value back to "All" (all 5 items); form closed (no "Title" textbox) | 4.1, 4.2, 5.4, 6.1, 6.2, 7.1, 7.2, 7.3, 9.1 |
| T-3 Validation blocks request | Recorder on. Open form. Submit empty. Type "ab" + past date, submit. Type 81-char title, submit. | Field messages "Title must be 3–80 characters" and "Choose a date and time in the future" shown and associated with inputs (`toHaveAccessibleDescription`); zero POST requests recorded | 5.1, 5.2, 5.3 |
| T-4 List error and retry | `server.use` GET 500 `{ once: true }`. Render. Click "Retry". | `alert` contains "Could not load sessions."; list absent; after Retry list with 4 items shown | 2.1, 2.2, 8.3 |
| T-5 Empty states | (a) GET returns `[]` -> "No sessions yet." (b) GET returns only scheduled sessions, select "Completed" -> "No sessions match this status." | messages visible, no list | 1.4, 3.4 |
| T-6 Create failure keeps values | POST 500 `{ once: true }`. Open form, valid input, submit. Submit again. | `alert` "Could not create the session. Please try again."; inputs keep values; button enabled; second submit succeeds and session appears | 6.3 |

T-1 and T-2 satisfy AC-9.1 on their own; T-3 to T-6 cover the failure and
boundary regressions that would be most damaging. If time is constrained, the
minimum required set is T-1, T-2, T-4.

### 9.2 Unit test – `src/features/sessions/model/validateSessionForm.test.ts`

With injected `now = new Date("2026-10-14T12:00:00")`:
title `"  ab "` invalid, `"abc"` valid, 80 chars valid, 81 invalid, `"   "`
invalid; date `""` invalid, equal to `now` invalid, one minute later valid;
valid result has trimmed title (AC-5.1, 5.2, 5.4).

## 10. Implementation Order

1. Approve and run dependency commands (section 2).
2. Model: `session.ts`, `validateSessionForm.ts` (+ unit test),
   `toStartsAtIso.ts`, `formatStartsAt.ts`.
3. Boundary: `httpClient.ts`, `sessionsApi.ts`.
4. Mocks: seed, store, handlers, `server.ts`; update `src/test/setup.ts`.
5. Hooks, then components, then `App.tsx`, `App.css`, delete `react.svg`.
6. `browser.ts` and `main.tsx`.
7. `App.test.tsx`.
8. Verification (section 11) and manual browser check.

## 11. Verification

| Command | Expected | AC |
| --- | --- | --- |
| `npm test` | All tests in `App.test.tsx` and `validateSessionForm.test.ts` pass; no MSW "unhandled request" errors | 9.2 |
| `npm run lint` | 0 errors (warnings from generated `public/mockServiceWorker.js` directives tolerated; see R-6) | – |
| `npm run build` | `tsc -b` passes (tests included), Vite build succeeds; MSW not in main chunk | 8.4 |
| `npm run dev` + browser | Console shows `[MSW] Mocking enabled.`; "Loading sessions…" ~500 ms then 4 sessions; filter Completed / All works; create "Evening Stretch" with future date shows "Creating…" then the session with "Scheduled" and filter at All; invalid input shows field messages | 10.1, 10.2 |

The manual observation must be recorded by the developer in
`tasks/training-sessions/workflow-log.md` under "Manual Browser Observation"
with what was actually seen (AC-10.2). This plan does not claim it.

## 12. Traceability

| AC | Files | Tests |
| --- | --- | --- |
| 1.1 | `useSessions.ts`, `sessionsApi.ts`, `httpClient.ts` | T-1 |
| 1.2 | `SessionsPanel.tsx` | T-1 |
| 1.3 | `SessionList.tsx`, `formatStartsAt.ts`, `session.ts` | T-1 |
| 1.4 | `SessionsPanel.tsx` | T-5a |
| 2.1 | `useSessions.ts`, `SessionsPanel.tsx` | T-4 |
| 2.2 | `useSessions.ts` (`retry`), `SessionsPanel.tsx` | T-4 |
| 3.1, 3.2 | `SessionStatusFilter.tsx`, `SessionsWorkspace.tsx` | T-1 |
| 3.3 | `SessionsWorkspace.tsx` (derived `visibleSessions`) | T-1 |
| 3.4 | `SessionsPanel.tsx` | T-5b |
| 4.1 | `SessionsWorkspace.tsx` | T-2 |
| 4.2 | `CreateSessionForm.tsx` | T-2 |
| 5.1–5.3 | `validateSessionForm.ts`, `useCreateSessionForm.ts`, `CreateSessionForm.tsx` | T-3, unit |
| 5.4 | `validateSessionForm.ts` | T-2 (request body), unit |
| 6.1 | `useCreateSessionForm.ts`, `sessionsApi.ts` | T-2 |
| 6.2 | `useCreateSessionForm.ts` (ref guard + pending), `CreateSessionForm.tsx` | T-2 |
| 6.3 | `useCreateSessionForm.ts`, `CreateSessionForm.tsx` | T-6 |
| 7.1–7.3 | `SessionsWorkspace.tsx` (`handleSessionCreated`), `useSessions.ts` (`addSession`) | T-2 |
| 8.1 | `httpClient.ts`, `sessionsApi.ts` (only modules calling `fetch`) | T-1..T-6 run through MSW |
| 8.2 | `src/mocks/*`, `public/mockServiceWorker.js`, `main.tsx` | all |
| 8.3 | `src/test/setup.ts`, `server.use` override | T-4 |
| 8.4 | no server code added | build |
| 9.1, 9.2 | `App.test.tsx` | T-1, T-2 |
| 10.1, 10.2 | `main.tsx`, `browser.ts` | manual, recorded in `workflow-log.md` |

## 13. Risks and Open Items

| ID | Risk / open item | Mitigation / decision owner |
| --- | --- | --- |
| R-1 | Adding `msw` and generating `public/mockServiceWorker.js` modifies `package.json`, `package-lock.json`, `public/`. | Needs explicit developer approval before the coder runs the commands. |
| R-2 | Relative URLs with Node `fetch` under jsdom can fail to parse. | `buildUrl` resolves against `window.location.origin`; MSW handlers use the relative `/api/sessions` path, which MSW resolves against the jsdom location. If matching still fails, switch handler paths to `*/api/sessions` (mock-only change). |
| R-3 | User TS rule asks for schema validation (e.g. Zod) at boundaries; adding Zod is a new dependency not covered by requirements. | Plan uses hand-written type guards in `session.ts`. Developer may approve Zod instead; guards would be replaced 1:1. |
| R-4 | User React rule discourages `useEffect` for initial fetch when a data library can do it; no data library is installed. StrictMode in dev fires the GET twice (first aborted). | Plan uses one `useEffect` with `AbortController`. Adding TanStack Query is a dependency decision for the developer/architect, not taken here. |
| R-5 | User TS rule prefers `enum`, but `erasableSyntaxOnly: true` makes `enum` (and constructor parameter properties) a compile error. | Use `as const` tuple + derived union; do not change tsconfig. |
| R-6 | `eslint .` also visits `public/mockServiceWorker.js` with default JS settings; its `eslint-disable` comments may yield "unused directive" warnings. | Warnings do not fail lint. Only if errors appear, add `public/mockServiceWorker.js` to `globalIgnores` (requires approval; config change). |
| R-7 | Mocking is enabled only in dev, so `npm run preview` / production build shows the list error state (no backend, AC-8.4). | Accepted per brief ("worker init in dev"); developer may choose to enable the worker in preview too. |
| R-8 | `user.type` on `datetime-local` in jsdom may not set the value. | Fallback to `fireEvent.change` for that input only. |
| R-9 | `Intl` output differs between Node and browsers / locales. | Tests compute expectations with `formatStartsAt` instead of hard-coded strings. |
| R-10 | Vitest `globals` is off, so RTL auto-cleanup does not run. | Explicit `cleanup()` in `afterEach` in `src/test/setup.ts`. |
| R-11 | MSW v2 requires Node >= 18; installed Node version was not checked by this role. | Coder confirms with `node --version` before install. |
| O-1 | New session placement (A-8) unspecified. | Appended at end of list; acceptable under A-8. |
| O-2 | No "Cancel" control for the create form is required. | Not planned; form closes only on success. Add only if the developer asks. |
