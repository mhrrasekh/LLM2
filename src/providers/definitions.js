export const providerDefinitions = {
  chatgpt: {
    name: "chatgpt-web",
    url: "https://chatgpt.com/",
    origin: "https://chatgpt.com",
    conversationIdPattern: /\/c\/([a-zA-Z0-9-]+)/,
    inputSelectors: [
      "#prompt-textarea",
      "textarea[data-testid='text-input']",
      "textarea[placeholder*='Message']",
      "textarea[placeholder*='پیام']",
      "[contenteditable='true'][role='textbox']"
    ],
    sendSelectors: [
      "button[data-testid='send-button']",
      "button[aria-label*='Send']",
      "button[aria-label*='ارسال']"
    ],
    responseSelector: "[data-message-author-role='assistant']",
    errors: {
      input: "CHATGPT_INPUT_NOT_FOUND",
      response: "CHATGPT_RESPONSE_NOT_FOUND",
      timeout: "CHATGPT_RESPONSE_TIMEOUT",
      inputMessage: "ChatGPT input was not found. Sign in normally if required."
    },
    capabilities: {
      chat: true, streaming: "compatibility", systemMessages: true,
      conversationSessions: true, tools: false, vision: false, files: false
    }
  },
  gemini: {
    name: "gemini-web",
    url: "https://gemini.google.com/",
    origin: "https://gemini.google.com",
    conversationIdPattern: /\/app\/([a-zA-Z0-9-]+)/,
    inputSelectors: [
      "rich-textarea .ql-editor",
      "div[contenteditable='true'][role='textbox']",
      "textarea[placeholder*='Enter a prompt']",
      "textarea[placeholder*='prompt']"
    ],
    sendSelectors: [
      "button[aria-label*='Send']",
      "button[aria-label*='send']"
    ],
    responseSelector: "message-content",
    errors: {
      input: "GEMINI_INPUT_NOT_FOUND",
      response: "GEMINI_RESPONSE_NOT_FOUND",
      timeout: "GEMINI_RESPONSE_TIMEOUT",
      inputMessage: "Gemini input was not found. Sign in normally if required."
    },
    capabilities: {
      chat: true, streaming: "compatibility", systemMessages: true,
      conversationSessions: true, tools: false, vision: false, files: false
    }
  },
  claude: {
    name: "claude-web",
    url: "https://claude.ai/new",
    origin: "https://claude.ai",
    conversationIdPattern: /\/chat\/([a-zA-Z0-9-]+)/,
    inputSelectors: [
      "div[contenteditable='true'][role='textbox']",
      "textarea[placeholder*='Reply']",
      "textarea[placeholder*='message']"
    ],
    sendSelectors: [
      "button[aria-label*='Send']",
      "button[aria-label*='send']"
    ],
    responseSelector: "[data-is-streaming='false']",
    errors: {
      input: "CLAUDE_INPUT_NOT_FOUND",
      response: "CLAUDE_RESPONSE_NOT_FOUND",
      timeout: "CLAUDE_RESPONSE_TIMEOUT",
      inputMessage: "Claude input was not found. Sign in normally if required."
    },
    capabilities: {
      chat: true, streaming: "compatibility", systemMessages: true,
      conversationSessions: true, tools: false, vision: false, files: false
    }
  }

  grok: {
    name: "grok-web",
    url: "https://grok.com/",
    origin: "https://grok.com",
    conversationIdPattern: /\/(?:c|conversation)\/([a-zA-Z0-9-]+)/,
    inputSelectors: [
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='Message']",
      "textarea",
      "[contenteditable='true'][role='textbox']"
    ],
    sendSelectors: ["button[aria-label*='Send']", "button[type='submit']"],
    responseSelector: "[data-testid*='message'], [data-message-author-role='assistant']",
    errors: { input: "GROK_INPUT_NOT_FOUND", response: "GROK_RESPONSE_NOT_FOUND", timeout: "GROK_RESPONSE_TIMEOUT", inputMessage: "Grok input was not found. Sign in normally if required." },
    capabilities: { chat: true, streaming: "compatibility", systemMessages: true, conversationSessions: true, tools: false, vision: false, files: false }
  },
  deepseek: {
    name: "deepseek-web",
    url: "https://chat.deepseek.com/",
    origin: "https://chat.deepseek.com",
    conversationIdPattern: /\/(?:a|chat)\/([a-zA-Z0-9-]+)/,
    inputSelectors: ["textarea", "textarea[placeholder*='Message']", "[contenteditable='true'][role='textbox']"],
    sendSelectors: ["button[type='submit']", "button[aria-label*='Send']"],
    responseSelector: "[data-testid*='message'], .ds-markdown",
    errors: { input: "DEEPSEEK_INPUT_NOT_FOUND", response: "DEEPSEEK_RESPONSE_NOT_FOUND", timeout: "DEEPSEEK_RESPONSE_TIMEOUT", inputMessage: "DeepSeek input was not found. Sign in normally if required." },
    capabilities: { chat: true, streaming: "compatibility", systemMessages: true, conversationSessions: true, tools: false, vision: false, files: false }
  },
  qwen: {
    name: "qwen-web",
    url: "https://chat.qwen.ai/",
    origin: "https://chat.qwen.ai",
    conversationIdPattern: /\/(?:c|chat)\/([a-zA-Z0-9-]+)/,
    inputSelectors: ["textarea", "textarea[placeholder*='message']", "[contenteditable='true'][role='textbox']"],
    sendSelectors: ["button[type='submit']", "button[aria-label*='Send']"],
    responseSelector: "[data-testid*='message'], .markdown-body",
    errors: { input: "QWEN_INPUT_NOT_FOUND", response: "QWEN_RESPONSE_NOT_FOUND", timeout: "QWEN_RESPONSE_TIMEOUT", inputMessage: "Qwen input was not found. Sign in normally if required." },
    capabilities: { chat: true, streaming: "compatibility", systemMessages: true, conversationSessions: true, tools: false, vision: false, files: false }
  },
  mistral: {
    name: "mistral-web",
    url: "https://chat.mistral.ai/",
    origin: "https://chat.mistral.ai",
    conversationIdPattern: /\/(?:chat|conversation)\/([a-zA-Z0-9-]+)/,
    inputSelectors: ["textarea", "textarea[placeholder*='message']", "[contenteditable='true'][role='textbox']"],
    sendSelectors: ["button[type='submit']", "button[aria-label*='Send']"],
    responseSelector: "[data-testid*='message'], .prose",
    errors: { input: "MISTRAL_INPUT_NOT_FOUND", response: "MISTRAL_RESPONSE_NOT_FOUND", timeout: "MISTRAL_RESPONSE_TIMEOUT", inputMessage: "Mistral input was not found. Sign in normally if required." },
    capabilities: { chat: true, streaming: "compatibility", systemMessages: true, conversationSessions: true, tools: false, vision: false, files: false }
  },
  perplexity: {
    name: "perplexity-web",
    url: "https://www.perplexity.ai/",
    origin: "https://www.perplexity.ai",
    conversationIdPattern: /\/search\/([a-zA-Z0-9-]+)/,
    inputSelectors: ["textarea", "textarea[placeholder*='Ask']", "[contenteditable='true'][role='textbox']"],
    sendSelectors: ["button[aria-label*='Submit']", "button[aria-label*='Send']", "button[type='submit']"],
    responseSelector: "[data-testid*='answer'], .prose",
    errors: { input: "PERPLEXITY_INPUT_NOT_FOUND", response: "PERPLEXITY_RESPONSE_NOT_FOUND", timeout: "PERPLEXITY_RESPONSE_TIMEOUT", inputMessage: "Perplexity input was not found. Sign in normally if required." },
    capabilities: { chat: true, streaming: "compatibility", systemMessages: true, conversationSessions: true, tools: false, vision: false, files: false }
  },
};
