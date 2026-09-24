import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class MemoryManager {
  constructor({ filePath = "./data/memory.json", maxMessagesPerSession = 100, maxMessageChars = 20000, summaryEvery = 20, maxSummaryChars = 4000 } = {}) {
    this.filePath = path.resolve(filePath);
    this.maxMessagesPerSession = maxMessagesPerSession;
    this.maxMessageChars = maxMessageChars;
    this.summaryEvery = summaryEvery;
    this.maxSummaryChars = maxSummaryChars;
    this.data = { version: 2, sessions: {} };
    this.loaded = false;
    this.writeChain = Promise.resolve();
  }

  async load() {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.version === 1 || parsed.version === 2) && parsed.sessions) this.data = parsed;
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

  normalize(record) {
    if (Array.isArray(record)) return { summary: "", messages: [...record] };
    return { summary: record?.summary || "", messages: [...(record?.messages || [])] };
  }

  async getRecord(sessionId) {
    await this.load();
    return this.normalize(this.data.sessions[sessionId]);
  }

  async get(sessionId) {
    return (await this.getRecord(sessionId)).messages;
  }

  async buildContext(sessionId, messages, memoryEnabled = true) {
    if (!memoryEnabled) return messages;
    const record = await this.getRecord(sessionId);
    if (messages.length !== 1 || messages[0].role !== "user") return messages;

    const context = [];
    if (record.summary) context.push({ role: "system", content: "[LONG_TERM_MEMORY]\n" + record.summary });
    context.push(...record.messages, messages[0]);
    return context;
  }

  async remember(sessionId, messages) {
    await this.load();
    const record = await this.getRecord(sessionId);

    for (const message of messages) {
      if (!message || !["system", "user", "assistant"].includes(message.role)) continue;
      if (typeof message.content !== "string") continue;
      record.messages.push({
        role: message.role,
        content: message.content.slice(0, this.maxMessageChars),
        createdAt: new Date().toISOString()
      });
    }

    if (record.messages.length >= this.summaryEvery) {
      const keep = Math.max(6, Math.floor(this.summaryEvery / 2));
      const archived = record.messages.slice(0, -keep);
      record.summary = this.mergeSummary(record.summary, archived).slice(-this.maxSummaryChars);
      record.messages = record.messages.slice(-keep);
    }

    this.data.version = 2;
    this.data.sessions[sessionId] = record;
    await this.persist();
  }

  mergeSummary(previous, messages) {
    const lines = messages.map(item =>
      item.role.toUpperCase() + ": " + item.content.replace(/\s+/g, " ").trim()
    );
    return (previous ? previous + "\n" : "") + lines.join("\n");
  }

  async clear(sessionId) {
    await this.load();
    delete this.data.sessions[sessionId];
    await this.persist();
  }

  async status() {
    await this.load();
    const records = Object.values(this.data.sessions).map(item => this.normalize(item));
    return {
      sessions: records.length,
      messages: records.reduce((sum, item) => sum + item.messages.length, 0),
      summarizedSessions: records.filter(item => Boolean(item.summary)).length,
      filePath: this.filePath
    };
  }
}
