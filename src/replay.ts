import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface ForensicEvent {
  id: number;
  timestamp: number;
  row: number;
  column: number;
  event_type: string;
  content: string | null;
}

let events: ForensicEvent[] = [];
let currentIndex = -1;
let isPlaying = false;
let playInterval: number | null = null;

let editorEl: HTMLElement | null = null;
let auditListEl: HTMLElement | null = null;
let statusTextEl: HTMLElement | null = null;
let scrubber: HTMLInputElement | null = null;

let btnPlayPause: HTMLButtonElement | null = null;
let selectSpeed: HTMLSelectElement | null = null;

async function initReplay() {
  try {
    const localEditorEl = document.getElementById("replay-editor") as HTMLElement;
    const localAuditListEl = document.getElementById("audit-list") as HTMLElement;
    const localStatusTextEl = document.getElementById("status-text") as HTMLElement;
    const localScrubber = document.getElementById("timeline-scrubber") as HTMLInputElement;

    const localBtnPlayPause = document.getElementById("btn-play-pause") as HTMLButtonElement;
    const localSelectSpeed = document.getElementById("play-speed") as HTMLSelectElement;

    if (!localEditorEl || !localAuditListEl || !localStatusTextEl || !localScrubber || !localBtnPlayPause || !localSelectSpeed) {
      return;
    }

    editorEl = localEditorEl;
    auditListEl = localAuditListEl;
    statusTextEl = localStatusTextEl;
    scrubber = localScrubber;
    btnPlayPause = localBtnPlayPause;
    selectSpeed = localSelectSpeed;

    // Bind event listeners only when elements are found
    localBtnPlayPause.addEventListener("click", () => {
      if (isPlaying) {
        pausePlayback();
      } else {
        if (currentIndex >= events.length - 1) {
          setStep(0);
        }
        play();
      }
    });
    localScrubber.addEventListener("input", (e) => { pausePlayback(); setStep(parseInt((e.target as HTMLInputElement).value)); });
    localSelectSpeed.addEventListener("change", () => { if (isPlaying) { pausePlayback(); play(); } });

    // Listen for session changes to dynamically reload the timeline
    await listen("session-changed", async () => {
      pausePlayback();
      await loadReplayData();
    });

    // Also reload whenever the replay window gains focus
    window.addEventListener("focus", async () => {
      if (!isPlaying) {
        await loadReplayData();
      }
    });

    // Listen for main window reload/active state to reload the entire webview
    await listen("main-window-active", () => {
      pausePlayback();
      window.location.reload();
    });

    await loadReplayData();
  } catch (err) {
    if (statusTextEl) {
      statusTextEl.textContent = `Replay loading failed: ${err}`;
    }
  }
}

async function loadReplayData() {
  try {
    if (!statusTextEl || !scrubber) return;
    const rawEvents = await invoke<ForensicEvent[]>("get_forensic_events");
    events = rawEvents;
    if (events.length === 0) {
      statusTextEl.textContent = "No forensic entries recorded yet.";
      if (editorEl) editorEl.innerHTML = "";
      if (auditListEl) auditListEl.innerHTML = "";
      scrubber.max = "0";
      scrubber.value = "0";
      currentIndex = -1;
      return;
    }

    // Perform full step-by-step cryptographic validation of all save points
    const validationResult = await verifyAllSavePoints(rawEvents);
    const isIntegrityValid = validationResult.isValid;
    if (!isIntegrityValid) {
      statusTextEl.innerHTML = `Audit records loaded: ${events.length} | <span style="color: #e06c75; font-weight: bold;">**Integrity mismatch check**: failed. Check audit log.</span>`;
    } else {
      statusTextEl.innerHTML = `Audit records loaded: ${events.length} | <span style="color: #98c379; font-weight: bold;">**Integrity mismatch check**: passed</span>`;
    }
    scrubber.max = (events.length - 1).toString();
    renderAuditLog(isIntegrityValid, validationResult.failedSaveIndices, validationResult.failedOpenIndices || []);
    setStep(0);
  } catch (err) {
    if (statusTextEl) {
      statusTextEl.textContent = `Replay loading failed: ${err}`;
    }
  }
}

function renderAuditLog(isIntegrityValid: boolean, failedSaveIndices: number[] = [], failedOpenIndices: number[] = []) {
  if (!auditListEl) return;
  const listEl = auditListEl;
  listEl.innerHTML = "";
  events.forEach((ev, i) => {
    const item = document.createElement("div");
    item.className = "audit-item";
    item.id = `audit-item-${i}`;
    
    const date = new Date(ev.timestamp).toLocaleTimeString();
    let displayContent = ev.content || "";

    if (ev.event_type === "save") {
      const isFailedSave = failedSaveIndices.includes(ev.id);
      if (isFailedSave) {
        item.style.borderLeft = "3px solid #e06c75";
        item.style.backgroundColor = "rgba(224, 108, 117, 0.15)";
        item.style.color = "#e06c75";
        displayContent = `[TAMPERED SAVE] (INTEGRITY MISMATCH)`;
      } else {
        item.style.borderLeft = "3px solid #98c379";
        item.style.backgroundColor = "rgba(152, 195, 121, 0.1)";
        item.style.color = "#98c379";
        displayContent = `[SECURE SAVE] (INTEGRITY PASSED)`;
      }
    } else if (ev.event_type === "open") {
      const isFailedOpen = failedOpenIndices.includes(ev.id);
      if (isFailedOpen) {
        item.style.borderLeft = "3px solid #e06c75";
        item.style.backgroundColor = "rgba(224, 108, 117, 0.15)";
        item.style.color = "#e06c75";
        displayContent = `[TAMPERED OPEN] (EXTERNAL MODIFICATION DETECTED)`;
      } else {
        const firstLine = displayContent.split("\n")[0].trim();
        if (displayContent.includes("\n") || firstLine.length > 100) {
          displayContent = firstLine.substring(0, 100) + "...";
        } else {
          displayContent = firstLine;
        }
      }
    } else if (displayContent.includes("Integrity mismatch check.")) {
      const lines = displayContent.split("\n");
      const idx = lines.findIndex(l => l.includes("Integrity mismatch check."));
      if (idx !== -1) {
        const resultLines = [lines[idx].trim()];
        for (let j = idx + 1; j < lines.length; j++) {
          const trimmed = lines[j].trim();
          if (trimmed.length > 0) {
            resultLines.push(trimmed);
            break;
          }
        }
        displayContent = resultLines.join(" ");
      }
    }

    if (ev.event_type !== "save") {
      if (!isIntegrityValid && displayContent.includes("Integrity mismatch check.")) {
        displayContent = displayContent.replace("Integrity mismatch check.", "**Integrity mismatch check**: failed");
      } else if (displayContent.includes("Integrity mismatch check.")) {
        displayContent = displayContent.replace("Integrity mismatch check.", "**Integrity mismatch check**:");
      }
    }
    const safeContent = displayContent ? ` -> "${displayContent}"` : "";
    if (ev.event_type === "save") {
      item.textContent = `#${i + 1} [${date}] SAVE${safeContent}`;
    } else {
      item.textContent = `#${i + 1} [${date}] ${ev.event_type.toUpperCase()} (L:${ev.row} C:${ev.column})${safeContent}`;
    }

    item.addEventListener("click", () => {
      pausePlayback();
      setStep(i);
    });
    listEl.appendChild(item);
  });
}

function setStep(index: number) {
  if (index < 0 || index >= events.length) return;
  currentIndex = index;
  if (scrubber) scrubber.value = index.toString();
  
  // Highlight current list item
  document.querySelectorAll(".audit-item").forEach(item => item.classList.remove("active"));
  const activeItem = document.getElementById(`audit-item-${index}`);
  if (activeItem) {
    activeItem.classList.add("active");
    activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // Reconstruct document state up to this event index
  const content = reconstructDocumentUpTo(index, events);
  if (editorEl) {
    editorEl.innerHTML = `${escapeHTML(content)}<span id="cursor"></span>`;
  }

  // Update button text if we reached the end of the timeline while not playing
  if (!isPlaying && btnPlayPause) {
    btnPlayPause.textContent = currentIndex >= events.length - 1 ? "Replay" : "Play";
  }
}

export function reconstructDocumentUpTo(index: number, eventList: ForensicEvent[]): string {
  let lines: string[] = [""];
  const undoStack: string[][] = [];
  const redoStack: string[][] = [];

  // Bound the reconstruction loop index to protect against out-of-bounds/undefined errors
  const maxIndex = Math.min(index, eventList.length - 1);
  for (let i = 0; i <= maxIndex; i++) {
    const ev = eventList[i];
    if (!ev) continue;

    if (ev.event_type === "save") {
      continue;
    }

    if (ev.event_type === "undo") {
      if (undoStack.length > 0) {
        redoStack.push([...lines]);
        lines = undoStack.pop()!;
      }
      continue;
    } else if (ev.event_type === "redo") {
      if (redoStack.length > 0) {
        undoStack.push([...lines]);
        lines = redoStack.pop()!;
      }
      continue;
    }

    const r = ev.row - 1; // Convert to 0-based
    const c = ev.column - 1; // Convert to 0-based

    if (ev.event_type === "input") {
      let isDuplicate = false;
      for (let j = i - 1; j >= 0; j--) {
        const prev = eventList[j];
        if (ev.timestamp - prev.timestamp > 2000) {
          break;
        }
        if (
          prev.event_type === "clipboard_paste" &&
          prev.row === ev.row &&
          prev.column === ev.column &&
          prev.content === ev.content
        ) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        for (let j = i + 1; j < eventList.length; j++) {
          const next = eventList[j];
          if (next.timestamp - ev.timestamp > 2000) {
            break;
          }
          if (
            next.event_type === "clipboard_paste" &&
            next.row === ev.row &&
            next.column === ev.column &&
            next.content === ev.content
          ) {
            isDuplicate = true;
            break;
          }
        }
      }
      if (isDuplicate) {
        continue;
      }
    }

    while (lines.length <= r) {
      lines.push("");
    }

    if (ev.event_type === "new") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      lines = [""];
    } else if (ev.event_type === "open") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      const text = ev.content || "";
      lines = text.split("\n");
    } else if (ev.event_type === "before_replace") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      const text = ev.content || "";

      // Look ahead to check if this before_replace is actually a style/format operation.
      // If the next input event is empty, null, or a format/history command, do not delete the text.
      let isFormatEvent = false;
      for (let j = i + 1; j < eventList.length; j++) {
        const nextEv = eventList[j];
        if (nextEv.event_type === "input") {
          const nextContent = nextEv.content || "";
          if (
            !nextEv.content ||
            nextContent === "" ||
            nextContent.startsWith("format") ||
            nextContent.startsWith("history")
          ) {
            isFormatEvent = true;
          }
          break;
        }
      }

      if (!isFormatEvent) {
        deleteTextAt(lines, r, c, text);
      }
    } else if (ev.event_type === "input") {
      const text = ev.content || "";
      if (text.startsWith("format") || text.startsWith("history")) {
        continue;
      }
      undoStack.push([...lines]);
      redoStack.length = 0;
      if (text === "deleteContentBackward" || text === "deleteContentForward") {
        if (c === lines[r].length && r < lines.length - 1) {
          // Merge current line with the next line
          lines[r] += lines[r + 1];
          lines.splice(r + 1, 1);
        } else if (c >= 0 && c < lines[r].length) {
          // Delete character within the line
          // For backspace (deleteContentBackward), we cannot delete a character at index 0
          // because backspace deletes backward and index 0 has nothing before it on this line.
          if (text === "deleteContentBackward" && c === 0) {
              if (lines[r].length === 1) {
                lines[r] = "";
              }
          } else {
            lines[r] = lines[r].slice(0, c) + lines[r].slice(c + 1);
          }
        }
      } else if (text === "insertLineBreak" || text === "insertParagraph" || text === "Enter") {
        const left = lines[r].slice(0, c);
        const right = lines[r].slice(c);
        lines[r] = left;
        lines.splice(r + 1, 0, right);
      } else if (text.length === 1 || (!text.startsWith("delete") && !text.startsWith("insert"))) {
        insertTextAt(lines, r, c, text);
      }
    } else if (ev.event_type === "clipboard_paste") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      const text = ev.content || "";
      insertTextAt(lines, r, c, text);
    } else if (ev.event_type === "clipboard_cut") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      const text = ev.content || "";
      deleteTextAt(lines, r, c, text);
    }
  }
  return lines.join("\n");
}

export async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return await invoke<string>("generate_content_signature", { content: message });
}

export interface ValidationResult {
  isValid: boolean;
  failedSaveIndex?: number;
  failedSaveIndices: number[];
  failedOpenIndices: number[];
}

export async function verifyAllSavePoints(rawEvents: ForensicEvent[]): Promise<ValidationResult> {
  let lines: string[] = [""];
  const undoStack: string[][] = [];
  const redoStack: string[][] = [];
  const failedSaveIndices: number[] = [];
  const failedOpenIndices: number[] = [];
  let isTimelineTampered = false;

  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i];

    if (ev.event_type === "save") {
      const currentText = lines.join("\n");
      const computedHash = await sha256(currentText);
      const expectedHash = ev.content;

      if (isTimelineTampered || computedHash !== expectedHash) {
        failedSaveIndices.push(ev.id);
        isTimelineTampered = true;
      }
      continue;
    }

    if (ev.event_type === "undo") {
      if (undoStack.length > 0) {
        redoStack.push([...lines]);
        lines = undoStack.pop()!;
      }
      continue;
    } else if (ev.event_type === "redo") {
      if (redoStack.length > 0) {
        undoStack.push([...lines]);
        lines = redoStack.pop()!;
      }
      continue;
    }

    const r = ev.row - 1;
    const c = ev.column - 1;

    if (ev.event_type === "input") {
      let isDuplicate = false;
      for (let j = i - 1; j >= 0; j--) {
        const prev = rawEvents[j];
        if (ev.timestamp - prev.timestamp > 2000) break;
        if (prev.event_type === "clipboard_paste" && prev.row === ev.row && prev.column === ev.column && prev.content === ev.content) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        for (let j = i + 1; j < rawEvents.length; j++) {
          const next = rawEvents[j];
          if (next.timestamp - ev.timestamp > 2000) break;
          if (next.event_type === "clipboard_paste" && next.row === ev.row && next.column === ev.column && next.content === ev.content) {
            isDuplicate = true;
            break;
          }
        }
      }
      if (isDuplicate) continue;
    }

    while (lines.length <= r) {
      lines.push("");
    }

    if (ev.event_type === "new") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      lines = [""];
    } else if (ev.event_type === "open") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      const text = ev.content || "";
      if (i > 0) {
        const expectedText = lines.join("\n");
        if (text !== expectedText) {
          isTimelineTampered = true;
          failedOpenIndices.push(ev.id);
        }
      }
      lines = text.split("\n");
    } else if (ev.event_type === "before_replace") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      const text = ev.content || "";
      let isFormatEvent = false;
      for (let j = i + 1; j < rawEvents.length; j++) {
        const nextEv = rawEvents[j];
        if (nextEv.event_type === "input") {
          const nextContent = nextEv.content || "";
          if (!nextEv.content || nextContent === "" || nextContent.startsWith("format") || nextContent.startsWith("history")) {
            isFormatEvent = true;
          }
          break;
        }
      }
      if (!isFormatEvent) {
        deleteTextAt(lines, r, c, text);
      }
    } else if (ev.event_type === "input") {
      const text = ev.content || "";
      if (text.startsWith("format") || text.startsWith("history")) {
        continue;
      }
      undoStack.push([...lines]);
      redoStack.length = 0;
      if (text === "deleteContentBackward" || text === "deleteContentForward") {
        if (c === lines[r].length && r < lines.length - 1) {
          lines[r] += lines[r + 1];
          lines.splice(r + 1, 1);
        } else if (c >= 0 && c < lines[r].length) {
          if (text === "deleteContentBackward" && c === 0) {
              if (lines[r].length === 1) {
                lines[r] = "";
              }
          } else {
            lines[r] = lines[r].slice(0, c) + lines[r].slice(c + 1);
          }
        }
      } else if (text === "insertLineBreak" || text === "insertParagraph" || text === "Enter") {
        const left = lines[r].slice(0, c);
        const right = lines[r].slice(c);
        lines[r] = left;
        lines.splice(r + 1, 0, right);
      } else if (text.length === 1 || (!text.startsWith("delete") && !text.startsWith("insert"))) {
        insertTextAt(lines, r, c, text);
      }
    } else if (ev.event_type === "clipboard_paste") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      const text = ev.content || "";
      insertTextAt(lines, r, c, text);
    } else if (ev.event_type === "clipboard_cut") {
      undoStack.push([...lines]);
      redoStack.length = 0;
      const text = ev.content || "";
      deleteTextAt(lines, r, c, text);
    }
  }
  return {
    isValid: !isTimelineTampered && failedSaveIndices.length === 0 && failedOpenIndices.length === 0,
    failedSaveIndex: failedSaveIndices.length > 0 ? failedSaveIndices[0] : undefined,
    failedSaveIndices,
    failedOpenIndices,
  };
}

export function deleteTextAt(lines: string[], r: number, c: number, text: string) {
  const textLines = text.split("\n");
  if (textLines.length === 1) {
    if (lines[r]) {
      lines[r] = lines[r].slice(0, c) + lines[r].slice(c + text.length);
    }
  } else {
    if (lines[r]) {
      const firstLineRemaining = lines[r].slice(0, c);
      const lastLineIndex = r + textLines.length - 1;
      const lastLineRemaining = lines[lastLineIndex] ? lines[lastLineIndex].slice(textLines[textLines.length - 1].length) : "";
      lines[r] = firstLineRemaining + lastLineRemaining;
      lines.splice(r + 1, textLines.length - 1);
    }
  }
}

export function insertTextAt(lines: string[], r: number, c: number, text: string) {
  const insertLines = text.split("\n");
  if (insertLines.length === 1) {
    if (lines[r] === undefined) lines[r] = "";
    lines[r] = lines[r].slice(0, c) + text + lines[r].slice(c);
  } else {
    if (lines[r] === undefined) lines[r] = "";
    const left = lines[r].slice(0, c);
    const right = lines[r].slice(c);
    lines[r] = left + insertLines[0];
    for (let j = 1; j < insertLines.length - 1; j++) {
      lines.splice(r + j, 0, insertLines[j]);
    }
    lines.splice(r + insertLines.length - 1, 0, insertLines[insertLines.length - 1] + right);
  }
}

export function getFirstFailedIndex(eventList: ForensicEvent[]): number {
  return eventList.findIndex(ev => ev.content && ev.content.includes("Integrity mismatch check.")) + 1;
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function play() {
  isPlaying = true;
  if (btnPlayPause) btnPlayPause.textContent = "Pause";
  const delay = selectSpeed ? parseInt(selectSpeed.value) : 125;
  playInterval = window.setInterval(() => {
    if (currentIndex < events.length - 1) {
      setStep(currentIndex + 1);
    } else {
      pausePlayback();
    }
  }, delay);
}

function pausePlayback() {
  isPlaying = false;
  if (btnPlayPause) {
    btnPlayPause.textContent = currentIndex >= events.length - 1 ? "Replay" : "Play";
  }
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReplay);
  } else {
    initReplay();
  }
}