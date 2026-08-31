---
name: organic-skill
description: "Handles requests for the 'organic' project. Use for questions about the TypeScript/Vite frontend, the Rust/Tauri backend, or general project structure. Triggers on mentions of 'organic', 'organic-replay', or files specific to this project."
---

# Organic Project Skill

## Core Instructions

Your primary directive is to provide concise, direct, and technically accurate answers related to the "organic" project. Adhere strictly to the "yes/no/this is how we do it" principle. Avoid conversational fluff.

- **Style**: Responses should be direct. When providing code, provide the code first, then a brief explanation if necessary.
- **Project Context**: This is a Tauri application with a TypeScript/Vite frontend and a Rust backend.
- **File Paths**: Assume all file paths are relative to the project root (`/Users/nikhilshah/rscode/organic`) unless otherwise specified.

## Slash Commands

You must respond to the following slash commands according to their specific instructions:

- **/code-review**: Perform a comprehensive code review of the proposed or existing changes based on the criteria in the **Code Review Guidelines** section.
  
  **Required Output Structure**:
  1. **Overall Status**: A clear statement of whether any actions are required (e.g., "⚠️ ACTION REQUIRED: 2 items need addressing" or "✅ NO ACTION REQUIRED").
  2. **Checklists**: Render exact markdown checklists showing the status of each guideline:
     - **Frontend Checklist**:
       - [ ] Correctness (No visible bugs, works as intended) — *[Passed / Action Required / N/A]*
       - [ ] Tauri Integration (Correct `@tauri-apps/api` usage) — *[Passed / Action Required / N/A]*
       - [ ] Small Chunks (Incremental update) — *[Passed / Action Required / N/A]*
       - [ ] No Proactive Refactoring (Stays in scope) — *[Passed / Action Required / N/A]*
       - [ ] Testing (Accompanied by `vitest` tests) — *[Passed / Action Required / N/A]*
       - [ ] Styling (Adheres to conventions) — *[Passed / Action Required / N/A]*
     - **Backend Checklist**:
       - [ ] Correctness (Logic implements requested functionality) — *[Passed / Action Required / N/A]*
       - [ ] Tauri Commands (Registered correctly in `main.rs`) — *[Passed / Action Required / N/A]*
       - [ ] Error Handling (Idiomatic usage of `Result`/`Option`) — *[Passed / Action Required / N/A]*
       - [ ] Small Chunks (Incremental update) — *[Passed / Action Required / N/A]*
       - [ ] No Proactive Refactoring (Stays in scope) — *[Passed / Action Required / N/A]*
       - [ ] Testing (Unit or integration tests added) — *[Passed / Action Required / N/A]*
       - [ ] Security (Parameterized queries with `rusqlite`) — *[Passed / Action Required / N/A]*
  3. **Frontend Findings**: Detailed notes and specific actions required for the Frontend code.
  4. **Backend Findings**: Detailed notes and specific actions required for the Backend code.

- **/test-review**: Verify that there are no missing tests for new or modified features.
  
  **Required Output Structure**:
  1. **Overall Status**: A clear statement of whether test addition actions are required (e.g., "⚠️ ACTION REQUIRED: Proposing new tests" or "✅ NO ACTION REQUIRED: Test coverage is sufficient").
  2. **Checklist**: Render a markdown checklist of all analyzed areas:
     - [ ] Frontend Test Coverage (Checks for modified TS/Vite files) — *[Sufficient / Needs Tests / N/A]*
     - [ ] Backend Test Coverage (Checks for modified Rust files) — *[Sufficient / Needs Tests / N/A]*
     - [ ] Edge Cases and Error Paths — *[Checked / Needs Tests / N/A]*
  3. **Proposals**: Propose/suggest adding specific new tests (detailing test cases, inputs, and expected behaviors) if actions are required. **Do not** make any actual code modifications or write the tests until the user explicitly approves.

- **/build-ready**: Verify that all version numbers, macOS plist configurations, and documentation are synchronized and up-to-date before a new build.

  **MANDATORY FILE INSPECTION PROTOCOL**: 
  You MUST NOT rely on cached context, memory, or guesswork. You are strictly REQUIRED to dynamically resolve the absolute path of the local project root directory (where the active `package.json` is located), and then physically open and read each of the following files using the `read_file` tool to inspect their actual contents in real-time before generating any part of your response:
  1. `<project-root>/package.json`
  2. `<project-root>/src-tauri/Cargo.toml`
  3. `<project-root>/src-tauri/tauri.conf.json`
  4. `<project-root>/src-tauri/Info.plist` (or equivalent macOS config)
  5. `<project-root>/src-tauri/Entitlements.plist` (or equivalent macOS config)
  6. `<project-root>/TEST.md`
  7. `<project-root>/src-tauri/resources/help.md`
  
  If you fail to call the appropriate file reading tool for each of these files (or confirm their non-existence if applicable), you are in direct violation of project guidelines and your response will be considered untrustworthy.

  **Execution Workflow**:
  You MUST follow these steps precisely:
  1.  **Resolve Paths**: Dynamically resolve the absolute path of the local project root.
  2.  **Inspect Files**: Physically read the 7 files listed in the protocol above using the `read_file` tool.
  3.  **Compare versions**: Extract versions from `package.json`, `Cargo.toml` (under `[package]`), and `tauri.conf.json` (under `package.version`) and verify they are identical.
  4.  **Verify plist configurations**: Review the contents of `Info.plist` and `Entitlements.plist`. Verify that bundle identifiers, hardware permissions (e.g., network, camera), and macOS sandbox settings are correctly configured and match the application's actual capabilities and recent changes.
  5.  **Review documentation**: Review `TEST.md` and `help.md` to ensure they are up-to-date and accurate with respect to current features.
  6.  **Construct the Output**: Generate the report strictly following the `Required Output Structure` below, ensuring all checklist items have a completed status.

  **Required Output Structure**:
  1. **Overall Status**: A clear statement of whether version sync, plist updates, or document updates are required (e.g., "⚠️ ACTION REQUIRED: Version mismatch / plist updates needed / documentation updates needed" or "✅ NO ACTION REQUIRED: Build ready").
  2. **Checklist**: Render exact markdown checklists showing the status of each item, citing the exact values read directly from each file:
     - [ ] `<project-root>/package.json` Version Check — *[Version X.Y.Z]* (Verified via real-time file read)
     - [ ] `<project-root>/src-tauri/Cargo.toml` Version Check — *[Version X.Y.Z]* (Verified via real-time file read)
     - [ ] `<project-root>/src-tauri/tauri.conf.json` Version Check — *[Version X.Y.Z]* (Verified via real-time file read)
     - [ ] Multi-file Version Synchronization — *[In Sync / Mismatch]*
     - [ ] `<project-root>/src-tauri/Entitlements.plist` Check — *[In Sync / Mismatch / N/A]* (Verified via real-time file read)
     - [ ] `<project-root>/src-tauri/Info.plist` Check — *[In Sync / Mismatch / N/A]* (Verified via real-time file read)
     - [ ] `<project-root>/TEST.md` documentation matches current capabilities — *[Consistent / Outdated / N/A]* (Verified via real-time file read)
     - [ ] `<project-root>/src-tauri/resources/help.md` documentation is consistent and accurate — *[Consistent / Outdated / N/A]* (Verified via real-time file read)
  3. **Discrepancy Details**: If there is any mismatch, inconsistency, or configuration issue (e.g., out-of-sync versions, missing plist permissions, or outdated documentation), detail the exact files, lines, and updates required.

## Development Workflow

- **Small Chunks**: All code changes must be made in small, incremental chunks.
- **No Proactive Refactoring**: Do not refactor code outside the scope of the immediate task.
- **Add Tests**: All new functionality, regardless of size, must be accompanied by new tests.
- **Fix Failing Tests**: This project does not use Test-Driven Development (TDD). If an existing test fails after a code change, prioritize fixing or updating the test to align with the new functionality. Do not alter the new code to pass an outdated test.

## Code Review Guidelines

When asked to perform a code review, analyze the code against the following project-specific criteria. Structure your review with separate sections for Frontend and Backend findings.

### Frontend (TypeScript) Checklist
- **Correctness**: Does the code work as intended? Are there any visible bugs?
- **Tauri Integration**: Is `@tauri-apps/api` used correctly for all communication with the Rust backend?
- **Small Chunks**: Is the change a small, self-contained, incremental update?
- **No Proactive Refactoring**: Does the change avoid refactoring code outside of its immediate scope?
- **Testing**: Is the change accompanied by new `vitest` tests?
- **Styling**: Does the code adhere to the existing TypeScript/CSS style and conventions?

### Backend (Rust) Checklist
- **Correctness**: Does the logic correctly implement the required functionality?
- **Tauri Commands**: If a new command is added, is it correctly defined with `#[tauri::command]` and registered in `main.rs`?
- **Error Handling**: Is error handling idiomatic (`Result`, `Option`)? Are errors from libraries like `rusqlite` handled gracefully?
- **Small Chunks**: Is the change a small, self-contained, incremental update?
- **No Proactive Refactoring**: Does the change avoid refactoring code outside of its immediate scope?
- **Testing**: Are new unit or integration tests added to cover the new logic?
- **Security**: Are database queries using `rusqlite` parameterized to prevent SQL injection?

## Version Management

When making changes that affect the application's functionality, you must check and update the version number across the following files to ensure they are synchronized:

1.  `package.json` (root)
2.  `src-tauri/Cargo.toml`
3.  `src-tauri/tauri.conf.json`

Increment the version according to Semantic Versioning (SemVer) principles. For example, bug fixes increment the patch version (`0.1.x`), new features increment the minor version (`0.x.0`), and breaking changes increment the major version (`x.0.0`).

## Frontend (TypeScript / Vite)

The frontend code is in the `src/` directory.

- **Main Files**: `main.ts` (main application logic), `replay.ts` (replay functionality), `help.ts` (help functionality).
- **Dependencies**: Use `@tauri-apps/api` for all interactions with the backend. Use `marked` for Markdown parsing.
- **Testing**: Tests are written with `vitest`. Test files end in `.test.ts`. Run tests using `npm test`.
- **Convention**: Follow existing TypeScript conventions, including types, interfaces, and module structure.

**Example Interaction:**

> **User**: How do I send a message from the frontend to the backend?
>
> **You**: Yes. Use the `invoke` function from `@tauri-apps/api`.
>
> ```typescript
> import { invoke } from '@tauri-apps/api/core';
>
> await invoke('my_rust_command', { anArgument: 'some-value' });
> ```

## Backend (Rust / Tauri)

The backend code is in the `src-tauri/` directory.

- **Main Files**: `main.rs` (Tauri application setup), `lib.rs` (core application logic and Tauri commands).
- **Dependencies**:
    - `tauri`: For the core application and command handling.
    - `rusqlite`: For database interactions. The database is the source of truth for documents.
    - `sha2`: For hashing.
    - `zip`: For creating document archives.
    - `chrono`: For timestamps.
- **Commands**: Tauri commands are defined in `lib.rs` within a `#[tauri::command]` block. Ensure any new commands are added there.
- **Convention**: Follow existing Rust conventions for error handling (e.g., `Result`), data structures, and module organization.

**Example Interaction:**

> **User**: Add a command to get a document by ID.
>
> **You**: Yes. I will add a new Tauri command to `src-tauri/src/lib.rs`.
>
> ```rust
> #[tauri::command]
> fn get_document_by_id(id: i32) -> Result<String, String> {
>   // your rusqlite logic here
>   Ok("document content".to_string())
> }
>
> // Then, register it in main.rs
> .invoke_handler(tauri::generate_handler![
>   // ... other commands
>   get_document_by_id
> ])
> ```

## General Workflow

1.  **Identify the context**: Is the request for the frontend (TypeScript) or backend (Rust)?
2.  **Locate the relevant files**: Use the file structure outlined above.
3.  **Provide a direct answer**: Start with "Yes, this is how we do it" or "No, that is not supported."
4.  **Show the code**: Provide a clear, concise code snippet that follows project conventions.
5.  **Keep it brief**: Do not add unnecessary explanations.
