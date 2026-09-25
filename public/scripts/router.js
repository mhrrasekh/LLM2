// Hash-based router: #/chat, #/projects, ... No full page reloads.

import { sections, defaultRoute, findSection } from "./views/registry.js";
import { notFoundView } from "./views/notFound.js";
import { sectionScaffold } from "./ui.js";

export function pathFromHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return defaultRoute;
  return raw.startsWith("/") ? raw : "/" + raw;
}

export function navigate(path) {
  const target = path.startsWith("/") ? path : "/" + path;
  if (window.location.hash === "#" + target) {
    dispatch(); // same route: re-render
  } else {
    window.location.hash = target; // triggers hashchange -> dispatch
  }
}

let mainEl = null;

function setActive(route) {
  for (const link of document.querySelectorAll("[data-route]")) {
    if (link.dataset.route === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

async function render(route) {
  const section = findSection(route);
  const title = section ? section.label : notFoundView.title;
  document.title = title + " — LLM2";
  mainEl.innerHTML = "";

  if (!section) {
    await notFoundView.render(mainEl, { path: route, navigate });
    return;
  }
  if (section.view) {
    await section.view.render(mainEl, { navigate });
  } else {
    mainEl.replaceChildren(sectionScaffold({
      title: section.label,
      description: section.description,
      backend: section.backend
    }));
  }
}

function dispatch() {
  const route = pathFromHash();
  setActive(route);
  render(route);
}

export function startRouter(main) {
  mainEl = main;
  window.addEventListener("hashchange", dispatch);
  dispatch();
}
