import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { createProviderRouter } from "./providers/router.js";
import { RequestManager } from "./request-manager.js";
import { browserStatus } from "./browser.js";
import { config } from "./config.js";
import { createLogger } from "./logger.js";
import { ProviderError } from "./providers/base.js";
import { SessionManager } from "./session-manager.js";

export function createApp({ router = createProviderRouter(), requestManager = new RequestManager({ maxQueueSize: config.maxQueueSize }), sessionManager = new SessionManager({ ttlMs: config.sessionTtlMs, maxSessions: config.maxSessions }) } = {}) {
  const app = express();
  const logger = createLogger("http");

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", async (_req, res) => {
    const browser = await browserStatus();
    res.json({
      ok: true,
      service: "browser-llm-bridge",
      provider: "chatgpt-web",
      browser,
      queue: requestManager.status,
      sessions: sessionManager.status()
    });
  });

  app.get("/ready", async (_req, res) => {
    const provider = router.get("browser");
    const health = provider ? await provider.health() : { ready: false };
    const ready = Boolean(health.ready);
    res.status(ready ? 200 : 503).json({
      ok: ready,
      provider: health,
      queue: requestManager.status
    });
  });

  app.get("/v1/capabilities", (_req, res) => {
    res.json({ object: "list", data: router.capabilities() });
  });

  app.get("/v1/sessions", (_req, res) => {
    res.json({ object: "sessions", ...sessionManager.status() });
  });

  app.get("/v1/models", (_req, res) => {
    res.json({ object: "list", data: router.list() });
  });

  app.post("/v1/chat/completions", async (req, res) => {
    const requestId = "req_" + crypto.randomUUID();
    const started = Date.now();

    try {
      const messages = validateMessages(req.body?.messages);
      const sessionId = sessionManager.ensure(req.header("x-session-id"))?.id || sessionManager.create();
      const model = typeof req.body?.model === "string" ? req.body.model : "browser";
      const provider = router.get(model);

      res.setHeader("X-Request-ID", requestId);
      res.setHeader("X-Session-ID", sessionId);
      logger.info("request accepted", { requestId, sessionId, model, messages: messages.length });

      const content = await requestManager.run(() => provider.chat(messages));

      if (req.body?.stream === true) {
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write("data: " + JSON.stringify({ id: "chatcmpl-browser-" + crypto.randomUUID(), object: "chat.completion.chunk", model, session_id: sessionId, choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] }) + "\n\n");
        res.write("data: " + JSON.stringify({ id: "chatcmpl-browser-" + crypto.randomUUID(), object: "chat.completion.chunk", model, session_id: sessionId, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }) + "\n\n");
        res.write("data: [DONE]\n\n");
        res.end();
      } else res.json({
        id: "chatcmpl-browser-" + crypto.randomUUID(),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop"
        }]
      });

      logger.info("request completed", { requestId, durationMs: Date.now() - started });
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error("request failed", {
        requestId,
        durationMs: Date.now() - started,
        code: normalized.code,
        error: normalized.message
      });

      res.status(normalized.status).json({
        error: {
          message: normalized.message,
          type: normalized.type,
          code: normalized.code
        }
      });
    }
  });

  return app;
}

function validateMessages(input) {
  if (!Array.isArray(input) || input.length === 0) {
    const error = new Error("messages must be a non-empty array.");
    error.code = "INVALID_MESSAGES";
    error.status = 400;
    throw error;
  }

  if (input.length > config.maxMessages) {
    const error = new Error("Too many messages.");
    error.code = "TOO_MANY_MESSAGES";
    error.status = 400;
    throw error;
  }

  return input.map((message, index) => {
    if (!message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") {
      const error = new Error("Each message must contain a valid role and string content.");
      error.code = "INVALID_MESSAGE";
      error.status = 400;
      throw error;
    }

    if (message.content.length > config.maxMessageChars) {
      const error = new Error("Message content is too long.");
      error.code = "MESSAGE_TOO_LONG";
      error.status = 400;
      throw error;
    }

    return { role: message.role, content: message.content };
  });
}

function normalizeError(error) {
  if (error instanceof ProviderError) {
    return { status: error.status, type: "browser_provider_error", code: error.code, message: error.message };
  }

  if (error?.code === "REQUEST_QUEUE_FULL") {
    return { status: 429, type: "rate_limit_error", code: error.code, message: "Request queue is full." };
  }

  return {
    status: Number.isInteger(error?.status) ? error.status : 500,
    type: "internal_error",
    code: error?.code || "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : String(error)
  };
}

