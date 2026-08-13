import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";

async function init() {
  const contentEl = document.getElementById("content");
  if (!contentEl) return;

  try {
    const markdown = await invoke<string>("read_help_markdown");
    contentEl.innerHTML = marked.parse(markdown) as string;
  } catch (err) {
    contentEl.innerHTML = `<div class="error-alert">Failed to load help file: ${err}</div>`;
  }
}

// Ensure the DOM is fully loaded before executing
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}