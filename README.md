# Browser LLM Bridge

A local MVP exposing an OpenAI-compatible HTTP endpoint backed by an authorized Chrome session controlled with Playwright.

## Requirements

- Node.js 20+
- Google Chrome
- Normal ChatGPT Web login in the dedicated browser profile

## Setup

1. Install dependencies: npm install
2. Install Playwright browser support: npx playwright install chromium
3. Start: npm start

The bridge uses ./browser-profile as a dedicated persistent browser profile. If ChatGPT asks for sign-in, sign in normally in the opened Chrome window.

The project does not read or store passwords, cookies, session tokens, or API keys.

## API

GET http://127.0.0.1:3000/health

GET http://127.0.0.1:3000/v1/models

POST http://127.0.0.1:3000/v1/chat/completions

Example request:

{
  "model": "browser",
  "messages": [
    { "role": "user", "content": "سلام! یک جمله درباره هوش مصنوعی بگو." }
  ]
}

## Limitations

This is browser automation, not an official ChatGPT API.

It does not bypass authentication, CAPTCHA, quotas, rate limits, or provider security controls.

ChatGPT Web may change its DOM selectors, so the provider adapter may need maintenance.

Requests are serialized: one browser interaction at a time.

The MVP sends the latest user message only; full conversation-history replay is not implemented yet.

## License

MIT
