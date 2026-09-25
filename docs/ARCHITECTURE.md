# LLM2 — Architecture Audit (Phase 2)

Audit of the current codebase as the baseline for the LLM2 "AI Control Center" roadmap.
Scope of this document: inventory what exists, what is missing, and the plan for the
application shell. No production behavior is changed by this phase.

## 1. Runtime stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (CI pins 20; project targets 24+) |
| Module system | ES Modules (`"type": "module"`) |
| HTTP | Express 5, bound to `127.0.0.1` only |
| Browser automation | Playwright + persistent Chrome profile (`./browser-profile`) |
| Persistence | JSON files under `./data/` (projects, memory) |
| Frontend | Single static `public/index.html`, no build step, no modules |
| Tests | `node --test` (18 tests), no external test framework |

## 2. Backend module map (`src/`)

| File | Responsibility | Notes |
|---|---|---|
| `index.js` | Entrypoint, binds `config.port` | 9 lines |
| `config.js` | Env-driven config, all numeric values validated as positive ints | 31 keys |
| `server.js` | All routes, validation, error normalization | 440 lines, 21 endpoints |
| `browser.js` | Single shared persistent browser context | lazy, cached `contextPromise` |
| `logger.js` | Structured JSON lines to stdout | no persistence / retrieval API |
| `request-manager.js` | Serialized queue (max 4 default), rejects when full | single-flight |
| `session-manager.js` | In-memory sessions, TTL + max count | not persisted |
| `conversation-manager.js` | Gateway conversations, TTL, native-state fields | not persisted |
| `memory-manager.js` | Persistent memory: history, summary, long-term memories | file-backed |
| `project-manager.js` | Registered workspaces, file/git/run access | sandboxed |
| `providers/base.js` | `BaseProvider` interface: `health/chat/getConversationState/restoreConversation` | |
| `providers/chatgpt.js` | ChatGPT Web adapter | also serves `browser` model id |
| `providers/web-ui.js` | Generic selector-driven adapter | gemini/claude/grok/deepseek/qwen/mistral/perplexity |
| `providers/definitions.js` | Per-provider selectors, URL patterns, capabilities | 8 definitions |
| `providers/router.js` | `ProviderRouter` + `createProviderRouter()` (9 model ids) | |
| `providers/capabilities.js` | ChatGPT capability constant | |
| `providers/index.js` | **dead code** — `createProviders`/`listCapabilities` unused | superseded by `router.js`; candidate for removal |

## 3. API map (verified against `src/server.js`)

Error contract (all non-2xx): `{ error: { message, type, code } }`.
Provider errors map to `type: "browser_provider_error"`; queue overflow to
`type: "rate_limit_error"` (429); everything else to `type: "internal_error"` (500).

| Group | Method + path | Purpose |
|---|---|---|
| System | `GET /health` | bridge + browser + queue + sessions + memory + conversations; `port`, `uptime`, `memory.enabled`, `memory.summaryEvery`, `queue.failures` |
| System | `GET /ready` | readiness of the `browser` provider only |
| Models | `GET /v1/models` | 9 model ids from the router |
| Models | `GET /v1/capabilities` | deduped provider capabilities (8) |
| Chat | `POST /v1/chat/completions` | OpenAI-compatible; `stream: true` → SSE; `conversation_id`, `memory: false`, `x-session-id` |
| Sessions | `GET /v1/sessions` | session status |
| Sessions | `GET|DELETE /v1/sessions/:sessionId/memory` | session memory record / clear |
| Memories | `GET /v1/memories` | requires `x-session-id` or `session_id` |
| Memories | `POST /v1/memories` | add memory (type/key/value/importance) |
| Memories | `POST /v1/memories/search` | relevance search |
| Memories | `PATCH|DELETE /v1/memories/:memoryId` | update / remove |
| Conversations | `GET /v1/conversations` | status only |
| Conversations | `GET|DELETE /v1/conversations/:conversationId` | fetch / remove |
| Projects | `GET|POST /v1/projects` | list / register |
| Projects | `DELETE /v1/projects/:projectId` | unregister |
| Files | `GET /v1/projects/:projectId/files?path=` | directory listing → `{ items: [...] }` |
| Files | `GET|PUT /v1/projects/:projectId/file?path=` | read / write single file |
| Files | `GET /v1/projects/:projectId/search?q=` | text search (file, line, preview) |
| Files | `GET /v1/projects/:projectId/context?q=` | AI context gathering |
| Git | `GET /v1/projects/:projectId/git/:operation` | `status`, `diff`, `diffFull`, `log` |
| Run | `POST /v1/projects/:projectId/run/:kind` | `test` / `build` from configured commands |

## 4. Frontend audit

Phase 3 delivered the application shell (dark/light theme, hash routing, sidebar
navigation, responsive layout, UX-state primitives). Implemented structure
(no-build vanilla ESM; the static middleware serves `public/` recursively):

```
public/
  index.html                 shell markup + no-flash theme bootstrap
  styles/base.css            theme tokens, layout, UX states, responsive
  scripts/main.js            bootstrap: nav, theme, sidebar toggle, status pill
  scripts/router.js          hash router, active nav state, 404 fallback
  scripts/api.js             fetch wrapper normalized to the error contract
  scripts/state.js           tiny shared store (theme, active project)
  scripts/ui.js              hyperscript helper, icons, spinner/empty/error/scaffold
  scripts/views/registry.js  sections (grouped, backend status), default route
  scripts/views/chat.js      live chat view (port of the original single page)
  scripts/views/notFound.js  404 view
```

Pending sections (projects, files, memory, models, git, logs, settings)
render an honest "shell only" scaffold with their real backend status; each later
roadmap phase replaces a registry entry with its own view module. The dashboard
(Phase 4) is the default route and renders `/health`, `/v1/capabilities` and
`/v1/projects` with a 15s auto-refresh.

## 5. Gap analysis (feature → current coverage)

| Spec feature | Backend | Frontend | Gap |
|---|---|---|---|
| Chat workspace | done | partial (send only) | history, regenerate, edit, cancel, error/retry UI |
| Conversation management | partial | none | no list/search/rename API; no persistence of conversations |
| Provider manager | partial | none | no per-provider health or last-error API (only `browser` via `/ready`) |
| Dashboard | done | done | auto-refresh interval; per-provider health deferred to Phase 6 |
| Project workspace | done | none | UI only |
| File explorer + editor | done | none | UI only (tree, viewer, editor) |
| Project search | done | none | UI only |
| Memory system | done | none | UI only (summary/CRUD/settings) |
| Compare models | sufficient | none | can reuse `POST /v1/chat/completions` per provider; fan-out queueing to consider |
| Git tools | done | none | UI only |
| Test/build center | done | none | UI only; output streaming |
| Runtime logs | partial | none | logs go to stdout only; no retrieval API |
| Settings | partial | none | config is env-only at startup; no runtime read/write API |

Security-relevant gaps to address before exposing dangerous operations in UI:
file write requires an explicit permission/confirmation step, and the run/git
endpoints need audit logging if surfaced.

## 6. UI plan

Layout per master spec:

```
------------------------------------------------
| LLM2 | Search | Status | Settings            |
------------------------------------------------
| Sidebar | Main Workspace                     |
| Chat    |                                    |
| Projects|                                    |
| Files   |                                    |
| Memory  |                                    |
| Models  |                                    |
| Git     |                                    |
| Logs    |                                    |
------------------------------------------------
```

- Dark-first theme, subtle glass surfaces, clear hierarchy, minimal animation.
- Sidebar navigation switches views via hash routing (`#/chat`, `#/projects`, ...).
- Topbar "Status" reflects `/health` (browser + queue) via a lightweight poll.
- Every view renders only real backend data (no fabricated status), per spec.

## 7. Security boundary (existing, must be preserved)

- Localhost-only binding (`127.0.0.1`).
- Project file access: registered roots only, path-traversal + symlink-escape checks,
  protected names (`.env*`, `credentials.json`, `secrets.json`, `*.pem`, `*.key`),
  size limits.
- Git operations limited to read-only `status/diff/diffFull/log`.
- Command execution limited to per-project configured test/build commands
  (`shell: false`, no arbitrary shell).
- No cookie/token/credential extraction, no auth bypass, no quota/rate-limit bypass,
  no CAPTCHA bypass (also documented in README "Security boundary").

## 8. Hygiene findings (candidates for a later small-fix batch)

1. `src/providers/index.js` is dead code (unused; superseded by `router.js`).
2. README endpoint list is stale: `files` and `context` endpoints undocumented;
   states "Node.js 20+" while the project targets 24+.
3. `.env.example` is missing the project config keys (`PROJECTS_FILE`,
   `MAX_PROJECTS`, `MAX_PROJECT_FILE_BYTES`, `MAX_PROJECT_SEARCH_RESULTS`).
4. `closeBrowser()` in `browser.js` is defined but never called (no graceful
   shutdown hook in `index.js`).

## 9. Testing strategy

- `npm test` must stay 18/18 green after every phase; `git diff --check` clean.
- New API routes ship with `node --test` cases using the mock-provider pattern
  already established in `test/runtime.test.js`.
- Frontend views verified by serving `public/` and checking view switching plus
  one real backend call per view.
- Startup smoke: server binds and `/health`, `/v1/models` respond 200.
