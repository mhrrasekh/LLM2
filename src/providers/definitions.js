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
};
