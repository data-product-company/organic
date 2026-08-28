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
