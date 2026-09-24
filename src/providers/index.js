import { ChatGPTProvider } from "./chatgpt.js";

export function createProviders() {
  const chatgpt = new ChatGPTProvider();
  return new Map([["browser", chatgpt], ["chatgpt", chatgpt]]);
}

export function listCapabilities(providers) {
  return [...new Set([...providers.values()])].map(provider => ({
    id: provider.name,
    capabilities: provider.capabilities || {}
  }));
}
