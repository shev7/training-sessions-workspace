# Verification: training-sessions

- Task ID: `training-sessions`
- Role: `verify` (read-only; ran checks only, fixed nothing)
- Date: 2026-10-14
- Application root: `/Users/shevich7/Documents/projects/training-sessions-workspace` (repository root)
- Baseline: uncommitted working tree on `main`, compared with HEAD `ee39eb8`

## Overall Verdict: PASS (automated checks only)

All three project checks exited with code 0: `npm run lint` (0 errors, 1 warning), `npm run test` (19/19 tests passed) and `npm run build`. These results support AC-9.1 and AC-9.2, and the behavior tests cover AC-1 to AC-8. This verdict does **not** include AC-10 (manual browser run). I did not check that myself. See "Unverified" below.

## Environment

| Item | Value |
| --- | --- |
| `node --version` | `v24.21.0` |
| `npm --version` | `11.19.0` |
| Vitest | v3.2.4 (from test output) |
| Vite | v7.3.7 (from build output) |

## Change Set Verified (`git status --short`)

```
 M package-lock.json
 M package.json
 M src/App.css
 M src/App.tsx
D  src/assets/react.svg
 M src/index.css
 M src/main.tsx
 M src/test/setup.ts
?? public/mockServiceWorker.js
?? src/App.test.tsx
?? src/features/
?? src/mocks/
?? src/shared/
?? src/test/nodeSignalFetch.ts
?? tasks/
```

The output was the same before and after the checks. `npm run build` wrote `dist/`, which `.gitignore` excludes (line 11), so the tracked change set did not change.

## Commands

| # | Command (from repo root) | Exit code | Result | Counts / notes |
| --- | --- | --- | --- | --- |
| 1 | `npm run lint` (`eslint .`) | 0 | PASS | 0 errors, 1 warning |
| 2 | `npm run test` (`vitest run`) | 0 | PASS | 2 test files passed out of 2; 19 tests passed out of 19 (`validateSessionForm.test.ts`: 11, `App.test.tsx`: 8); duration 1.33s |
| 3 | `npm run build` (`tsc -b && vite build`) | 0 | PASS | `tsc -b` gave no errors; 279 modules transformed; built in 436ms |

I also ran `npx vitest run --reporter=verbose` once, only to list the individual test names. It also exited with 19/19 passed. It is not one of the required checks.

## Details: Warnings and Failures

**Failures:** none.

**Warnings:**

1. Lint, in a generated file:
   ```
   public/mockServiceWorker.js
     1:1  warning  Unused eslint-disable directive (no problems were reported)
   ✖ 1 problem (0 errors, 1 warning)
   ```
   The file is MSW's generated worker. Earlier coder runs (workflow log) reported the same warning. It does not block anything.
2. Test: no warnings or errors were printed to the console (no React `act` warnings, no MSW unhandled-request warnings).
3. Build: no warnings. There was no chunk-size warning (JS bundle 228.52 kB, gzip 71.54 kB; CSS 2.11 kB; `index.html` 0.46 kB).

## Test Inventory

`src/App.test.tsx` (behavior tests using Testing Library roles and labels, with MSW):
- T1 "loads sessions and filters them by status"
- T2 "creates a session once and shows it with the filter reset"
- T3 "cancels the create form without sending a request"
- T4 "blocks invalid input without sending a request"
- T5 "shows a list error and recovers on retry"
- T6 "shows a message when there are no sessions"
- T7 "shows a message when no session matches the status"
- T8 "keeps values after a create failure and allows retry"

`src/features/sessions/model/validateSessionForm.test.ts` (unit tests, 11 cases):
- U1: 5 title cases (`"  ab "`, `"   "`, `"abc"`, 80 chars, 81 chars)
- U2: 4 start cases (empty, equal to now, past, future)
- U3: "returns both errors when both fields are invalid"
- U4: "returns the trimmed title and an ISO start"

## AC Evidence

"Automated" means a passing test asserts the behavior. "Partial" means some of the AC is asserted and the rest is not.

| AC | Evidence from this run | Status |
| --- | --- | --- |
| 1.1 Request through boundary | T1 loads the list through MSW at the HTTP level. Which module the UI imports is not checked by any test; only the code review says so. | Partial (behavior automated; import structure not checked) |
| 1.2 Loading indicator, no list | T1 checks the `status` role shows "Loading sessions…" and that no `list` exists | Automated |
| 1.3 Title, status, date/time shown | T1 checks title and date for every seed item (`expectSessionShown`), but status only for the Completed item. T2 checks status and date for the created item. | Partial (review finding 8) |
| 1.4 Empty list message | T6 "No sessions yet." | Automated |
| 2.1 List error message | T5: alert "Could not load sessions.", no list | Automated |
| 2.2 Retry recovers | T5: Retry, then list shown and alert gone | Automated |
| 3.1 Filter offers All and statuses | T1 and T2 select "All", "Completed" and "Cancelled". No test checks "Scheduled" as an option or the full option list. | Partial |
| 3.2 All is the default | T1 checks the filter value is `all` and all seed items are shown | Automated |
| 3.3 Filter, then All restores | T1 | Automated |
| 3.4 Empty filter result message | T7 "No sessions match this status." | Automated |
| 4.1 Open the create form | T2 and T3 use the "New session" button to open the form | Automated |
| 4.2 Labelled inputs and submit | T2 to T4 and T8 find inputs by label and submit the form | Automated |
| 5.1 Trim; 3–80 characters | U1 and U4; T4 (empty, "ab", 81 characters) | Automated |
| 5.2 Future date/time required | U2; T4 (empty, past) | Automated |
| 5.3 Field-tied message; no request | T4 checks the accessible description on each field and that 0 POSTs were sent | Automated |
| 5.4 Trimmed title submitted | T2 checks the POST body title is "Evening Stretch"; U4 | Automated |
| 6.1 One create request | T2: `countPosts` is 1 | Automated |
| 6.2 Disabled while pending; pending text | T2: "Creating…" button disabled; a click and Enter while pending still give 1 POST. The `isSubmittingRef` guard is never reached in tests (review finding 6). | Automated (with that caveat) |
| 6.3 Create error; values kept; resubmit | T8 | Automated |
| 7.1 Created session appears with title, status, date | T2 | Automated |
| 7.2 Form closed after success | T2 | Automated |
| 7.3 Filter resets to All | T2 (filter was Cancelled, then `all`) | Automated |
| 8.1 Single replaceable client | Not checked by tests (structural). Only the code review supports it. | Not verified by me |
| 8.2 Mocks outside UI, MSW | Tests use MSW `server.use` overrides. I did not check where the files live. | Partial |
| 8.3 Mock can produce a list failure | T5 | Automated |
| 8.4 No backend | Not checked by any command | Not verified by me |
| 9.1 Behavior-level test of main flow | T1 (filter) and T2 (create appears) pass | Automated |
| 9.2 `npm test` passes | `npm run test` exit 0, 19/19 | **Verified** |
| 10.1 `npm run dev` starts | Not run. I was told not to start the dev server. | **Unverified by me** |
| 10.2 Browser observation recorded | Not performed by me | **Unverified by me** |

## Unverified

1. **AC-10 (10.1 and 10.2), the manual browser run.** I did not run `npm run dev` or check anything in a browser.
   - `tasks/training-sessions/workflow-log.md` has a developer-recorded browser run and re-check (about 09:15 and 09:35). It records that list, filter, create and Cancel work and that the layout is top-aligned and stable.
   - That is the developer's own observation. This verification does not confirm it.
   - The list error and Retry were not tried in the browser, by decision Q-5.
2. **Structural ACs that tests don't check:** AC-8.1 (one replaceable HTTP client, no UI changes needed to swap it), AC-8.2 (where the mock files live), AC-8.4 (no backend) and the import-structure part of AC-1.1. Only the code review in `review.md` covers these.
3. **Partial test coverage:**
   - AC-1.3: status is not checked for every seed item (finding 8).
   - AC-3.1: the "Scheduled" option and the full option list are not checked.
   - AC-6.2: the ref guard is never reached (finding 6).
4. **Real-browser behavior.** The tests run in jsdom with a test-only `src/test/nodeSignalFetch.ts` bridge. These are not covered:
   - the MSW service worker
   - the ~500 ms mock latency (Q-6)
   - time-zone and locale formatting in a real browser
   - layout and CSS
5. **Status of `review.md` findings.** This run did not check whether any of them were fixed, apart from what the commands show:
   - **Finding 1 (`@types/node`).** `package.json` now lists `@types/node: ^24.19.2` in devDependencies, and `tsc -b` passed. The other part of the finding was not changed: Node global types still load into the app's type-check, because `tsconfig.app.json` was not changed and no test tsconfig was added.
   - **Finding 9 (layout jump).** The workflow log says a later coder run changed `src/index.css`. No command here checks layout, so it stays unverified by me.
   - **Findings 2 to 8 and the nits.** These are the developer's decision. The workflow log records them as accepted, not fixed. Specifically:
     - 2: no StrictMode or abort test
     - 3: a session created while the list isn't loaded is dropped
     - 4: no fallback when `worker.start()` fails
     - 5: focus management
     - 6: ref guard untested
     - 7: request-recorder timing
     - 8: AC-1.3 status assertion
     - Nits: `Headers` spread in `httpClient.ts`, non-JSON POST gives 500 in `handlers.ts`, the abort-listener leak, and the experimental `util.transferableAbortController`.
6. **Other items not checked:** `npm audit` results (the workflow log notes 3 vulnerabilities in existing Vitest dependencies), `npm run preview`, and accessibility or responsive checks (non-goals).

## Evidence

- Read: `/Users/shevich7/Documents/projects/training-sessions-workspace/tasks/training-sessions/requirements.md` (in full), `/Users/shevich7/Documents/projects/training-sessions-workspace/tasks/training-sessions/review.md`, `/Users/shevich7/Documents/projects/training-sessions-workspace/tasks/training-sessions/workflow-log.md`, `/Users/shevich7/Documents/projects/training-sessions-workspace/package.json`, `/Users/shevich7/Documents/projects/training-sessions-workspace/src/App.test.tsx` (test bodies), `/Users/shevich7/Documents/projects/training-sessions-workspace/src/features/sessions/model/validateSessionForm.test.ts`
- Commands run: `node --version`, `npm --version`, `git status --short`, `npm run lint`, `npm run test`, `npm run build`, `npx vitest run --reporter=verbose` (listing only), and a `grep` of `.gitignore` for `dist`
- Not run: installs, `npm run dev`, browser checks, any fixes
- Files changed by this role: none. The only side effect is the gitignored `dist/` build output.
- Note: no `verify` Skill tool was available in this environment, so I ran the requested checks directly within the verify role's read-only limits.

## Next Step

- **Main recommendation: `/browser-verify`.** AC-10 is the only acceptance criterion that no tool has independently checked. Run it if you want an independent check of the list, filter, create and Cancel flow and the layout (finding 9).
- **Alternative: record the developer's browser observation as the AC-10 evidence** and close the task. The automated checks pass, and the workflow log already has your own browser run.
- **Alternative: `/test-generator`**, only if you change your earlier decision and want findings 2, 6, 7 or 8 covered by tests.

The decision is yours. I have not invoked any of these.
