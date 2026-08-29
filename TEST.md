# Organic Replay - macOS Manual Test Suite (TestFlight & Sandbox) 📝

This document outlines the essential manual test scenarios that must be executed and verified within the sandboxed **macOS TestFlight** or Mac App Store environment. Under macOS sandboxing, standard file dialog privileges are restricted to single-file write streams, which is why the application enforces a **Workspace-based workflow** to securely manage adjacent forensic database (`.tsgr`) creations.

---

## 🚀 Test Prerequisites

Before beginning manual validation, set up a dedicated testing environment on your Mac:
1. Create an empty testing folder in your Documents directory (e.g., `~/Documents/OrganicTestWorkspace`). This will serve as your **Workspace Folder**.
2. Ensure no hidden files are lingering from previous tests. (Toggle hidden files visibility in Finder with `Cmd + Shift + .`).
3. Install the latest build via **TestFlight**.

---

## 🧪 Test Scenarios

### Scenario 1: New Document & Save (Sandbox & Companion Validation)
**Objective:** Verify that creating and saving a new document correctly secures folder-level sandbox permissions to write both the primary file and the hidden forensic companion file.

1. Launch Organic Replay from TestFlight.
2. Click the **New** button on the toolbar (or press `Cmd + N`).
3. Type: `This is a sandboxed manual TestFlight run.`
4. Click the **Save** button (or press `Cmd + S`).
5. **Validation 1:** Verify the app prompts you with a dialog titled: *"Select Workspace Folder and click Open"*.
6. Choose your `OrganicTestWorkspace` directory and click **Open**.
7. **Validation 2:** Verify a second dialog sheet slides down titled *"Save Document to Workspace"*, pre-filled with `Untitled.txt` inside your selected workspace folder.
8. Rename the file to `testflight_doc.txt` and click **Save**.
9. **Expected Outcomes:**
   * The editor title bar updates to: `Organic Replay - testflight_doc.txt`.
   * The status bar at the bottom displays `testflight_doc.txt` highlighted in **green** (without an asterisk `*` indicating unsaved changes).
   * Navigate to Finder inside `OrganicTestWorkspace` (press `Cmd + Shift + .` to show hidden files). Verify that two files exist:
     1. `testflight_doc.txt` (the primary rich HTML document).
     2. `.testflight_doc.txt.tsgr` (the hidden companion SQLite database).

---

### Scenario 2: Load Workspace & File (Replay Verification)
**Objective:** Verify that loading an existing document from a sandboxed folder correctly matches it with its hidden companion database to reconstruct the typing timeline.

1. Close the active session in Organic Replay (click **Close** in the toolbar or press `Cmd + W`).
2. Click **Open** on the toolbar (or press `Cmd + O`).
3. **Validation 1:** Verify the dialog requests: *"Select Workspace Folder and click Open"*. Select your `OrganicTestWorkspace` folder and click **Open**.
4. **Validation 2:** Verify a second dialog slides down titled *"Select Document from Workspace"* filtered to your folder. Pick `testflight_doc.txt`.
5. **Expected Outcomes:**
   * The document content loads correctly into the editor.
   * The status bar displays `testflight_doc.txt` highlighted in **green**.
   * Open the menu **Help > Replay Session** (or press `Cmd + R`).
   * Verify that the replay scrubber displays the chronological timeline showing the keystroke events recorded from your previous session.

---

### Scenario 3: External Tampering (Integrity Check Validation)
**Objective:** Verify that the cryptographic hash matching mechanism correctly flags when a document has been modified outside of the Organic Replay editor.

1. Open Finder and navigate to your saved `testflight_doc.txt` inside your workspace folder.
2. Right-click `testflight_doc.txt` and open it with the default macOS **TextEdit** app.
3. Add a word at the end: ` (Edited in TextEdit)` and save the file.
4. Go back to Organic Replay. Close the active document if open, and then click **Open** (`Cmd + O`).
5. Complete the workspace directory and file pick flow to load the tampered `testflight_doc.txt`.
6. **Expected Outcomes:**
   * Immediately upon load, verify that the **Integrity Mismatch Detected** modal warns you: *"This document has been modified outside of the Organic Replay App... your proof of human authorship (the chain of custody) is broken."*
   * Dismiss the modal by clicking **OK**.
   * Verify that the active filename in the bottom status bar highlights in **red** with the error: `| **Integrity mismatch check**: failed`.

---

### Scenario 4: Poisoned Timeline (Cascading Verification Failure)
**Objective:** Verify that once external tampering is detected, the entire chronological timeline is flagged as poisoned, and subsequent saves remain permanently flagged as tampered.

1. Complete Scenario 3 to open the tampered document.
2. Inside Organic Replay, type some new text (e.g., ` New typing after tampering.`).
3. Save the document by pressing `Cmd + S`.
4. **Validation 1:** Observe that the editor status bar turns green, indicating a successful local write of your changes.
5. **Validation 2:** Open the Replay Session by pressing `Cmd + R`.
6. **Expected Outcomes:**
   * In the Replay Session window, observe that the `OPEN` event representing the load of the tampered document is flagged in **red** as `[TAMPERED OPEN] (EXTERNAL MODIFICATION DETECTED)`.
   * Scroll down to the very end of the audit log to find your recent save event.
   * Verify that the save event is flagged in **red** as `[TAMPERED SAVE] (INTEGRITY MISMATCH)` rather than green.
   * This confirms that the timeline remains poisoned and cannot be "healed" or laundered by simply saving again inside the editor.

---

### Scenario 5: Export to Word (.doc)
**Objective:** Verify that exporting formatting presets (such as alignments, colors, and font families) to Microsoft Word format runs successfully without permissions blockage.

1. Open or create a document in Organic Replay.
2. Type a paragraph and format it:
   * Apply **Bold**, *Italics*, and __Underline__.
   * Highlight some text and change its color (using the color picker dropdown).
   * Change its alignment (e.g., Center or Justify).
3. Click **Export to Word** (or press `Cmd + Shift + S`).
4. Select your workspace folder, name the file `export_test.doc`, and save.
5. **Expected Outcomes:**
   * The export executes successfully without throwing any platform-denied exceptions.
   * Open the generated `export_test.doc` inside Microsoft Word, Pages, or LibreOffice.
   * Verify that the custom alignments, colors, font selections, and styling attributes match your original editor draft.

---

### Scenario 6: Share Bundle compilation (.zip)
**Objective:** Verify that packaging the document, its hidden `.tsgr` database, and a setup `README.md` into a compressed archive succeeds inside the sandboxed workspace.

1. Open your valid, untampered `testflight_doc.txt`.
2. Click **Share Bundle** (or press `Cmd + Shift + P`).
3. **Expected Outcomes:**
   * A toast notification pops up indicating: `Bundle created: testflight_doc_<timestamp>.zip`.
   * Open Finder. Verify that `testflight_doc_<timestamp>.zip` has been generated adjacent to your document.
   * Double-click the ZIP archive to extract it.
   * Verify the extracted bundle contains exactly:
     1. `testflight_doc.txt` (the document).
     2. `.testflight_doc.txt.tsgr` (the hidden database).
     3. `README.md` (the guidance document containing replay instructions).

---

### Scenario 7: Printing Styles and Layout
**Objective:** Verify that triggering print actions displays a clean, print-only layout concealing all active toolbars, modals, and status interfaces.

1. Open any document with content.
2. Press `Cmd + P` (or click **Print** on the toolbar).
3. **Expected Outcomes:**
   * The native macOS print dialog sheet slides down.
   * Inspect the page preview on the left side of the native print dialog.
   * Confirm that the **top toolbar, dropdown selectors, bottom status bar, and any open search/replace containers are completely hidden** in the print preview. Only the document's pure rich text must be visible on the page layouts.

---
*Organic Replay - Manual QA Guidelines*