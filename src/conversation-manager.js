import crypto from "node:crypto";

export class ConversationManager {
  constructor({ ttlMs = 30 * 60 * 1000, maxConversations = 100 } = {}) {
    this.ttlMs = ttlMs;
    this.maxConversations = maxConversations;
    this.conversations = new Map();
  }

  ensure(sessionId, provider) {
    this.prune();
    let conversation = [...this.conversations.values()].find(
      item => item.sessionId === sessionId && item.provider === provider
    );
    if (!conversation) {
      if (this.conversations.size >= this.maxConversations) {
        const oldest = this.conversations.keys().next().value;
        if (oldest) this.conversations.delete(oldest);
      }
      conversation = {
        id: "conv_" + crypto.randomUUID(),
        sessionId,
        provider,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        native: false
      };
      this.conversations.set(conversation.id, conversation);
    } else {
      conversation.lastUsedAt = Date.now();
    }
    return conversation;
  }

  get(id) {
    this.prune();
    const item = this.conversations.get(id);
    if (item) item.lastUsedAt = Date.now();
    return item || null;
  }

  remove(id) {
    return this.conversations.delete(id);
  }

  prune() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, item] of this.conversations) {
      if (item.lastUsedAt < cutoff) this.conversations.delete(id);
    }
  }

  status() {
    this.prune();
    return { active: this.conversations.size, ttlMs: this.ttlMs };
  }
}
