import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class MemoryManager {
  constructor({
    filePath = "./data/memory.json",
    maxMessagesPerSession = 100,
    maxMessageChars = 20000,
    summaryEvery = 20,
    maxSummaryChars = 4000,
    maxMemoriesPerSession = 100,
    relevanceLimit = 8
  } = {}) {
    this.filePath = path.resolve(filePath);
    this.maxMessagesPerSession = maxMessagesPerSession;
    this.maxMessageChars = maxMessageChars;
    this.summaryEvery = summaryEvery;
    this.maxSummaryChars = maxSummaryChars;
    this.maxMemoriesPerSession = maxMemoriesPerSession;
    this.relevanceLimit = relevanceLimit;
    this.data = { version: 3, sessions: {} };
    this.loaded = false;
    this.writeChain = Promise.resolve();
  }

  async load() {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.version === 1 || parsed.version === 2 || parsed.version === 3) && parsed.sessions) {
        this.data = parsed;
        if (this.data.version < 3) this.data.version = 3;
        for (const record of Object.values(this.data.sessions)) {
          if (!record.memories) record.memories = [];
        }
      }
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
    if (Array.isArray(record)) return { summary: "", messages: [...record], memories: [] };
    return {
      summary: record?.summary || "",
      messages: [...(record?.messages || [])],
      memories: [...(record?.memories || [])]
    };
  }

  async getRecord(sessionId) {
    await this.load();
    return this.normalize(this.data.sessions[sessionId]);
  }

  async get(sessionId) {
    return (await this.getRecord(sessionId)).messages;
  }

  tokenize(text) {
    return new Set(
      String(text).toLowerCase()
        .replace(/[^\p{L}\p{N}_-]+/gu, " ")
        .split(/\s+/)
        .filter(token => token.length >= 2)
    );
  }

  scoreMemory(memory, query) {
    const queryTokens = this.tokenize(query);
    const memoryTokens = this.tokenize((memory.key || "") + " " + (memory.value || ""));
    if (!queryTokens.size || !memoryTokens.size) return 0;
    let overlap = 0;
    for (const token of queryTokens) if (memoryTokens.has(token)) overlap++;
    return overlap / queryTokens.size + Number(memory.importance || 0) * 0.05;
  }

  async listMemories(sessionId) {
    return (await this.getRecord(sessionId)).memories;
  }

  async addMemory(sessionId, input) {
    await this.load();
    const record = await this.getRecord(sessionId);
    const type = ["fact", "preference", "goal"].includes(input?.type) ? input.type : "fact";
    const key = typeof input?.key === "string" ? input.key.trim().slice(0, 200) : "";
    const value = typeof input?.value === "string" ? input.value.trim().slice(0, this.maxMessageChars) : "";
    if (!key || !value) {
      const error = new Error("Memory key and value are required.");
      error.code = "INVALID_MEMORY";
      error.status = 400;
      throw error;
    }
    const importance = Math.min(1, Math.max(0, Number(input?.importance ?? 0.5) || 0.5));
    const now = new Date().toISOString();
    const existing = record.memories.find(item => item.key === key && item.type === type);
    if (existing) {
      existing.value = value;
      existing.importance = importance;
      existing.updatedAt = now;
      existing.source = input?.source === "system" ? "system" : "user";
    } else {
      record.memories.push({
        id: "mem_" + crypto.randomUUID(),
        type, key, value, importance,
        source: input?.source === "system" ? "system" : "user",
        createdAt: now,
        updatedAt: now
      });
    }
    record.memories.sort((a, b) => Number(b.importance) - Number(a.importance) || b.updatedAt.localeCompare(a.updatedAt));
    record.memories = record.memories.slice(0, this.maxMemoriesPerSession);
    this.data.version = 3;
    this.data.sessions[sessionId] = record;
    await this.persist();
    return record.memories.find(item => item.key === key && item.type === type);
  }

  async updateMemory(sessionId, memoryId, patch) {
    await this.load();
    const record = await this.getRecord(sessionId);
    const memory = record.memories.find(item => item.id === memoryId);
    if (!memory) return null;
    if (typeof patch?.key === "string" && patch.key.trim()) memory.key = patch.key.trim().slice(0, 200);
    if (typeof patch?.value === "string" && patch.value.trim()) memory.value = patch.value.trim().slice(0, this.maxMessageChars);
    if (patch?.importance !== undefined) memory.importance = Math.min(1, Math.max(0, Number(patch.importance) || 0));
    if (["fact", "preference", "goal"].includes(patch?.type)) memory.type = patch.type;
    memory.updatedAt = new Date().toISOString();
    this.data.sessions[sessionId] = record;
    await this.persist();
    return memory;
  }

  async deleteMemory(sessionId, memoryId) {
    await this.load();
    const record = await this.getRecord(sessionId);
    const before = record.memories.length;
    record.memories = record.memories.filter(item => item.id !== memoryId);
    if (record.memories.length === before) return false;
    this.data.sessions[sessionId] = record;
    await this.persist();
    return true;
  }

  async searchMemories(sessionId, query, limit = this.relevanceLimit) {
    const memories = await this.listMemories(sessionId);
    return memories
      .map(memory => ({ memory, score: this.scoreMemory(memory, query) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.memory.importance) - Number(a.memory.importance))
      .slice(0, Math.max(1, Math.min(50, limit)))
      .map(item => item.memory);
  }

  extractMemories(messages) {
    const extracted = [];
    for (const message of messages) {
      if (!message || message.role !== "user" || typeof message.content !== "string") continue;
      const text = message.content.trim();
      const patterns = [
        { type: "fact", re: /^(?:my name is|i am|i'm)\\s+(.{1,120})[.!]?$/i, key: "profile" },
        { type: "fact", re: /^اسم من\\s+(.{1,120})[.!؟]?$/u, key: "profile" },
        { type: "preference", re: /^(?:i prefer|i like|i love)\\s+(.{1,160})[.!]?$/i, key: "preference" },
        { type: "preference", re: /^(?:من ترجیح می.?دهم|من دوست دارم)\\s+(.{1,160})[.!؟]?$/u, key: "preference" },
        { type: "goal", re: /^(?:my goal is|i want to|i need to)\\s+(.{1,160})[.!]?$/i, key: "goal" },
        { type: "goal", re: /^(?:هدف من|می.?خواهم|لازم دارم)\\s+(.{1,160})[.!؟]?$/u, key: "goal" }
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern.re);
        if (match) {
          extracted.push({ type: pattern.type, key: pattern.key, value: match[1].trim(), importance: pattern.type === "goal" ? 0.8 : 0.7, source: "system" });
          break;
        }
      }
    }
    return extracted;
  }

  async remember(sessionId, messages, { extract = true } = {}) {
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
    if (extract) {
      for (const memory of this.extractMemories(messages)) {
        const existing = record.memories.find(item => item.key === memory.key && item.type === memory.type);
        if (existing) {
          existing.value = memory.value;
          existing.importance = Math.max(existing.importance, memory.importance);
          existing.updatedAt = new Date().toISOString();
        } else {
          record.memories.push({ id: "mem_" + crypto.randomUUID(), ...memory, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
      }
      record.memories = record.memories
        .sort((a, b) => Number(b.importance) - Number(a.importance))
        .slice(0, this.maxMemoriesPerSession);
    }
    if (record.messages.length >= this.summaryEvery) {
      const keep = Math.max(6, Math.floor(this.summaryEvery / 2));
      const archived = record.messages.slice(0, -keep);
      record.summary = this.mergeSummary(record.summary, archived).slice(-this.maxSummaryChars);
      record.messages = record.messages.slice(-keep);
    }
    this.data.version = 3;
    this.data.sessions[sessionId] = record;
    await this.persist();
  }

  async buildContext(sessionId, messages, memoryEnabled = true) {
    if (!memoryEnabled) return messages;
    const record = await this.getRecord(sessionId);
    const query = messages.filter(item => item.role === "user").at(-1)?.content || "";
    const relevant = await this.searchMemories(sessionId, query);
    const context = [];
    if (record.summary) context.push({ role: "system", content: "[LONG_TERM_MEMORY]\n" + record.summary });
    if (relevant.length) {
      context.push({
        role: "system",
        content: "[RELEVANT_USER_MEMORY]\n" + relevant.map(item => "- " + item.type + ": " + item.key + " = " + item.value).join("\n")
      });
    }
    if (messages.length === 1 && messages[0].role === "user") context.push(...record.messages, messages[0]);
    else context.push(...messages);
    return context;
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
      memories: records.reduce((sum, item) => sum + item.memories.length, 0),
      summarizedSessions: records.filter(item => Boolean(item.summary)).length,
      filePath: this.filePath
    };
  }
}