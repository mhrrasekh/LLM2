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
import { MemoryManager } from "./memory-manager.js";
import { ConversationManager } from "./conversation-manager.js";
import { ProjectManager } from "./project-manager.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function createApp({
  router = createProviderRouter(),
  requestManager = new RequestManager({ maxQueueSize: config.maxQueueSize }),
  sessionManager = new SessionManager({ ttlMs: config.sessionTtlMs, maxSessions: config.maxSessions }),
  memoryManager = new MemoryManager({
    filePath: config.memoryFile,
    maxMessagesPerSession: config.maxMemoryMessages,
    maxMessageChars: config.maxMessageChars,
    summaryEvery: config.memorySummaryEvery,
    maxSummaryChars: config.maxMemorySummaryChars,
    maxMemoriesPerSession: config.maxMemoryMemories,
    relevanceLimit: config.memoryRelevanceLimit
  }),
  conversationManager = new ConversationManager({
    ttlMs: config.sessionTtlMs,
    maxConversations: config.maxConversations
  }),
  projectManager = new ProjectManager({
    filePath: config.projectsFile,
    maxProjects: config.maxProjects,
    maxFileBytes: config.maxProjectFileBytes,
    maxSearchResults: config.maxProjectSearchResults
  })
} = {}) {
  const app = express();
  const logger = createLogger("http");

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.resolve(__dirname, "../public")));

  app.get("/health", async (_req, res) => {
    const browser = await browserStatus();
    res.json({
      ok: true,
      service: "browser-llm-bridge",
      browser,
      queue: requestManager.status,
      sessions: sessionManager.status(),
      memory: await memoryManager.status(),
      conversations: conversationManager.status()
    });
  });

  app.get("/ready", async (_req, res) => {
    try {
      const provider = router.get("browser");
      const health = await provider.health();
      const ready = Boolean(health.ready);
      res.status(ready ? 200 : 503).json({ ok: ready, provider: health, queue: requestManager.status });
    } catch (error) {
      res.status(503).json({ ok: false, error: { code: error.code || "NOT_READY", message: error.message } });
    }
  });

  app.get("/v1/capabilities", (_req, res) => {
    res.json({ object: "list", data: router.capabilities() });
  });

  app.get("/v1/sessions", (_req, res) => {
    res.json({ object: "sessions", ...sessionManager.status() });
  });

  app.get("/v1/sessions/:sessionId/memory", async (req, res) => {
    res.json({ object: "memory", session_id: req.params.sessionId, ...(await memoryManager.getRecord(req.params.sessionId)) });
  });

  app.delete("/v1/sessions/:sessionId/memory", async (req, res) => {
    await memoryManager.clear(req.params.sessionId);
    res.json({ ok: true, session_id: req.params.sessionId });
  });

  app.get("/v1/memories", async (req, res) => {
    const sessionId = req.header("x-session-id") || req.query.session_id;
    if (!sessionId) return res.status(400).json({ error: { code: "SESSION_REQUIRED", message: "session_id or X-Session-ID is required." } });
    res.json({ object: "list", session_id: sessionId, data: await memoryManager.listMemories(sessionId) });
  });

  app.post("/v1/memories", async (req, res) => {
    try {
      const sessionId = req.header("x-session-id") || req.body?.session_id;
      if (!sessionId) return res.status(400).json({ error: { code: "SESSION_REQUIRED", message: "session_id or X-Session-ID is required." } });
      const memory = await memoryManager.addMemory(sessionId, req.body);
      res.status(201).json(memory);
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.post("/v1/memories/search", async (req, res) => {
    const sessionId = req.header("x-session-id") || req.body?.session_id;
    const query = typeof req.body?.query === "string" ? req.body.query : "";
    if (!sessionId || !query) return res.status(400).json({ error: { code: "INVALID_MEMORY_SEARCH", message: "session_id and query are required." } });
    res.json({ object: "list", session_id: sessionId, data: await memoryManager.searchMemories(sessionId, query, req.body?.limit) });
  });

  app.patch("/v1/memories/:memoryId", async (req, res) => {
    try {
      const sessionId = req.header("x-session-id") || req.body?.session_id;
      if (!sessionId) return res.status(400).json({ error: { code: "SESSION_REQUIRED", message: "session_id or X-Session-ID is required." } });
      const memory = await memoryManager.updateMemory(sessionId, req.params.memoryId, req.body);
      if (!memory) return res.status(404).json({ error: { code: "MEMORY_NOT_FOUND", message: "Memory not found." } });
      res.json(memory);
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.delete("/v1/memories/:memoryId", async (req, res) => {
    const sessionId = req.header("x-session-id") || req.query.session_id;
    if (!sessionId) return res.status(400).json({ error: { code: "SESSION_REQUIRED", message: "session_id or X-Session-ID is required." } });
    const removed = await memoryManager.deleteMemory(sessionId, req.params.memoryId);
    res.status(removed ? 200 : 404).json({ ok: removed });
  });

  app.get("/v1/conversations", (_req, res) => {
    res.json({ object: "conversations", ...conversationManager.status() });
  });

  app.get("/v1/conversations/:conversationId", (req, res) => {
    const conversation = conversationManager.get(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({
        error: { code: "CONVERSATION_NOT_FOUND", message: "Conversation not found." }
      });
    }
    res.json(conversation);
  });

  app.delete("/v1/conversations/:conversationId", (req, res) => {
    const removed = conversationManager.remove(req.params.conversationId);
    res.status(removed ? 200 : 404).json({ ok: removed });
  });

  app.get("/v1/projects", async (_req, res) => {
    res.json({ object: "projects", data: await projectManager.list() });
  });

  app.post("/v1/projects", async (req, res) => {
    try {
      res.status(201).json(await projectManager.add(req.body));
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.delete("/v1/projects/:projectId", async (req, res) => {
    try {
      const removed = await projectManager.remove(req.params.projectId);
      res.status(removed ? 200 : 404).json({ ok: removed });
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.get("/v1/projects/:projectId/file", async (req, res) => {
    try {
      res.json(await projectManager.readFile(req.params.projectId, req.query.path));
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.put("/v1/projects/:projectId/file", async (req, res) => {
    try {
      res.json(await projectManager.writeFile(req.params.projectId, req.body?.path, req.body?.content));
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.get("/v1/projects/:projectId/search", async (req, res) => {
    try {
      res.json(await projectManager.search(req.params.projectId, req.query.q));
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.get("/v1/projects/:projectId/context", async (req, res) => {
    try {
      res.json(await projectManager.context(req.params.projectId, req.query.q, Math.min(Number(req.query.max_files) || 8, 20)));
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.get("/v1/projects/:projectId/git/:operation", async (req, res) => {
    try {
      res.json(await projectManager.git(req.params.projectId, req.params.operation));
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.post("/v1/projects/:projectId/run/:kind", async (req, res) => {
    try {
      if (!["test", "build"].includes(req.params.kind)) {
        return res.status(400).json({ error: { code: "INVALID_COMMAND_KIND", message: "Allowed commands: test, build." } });
      }
      res.json(await projectManager.runConfigured(req.params.projectId, req.params.kind));
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({ error: { message: normalized.message, type: normalized.type, code: normalized.code } });
    }
  });

  app.get("/v1/models", (_req, res) => {
    res.json({ object: "list", data: router.list() });
  });

  app.post("/v1/chat/completions", async (req, res) => {
    const requestId = "req_" + crypto.randomUUID();
    const started = Date.now();

    try {
      const messages = validateMessages(req.body?.messages);
      const headerSessionId = req.header("x-session-id");
      const cookieSessionId = readCookie(req.headers.cookie, "llm2_session");
      const session = sessionManager.ensure(headerSessionId || cookieSessionId);
      const sessionId = typeof session === "string" ? session : session.id;
      if (!sessionId) {
        const error = new Error("Failed to establish a browser bridge session.");
        error.code = "SESSION_CREATE_FAILED";
        error.status = 500;
        throw error;
      }
      res.setHeader("Set-Cookie", "llm2_session=" + encodeURIComponent(sessionId) + "; Path=/; HttpOnly; SameSite=Lax");
      const model = typeof req.body?.model === "string" ? req.body.model : "browser";
      const provider = router.get(model);
      const memoryEnabled = req.body?.memory !== false && config.memoryEnabled;
      let conversation = null;
      const requestedConversationId = typeof req.body?.conversation_id === "string" ? req.body.conversation_id : null;
      if (requestedConversationId) {
        const existing = conversationManager.get(requestedConversationId);
        if (existing && existing.sessionId === sessionId && existing.provider === provider.name) conversation = existing;
      }
      if (!conversation) conversation = conversationManager.ensure(sessionId, provider.name);
      if (conversation.native) {
        const restored = await provider.restoreConversation(conversation);
        if (!restored) {
          conversation.native = false;
          conversation.nativeId = null;
          conversation.nativeUrl = null;
        }
      }
      const contextMessages = await memoryManager.buildContext(sessionId, messages, memoryEnabled);

      res.setHeader("X-Request-ID", requestId);
      res.setHeader("X-Session-ID", sessionId);
      res.setHeader("X-Conversation-ID", conversation.id);

      logger.info("request accepted", {
        requestId,
        sessionId,
        conversationId: conversation.id,
        model,
        messages: messages.length,
        contextMessages: contextMessages.length,
        memoryEnabled
      });

      const content = await requestManager.run(() => provider.chat(contextMessages));
      const nativeState = await provider.getConversationState();
      if (nativeState.native) {
        conversationManager.ensure(sessionId, provider.name, nativeState);
      }

      if (memoryEnabled) {
        await memoryManager.remember(sessionId, [
          messages.at(-1),
          { role: "assistant", content }
        ]);
      }

      const completionId = "chatcmpl-browser-" + crypto.randomUUID();

      if (req.body?.stream === true) {
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write("data: " + JSON.stringify({
          id: completionId,
          object: "chat.completion.chunk",
          model,
          session_id: sessionId,
          conversation_id: conversation.id,
          choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }]
        }) + "\n\n");
        res.write("data: " + JSON.stringify({
          id: completionId,
          object: "chat.completion.chunk",
          model,
          session_id: sessionId,
          conversation_id: conversation.id,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
        }) + "\n\n");
        res.write("data: [DONE]\n\n");
        res.end();
      } else {
        res.json({
          id: completionId,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          session_id: sessionId,
          conversation_id: conversation.id,
          choices: [{
            index: 0,
            message: { role: "assistant", content },
            finish_reason: "stop"
          }]
        });
      }

      logger.info("request completed", { requestId, durationMs: Date.now() - started });
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error("request failed", {
        requestId,
        durationMs: Date.now() - started,
        code: normalized.code,
        error: normalized.message
      });

      if (!res.headersSent) {
        res.status(normalized.status).json({
          error: {
            message: normalized.message,
            type: normalized.type,
            code: normalized.code
          }
        });
      }
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

  return input.map(message => {
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

function readCookie(header, name) {
  if (!header) return null;
  const pair = String(header)
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(name + "="));
  if (!pair) return null;
  try {
    return decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    return null;
  }
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