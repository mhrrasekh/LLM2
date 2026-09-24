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
  maxMessageChars: positiveInt(process.env.MAX_MESSAGE_CHARS, 20000),
  sessionTtlMs: positiveInt(process.env.SESSION_TTL_MS, 1800000),
  maxSessions: positiveInt(process.env.MAX_SESSIONS, 100),
  memoryFile: path.resolve(process.env.MEMORY_FILE || "./data/memory.json"),
  maxMemoryMessages: positiveInt(process.env.MAX_MEMORY_MESSAGES, 100),
  memoryEnabled: process.env.MEMORY_ENABLED !== "false",
  memorySummaryEvery: positiveInt(process.env.MEMORY_SUMMARY_EVERY, 20),
  maxMemorySummaryChars: positiveInt(process.env.MAX_MEMORY_SUMMARY_CHARS, 4000),
  maxConversations: positiveInt(process.env.MAX_CONVERSATIONS, 100)
};
