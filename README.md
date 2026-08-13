# Organic Replay 📝

> **Organic Replay** is a minimalist, distraction-free document editor designed with security, formatting consistency, and forensic integrity at its core. Part of the *"Human, not A.I."* initiative.

Organic Replay is built using **Tauri**, **Rust**, and **TypeScript**, combining the performance and security of Rust with the flexibility of modern web technologies to create a high-performance cross-platform desktop application.

Who is it for? For Students & Academics, Professional Writers, Publishers & Editors, Journalists, Human Authors, everyone who cares about ownership in AI-era.

Why? False accusations of AI cheating from flawed detectors or need to prove authorship.

How? Open source software with lightweight features to get the job done and prove it through replay.

Video Demo: https://youtu.be/3CiOYcWZVtQ

---


---

## ✨ Key Features

- **Distraction-Free Editing**: Clean, distraction-free writing environment.
- **Forensic Logging**: Every single keystroke, deletion, and clipboard modification is securely logged in real-time to a companion SQLite database (`.tsgr`) alongside your document.
- **Session Replay Engine**: Fully integrated chronological player that lets you scrub through and replay the exact writing process of any document.
- **Share Bundle**: Automatically package your saved document and its hidden companion `.tsgr` forensic database into a single, standardized, timestamped `.zip` file for easy sharing and verification.
- **Strong Indentation & Formatting**: Perfect tab rendering (set to 4 spaces) and block-level text alignment (Left, Center, Right, Justify) that translates flawlessly between live editing and forensic replays.
- **Native OS Integrations**: Operating system-level menu bars, native keyboard shortcuts, and file dialogues.
- **Secure File Operations**: Automatic warning dialogs to prevent losing unsaved changes upon closing or exit.

---

## 🎨 The Brand & Logo Design

The visual identity of **Organic Replay** is deeply tied to its core philosophy and origin:

- **The Deep Blue Ocean Background (`#082147`)**: A subtle auditory and visual play on **DPC** (Data Product Company) spoken quickly.
- **The "OR" Monogram (`#9ad0ff`)**: Stands for **Organic Replay** and the endless **Options** available to the writer, rendered in a striking, high-luminance rich light blue.
- **The "O" Dial**: Features engraved clock tick marks resembling a clock face or calibration dial, representing the "Timeseries/Chronological Replay" engine at the heart of our forensic verification system.
- **The "R" Monogram**: A bold, classic typewriter-inspired "R" structure, grounding the application in the timeless, physical tradition of focused, distraction-free human writing.
- **The Play Triangle (`>`) Cutout**: Sliced cleanly into the loop of the **R** using the deep background color, this bold right-pointing triangle mimics retro VCR and Blu-ray play buttons. It represents the chronological playback and verification engine that brings your writing history to life.

---

## 🚀 Getting Started

### Prerequisites

Before building this project, ensure you have the following installed on your machine:

- **Node.js** (v18+) & **npm**
- **Rust** and **Cargo** (via rustup)
- **Tauri Prerequisites** (System-specific libraries. See Tauri Setup Guide)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/organic.git
   cd organic
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

### Development

To run the application in development mode with hot-reloading:
   ```bash
   npm run tauri dev
   ```
This triggers pre-development hooks to run both the frontend Vitest suite and Rust unit tests automatically.

### Testing

Run the full test suite (both Vitest and Cargo):
   ```bash
   npm run predev
   ```
Or run them individually:
- **Frontend tests (Vitest)**: `npm test` or `npm run test:watch`
- **Backend tests (Rust)**: `cargo test --manifest-path src-tauri/Cargo.toml`

### Production Build

To bundle the application into a standalone native executable for your current OS:
   ```bash
   npm run tauri build
   ```
This will output production installers in `src-tauri/target/release/bundle/`.

---

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)** - a strong copyleft license that ensures the project remains free and open-source forever. 

See the LICENSE file for the full text.

Copyright © 2026 Data Product Company LLC.


---
*Organic Replay - Human, not A.I. Initiative*

Maintained with ❤️ by [Data Product Company LLC](https://www.dataproduct.company)