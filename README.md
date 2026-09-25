# Browser LLM Bridge

Professional MVP: a local OpenAI-compatible HTTP bridge backed by an authorized ChatGPT Web browser session controlled with Playwright.

## Architecture

Client -> HTTP API -> validation -> request queue -> provider adapter -> Playwright -> ChatGPT Web

## Requirements

- Node.js 24+
- Google Chrome
- Normal ChatGPT Web login

## Setup

1. Run `npm install`
2. Run `npx playwright install chromium`
3. Run `npm start` (provider browsers run headless by default)
4. For first-time login, start once with `$env:HEADLESS="false"; npm start`, sign in normally in the dedicated browser profile, then stop the server and run `npm start` normally again.

The default automation profile is `./browser-profile`. Keep it separate from your everyday Chrome profile.

## Endpoints

- `GET /health` — bridge runtime status: uptime, port, browser, queue (including failure count), sessions, memory and conversations
- `GET /ready` — provider readiness
- `GET /v1/models` — available bridge models
- `POST /v1/chat/completions` — OpenAI-compatible chat response

Example request:

    {
      "model": "browser",
      "messages": [
        { "role": "system", "content": "Answer briefly." },
        { "role": "user", "content": "Hello" }
      ]
    }

## Professional MVP changes

- Provider adapter boundary for future Web UI providers
- Bounded request queue and serialized browser interactions
- Request IDs and structured JSON logging
- Input validation and configurable message limits
- Health and readiness diagnostics
- Mock-provider API tests
- Dedicated startup entrypoint
- Localhost-only HTTP binding

## Tests

Run `npm test`.

The test suite uses a mock provider and does not require a real ChatGPT login.
A GitHub Actions workflow also runs the test suite on pushes and pull requests to main.

## Security boundary

- No password collection
- No cookie or session-token extraction
- No authentication bypass
- No CAPTCHA bypass
- No quota or rate-limit bypass
- No provider security bypass
- Intended for accounts and services the user is authorized to automate

## Limitations

ChatGPT Web is not an official API integration. DOM selectors can change. Streaming, tool calling, vision/files and provider failover are not implemented yet.

Playwright documents persistent contexts as storing browser session data in the supplied user-data directory and warns against automating the default Chrome user profile. Use the dedicated profile configured by this project.


## v0.3 Session & Streaming Layer

The bridge now provides:

- in-memory session IDs with TTL and a maximum session count
- `X-Session-ID` request support
- `GET /v1/sessions`
- `GET /v1/capabilities`
- `stream: true` SSE-compatible response mode
- provider capability metadata

The current browser adapter still maps a session to the bridge request context rather than controlling separate native ChatGPT conversations. Streaming is currently **compatibility streaming**: the provider response is returned as one content delta followed by the final event. True token-by-token browser streaming remains a later phase.



## v0.4 Provider Router

The bridge now has an explicit provider router with browser adapters for:

- `chatgpt`
- `gemini`
- `claude`

Each provider exposes capability metadata through `GET /v1/capabilities`, and `GET /v1/models` is generated from the router rather than hard-coded.

Example:

~~~text
POST /v1/chat/completions
{
  "model": "gemini",
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
~~~

The same local API can therefore select the configured Web UI provider by model ID.

### Provider status

ChatGPT is the primary adapter inherited from the original MVP. Gemini and Claude adapters are now implemented as selector-driven Web UI adapters, but their selectors are **not guaranteed to match every current UI/account variant** and must be validated on the user's machine before being treated as production-ready.

### Important session limitation

Bridge session IDs are currently logical gateway sessions. They do not yet guarantee a separate native conversation inside each provider Web UI. Native per-conversation routing is intentionally deferred until the browser adapters have provider-specific conversation creation/navigation logic.


## License

MIT

## v0.5 Persistent Memory

The bridge now has a local persistent memory layer for logical sessions.

When memory is enabled (the default), a request containing a single new user message automatically receives the stored session conversation as context. The resulting user/assistant turn is persisted to `data/memory.json`.

Configuration:

- `MEMORY_ENABLED=true`
- `MEMORY_FILE=./data/memory.json`
- `MAX_MEMORY_MESSAGES=100`

Memory endpoints:

- `GET /v1/sessions/:sessionId/memory`
- `DELETE /v1/sessions/:sessionId/memory`

Send `"memory": false` on a request to bypass memory for that request.

Memory is intentionally local and does not extract provider cookies, tokens, credentials or browser session data. The memory layer is gateway-side conversation context; it does not yet create independent native provider conversations.


## v0.7 Memory Intelligence

The memory layer now separates short-term conversation history from explicit long-term user memories.

Memory types:
- `fact`
- `preference`
- `goal`

Long-term memories are stored locally in the same memory file and can be explicitly managed through:
- `GET /v1/memories?session_id=...`
- `POST /v1/memories`
- `POST /v1/memories/search`
- `PATCH /v1/memories/:memoryId`
- `DELETE /v1/memories/:memoryId`

The bridge also performs a small deterministic extraction pass for clear user statements such as "My name is ..." / "اسم من ..." and preference/goal statements. This is intentionally rule-based in v0.7: it does not send private memory data to a separate model and does not claim semantic understanding beyond the supported patterns.

Relevant memories are retrieved using local token overlap plus importance and injected as a `[RELEVANT_USER_MEMORY]` system context. Full client-supplied message histories are now preserved; memory is no longer limited to requests containing exactly one user message.

A request may include `conversation_id` to reuse an existing gateway conversation when it belongs to the same session and provider. Conversation IDs remain gateway-side; native provider conversation IDs are still not claimed.

Privacy:
- Memory is local to the configured JSON file.
- No cookies, provider tokens, passwords or browser credentials are stored by the memory layer.
- Use `memory: false` to bypass memory for a request.
- Delete individual memories or the entire session memory when needed.

Configuration:
- `MAX_MEMORY_MEMORIES=100`
- `MEMORY_RELEVANCE_LIMIT=8`


## v0.8 Native Web Conversations

v0.8 connects gateway conversations to detectable native Web UI conversation URLs.

When a provider exposes a recognizable conversation URL after a successful response, the bridge records:
- `native: true`
- `nativeId`
- `nativeUrl`

On a later request with the same `conversation_id`, the bridge attempts to navigate the provider Web UI back to that native conversation before sending the next message.

Current URL recognition:
- ChatGPT: `/c/<id>`
- Gemini: `/app/<id>`
- Claude: `/chat/<id>`

This is deliberately conservative. The bridge does not read cookies, authentication tokens, private browser storage, or provider API credentials. It only uses the visible browser URL and normal Web UI navigation.

Provider UI layouts can change, so native recognition/navigation must be verified with a real logged-in browser session before being treated as production-stable.


## v0.9 Local Project Bridge

The bridge can now connect to explicitly registered local project workspaces. This is a local filesystem capability; it does not grant arbitrary computer access.

Register a project:

~~~text
POST /v1/projects
{
  "id": "ezshope",
  "name": "EZSHOPE",
  "root": "C:/Users/sinaaaaaa/Desktop/EZSHOPE",
  "testCommand": ["npm", "test"],
  "buildCommand": ["npm", "run", "build"]
}
~~~

Project endpoints:

- `GET /v1/projects` — list registered workspaces
- `POST /v1/projects` — register a workspace
- `DELETE /v1/projects/:projectId` — unregister a workspace
- `GET /v1/projects/:projectId/file?path=...` — read a project file
- `PUT /v1/projects/:projectId/file` — write a project file
- `GET /v1/projects/:projectId/files?path=...` — directory listing (blocked entries such as `.git`/`node_modules` are hidden)
- `GET /v1/projects/:projectId/search?q=...` — search project text
- `GET /v1/projects/:projectId/context?q=...` — collect matching file contents as AI context
- `GET /v1/projects/:projectId/git/status` — git status
- `GET /v1/projects/:projectId/git/diff` — diff summary
- `GET /v1/projects/:projectId/git/diffFull` — full diff
- `GET /v1/projects/:projectId/git/log` — recent commits
- `POST /v1/projects/:projectId/run/test` — run the configured test command
- `POST /v1/projects/:projectId/run/build` — run the configured build command

Safety boundary:

- Only explicitly registered project roots are accessible.
- File paths are checked to prevent escaping the workspace.
- File reads/writes have a configurable size limit.
- Search skips common generated/dependency directories such as `.git`, `node_modules`, `dist` and `target`.
- Git operations are limited to read-only status/diff/log operations.
- Command execution is limited to commands explicitly configured on the project.
- The bridge does not read browser cookies, provider tokens or credentials.

Configuration:

- `PROJECTS_FILE=./data/projects.json`
- `MAX_PROJECTS=50`
- `MAX_PROJECT_FILE_BYTES=2000000`
- `MAX_PROJECT_SEARCH_RESULTS=100`

The project bridge is designed so a future UI or coding agent can use these capabilities as explicit tools instead of giving an LLM unrestricted access to the computer.
