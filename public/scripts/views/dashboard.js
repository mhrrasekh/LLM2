// Dashboard — read-only overview built from /health, /v1/capabilities and
// /v1/projects. Only real backend data is shown.

import { api } from "../api.js";
import { h, spinner, errorState } from "../ui.js";
import { state } from "../state.js";

let refreshTimer = null;

function stat(label, value, hint, tone) {
  return h("div", { class: "stat" },
    h("span", { class: "stat-label" }, label),
    h("span", { class: "stat-value" + (tone ? " tone-" + tone : "") }, value),
    hint ? h("span", { class: "stat-hint" }, hint) : null
  );
}

function statGrid() {
  return h("div", { class: "stat-grid" });
}

function panel(title, description, body) {
  return h("section", { class: "panel" },
    h("header", { class: "panel-head" },
      h("h2", {}, title),
      h("p", { class: "muted" }, description)
    ),
    body
  );
}

function quickAction(label, onClick, disabledNote) {
  const button = h("button", { class: "btn", type: "button" }, label);
  if (onClick) {
    button.addEventListener("click", onClick);
  } else {
    button.disabled = true;
    button.title = disabledNote || "Not available yet";
    button.setAttribute("aria-disabled", "true");
  }
  return button;
}

function formatUptime(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  if (value < 60) return value + "s";
  const minutes = Math.floor(value / 60);
  if (minutes < 60) return minutes + "m " + (value % 60) + "s";
  const hours = Math.floor(minutes / 60);
  return hours + "h " + (minutes % 60) + "m";
}

export const dashboardView = {
  title: "Dashboard",
  description: "Server, providers, requests, memory and projects at a glance.",
  async render(root, ctx) {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }

    const serverStats = statGrid();
    const requestStats = statGrid();
    const memoryStats = statGrid();
    const providersBody = h("div", {}, spinner("Loading providers…"));
    const projectsBody = h("div", {}, spinner("Loading projects…"));
    const status = h("p", { class: "chat-status", role: "status", "aria-live": "polite" });

    const checkBrowser = h("button", { class: "btn", type: "button" }, "Check browser");
    checkBrowser.addEventListener("click", async () => {
      checkBrowser.disabled = true;
      status.textContent = "Checking browser provider…";
      try {
        const ready = await api.get("/ready");
        status.textContent = ready.ok
          ? "Browser provider is ready."
          : "Browser provider is not ready yet.";
      } catch (error) {
        status.textContent = "Browser not ready: " + (error?.message || "unknown error");
      } finally {
        checkBrowser.disabled = false;
      }
    });

    root.replaceChildren(
      h("section", { class: "panel" },
        h("header", { class: "panel-head" },
          h("h2", {}, "Server"),
          h("p", { class: "muted" }, "Local bridge runtime status")
        ),
        serverStats,
        h("div", { class: "panel-actions" }, checkBrowser),
        status
      ),

      h("div", { class: "quick-actions" },
        quickAction("New chat", () => ctx.navigate("/chat")),
        quickAction("Open project", () => ctx.navigate("/projects")),
        quickAction("Compare models", null, "Available in a later roadmap phase"),
        quickAction("Search", null, "Available in a later roadmap phase")
      ),

      h("div", { class: "dash-grid" },
        panel("Providers", "Configured browser providers", providersBody),
        panel("Requests", "Queue and failure counters", requestStats),
        panel("Memory", "Long-term memory status", memoryStats),
        panel("Projects", "Registered workspaces", projectsBody)
      )
    );

    function paintProviders(capabilities) {
      const providers = Array.isArray(capabilities?.data) ? capabilities.data : [];
      if (!providers.length) {
        providersBody.replaceChildren(h("p", { class: "muted" }, "No providers configured."));
        return;
      }
      providersBody.replaceChildren(
        h("div", { class: "chips" },
          providers.map((entry) => h("span", { class: "chip" }, entry.id))
        ),
        h("p", { class: "stat-hint", style: "margin-top:10px" },
          "Per-provider health lands in a later phase. "
        ),
        h("a", { href: "#/models" }, "View all models")
      );
    }

    function paintProjects(projects) {
      const list = Array.isArray(projects?.data) ? projects.data : [];
      if (!list.length) {
        projectsBody.replaceChildren(
          h("p", { class: "muted" }, "No project registered yet."),
          h("a", { href: "#/projects" }, "Register a project")
        );
        return;
      }
      const active = state.projectId
        ? list.find((project) => project.id === state.projectId)
        : null;
      projectsBody.replaceChildren(
        h("div", { class: "chips" }, list.map((project) => h("span", { class: "chip" }, project.name))),
        h("p", { class: "stat-hint", style: "margin-top:10px" },
          "Active: " + (active ? active.name : "none selected")
        ),
        h("a", { href: "#/projects" }, "Manage projects")
      );
    }

    async function refresh() {
      try {
        const [health, capabilities, projects] = await Promise.all([
          api.get("/health"),
          api.get("/v1/capabilities"),
          api.get("/v1/projects")
        ]);

        serverStats.replaceChildren(
          stat("Status", health.ok ? "ok" : "down", null, health.ok ? "ok" : "bad"),
          stat("Port", health.port != null ? String(health.port) : "—"),
          stat("Uptime", formatUptime(health.uptime)),
          stat("Browser", health.browser?.ready ? "ready" : "not ready",
            health.browser?.pages != null ? health.browser.pages + " page(s)" : null,
            health.browser?.ready ? "ok" : null)
        );

        requestStats.replaceChildren(
          stat("Active", health.queue?.running ? "1" : "0"),
          stat("Queued", String(health.queue?.queued ?? 0)),
          stat("Failures", String(health.queue?.failures ?? 0), null,
            (health.queue?.failures ?? 0) > 0 ? "bad" : null)
        );

        memoryStats.replaceChildren(
          stat("Enabled", health.memory?.enabled ? "yes" : "no", null,
            health.memory?.enabled ? "ok" : "bad"),
          stat("Memories", String(health.memory?.memories ?? 0)),
          stat("Summarized", String(health.memory?.summarizedSessions ?? 0)),
          stat("Threshold", health.memory?.summaryEvery ? health.memory.summaryEvery + " msgs" : "—")
        );

        paintProviders(capabilities);
        paintProjects(projects);
        status.textContent = "";
      } catch (error) {
        status.textContent = "Refresh failed: " + (error?.message || "unknown error");
      }
    }

    await refresh();
    refreshTimer = setInterval(refresh, 15_000);
  }
};
