# Organic Replay - Cryptographic and Hashing Specification (SHA-256) 🔒

This document details the use of cryptographic hash functions within the **Organic Replay** application. It serves as an official reference for the App Store App Review team regarding export compliance, security architectures, and cryptographic disclosures.

---

## 🚀 Overview & Export Compliance Status

Organic Replay uses **SHA-256 hashing purely for data integrity, verification, and authentication (non-repudiation of authorship)**. 
* **No Encryption for Confidentiality**: The application does *not* encrypt user files, lock documents with passwords, or employ symmetric/asymmetric algorithms (such as AES or RSA) to conceal data. All documents remain in portable, open-text format.
* **App Store Compliance Classification**: Because cryptography is restricted strictly to *message authentication, digital signature, or data integrity (hashing)*, it qualifies for self-exempting status under the US Export Administration Regulations (EAR) **Category 5, Part 2 (Information Security)** exemptions (specifically under the *Note 4* exclusions for authentication and integrity).

---

## 💻 Frontend (TypeScript) Hashing Engine

In the frontend webview (Vite + TypeScript), the application calculates SHA-256 hashes dynamically to power the **Session Replay Engine** [TSGR.md].

### 1. Library & API Usage
The frontend utilizes the browser-native **Web Crypto API** standard available in the modern webview container:
* **API**: `window.crypto.subtle.digest("SHA-256", data)`
* This avoids bundling bloated, third-party cryptographic node modules and ensures high-performance hashing directly managed by the macOS WebKit layer.

### 2. Implementation Flow
Within `src/replay.ts`, the frontend defines an asynchronous hashing helper:
```typescript
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 3. Application Use-Case
* **Replay Verification**: During a playback session, the player steps through keypress events to construct a virtual "virtual in-memory text buffer" [TSGR.md]. At every timestamp corresponding to a historic save event, the player hashes the current state of this virtual buffer using `sha256()`.
* It compares the calculated virtual hash with the historic signature hash stored inside the SQLite database companion. Any mismatch immediately alerts the user that the keystroke timeline has been altered or injected.

---

## 🦀 Backend (Rust) Verification Engine

In the native compiled environment (Tauri + Rust), the backend verifies file payloads on disk during opening and saving operations to detect external tampering.

### 1. Dependencies and Libraries
The Rust backend uses standard, audited crates from the Rust cryptographic community:
* **`sha2` Crate**: Providing the SHA-256 engine (`sha2::{Sha256, Digest}`).
* **`rusqlite` Crate**: Used to query and cross-reference recorded hashes stored in the hidden companion database (`.tsgr`).

### 2. Implementation Flow
In `src-tauri/src/lib.rs`, the SHA-256 signature generator is defined as a Tauri command:
```rust
#[tauri::command]
fn generate_content_signature(content: String) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}
```

### 3. Application Use-Case
* **Active File Load Verification (Hash Match)**: When a document is loaded, the backend invokes `verify_document_integrity`.
* It reads the latest hash entry stored in the `forensic_log` SQLite database:
  ```sql
  SELECT content FROM forensic_log WHERE event_type = 'save' ORDER BY id DESC LIMIT 1;
  ```
* It computes the SHA-256 signature of the loaded file's current on-disk plain text using `generate_content_signature`.
* If the calculated signature does not match the SQL record, it warns the user with an **"Integrity Mismatch Detected"** modal, indicating that the text has been edited outside of the Organic Replay editor.

---

## 📊 Summary of Hashing Scenarios

| Step | Event | Action | Verification |
| :--- | :--- | :--- | :--- |
| **1** | User saves document in editor | Backend calculates SHA-256 of text, saves it as the payload of a `save` event in the database, and writes both the file and `.tsgr` companion to disk. | Cryptographic Baseline Set |
| **2** | User opens existing document | Backend generates a fresh SHA-256 hash of the on-disk file, matching it against the last database record. | **Active File Load Check** |
| **3** | User triggers "Session Replay" | Frontend reconstructs the text incrementally in memory, computing a SHA-256 hash at every historical checkpoint. | **Replay Timeline Check** |

---

## 📋 App Store Export Compliance (FAQ)

**Q: Does the app use encryption?**  
**A:** Yes, but strictly **one-way cryptographic hashing (SHA-256)** for data integrity, verification, and authentication purposes. The application does *not* support document encryption, ciphering for confidentiality, or access controls.

**Q: Is this app exempt from export documentation requirements?**  
**A:** Yes. Under the Export Administration Regulations (EAR), functions limited to "authentication", "digital signature", or "data integrity" are exempt from encryption registration and review requirements (specifically classified under Note 4 of Category 5, Part 2).

---
*Organic Replay - Encryption & Security Specifications*