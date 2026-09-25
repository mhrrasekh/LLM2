// Minimal DOM helpers + shared UX-state components for the LLM2 shell.

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4c-1.5 0-3-.4-4.2-1.1L3 20l1.2-5.3A8.4 8.4 0 1 1 21 11.5z"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  files: '<path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M13 3v6h6"/>',
  memory: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  models: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  git: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  logs: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
  moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18.2h.01"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>'
};

export function icon(name, className = "icon") {
  const wrapper = document.createElement("span");
  wrapper.className = className;
  wrapper.setAttribute("aria-hidden", "true");
  const paths = ICONS[name];
  if (paths) {
    wrapper.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>";
  }
  return wrapper;
}

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function spinner(label) {
  return h("span", { class: "spinner", role: "status", "aria-live": "polite" }, label);
}

export function emptyState({ title, description, actionLabel, onAction, iconName = "box" }) {
  const actions = actionLabel
    ? h("div", { class: "state-actions" }, h("button", { class: "btn", type: "button", onClick: onAction }, actionLabel))
    : null;
  return h("div", { class: "state" },
    h("span", { class: "state-icon" }, icon(iconName, "")),
    h("h3", {}, title),
    description ? h("p", {}, description) : null,
    actions
  );
}

export function errorState(error, onRetry) {
  const code = error?.code ? h("p", {}, "Code: ", h("span", { class: "code" }, error.code)) : null;
  const actions = onRetry
    ? h("div", { class: "state-actions" }, h("button", { class: "btn", type: "button", onClick: onRetry }, "Retry"))
    : null;
  return h("div", { class: "state", role: "alert" },
    h("span", { class: "state-icon" }, icon("alert", "")),
    h("h3", {}, "Request failed"),
    h("p", {}, error?.message || "Something went wrong."),
    code,
    actions
  );
}

// Honest placeholder for sections whose UI lands in a later roadmap phase.
export function sectionScaffold({ title, description, backend }) {
  return h("section", { class: "panel" },
    h("header", { class: "panel-head" },
      h("h2", {}, title),
      description ? h("p", { class: "muted" }, description) : null
    ),
    h("div", { class: "pending" },
      h("span", { class: "badge" }, "Shell only"),
      h("p", {}, "This section is part of the LLM2 shell. Its interface is delivered in a later roadmap phase."),
      backend ? h("p", { class: "muted" }, "Backend status: ", backend) : null
    )
  );
}
