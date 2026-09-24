import { ChatGPTProvider } from "./chatgpt.js";
import { WebUIProvider } from "./web-ui.js";
import { providerDefinitions } from "./definitions.js";

export class ProviderRouter {
  constructor(providers = new Map()) {
    this.providers = providers;
  }

  get(model = "browser") {
    const provider = this.providers.get(model);
    if (!provider) {
      const error = new Error("Unknown model/provider: " + model);
      error.code = "MODEL_NOT_FOUND";
      error.status = 404;
      throw error;
    }
    return provider;
  }

  list() {
    return [...this.providers.entries()].map(([id, provider]) => ({
      id,
      object: "model",
      owned_by: "browser-llm-bridge",
      provider: provider.name,
      capabilities: provider.capabilities || {}
    }));
  }

  capabilities() {
    return [...new Set([...this.providers.values()])].map(provider => ({
      id: provider.name,
      capabilities: provider.capabilities || {}
    }));
  }
}

export function createProviderRouter() {
  const chatgpt = new ChatGPTProvider();
  const gemini = new WebUIProvider(providerDefinitions.gemini);
  const claude = new WebUIProvider(providerDefinitions.claude);
  const grok = new WebUIProvider(providerDefinitions.grok);
  const deepseek = new WebUIProvider(providerDefinitions.deepseek);
  const qwen = new WebUIProvider(providerDefinitions.qwen);
  const mistral = new WebUIProvider(providerDefinitions.mistral);
  const perplexity = new WebUIProvider(providerDefinitions.perplexity);

  return new ProviderRouter(new Map([
    ["browser", chatgpt],
    ["chatgpt", chatgpt],
    ["gemini", gemini],
    ["claude", claude],
    ["grok", grok],
    ["deepseek", deepseek],
    ["qwen", qwen],
    ["mistral", mistral],
    ["perplexity", perplexity]
  ]));
}
