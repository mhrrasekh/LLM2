const levels = { info: 1, warn: 2, error: 3 };

export function createLogger(scope = "bridge") {
  const write = (level, message, meta = {}) => {
    const payload = {
      time: new Date().toISOString(),
      level,
      scope,
      message,
      ...meta
    };
    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  return {
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta)
  };
}
