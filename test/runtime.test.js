import test from "node:test";
import assert from "node:assert/strict";
import { RequestManager } from "../src/request-manager.js";
import { createApp } from "../src/server.js";
import { ProviderRouter } from "../src/providers/router.js";

test("RequestManager serializes tasks", async () => {
  const manager = new RequestManager({ maxQueueSize: 2 });
  const events = [];

  const first = manager.run(async () => {
    events.push("first:start");
    await new Promise(resolve => setTimeout(resolve, 20));
    events.push("first:end");
    return "one";
  });

  const second = manager.run(async () => {
    events.push("second:start");
    return "two";
  });

  assert.equal(await first, "one");
  assert.equal(await second, "two");
  assert.deepEqual(events, ["first:start", "first:end", "second:start"]);
});

test("RequestManager rejects a full queue", async () => {
  const manager = new RequestManager({ maxQueueSize: 1 });

  const first = manager.run(async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
    return "one";
  });

  const second = manager.run(async () => "two");
  await assert.rejects(
    manager.run(async () => "three"),
    error => error.code === "REQUEST_QUEUE_FULL"
  );

  await first;
  await second;
});

test("API validates and returns OpenAI-compatible completion", async () => {
  const provider = {
    name: "mock",
    async health() { return { provider: "mock", ready: true }; },
    async chat(messages) {
      assert.equal(messages.length, 2);
      return "mock response";
    }
  };

  const app = createApp({
    router: new ProviderRouter(new Map([["browser", provider]])),
    requestManager: new RequestManager({ maxQueueSize: 2 })
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;

  try {
    const response = await fetch("http://127.0.0.1:" + port + "/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "browser",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hello" }
        ]
      })
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.object, "chat.completion");
    assert.equal(body.choices[0].message.content, "mock response");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("API rejects invalid messages", async () => {
  const app = createApp({
    router: new ProviderRouter(new Map()),
    requestManager: new RequestManager({ maxQueueSize: 1 })
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;

  try {
    const response = await fetch("http://127.0.0.1:" + port + "/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [] })
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, "INVALID_MESSAGES");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});


test("SessionManager creates and reuses sessions", async () => {
  const { SessionManager } = await import("../src/session-manager.js");
  const manager = new SessionManager({ ttlMs: 1000, maxSessions: 2 });
  const first = manager.create();
  assert.match(first, /^sess_/);
  assert.equal(manager.ensure(first).id, first);
  assert.equal(manager.status().active, 1);
});


test("ProviderRouter exposes explicit browser providers", async () => {
  const { createProviderRouter } = await import("../src/providers/router.js");
  const router = createProviderRouter();
  assert.equal(router.get("chatgpt").name, "chatgpt-web");
  assert.equal(router.get("gemini").name, "gemini-web");
  assert.equal(router.get("claude").name, "claude-web");
  assert.equal(router.list().length, 4);
});

test("ProviderRouter rejects unknown models", async () => {
  const { ProviderRouter } = await import("../src/providers/router.js");
  const router = new ProviderRouter();
  await assert.rejects(
    Promise.resolve().then(() => router.get("unknown")),
    error => error.code === "MODEL_NOT_FOUND" && error.status === 404
  );
});
