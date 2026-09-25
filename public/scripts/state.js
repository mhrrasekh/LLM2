// Tiny shared store for shell-wide state (theme, active project, ...).

const listeners = new Set();

export const state = {
  theme: document.documentElement.getAttribute("data-theme") || "dark",
  projectId: null
};

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
