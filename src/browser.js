import { chromium } from "playwright";
import { config } from "./config.js";

let context;

export async function getContext() {
  if (!context) {
    context = await chromium.launchPersistentContext(config.browserProfile, {
      channel: "chrome",
      headless: config.headless,
      viewport: { width: 1440, height: 1000 }
    });
  }
  return context;
}

export async function closeBrowser() {
  if (context) {
    await context.close();
    context = undefined;
  }
}
