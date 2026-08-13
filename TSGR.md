# TSGR Forensic Log Specification (.tsgr)

The `.tsgr` file is a crucial component of the **Organic** "Human, not A.I." document verification ecosystem. It acts as an immutable companion forensic log alongside your standard document files (e.g., `my_essay.txt` is accompanied by `my_essay.txt.tsgr`). To safeguard the forensic integrity of the timeline and prevent accidental deletion, modification, or movement of the database by the writer, the `.tsgr` file is automatically hidden by the operating system (created with a leading dot on Unix/macOS/Linux and set with hidden attributes on Windows).

Here is an architectural breakdown of how the TSGR system works under the hood.

---

## 1. Core Architecture

The TSGR system operates on a **hybrid client-server (Tauri + Rust + SQLite)** model:

```
[ Frontend Editor (contenteditable) ]
               │
               │  (Caret & Text Interception)
               ▼
[ Caret & Selection Offset Tracker ]
               │
               │  (Tauri IPC: log_forensic_event)
               ▼
[ Rust Backend (Tauri State) ]
               │
               │  (SQLite Transactions)
               ▼
[ System Temp DB (tauri_forensic_*.db) ] ──(Sync/Save)──► [ Companion File (document.txt.tsgr) ]
```

---

## 2. Timeseries Graph Replay (TSGR) Coordinate Space

Unlike a conventional text editor that only captures a document's final state, **Timeseries Graph Replay (TSGR)** models writing as a dynamic trajectory through a multi-dimensional coordinate space. This trajectory maps the writer's exact creative workflow by tracking coordinates over time:

*   **X-Axis (Time & Line Spatiality)**: Composed of the chronological **Timestamp** ($t$) coupled with the vertical **Row / Line Number** ($r$). This captures *when* and *where* vertically the action occurred.
*   **Y-Axis (Horizontal Caret Offset)**: Composed of the horizontal **Column / Caret Offset** ($c$) within that line.
*   **Mapping/Edge Relationships**: Together, the $(Timestamp, Row, Col)$ tuple is mapped to the **Content** payload (e.g., `'a'`, `'\n'`, or a multi-line pasted block) through a specific **Event Type** attribute (such as `input`, `clipboard_paste`, `before_replace`, `undo`).

By treating the writing process as a graph trajectory rather than a static string, TSGR captures the natural rhythm of human output—such as thinking pauses, spelling corrections, and non-linear edits. Conversely, AI generations or script injections reveal themselves as near-instantaneous vertical spikes in the coordinate space, making automated text easy to detect.

---

## 3. Step-by-Step Lifecycle

### A. Interception & Caret Tracking
As you type, edit, or paste inside the distraction-free editor:
1. **Event Capture**: The frontend listens to browser-native `input`, `beforeinput`, `paste`, `copy`, `cut`, and `composition` events.
2. **Caret Mapping**: A custom, layout-aware DOM traversal algorithm (`getCaretOffset` in `main.ts`) tracks the cursor's selection boundary. This handles nested blocks (`<div>`, `<p>`, `<br>`) and translates the caret position into a precise character offset.
3. **Coordinates Extraction**: The offset is converted into a human-readable **Row (Line)** and **Column** pair matching the exact plain-text representation of the document.

### B. Transactional Buffer (Temp DB)
To protect your disk from unnecessary wear-and-tear and isolate uncommitted sessions:
1. The Rust backend initializes a temporary SQLite database in the system's temporary directory (`tauri_forensic_<pid>.db`).
2. Every logged event is dispatched asynchronously via Tauri IPC to the `log_forensic_event` command, which executes a write operation on the `forensic_log` table:
   ```sql
   INSERT INTO forensic_log (timestamp, row, column, event_type, content)
   VALUES (?1, ?2, ?3, ?4, ?5);
   ```

### C. Companion Sync & Conservation
1. **On Save**: Clicking "Save" or executing `CmdOrCtrl+S` writes the active document's HTML to disk (e.g., `document.txt`), and immediately copies the temporary database to a companion file called `document.txt.tsgr` (which is saved as `.[filename].tsgr` on Unix/macOS/Linux and marked with a hidden attribute on Windows).
2. **On Open**: When you open an existing file, if a `.tsgr` companion file exists adjacent to it, the backend copies it into the temporary workspace. The file's initial plain-text is logged as an `open` event to set up a starting baseline.
3. **On Close**: If you close without saving, the temporary database is securely wiped from your system's temp folder. If you exit cleanly, the final state is committed.

### D. Decoupled Sharing & Missing Database Behavior
If a user shares the main document file (e.g., `essay.txt`) but fails to provide the hidden companion database (e.g., `.essay.txt.tsgr`):
1. **Graceful Fallback**: The backend's `open_document` command detects that the `.tsgr` file is missing. Instead of throwing an error, it purges any lingering session data, instantiates a clean, empty temporary SQLite database, and runs `init_db`.
2. **Baseline Logging**: The frontend immediately captures the text currently on disk and logs it as a singular `open` event.
3. **Loss of Forensic Chain**: Because the chronological sequence of intermediate typing, deleting, and editing coordinates ($t, r, c$) is absent, the replay engine will only display a single state transition (the baseline `open` event containing the completed text). The writer loses the mathematical proof of human authorship, as there is no interactive timeline to scrub through.

---

## 4. Database Schema

The `.tsgr` file is a lightweight SQLite database consisting of a single, well-indexed table:

```sql
CREATE TABLE IF NOT EXISTS forensic_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER, -- Unix epoch millisecond timestamp
    "row" INTEGER,     -- 1-based line number of the modification
    "column" INTEGER,  -- 1-based character column offset in the row
    event_type TEXT,   -- "new", "open", "input", "clipboard_paste", "clipboard_cut", "close", "before_replace"
    content TEXT       -- The actual text inserted/removed, or inputType metadata
);
```

---

## 5. Chronological Replay Engine

When you trigger **Replay Session**, the custom playback player reconstructs your writing timeline:
1. **Filtering**: The player calls `get_forensic_events` to retrieve the logs chronologically and filters out non-textual checkpoints (like `save` metadata).
2. **Sequential Array Playback**: It iterates through the events using a custom array-based builder (`reconstructDocumentUpTo`):
   * **`open` / `new`**: Initializes the starting layout lines.
   * **`input`**: Inserts individual characters or processes line breaks (`Enter`) and deletions (`deleteContentBackward` / `deleteContentForward`).
   * **`before_replace` / `clipboard_cut`**: Removes selection blocks.
   * **`clipboard_paste`**: Splices multiline pasted text directly into the coordinates.
3. **Interactive Scrubber**: Users can pause, scrub to any point in time, alter the speed (from 0.5x up to instant replay), or check the live-updating database audit log.

---
*Organic - Human, not A.I. Initiative*