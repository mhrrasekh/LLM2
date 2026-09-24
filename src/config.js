import path from "node:path";

export const config = {
  port: Number(process.env.PORT || 3000),
  llmUrl: process.env.LLM_URL || "https://chatgpt.com/",
  headless: process.env.HEADLESS === "true",
  browserProfile: path.resolve(process.env.BROWSER_PROFILE || "./browser-profile"),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 120000)
};
