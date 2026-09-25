import "dotenv/config";
import { createApp } from "./server.js";
import { config } from "./config.js";
import { closeBrowser } from "./browser.js";

const app = createApp();

const server = app.listen(config.port, "127.0.0.1", () => {
  console.log("browser-llm-bridge listening on http://127.0.0.1:" + config.port);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("received " + signal + ", shutting down");
  server.close(() => {
    closeBrowser().finally(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
