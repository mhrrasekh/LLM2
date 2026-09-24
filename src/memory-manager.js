import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class MemoryManager {
  constructor({ filePath = "./data/memory.json", maxMessagesPerSession = 100, maxMessageChars = 20000 } = {}) {
    this.filePath = path.resolve(filePath);
    this.maxMessagesPerSession = maxMessagesPerSession;
    this.maxMessageChars = maxMessageChars;
    this.data = { version: 1, sessions: {} };
    this.loaded = false;
    this.writeChain = Promise.resolve();
  }

  async load() {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1 && parsed.sessions) this.data = parsed;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    this.loaded = true;
  }

  async save() {
    const payload = JSON.stringify(this.data, null, 2) + "\n";
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + "." + crypto.randomUUID() + ".tmp";
    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, this.filePath);
  }

  async persist() {
    this.writeChain = this.writeChain.then(() => this.save());
    return this.writeChain;
  }

  async get(sessionId) {
    await this.load();
    return [...(this.data.sessions[sessionId] || [])];
  }

  async buildContext(sessionId, messages, memoryEnabled = true) {
    if (!memoryEnabled) return messages;
    const stored = await this.get(sessionId);
    if (messages.length === 1 && messages[0].role === "user") {
      return [...stored, messages[0]];
    }
    return messages;
  }

  async remember(sessionId, messages) {
    await this.load();
    const session = this.data.sessions[sessionId] || [];
    for (const message of messages) {
      if (!message || !["system", "user", "assistant"].includes(message.role)) continue;
      if (typeof message.content !== "string") continue;
      session.push({
        role: message.role,
        content: message.content.slice(0, this.maxMessageChars),
        createdAt: new Date().toISOString()
      });
    }
    this.data.sessions[sessionId] = session.slice(-this.maxMessagesPerSession);
    await this.persist();
  }

  async clear(sessionId) {
    await this.load();
    delete this.data.sessions[sessionId];
    await this.persist();
  }

  async status() {
    await this.load();
    const sessions = Object.values(this.data.sessions);
    return {
      sessions: sessions.length,
      messages: sessions.reduce((sum, items) => sum + items.length, 0),
      filePath: this.filePath
    };
  }
}
