import crypto from "node:crypto";

export class SessionManager {
  constructor({ ttlMs = 30 * 60 * 1000, maxSessions = 100 } = {}) {
    this.ttlMs = ttlMs;
    this.maxSessions = maxSessions;
    this.sessions = new Map();
  }

  create() {
    this.prune();
    if (this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (oldest) this.sessions.delete(oldest);
    }
    const id = "sess_" + crypto.randomUUID();
    this.sessions.set(id, { id, createdAt: Date.now(), lastUsedAt: Date.now() });
    return id;
  }

  touch(id) {
    if (!id) return null;
    const session = this.sessions.get(id);
    if (!session) return null;
    session.lastUsedAt = Date.now();
    return session;
  }

  ensure(id) {
    return this.touch(id) || this.create();
  }

  prune() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, session] of this.sessions) {
      if (session.lastUsedAt < cutoff) this.sessions.delete(id);
    }
  }

  status() {
    this.prune();
    return { active: this.sessions.size, ttlMs: this.ttlMs };
  }
}
