import { ChatGPTProvider } from "./chatgpt.js";

export function createProviders() {
  const chatgpt = new ChatGPTProvider();
  return new Map([["browser", chatgpt], ["chatgpt", chatgpt]]);
}
