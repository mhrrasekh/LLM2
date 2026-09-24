# Browser LLM Bridge

Professional MVP: a local OpenAI-compatible HTTP bridge backed by an authorized ChatGPT Web browser session controlled with Playwright.

## Architecture

Client -> HTTP API -> validation -> request queue -> provider adapter -> Playwright -> ChatGPT Web

## Requirements

- Node.js 20+
- Google Chrome
- Normal ChatGPT Web login

## Setup

1. Run `npm install`
2. Run `npx playwright install chromium`
3. Run `npm start`
4. On first use, sign in normally in the dedicated browser profile if required.

The default automation profile is `./browser-profile`. Keep it separate from your everyday Chrome profile.

## Endpoints

- `GET /health` — bridge, browser and queue status
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