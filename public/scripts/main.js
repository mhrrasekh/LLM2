// Shell bootstrap: sidebar navigation, theme handling, mobile sidebar toggle,
// service status pill and router startup.

import { sections, defaultRoute } from "./views/registry.js";
import { startRouter } from "./router.js";
import { state, setState, subscribe } from "./state.js";
import { api } from "./api.js";
import { h, icon } from "./ui.js";

const THEME_KEY = "llm2-theme";

/* ---------- sidebar navigation ---------- */

function buildNav() {
  const nav = document.getElementById("sidebarNav");
  nav.replaceChildren();

  let group = null;
  for (const section of sections) {
    if (section.group !== group) {
      group = section.group;
      nav.append(h("div", { class: "nav-group-label" }, group));
    }
    nav.append(
      h("a", {
        class: "nav-link",
        href: "#" + section.route,
        "data-route": section.route
      },
        icon(section.icon),
        h("span", {}, section.label)
      )
    );
  }
}

/* ---------- theme ---------- */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.setProperty("color-scheme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage blocked */ }
  setState({ theme });
}

function initTheme() {
  let theme = null;
  try { theme = localStorage.getItem(THEME_KEY); } catch { /* storage blocked */ }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  applyTheme(theme);

  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch { /* storage blocked */ }
    if (stored !== "light" && stored !== "dark") applyTheme(event.matches ? "light" : "dark");
  });
}

function initThemeToggle() {
  const button = document.getElementById("themeToggle");
  button.append(icon("moon"));

  const sync = ({ theme }) => {
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    button.replaceChildren(icon(theme === "dark" ? "sun" : "moon"));
  };
  sync(state);
  subscribe(sync);

  button.addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });
}

/* ---------- mobile sidebar ---------- */

function initSidebarToggle() {
  const toggle = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  const sidebar = document.getElementById("sidebar");
  toggle.append(icon("menu"));

  const close = () => {
    document.body.classList.remove("sidebar-open");
    toggle.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
  };
  const open = () => {
    document.body.classList.add("sidebar-open");
    toggle.setAttribute("aria-expanded", "true");
    backdrop.hidden = false;
  };

  toggle.addEventListener("click", () => {
    document.body.classList.contains("sidebar-open") ? close() : open();
  });
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      close();
      toggle.focus();
    }
  });
  sidebar.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
}

/* ---------- service status ---------- */

async function refreshStatus() {
  const pill = document.getElementById("serviceStatus");
  pill.className = "status-pill";
  pill.textContent = "checking…";
  try {
    const health = await api.get("/health");
    const ok = Boolean(health?.ok);
    const browserReady = Boolean(health?.browser?.ready);
    pill.className = "status-pill " + (ok ? "ok" : "bad");
    pill.replaceChildren(
      h("span", { class: "dot" }),
      document.createTextNode(" bridge " + (ok ? "ok" : "down") + " · browser " + (browserReady ? "ready" : "not ready"))
    );
  } catch {
    pill.className = "status-pill bad";
    pill.replaceChildren(h("span", { class: "dot" }), document.createTextNode(" offline"));
  }
}

/* ---------- boot ---------- */

function init() {
  buildNav();
  initTheme();
  initThemeToggle();
  initSidebarToggle();
  document.querySelector('.topbar-right a[href="#/settings"]').append(icon("settings"));
  refreshStatus();
  setInterval(refreshStatus, 60_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshStatus();
  });

  if (!window.location.hash) window.location.hash = "#" + defaultRoute;
  startRouter(document.getElementById("main"));
}

init();
