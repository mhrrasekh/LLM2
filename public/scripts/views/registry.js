// Sidebar sections aligned to the real backend capabilities documented in
// docs/ARCHITECTURE.md (section 5). Views without a `view` module render the
// honest "shell only" scaffold until their roadmap phase lands.

import { chatView } from "./chat.js";
import { dashboardView } from "./dashboard.js";

export const sections = [
  { group: "Overview", id: "dashboard", label: "Dashboard", route: "/dashboard", icon: "dashboard",
    description: "Server, providers, requests, memory and project overview.", view: dashboardView },

  { group: "Workspace", id: "chat", label: "Chat", route: "/chat", icon: "chat",
    description: "Send messages to any configured browser provider.", view: chatView },
  { group: "Workspace", id: "projects", label: "Projects", route: "/projects", icon: "projects",
    description: "Register and open local project workspaces.", backend: "ready" },
  { group: "Workspace", id: "files", label: "Files", route: "/files", icon: "files",
    description: "Browse and read files of the active project. Requires a registered project.", backend: "ready" },
  { group: "Workspace", id: "git", label: "Git", route: "/git", icon: "git",
    description: "Status, diff and history of the active project. Requires a registered project.", backend: "ready" },

  { group: "Intelligence", id: "memory", label: "Memory", route: "/memory", icon: "memory",
    description: "Long-term memories, summaries and memory settings.", backend: "ready" },
  { group: "Intelligence", id: "models", label: "Models", route: "/models", icon: "models",
    description: "Providers, capabilities, health and availability.", backend: "ready" },

  { group: "System", id: "logs", label: "Logs", route: "/logs", icon: "logs",
    description: "Recent request logs (id, session, provider, duration, status).", backend: "partial" },
  { group: "System", id: "settings", label: "Settings", route: "/settings", icon: "settings",
    description: "General, server, memory and security preferences.", backend: "partial" }
];

export const defaultRoute = "/dashboard";

export function findSection(route) {
  return sections.find((section) => section.route === route) || null;
}
