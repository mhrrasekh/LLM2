export class RequestManager {
  constructor({ maxQueueSize = 4 } = {}) {
    this.maxQueueSize = maxQueueSize;
    this.running = false;
    this.queue = [];
    this.failures = 0;
  }

  get status() {
    return { running: this.running, queued: this.queue.length, failures: this.failures };
  }

  run(task) {
    if (this.running || this.queue.length) {
      if (this.queue.length >= this.maxQueueSize) {
        const error = new Error("REQUEST_QUEUE_FULL");
        error.code = "REQUEST_QUEUE_FULL";
        return Promise.reject(error);
      }
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.drain();
    });
  }

  async drain() {
    if (this.running) return;
    const item = this.queue.shift();
    if (!item) return;

    this.running = true;
    try {
      item.resolve(await item.task());
    } catch (error) {
      this.failures++;
      item.reject(error);
    } finally {
      this.running = false;
      queueMicrotask(() => this.drain());
    }
  }
}
