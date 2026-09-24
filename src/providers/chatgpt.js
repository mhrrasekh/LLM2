import { getContext } from "../browser.js";
import { config } from "../config.js";
import { BaseProvider, ProviderError } from "./base.js";
import { CHATGPT_CAPABILITIES } from "./capabilities.js";

const inputSelectors = [
  "#prompt-textarea",
  "textarea[data-testid='text-input']",
  "textarea[placeholder*='Message']",
  "textarea[placeholder*='پیام']",
  "[contenteditable='true'][role='textbox']"
];

const sendSelectors = [
  "button[data-testid='send-button']",
  "button[aria-label*='Send']",
  "button[aria-label*='ارسال']"
];

export class ChatGPTProvider extends BaseProvider {
  get name() {
    return "chatgpt-web";
  }

  get capabilities() {
    return CHATGPT_CAPABILITIES;
  }

  async ensurePage() {
    const context = await getContext();
    let page = context.pages()[0];
    if (!page) page = await context.newPage();

    if (!page.url().startsWith("https://chatgpt.com")) {
      await page.goto(config.llmUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.requestTimeoutMs
      });
    }
    return page;
  }

  async health() {
    try {
      const page = await this.ensurePage();
      const input = await this.findVisible(page, inputSelectors);
      return {
        provider: this.name,
        ready: Boolean(input),
        authenticated: Boolean(input),
        url: page.url()
      };
    } catch (error) {
      return {
        provider: this.name,
        ready: false,
        authenticated: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async chat(messages) {
    const page = await this.ensurePage();
    await page.bringToFront();

    const input = await this.findVisible(page, inputSelectors);
    if (!input) {
      throw new ProviderError(
        "CHATGPT_INPUT_NOT_FOUND",
        "ChatGPT input was not found. Open the browser and sign in normally if required."
      );
    }

    const before = await this.responseSnapshot(page);
    const prompt = this.formatMessages(messages);

    await input.fill(prompt);

    const send = await this.findVisible(page, sendSelectors);
    if (send) await send.click();
    else await input.press("Enter");

    await page.waitForTimeout(500);
    await this.waitForResponse(page, before);

    const response = await this.latestResponse(page);
    if (!response) {
      throw new ProviderError("CHATGPT_RESPONSE_NOT_FOUND", "ChatGPT response was not found.");
    }
    return response;
  }

  formatMessages(messages) {
    return messages.map(message => {
      const role = String(message.role || "user").toUpperCase();
      const content = String(message.content || "").trim();
      return "[" + role + "]\n" + content;
    }).join("\n\n");
  }

  async findVisible(page, selectors) {
    for (const selector of selectors) {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return loc;
    }
    return null;
  }

  async responseSnapshot(page) {
    return page.locator("[data-message-author-role='assistant']").allInnerTexts().catch(() => []);
  }

  async latestResponse(page) {
    const loc = page.locator("[data-message-author-role='assistant']").last();
    if (!await loc.count()) return "";
    return (await loc.innerText()).trim();
  }

  async waitForResponse(page, before) {
    const deadline = Date.now() + config.requestTimeoutMs;
    let stable = 0;
    let last = "";

    while (Date.now() < deadline) {
      const current = (await this.latestResponse(page)).trim();
      const changed = current && (!before.length || current !== before.at(-1)?.trim());

      if (changed) {
        if (current === last) stable++;
        else {
          stable = 0;
          last = current;
        }
        if (stable >= 3) return;
      }
      await page.waitForTimeout(1000);
    }

    throw new ProviderError(
      "CHATGPT_RESPONSE_TIMEOUT",
      "Timed out while waiting for the ChatGPT response."
    );
  }
}
