// Chat workspace — port of the original single-page chat UI.
// Uses the existing /v1/models and /v1/chat/completions contracts.

import { api } from "../api.js";
import { h, spinner, errorState, emptyState } from "../ui.js";

const DEFAULT_MESSAGE = "سلام، فقط بگو LLM2 OK";

export const chatView = {
  title: "Chat",
  description: "Send messages to any configured browser provider.",
  async render(root) {
    const modelHost = h("div", { id: "chatModels" }, spinner("Loading models…"));
    const message = h("textarea", {
      id: "chatMessage", class: "textarea", rows: 5,
      placeholder: "پیام خود را بنویسید…"
    }, DEFAULT_MESSAGE);
    const send = h("button", { id: "chatSend", class: "btn btn-primary", type: "button" }, "Send");
    const status = h("p", { class: "chat-status", role: "status", "aria-live": "polite" });
    const answer = h("div", { class: "chat-answer", id: "chatAnswer" });

    root.replaceChildren(
      h("section", { class: "panel" },
        h("header", { class: "panel-head" },
          h("h2", {}, "Chat"),
          h("p", { class: "muted" }, chatView.description)
        ),
        h("div", { class: "chat-form" },
          h("div", {},
            h("label", { class: "field-label", for: "chatModel" }, "Provider / model"),
            modelHost
          ),
          h("div", {},
            h("label", { class: "field-label", for: "chatMessage" }, "Message"),
            message
          ),
          h("div", { class: "chat-actions" }, send)
        ),
        status,
        answer
      )
    );

    message.focus();

    async function loadModels() {
      modelHost.replaceChildren(spinner("Loading models…"));
      try {
        const data = await api.get("/v1/models");
        const models = Array.isArray(data?.data) ? data.data : [];
        if (!models.length) {
          modelHost.replaceChildren(emptyState({
            title: "No models available",
            description: "No provider model targets are registered on the bridge."
          }));
          send.disabled = true;
          return;
        }
        const select = h("select", { id: "chatModel", class: "select" },
          models.map((model) => h("option", { value: model.id }, model.id))
        );
        modelHost.replaceChildren(select);
      } catch (error) {
        modelHost.replaceChildren(errorState(error, loadModels));
        send.disabled = true;
      }
    }

    send.addEventListener("click", async () => {
      const select = document.getElementById("chatModel");
      const content = message.value.trim();
      if (!select) return;
      if (!content) { status.textContent = "Write a message first."; return; }

      send.disabled = true;
      status.textContent = "Sending…";
      answer.replaceChildren();

      try {
        const result = await api.post("/v1/chat/completions", {
          model: select.value,
          messages: [{ role: "user", content }]
        });
        answer.textContent = result?.choices?.[0]?.message?.content || "";
        status.textContent = "Completed with " + (result?.model || select.value);
      } catch (error) {
        answer.replaceChildren(errorState(error, null));
        status.textContent = "Request failed";
      } finally {
        send.disabled = false;
      }
    });

    await loadModels();
  }
};
