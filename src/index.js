import "dotenv/config";
import { createApp } from "./server.js";
import { config } from "./config.js";

const app = createApp();

app.listen(config.port, "127.0.0.1", () => {
  console.log("browser-llm-bridge listening on http://127.0.0.1:" + config.port);
});
