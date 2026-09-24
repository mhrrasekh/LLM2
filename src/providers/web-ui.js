import { getContext } from "../browser.js";
import { config } from "../config.js";
import { BaseProvider, ProviderError } from "./base.js";

export class WebUIProvider extends BaseProvider {
  constructor(definition) {
    super();
    this.definition = definition;
  }

  get name() { return this.definition.name; }
  get capabilities() { return this.definition.capabilities; }

  async ensurePage() {
    const context = await getContext();
    let page = context.pages().find(p => p.url().startsWith(this.definition.origin));
    if (!page) page = await context.newPage();
    if (!page.url().startsWith(this.definition.origin)) {
      await page.goto(this.definition.url, { waitUntil: "domcontentloaded", timeout: config.requestTimeoutMs });
    }
    return page;
  }

  async health() {
    try {
      const page = await this.ensurePage();
      const input = await this.findVisible(page, this.definition.inputSelectors);
      return { provider: this.name, ready: Boolean(input), authenticated: Boolean(input), url: page.url() };
    } catch (error) {
      return { provider: this.name, ready: false, authenticated: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getConversationState() {
    const page = await this.ensurePage();
    const url = page.url();
    const nativeId = this.extractConversationId(url);
    return nativeId ? { native: true, nativeId, nativeUrl: url } : { native: false, nativeId: null, nativeUrl: null };
  }

  async restoreConversation(state) {
    if (!state?.nativeUrl) return false;
    const page = await this.ensurePage();
    if (page.url() === state.nativeUrl) return true;
    try {
      await page.goto(state.nativeUrl, { waitUntil: "domcontentloaded", timeout: config.requestTimeoutMs });
      return Boolean(this.extractConversationId(page.url()));
    } catch {
      return false;
    }
  }

  extractConversationId(url) {
    const pattern = this.definition.conversationIdPattern;
    if (!pattern) return null;
    const match = String(url).match(pattern);
    return match?.[1] || null;
  }

  async chat(messages) {
    const page = await this.ensurePage();
    const input = await this.findVisible(page, this.definition.inputSelectors);
    if (!input) throw new ProviderError(this.definition.errors.input, this.definition.errors.inputMessage);

    const before = await this.snapshot(page);
    const hasNativeConversation = Boolean(this.extractConversationId(page.url()));
    const promptMessages = hasNativeConversation ? this.latestTurnWithSystemContext(messages) : messages;

    await input.fill(this.formatMessages(promptMessages));
    const send = await this.findVisible(page, this.definition.sendSelectors);
    if (send) await send.click();
    else await input.press("Enter");

    await page.waitForTimeout(500);
    await this.waitForResponse(page, before);

    const response = await this.latestResponse(page);
    if (!response) throw new ProviderError(this.definition.errors.response, "Provider response was not found.");
    return response;
  }

  latestTurnWithSystemContext(messages) {
    const system = messages.filter(message => message.role === "system");
    const user = [...messages].reverse().find(message => message.role === "user");
    return user ? [...system, user] : system;
  }

  formatMessages(messages) {
    return messages.map(message =>
      "[" + String(message.role || "user").toUpperCase() + "]\n" + String(message.content || "").trim()
    ).join("\n\n");
  }

  async findVisible(page, selectors) {
    for (const selector of selectors) {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return loc;
    }
    return null;
  }

  async snapshot(page) {
    return page.locator(this.definition.responseSelector).allInnerTexts().catch(() => []);
  }

  async latestResponse(page) {
    const loc = page.locator(this.definition.responseSelector).last();
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
        else { stable = 0; last = current; }
        if (stable >= 3) return;
      }
      await page.waitForTimeout(1000);
    }
    throw new ProviderError(this.definition.errors.timeout, "Timed out while waiting for the provider response.");
  }
}
