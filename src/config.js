import "dotenv/config";
import path from "node:path";

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: positiveInt(process.env.PORT, 3000),
  llmUrl: process.env.LLM_URL || "https://chatgpt.com/",
  headless: process.env.HEADLESS === "true",
  browserProfile: path.resolve(process.env.BROWSER_PROFILE || "./browser-profile"),
  requestTimeoutMs: positiveInt(process.env.REQUEST_TIMEOUT_MS, 120000),
  maxQueueSize: positiveInt(process.env.MAX_QUEUE_SIZE, 4),
  maxMessages: positiveInt(process.env.MAX_MESSAGES, 40),
  maxMessageChars: positiveInt(process.env.MAX_MESSAGE_CHARS, 20000)
};
