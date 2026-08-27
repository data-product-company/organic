# Organic Replay App Help

Welcome to the Organic help documentation.

## Getting Started

The Organic Replay App is a minimalist, distraction-free document editor designed with formatting consistency, privacy, and cryptographic forensic integrity at its core. It is part of the **"Human, not A.I."** initiative, giving writers a way to mathematically prove their own human authorship.

## Core Features

- **Distraction-Free Environment**: A clean, highly-focused workspace designed to maximize writing productivity.
- **Forensic Logging (.tsgr)**: Every single keystroke, deletion, composition, clipboard modification (copy/cut/paste), and undo/redo action is securely recorded in real-time to an adjacent, hidden SQLite companion database.
- **Chronological Session Replay**: An integrated playback player that allows anyone to scrub through, inspect, and replay the exact character-by-character creation timeline of your document.
- **Typography & Styling Controls**: Access and apply any local system fonts available on your machine alongside standard serif and typewriter selections, adjust font sizes (12px to 36px), and pick custom font colors dynamically.
- **Text Alignment & Formatting**: Seamlessly format text with Bold, Italic, Underline, and block-level alignments (Left, Center, Right, Justify) that translate perfectly in both the editor and playback engine.
- **Native Printing Support**: Print your finalized document directly from within the app (via `CmdOrCtrl + P`), styled with a clean, print-only layout that automatically hides toolbars, status bars, and UI dialogs.
- **Hyperlink Management**: Quickly insert, edit, or completely remove links from selected text blocks using the on-screen modal.
- **Full Find & Replace Suite**: Real-time matched results tracking ("X of Y"), search query wrap-around, and sequential "Replace" or global "Replace All" actions.
- **Share Bundle**: Instantly pack your saved document and its companion `.tsgr` forensic log into a timestamped `.zip` file in the same directory, simplifying sharing with reviewers.
- **Interactive Status Bar**: Displays live word count, character count, active file name, and a visual unsaved changes indicator (`*`).
- **Microsoft Word Export**: Export formatted documents directly to Microsoft Word (`.doc`) with customized margins and style settings.
- **Secure File Operations**: Automatic, non-obtrusive confirmation dialogs warning about unsaved modifications when closing a document or exiting the app.

## Keyboard Shortcuts

### File Management
- **New Document**: `CmdOrCtrl + N`
- **Open Document**: `CmdOrCtrl + O`
- **Save Document**: `CmdOrCtrl + S`
- **Print Document**: `CmdOrCtrl + P`
- **Share Replay Bundle**: `CmdOrCtrl + Shift + P`
- **Export to Word**: `CmdOrCtrl + Shift + S`
- **Close Document**: `CmdOrCtrl + W`

### Editing & Utilities
- **Undo last action**: `CmdOrCtrl + Z`
- **Redo last action**: `CmdOrCtrl + Shift + Z` (or `CmdOrCtrl + Y`)
- **Find & Replace**: `CmdOrCtrl + F`
- **Zoom In**: `CmdOrCtrl + =` (or `CmdOrCtrl + +`)
- **Zoom Out**: `CmdOrCtrl + -`
- **Actual Size (Reset Zoom)**: `CmdOrCtrl + 0`

### Typography & Formatting
- **Apply Bold**: `CmdOrCtrl + B`
- **Apply Italic**: `CmdOrCtrl + I`
- **Apply Underline**: `CmdOrCtrl + U`
- **Align Left**: `CmdOrCtrl + Shift + L`
- **Center Align**: `CmdOrCtrl + Shift + E`
- **Align Right**: `CmdOrCtrl + Shift + R`
- **Justify**: `CmdOrCtrl + J`

### Diagnostics & Help
- **Toggle Help Menu**: `CmdOrCtrl + H`
- **Open Replay Session**: `CmdOrCtrl + R`

## Sharing & Verifying Documents

To allow someone else (like an instructor, publisher, or editor) to replay your writing session and verify your human authorship:
1. **Create a Share Bundle**: Click the **Share Bundle** button on the toolbar or press `CmdOrCtrl + Shift + P` to automatically generate a timestamped `.zip` package containing both your document and its hidden forensic `.tsgr` database.
2. **Share the ZIP**: Share the generated ZIP file with your recipient.
3. **Recipient Action**: The recipient unzips the bundle and opens the document file from within the **Organic Replay App** (via the **Open** button or `CmdOrCtrl + O`).

   *Note on Opening in the Organic Replay App*: Unlike traditional editors that only render static text, opening a document within the Organic Replay App initiates an active forensic session. The app scans the surrounding directory, matches the document with its hidden `.tsgr` database, and reconstructs your keystroke history to activate the **Chronological Replay** (`CmdOrCtrl + R`) window.

*Note: If you share only the document without the `.tsgr` companion database, the recipient will still be able to open and read your text, but they will not see any chronological typing history. The replay will only show a single "Open" event with the finalized text.*

## ❓ Frequently Asked Questions (FAQ)

### Why use Organic Replay (OR) in the AI era?
In an era dominated by generative AI, writers, students, and professionals face a growing risk of false accusations of plagiarism or AI assistance from unreliable detection algorithms. Organic Replay records your actual step-by-character-step writing journey. By capturing the natural pauses, non-linear edits, and pacing of human thought, it provides an indisputable, mathematically backed forensic proof of your original authorship.

### Why are files saved as `.txt` when the contents are actually HTML?
We save files with a `.txt` extension to guarantee absolute simplicity, portability, and universal compatibility. Under the hood, we use clean HTML formatting elements to preserve your rich styles (like bold, italics, underlines, and paragraph alignments) across editing sessions. This ensures that the replay engine has all the stylistic cues it needs to reconstruct your document exactly as you styled it.

### Why export specifically as Microsoft Word `.doc` files?
We restrict direct export to the standard `.doc` format to keep the application incredibly lightweight, fast, and distraction-free. Generating complex, bloated layout structures inside a minimalist editor is unnecessary. Once your draft is exported, you can seamlessly open or import it into Microsoft Word, Google Docs, or LibreOffice to customize margins, headers, and advanced styling exactly to your liking.

### What happens if a document is edited outside of the Organic Replay App?
* **For Authors**: If you open and edit your file in another text editor (like Word, Notepad, or an external A.I. tool), the Organic Replay App will detect that the document's text has changed without any corresponding typing history. When you open the file back up in the Organic Replay App, it will warn you that the document and its forensic log do not match, meaning your proof of human authorship (the chain of custody) is broken.
* **For Reviewers**: When auditing a document, you can immediately tell if it has been tampered with. If someone tries to manually paste, insert, or modify text using an external program, the character-by-character Replay Session will fail to recreate the final document. The replay engine will raise an integrity flag, letting you know that the document has been modified outside the secure environment.

## ⚖️ License & Warranty Disclaimer

**Organic Replay** is proud to be open-source software distributed under the **GNU General Public License, Version 3 (GPLv3)**. 

### Free and Open-Source (Copyleft)
You are completely free to use, inspect, modify, and redistribute this software (including for commercial purposes), provided that any modified versions or derivative works you distribute are also kept open-source under these exact same GPLv3 copyleft terms. You cannot turn this program into proprietary, closed-source software.

---

### 🚫 "AS IS" Warranty & Liability Disclaimer
As is standard with free and open-source software, **Organic Replay is provided to you entirely "AS IS," without any warranty of any kind.** 

Here is what this means under **Sections 15 and 16** of the license agreement:

1. **No Warranty (Section 15):**
   * The copyright holders and contributors provide the program "as is" without warranty of any kind, either expressed or implied. 
   * This includes, but is not limited to, the implied warranties of merchantability (that it is fit to sell) and fitness for a particular purpose (that it works for your specific task).
   * The entire risk as to the quality and performance of the program is with you. Should the program prove defective, you assume the cost of all necessary servicing, repair, or correction.

2. **Limitation of Liability (Section 16):**
   * Under no circumstances—unless required by local law or agreed to in writing—will any copyright holder or contributor who modifies and/or distributes the program be liable to you for any damages.
   * This includes general, special, incidental, or consequential damages (such as data loss, data corruption, or a failure of the program to operate with other software) arising out of your use or inability to use the program, even if the authors have been advised of the possibility of such damages.

---
*Organic Replay: Human, not A.I. Initiative*