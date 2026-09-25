// Fetch wrapper normalized to the backend error contract:
// non-2xx responses carry { error: { message, type, code } }.

export class ApiError extends Error {
  constructor({ message, code, type, status }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.type = type;
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) }
    });
  } catch {
    throw new ApiError({
      message: "Network request failed. Is the bridge running?",
      code: "NETWORK_ERROR",
      type: "network_error",
      status: 0
    });
  }

  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }

  if (!response.ok) {
    throw new ApiError({
      message: body?.error?.message || response.statusText || "Request failed.",
      code: body?.error?.code || "HTTP_" + response.status,
      type: body?.error?.type || "http_error",
      status: response.status
    });
  }
  return body;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path) => request(path, { method: "DELETE" })
};
