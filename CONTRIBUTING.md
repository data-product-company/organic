# Contributing to Organic 🤝

First off, thank you for taking the time to contribute! We welcome contributions to help keep Organic secure, robust, and aligned with our **Human-First Initiative**.

As a copyleft open-source project under the **GPLv3**, any contributions you make will also be licensed under the GPLv3.

---

## 🐛 Reporting Bugs

If you find a bug, please open an Issue. Include:
- Your Operating System and Tauri version.
- Steps to reproduce the issue.
- Expected vs. actual behavior.
- Relevant console/terminal logs or forensic database logs (`.tsgr` schema matches).

---

## 💡 Feature Requests

We are highly selective about adding features to keep the editor minimalist and lightweight. To suggest a feature:
- Open an Issue describing the feature and its use-case.
- Explain how it fits into a distraction-free, privacy-centric workspace.

---

## 🏷️ Issue Labels

To help us triage and resolve issues efficiently, we categorize them using the following labels. When creating an issue, feel free to suggest which category fits best:
- `bug` 🐛: Something is broken or behaving unexpectedly.
- `enhancement` 💡: Proposed new features or enhancements aligned with our minimalist philosophy.
- `security` 🔒: Issues concerning forensic integrity, database logging, or security vulnerabilities.
- `documentation` 📝: Improvements or fixes for the help files and guides.
- `good first issue` 🚀: Great starting points for new contributors to get familiar with the codebase.

---

## 🚀 Good First Issues (Where to Start)

If you are looking to get your feet wet in the Organic codebase, search for issues with the `good first issue` 🚀 label. These issues are scoped, self-contained, and perfect for learning the system architecture. Typical starter tasks include:

1. **Expanding Test Suites**: 
   - Adding edge-case tests in `src/utils.test.ts` (e.g., verifying cursor behaviors on complex multiline layouts).
   - Enhancing the replay tests in `src/replay.test.ts` to verify complex undo/redo histories.
2. **UI/UX Refinements**: 
   - Adding helpful keyboard shortcut tooltips or hover titles to buttons in `index.html`.
   - Polishing CSS styles to keep the distraction-free aesthetic uniform on various operating systems.
3. **Improving Guides & Specs**: 
   - Correcting documentation errors, updating features (such as the Share Bundle utility), or explaining behaviors in `src-tauri/resources/help.md` or the TSGR Forensic specification `TSGR.md`.
4. **Performance Tuning**:
   - Profiling and optimizing the DOM caret-offset calculations in `src/utils.ts` for large files.

---

## 🛠️ Pull Request Process

1. **Fork the Repo**: Fork this repository and create your branch from `main`.
2. **Branch Naming**: Use a prefix like `feature/` or `bugfix/` (e.g., `bugfix/fix-tab-index-offset`).
3. **Write Tests**: Ensure any changes to the forensic replay engine are accompanied by robust unit tests in `src/replay.test.ts` (including filtering rules for non-textual events like `share_bundle`).
4. **Run Verification Hooks**:
   Before committing, run:
   ```bash
   npm run predev
   ```
   This will execute:
   - Frontend unit tests (Vitest)
   - Backend unit tests (`cargo test`)
   Both suites must pass cleanly.
5. **Submit a PR**: Keep your pull request descriptions concise and reference the associated issue.

---

## 🎨 Code Style Guidelines

### Rust (Backend)
- Format your code using `cargo fmt` before submitting.
- Follow idiomatic Rust design patterns. Avoid unsafe code blocks unless absolutely necessary.
- Document public functions.

### TypeScript / Frontend
- Keep variables scoped cleanly and use modern ESNext/TS features.
- Do not bypass our custom event boundaries—all typing events, deletions, replacements, and bundle sharing *must* be correctly routed to `logForensicEvent` via `main.ts` so the timeline remains completely robust.

---

*Thank you for being part of the human-first writing community!*