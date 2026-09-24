import { chromium } from "playwright";
import { config } from "./config.js";

let contextPromise = null;

export async function getContext() {
  if (!contextPromise) {
    contextPromise = chromium.launchPersistentContext(config.browserProfile, {
      channel: "chrome",
      headless: config.headless,
      viewport: { width: 1440, height: 1000 }
    }).catch(error => {
      contextPromise = null;
      throw error;
    });
  }
  return contextPromise;
}

export async function browserStatus() {
  if (!contextPromise) return { ready: false, pages: 0 };
  try {
    const context = await contextPromise;
    return { ready: true, pages: context.pages().length };
  } catch {
    return { ready: false, pages: 0 };
  }
}

export async function closeBrowser() {
  if (!contextPromise) return;
  const promise = contextPromise;
  contextPromise = null;
  const context = await promise.catch(() => null);
  if (context) await context.close();
}
