import { emptyState } from "../ui.js";

export const notFoundView = {
  title: "Not found",
  render(root, ctx) {
    const path = ctx?.path;
    root.replaceChildren(
      emptyState({
        title: "404 — section not found",
        description: path
          ? "“" + path + "” is not a valid LLM2 section."
          : "This is not a valid LLM2 section.",
        actionLabel: "Go to chat",
        onAction: () => ctx?.navigate?.("/chat"),
        iconName: "alert"
      })
    );
  }
};
