import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { ChatGPTProvider } from "./providers/chatgpt.js";
import { config } from "./config.js";

const app = express();
const provider = new ChatGPTProvider();
let busy = false;

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, provider: "chatgpt-web", browser: "chrome-playwright" });
});

app.get("/v1/models", (_req, res) => {
  res.json({
    object: "list",
    data: [{ id: "browser", object: "model", owned_by: "browser-llm-bridge" }]
  });
});

app.post("/v1/chat/completions", async (req, res) => {
  if (busy) {
    return res.status(429).json({
      error: { message: "Another browser request is already running.", type: "busy" }
    });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const userMessages = messages.filter(
    m => m?.role === "user" && typeof m.content === "string"
  );
  const prompt = userMessages.at(-1)?.content?.trim();

  if (!prompt) {
    return res.status(400).json({
      error: { message: "messages must contain a user message.", type: "invalid_request_error" }
    });
  }

  busy = true;
  try {
    const content = await provider.chat(prompt);
    res.json({
      id: "chatcmpl-browser-" + crypto.randomUUID(),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: req.body.model || "browser",
      choices: [{
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop"
      }]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message.startsWith("CHATGPT_") ? 502 : 500).json({
      error: { message, type: "browser_provider_error" }
    });
  } finally {
    busy = false;
  }
});

app.listen(config.port, "127.0.0.1", () => {
  console.log("browser-llm-bridge listening on http://127.0.0.1:" + config.port);
});
