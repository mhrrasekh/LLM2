export class ProviderError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
  }
}

export class BaseProvider {
  get name() {
    throw new Error("Provider name is not implemented.");
  }

  async health() {
    return { provider: this.name, ready: false };
  }

  async chat(_messages) {
    throw new Error("Provider chat is not implemented.");
  }
}
