import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { createProviders } from "./providers/index.js";
import { RequestManager } from "./request-manager.js";
import { browserStatus } from "./browser.js";
import { config } from "./config.js";
import { createLogger } from "./logger.js";
import { ProviderError } from "./providers/base.js";

export function createApp({ providers = createProviders(), requestManager = new RequestManager({ maxQueueSize: config.maxQueueSize }) } = {}) {
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
      queue: requestManager.status
    });
  });

  app.get("/ready", async (_req, res) => {
    const provider = providers.get("browser");
    const health = provider ? await provider.health() : { ready: false };
    const ready = Boolean(health.ready);
    res.status(ready ? 200 : 503).json({
      ok: ready,
      provider: health,
      queue: requestManager.status
    });
  });

  app.get("/v1/models", (_req, res) => {
    res.json({
      object: "list",
      data: [
        { id: "browser", object: "model", owned_by: "browser-llm-bridge" },
        { id: "chatgpt", object: "model", owned_by: "browser-llm-bridge" }
      ]
    });
  });

  app.post("/v1/chat/completions", async (req, res) => {
    const requestId = "req_" + crypto.randomUUID();
    const started = Date.now();

    try {
      const messages = validateMessages(req.body?.messages);
      const model = typeof req.body?.model === "string" ? req.body.model : "browser";
      const provider = providers.get(model) || providers.get("browser");

      if (!provider) {
        return res.status(400).json({
          error: { message: "Unknown model/provider.", type: "invalid_request_error", code: "MODEL_NOT_FOUND" }
        });
      }

      logger.info("request accepted", { requestId, model, messages: messages.length });

      const content = await requestManager.run(() => provider.chat(messages));

      res.json({
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

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  app.listen(config.port, "127.0.0.1", () => {
    console.log("browser-llm-bridge listening on http://127.0.0.1:" + config.port);
  });
}
