## Code review: training-sessions (uncommitted working tree compared with HEAD `ee39eb8`)

### Context Summary
I reviewed the working tree diff against HEAD. That covers `git diff` and `git diff --cached` for tracked files, plus every untracked file under `src/`. I checked it against `tasks/training-sessions/requirements.md` and `tasks/training-sessions/implementation-plan.md` (both read in full). I applied `rulesets/common/code-reviewer` (evidence-first), `rulesets/framework/code-reviewer` with the React coder index, and the pinned web-interface guidelines. The implementation follows the plan closely, and every AC from AC-1 to AC-9 is implemented. None of the findings block the happy path. Two should-fix items remain: the test bridge depends on a package `package.json` doesn't declare, and the abort/StrictMode behavior the bridge exists for has no test. No files were changed.

**Verdict: NEEDS-CHANGES.** The happy path (load, filter, create, appears in list) is **not blocked**.

### Findings (most severe first)

**Medium / should-fix**

1. **The type-check of the bridge and test code depends on `@types/node` that `package.json` doesn't declare. That package also now puts Node global types into the browser app's type-check.** `src/test/nodeSignalFetch.ts:1` imports `node:util`.
   - `@types/node` is not in `package.json`. It is installed only indirectly, through msw (`@inquirer/*`, `@types/set-cookie-parser`), vite and vitest (`npm ls @types/node`).
   - It was not in the HEAD lockfile (`git show HEAD:package-lock.json | grep -c node_modules/@types/node` gives 0), so this diff is what brings it in.
   - `tsconfig.app.json` sets no `types` and has `include: ["src"]`, so all `@types/*` packages load automatically for app code.
   - **Failure scenario:** a msw or vite upgrade stops pulling in `@types/node`, and `tsc -b` (and so `npm run build`) fails with "Cannot find module 'node:util'". Separately, app code can already use `process`, `Buffer` and `NodeJS.Timeout` without a type error.
   - **Fix:** add `@types/node` explicitly as a devDependency (needs approval). Better still, move test files (`src/test/**`, `*.test.tsx`) into a test tsconfig with `types: ["node", "vitest/..."]`. If you do that, exclude them from `tsconfig.app.json`. This is a config change, so it also needs approval.

2. **Nothing tests abort or StrictMode handling, so the reason for the bridge is never checked.**
   - `useSessions.ts:20-39` aborts on cleanup and ignores errors from aborted requests. That logic is correct by reading.
   - However, `App.test.tsx:64-69` renders `<App />` without `<StrictMode>`, and no test unmounts or retries while a request is still running.
   - **Failure scenario:** someone removes the `controller.signal.aborted` early return, or breaks how the bridge passes on the abort. In dev StrictMode the first aborted GET would then briefly show "Could not load sessions." The suite would stay green.
   - **Fix:** add one behavior test that renders inside `<StrictMode>` and asserts that no `alert` appears and the 4 seed items show. Optionally add a second test: unmount during a gated GET and assert there are no errors or state updates.

**Low**

3. **A session created while the list isn't loaded successfully is silently dropped from the UI.**
   - `useSessions.ts:46-53` returns the previous state when the status is not `success`.
   - "New session" stays available in loading and error states (`SessionsWorkspace.tsx:53-57`), and `handleSessionCreated` still closes the form.
   - **Scenario:** the list fails, the user creates a session, the form closes, and only the error alert remains with no confirmation. The new session shows up only after Retry. A rarer race: if a Retry GET response arrives after the insert but before the POST response, the session is appended a second time and React warns about a duplicate key.
   - The plan intended this (section 8), but it leaves an edge-case gap in AC-7.1.
   - **Fix:** either show "New session" only on `success`, or skip the append when `session.id` is already present.

4. **If `worker.start()` fails, dev shows a blank page.** At `main.tsx:29`, `enableMocking().then(renderApp)` has no rejection path. Service workers can be unavailable, for example on an insecure LAN origin or in some private-browsing modes. In that case the app never renders and the rejection goes unhandled. Dev only. **Fix:** render even if mocking fails (`.catch(...).then(renderApp)` or `finally`), so the user sees the list error state instead.

5. **Focus is lost when controls disappear.** `SessionsWorkspace.tsx:53-61` removes the focused "New session" button when the form opens, and removes the form after a successful create. In both cases keyboard focus falls back to `<body>`. Validation errors are also not announced and focus doesn't move to the first invalid field, which the guidelines ask for ("focus first error on submit"; "validation needs aria-live"). Exhaustive accessibility is a non-goal, so this is Low. **Fix:** focus the Title input when the form opens, and focus the first invalid field on a rejected submit.

6. **The duplicate-submit test only checks the `disabled` attribute.**
   - `App.test.tsx:160-161` clicks a disabled button, which user-event ignores. Enter-to-submit is blocked by the disabled default button.
   - So `isSubmittingRef` (`useCreateSessionForm.ts:76`) is never reached.
   - AC-6.2 is still really covered, because the button is disabled and exactly one POST is recorded. The ref guard just has no test. Acceptable as is; this is a note.

7. **Request recorder timing.** At `App.test.tsx:38-42`, the async `request:start` listener pushes only after `await request.clone().json()`. The count assertions at :163 and :186 are reliable today only because several `await`s come before them. **Fix:** push `{ method }` synchronously and fill in `body` afterwards, so the count never lags.

8. **AC-1.3: the status label is not checked for every seed item.** `expectSessionShown` (`App.test.tsx:90-100`) checks title and date but not the status label. Status is only checked for the Completed item (:119) and the created item (:182). **Fix:** also assert `STATUS_LABELS[session.status]`.

9. **The layout may jump in the browser.** The old `#root` rule was removed from `App.css`. The unchanged `index.css` still sets `body { display: flex; place-items: center }`, so `#root` sizes to its content and `.app { inline-size: 100% }` resolves against that. The content width will change when the form opens or titles get longer. This needs checking during AC-10.

**Nits**

- `httpClient.ts:20`: spreading `init?.headers` silently drops a `Headers` instance or a headers array. No caller passes headers today.
- `handlers.ts:17`: a non-JSON POST body throws, and MSW turns that into a 500 instead of the planned 400.
- `nodeSignalFetch.ts:15`: the abort listener is never removed after the fetch settles. The leak is per request and negligible. `util.transferableAbortController` is still marked Experimental in Node docs; it is available on Node 24.21.0, which is installed here.
- `package.json` lost its trailing newline (most likely from `msw init --save`).
- Style:
  - `App.test.tsx:27-28` needs a blank line after the arrow-function definition `let resolve = ...`.
  - The `let` in `App.test.tsx:27` and `setup.ts:8` is needed and acceptable.
  - Otherwise the code meets the style rules. Grep found no lines over 80 columns, no single quotes, no default exports, and no `var`, `any` or `as`. Blank lines around `if`/`return` and object arguments are applied consistently.

### Assessment of `src/test/nodeSignalFetch.ts`
- **Root cause is correct.** MSW's Node fetch interceptor builds `new FetchRequest(input, init)`, a subclass of Node's `Request` (`node_modules/@mswjs/interceptors/lib/node/fetch-CaC3rGEu.mjs:153`). Node's `Request` rejects jsdom's `AbortSignal`. Without the bridge, every list GET would reject and the tests would show the error state.
- **It is correct.**
  - A signal that is already aborted is copied over immediately.
  - Later aborts pass on `signal.reason`.
  - `useSessions` decides based on the jsdom `controller.signal.aborted`, not on the error type, so the reason object doesn't matter.
  - The interceptor listens to the Node signal (same file, around line 229, "request has been aborted!"), so cancellation really reaches MSW.
- **Install order is correct.** `setup.ts` wraps fetch after `server.listen()` patches it. Teardown runs in reverse order: the bridge is removed first, then `server.close()`.
- **It doesn't hide real behavior.** It only changes which realm the signal belongs to, and browsers accept DOM signals natively. Requests without `init.signal` pass through untouched. It isn't bundled, because only `setup.ts` imports it.
- **Isolation.** It is installed for every test file, including the pure `validateSessionForm.test.ts`. That is harmless.
- **Remaining risks:** findings 1 (undeclared type dependency) and 2 (no test proves the abort path).

### AC coverage
| AC | Implementation | Test |
| --- | --- | --- |
| 1.1 | `sessionsApi.ts` to `httpClient.ts`; the UI never imports from `src/mocks` | T "loads and filters" (through MSW) |
| 1.2 | `SessionsPanel.tsx:16-18` | yes (:106-109) |
| 1.3 | `SessionList.tsx`, `formatStartsAt.ts` (Intl) | partial (finding 8) |
| 1.4 | `SessionsPanel.tsx:31-33` | yes |
| 2.1 / 2.2 | `SessionsPanel.tsx:20-29`, `useSessions.retry` | yes |
| 3.1–3.3 | `SessionStatusFilter.tsx`, derived `getVisibleSessions` | yes |
| 3.4 | `SessionsPanel.tsx:35-37` | yes |
| 4.1 / 4.2 | `SessionsWorkspace.tsx:53-61`, labelled inputs | yes |
| 5.1–5.4 | `validateSessionForm.ts` (trim, 3–80, future checked at submit using `new Date()`), `aria-describedby` | yes, plus a unit test |
| 6.1 / 6.2 | disabled button, "Creating…" text, ref guard | yes (the ref guard itself is untested, finding 6) |
| 6.3 | `useCreateSessionForm.ts:64-65`, values kept | yes |
| 7.1–7.3 | `handleSessionCreated` (append, reset filter to All, close form) | yes; edge-case gap in finding 3 |
| 8.1–8.4 | `httpClient` is the only fetch call site; MSW handlers in `src/mocks`; list failure only through test overrides; no backend code | yes |
| 9.1 | behavior tests use roles and labels | yes |
| 9.2 | — | **not verified by me** (I did not run `npm test`) |
| 10 | — | manual check pending |

Scope: nothing goes beyond the requirements. `App.css` is a little richer than "a few layout rules" (custom properties, light/dark error colors), but stays in scope.

### Evidence
- Commands run: `git diff` (package.json, App.css, App.tsx, main.tsx, test/setup.ts), `git diff --cached --stat`, `git show HEAD:package-lock.json | grep -c '"node_modules/@types/node"'` (gave 0), `npm ls @types/node`, `node --version` (v24.21.0), grep checks for line width, quotes and exports, and greps into the `@mswjs/interceptors` source.
- Not run, because this review was limited to read-only commands: `npm test`, `npm run lint`, `npm run build`, and the browser check. I don't claim any of them passed.
- Key files:
  - `/Users/shevich7/Documents/projects/training-sessions-workspace/src/test/nodeSignalFetch.ts`
  - `/Users/shevich7/Documents/projects/training-sessions-workspace/src/test/setup.ts`
  - `/Users/shevich7/Documents/projects/training-sessions-workspace/tsconfig.app.json`
  - `/Users/shevich7/Documents/projects/training-sessions-workspace/src/features/sessions/hooks/useSessions.ts`
  - `/Users/shevich7/Documents/projects/training-sessions-workspace/src/features/sessions/hooks/useCreateSessionForm.ts`
  - `/Users/shevich7/Documents/projects/training-sessions-workspace/src/features/sessions/components/SessionsWorkspace.tsx`
  - `/Users/shevich7/Documents/projects/training-sessions-workspace/src/main.tsx`
  - `/Users/shevich7/Documents/projects/training-sessions-workspace/src/App.test.tsx`

### Next Step
**Primary: `/coder`**, limited to findings 1 to 5. Adding `@types/node` or a test tsconfig is a dependency or config change, so it needs your approval first.

Alternatives:
- `/test-generator`, if you only want the test gaps closed: findings 2, 6, 7 and 8.
- `/verify`, to run `npm test`, `npm run lint` and `npm run build` (AC-9.2) once you have accepted or addressed the findings.
- `/browser-verify`, for AC-10, including the layout check in finding 9.
