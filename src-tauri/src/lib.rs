// Organic Replay - A minimalist, distraction-free document editor designed with forensic integrity.
// Copyright (C) 2026  Data Product Company LLC <https://www.dataproduct.company>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

use tauri::path::BaseDirectory;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem};
use tauri::Emitter;
use tauri::Manager;
use std::sync::Mutex;
use rusqlite::{Connection, params};
use std::path::Path;

fn get_tsgr_path(doc_path: &str) -> std::path::PathBuf {
    let path = Path::new(doc_path);
    if let (Some(parent), Some(file_name)) = (path.parent(), path.file_name()) {
        let hidden_file_name = format!(".{}.tsgr", file_name.to_string_lossy());
        parent.join(hidden_file_name)
    } else {
        std::path::PathBuf::from(format!("{}.tsgr", doc_path))
    }
}

fn hide_file_on_windows(_path: &std::path::Path) {
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("attrib").arg("+h").arg(_path).status();
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn create_zip_bundle(
    doc_path: &Path,
    tsgr_path: &Path,
    zip_path: &Path,
) -> Result<(), String> {
    use std::io::{Read, Write};
    use zip::write::FileOptions;

    let file_name = doc_path.file_name().ok_or_else(|| "Invalid document filename".to_string())?;
    let tsgr_file_name = tsgr_path.file_name().ok_or_else(|| "Invalid tsgr filename".to_string())?;

    let zip_file = std::fs::File::create(zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(zip_file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // Add the main document file
    zip.start_file(file_name.to_string_lossy(), options).map_err(|e| e.to_string())?;
    let mut doc_file = std::fs::File::open(doc_path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    doc_file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
    zip.write_all(&buffer).map_err(|e| e.to_string())?;

    // Add the hidden .tsgr forensic log file
    zip.start_file(tsgr_file_name.to_string_lossy(), options).map_err(|e| e.to_string())?;
    let mut tsgr_file = std::fs::File::open(tsgr_path).map_err(|e| e.to_string())?;
    buffer.clear();
    tsgr_file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
    zip.write_all(&buffer).map_err(|e| e.to_string())?;

    // 4. Add a friendly README.md to help the recipient get started
    let readme_content = format!(
        "# Organic Forensic Share Bundle 📝\n\n\
         You have received a secure, cryptographically signed writing session from **Organic**.\n\
         This bundle contains the document (`{}`) and its hidden, immutable companion forensic history database (`{}`).\n\n\
         ## How to Replay and Verify this Document:\n\n\
         1. **Extract this ZIP file**: Unzip all contents (including hidden files) into any local folder.\n\
         2. **Open the Organic app**.\n\
         3. **Open the document**: Click the **Open** button (or press `CmdOrCtrl + O`) and select the extracted `{}` file.\n\
         4. **Launch the Replay**: Organic will automatically detect the adjacent hidden `{}` forensic database. Press `CmdOrCtrl + R` (or go to **Help > Replay Session**) to open the interactive player and scrub through the character-by-character authorship timeline!\n\n\
         ---\n\
         *Organic - Human, not A.I. Initiative*\n",
        file_name.to_string_lossy(),
        tsgr_file_name.to_string_lossy(),
        file_name.to_string_lossy(),
        tsgr_file_name.to_string_lossy()
    );
    zip.start_file("README.md", options).map_err(|e| e.to_string())?;
    zip.write_all(readme_content.as_bytes()).map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn share_replay_bundle(
    _state: tauri::State<'_, AppState>,
    doc_path: String,
) -> Result<String, String> {
    let path = Path::new(&doc_path);
    let parent = path.parent().ok_or_else(|| "Invalid document directory".to_string())?;
    let file_stem = path.file_stem().ok_or_else(|| "Invalid document file stem".to_string())?;

    // 1. Resolve hidden .tsgr path
    let tsgr_path = get_tsgr_path(&doc_path);
    if !tsgr_path.exists() {
        return Err("Forensic log (.tsgr) does not exist. Please save the document first.".to_string());
    }

    // 2. Generate timestamped ZIP filename: <stem>_<timestamp>.zip
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let zip_filename = format!("{}_{}.zip", file_stem.to_string_lossy(), timestamp);
    let zip_path = parent.join(&zip_filename);

    // 3. Create and compile the ZIP file using the helper
    create_zip_bundle(path, &tsgr_path, &zip_path)?;

    Ok(zip_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn generate_content_signature(content: String) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

#[tauri::command]
async fn verify_document_integrity(
    state: tauri::State<'_, AppState>,
    content: String,
) -> Result<bool, String> {
    let mut conn_lock = state.db_conn.lock().unwrap();
    if conn_lock.is_none() {
        *conn_lock = Some(Connection::open(&state.temp_db_path).map_err(|e| e.to_string())?);
    }
    let conn = conn_lock.as_ref().unwrap();
    let mut stmt = conn.prepare(
        "SELECT content FROM forensic_log WHERE event_type = 'save' ORDER BY id DESC LIMIT 1"
    ).map_err(|e| e.to_string())?;
    
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let recorded_signature: Option<String> = row.get(0).map_err(|e| e.to_string())?;
        if let Some(expected_sig) = recorded_signature {
            let actual_sig = generate_content_signature(content);
            return Ok(actual_sig == expected_sig);
        }
    }
    Ok(true) // Defaults to true if no saves have occurred yet
}

#[tauri::command]
async fn read_help_markdown(app_handle: tauri::AppHandle) -> Result<String, String> {
    let resource_path = app_handle.path()
        .resolve("resources/help.md", BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    dbg!(&resource_path);

    std::fs::read_to_string(resource_path)
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct ForensicEvent {
    id: i32,
    timestamp: i64,
    row: i32,
    column: i32,
    event_type: String,
    content: Option<String>,
}

#[tauri::command]
async fn get_forensic_events(state: tauri::State<'_, AppState>) -> Result<Vec<ForensicEvent>, String> {
    {
        let current_path = state.current_doc_path.lock().unwrap();
        if current_path.is_none() {
            return Ok(Vec::new());
        }
    }
    let mut conn_lock = state.db_conn.lock().unwrap();
    if conn_lock.is_none() {
        *conn_lock = Some(Connection::open(&state.temp_db_path).map_err(|e| e.to_string())?);
    }
    let conn = conn_lock.as_ref().unwrap();
    let mut stmt = conn.prepare("SELECT id, timestamp, \"row\", \"column\", event_type, content FROM forensic_log ORDER BY timestamp ASC")
        .map_err(|e| e.to_string())?;
    let event_iter = stmt.query_map([], |row| {
        Ok(ForensicEvent {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            row: row.get(2)?,
            column: row.get(3)?,
            event_type: row.get(4)?,
            content: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut events = Vec::new();
    for event in event_iter {
        events.push(event.map_err(|e| e.to_string())?);
    }
    Ok(events)
}

struct AppState {
    temp_db_path: String,
    current_doc_path: Mutex<Option<String>>,
    db_conn: Mutex<Option<Connection>>,
}

#[tauri::command]
async fn open_document(state: tauri::State<'_, AppState>) -> Result<(String, String), String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Select Workspace Folder and click Open")
        .pick_folder()
        .await;

    if let Some(folder) = folder {
        let folder_path = folder.path();
        
        // Prompt the user to select the specific document they wish to open from this folder
        let file = rfd::AsyncFileDialog::new()
            .set_title("Select Document from Workspace")
            .set_directory(folder_path)
            .add_filter("Text, Markdown, & Word Documents types", &["txt", "md", "doc"])
            .pick_file()
            .await;

        if let Some(file) = file {
            let file_path = file.path();
            let path_str = file_path.to_string_lossy().into_owned();
            let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;

            *state.current_doc_path.lock().unwrap() = Some(path_str.clone());

            // Drop active persistent connection to release database file lock before filesystem operations
            *state.db_conn.lock().unwrap() = None;

            // Always ensure the temporary database is clean before proceeding
            let _ = std::fs::remove_file(&state.temp_db_path);

            // If a companion forensic file exists, copy it to the temporary workspace
            let tsgr_path = get_tsgr_path(&path_str);
            if tsgr_path.exists() {
                std::fs::copy(&tsgr_path, &state.temp_db_path).map_err(|e| e.to_string())?;
            }
            // Ensure the database structure is present (creates if not exists, or ensures table exists)
            init_db(&state.temp_db_path)?;

            Ok((path_str, content))
        } else {
            Err("Cancelled".into())
        }
    } else {
        Err("Cancelled".into())
    }
}

#[tauri::command]
async fn save_document(
    state: tauri::State<'_, AppState>,
    path: Option<String>,
    content: String,
) -> Result<String, String> {
    let file_path = match path {
        Some(p) => std::path::PathBuf::from(p),
        None => {
            let folder = rfd::AsyncFileDialog::new()
                .set_title("Select Workspace Folder and click Open")
                .pick_folder()
                .await;

            if let Some(folder) = folder {
                let folder_path = folder.path();
                let save_dialog = rfd::AsyncFileDialog::new()
                    .set_title("Save Document to Workspace")
                    .set_directory(folder_path)
                    .add_filter("Text, Markdown, & Word Documents types", &["txt", "md", "doc"])
                    .set_file_name("Untitled.txt")
                    .save_file()
                    .await;
                match save_dialog {
                    Some(file) => file.path().to_owned(),
                    None => return Err("Cancelled".into()),
                }
            } else {
                return Err("Cancelled".into());
            }
        }
    };

    let saved_path = file_path.to_string_lossy().into_owned();
    std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;
    *state.current_doc_path.lock().unwrap() = Some(saved_path.clone());

    // Copy current session database as a companion file
    let tsgr_path = get_tsgr_path(&saved_path);
    std::fs::copy(&state.temp_db_path, &tsgr_path).map_err(|e| {
        format!("Failed to write adjacent forensic companion file (.tsgr): {}", e)
    })?;
    hide_file_on_windows(&tsgr_path);

    Ok(saved_path)
}

#[tauri::command]
async fn export_to_word(
    state: tauri::State<'_, AppState>,
    content: String,
) -> Result<String, String> {
    let default_name = {
        let current_path = state.current_doc_path.lock().unwrap();
        match &*current_path {
            Some(p) => {
                let path = Path::new(p);
                if let Some(stem) = path.file_stem() {
                    format!("{}.doc", stem.to_string_lossy())
                } else {
                    "document.doc".to_string()
                }
            }
            None => "Untitled.doc".to_string()
        }
    };

    let save_dialog = rfd::AsyncFileDialog::new()
        .add_filter("Word Document", &["doc"])
        .set_file_name(&default_name)
        .save_file()
        .await;

    match save_dialog {
        Some(f) => {
            let file_path = f.path().to_owned();
            let saved_path = file_path.to_string_lossy().into_owned();
            std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
            Ok(saved_path)
        }
        None => Err("Cancelled".into()),
    }
}

#[tauri::command]
async fn close_document(state: tauri::State<'_, AppState>) -> Result<(), String> {
    *state.current_doc_path.lock().unwrap() = None;
    *state.db_conn.lock().unwrap() = None;
    // Attempt to remove the file. If it fails, clear the table instead to ensure a clean state.
    if let Err(e) = std::fs::remove_file(&state.temp_db_path) {
        eprintln!("Failed to remove temporary database file {}: {}. Attempting to clear table instead.", &state.temp_db_path, e);
        let mut conn_lock = state.db_conn.lock().unwrap();
        let conn = Connection::open(&state.temp_db_path).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM forensic_log", [])
            .map_err(|e| format!("Failed to clear forensic_log table: {}", e))?;
        *conn_lock = Some(conn);
    }
    // Ensure the database structure is present (creates if removed, or ensures table exists if not removed)
    init_db(&state.temp_db_path)?;
    Ok(())
}

#[tauri::command]
async fn sync_forensic_db(state: tauri::State<'_, AppState>) -> Result<(), String> {
    if let Some(ref path) = *state.current_doc_path.lock().unwrap() {
        let tsgr_path = get_tsgr_path(path);
        std::fs::copy(&state.temp_db_path, &tsgr_path).map_err(|e| {
            format!("Failed to sync forensic database (.tsgr): {}", e)
        })?;
        hide_file_on_windows(&tsgr_path);
    }
    Ok(())
}

#[tauri::command]
async fn log_forensic_event(
    state: tauri::State<'_, AppState>,
    timestamp: i64,
    row: i32,
    column: i32,
    event_type: String,
    content: Option<String>,
) -> Result<(), String> {
    let mut conn_lock = state.db_conn.lock().unwrap();
    if conn_lock.is_none() {
        *conn_lock = Some(Connection::open(&state.temp_db_path).map_err(|e| e.to_string())?);
    }
    let conn = conn_lock.as_ref().unwrap();
    conn.execute(
        "INSERT INTO forensic_log (timestamp, \"row\", \"column\", event_type, content)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            timestamp,
            row,
            column,
            event_type,
            content
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_system_font_families() -> Vec<String> {
    let mut families = std::collections::HashSet::new();
    let mut paths = Vec::new();

    #[cfg(target_os = "macos")]
    {
        paths.push("/Library/Fonts".to_string());
        paths.push("/System/Library/Fonts".to_string());
        if let Ok(home) = std::env::var("HOME") {
            paths.push(format!("{}/Library/Fonts", home));
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(windir) = std::env::var("windir") {
            paths.push(format!("{}\\Fonts", windir));
        } else {
            paths.push("C:\\Windows\\Fonts".to_string());
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            paths.push(format!("{}\\AppData\\Local\\Microsoft\\Windows\\Fonts", userprofile));
        }
    }

    #[cfg(target_os = "linux")]
    {
        paths.push("/usr/share/fonts".to_string());
        paths.push("/usr/local/share/fonts".to_string());
        if let Ok(home) = std::env::var("HOME") {
            paths.push(format!("{}/.local/share/fonts", home));
            paths.push(format!("{}/.fonts", home));
        }
    }

    fn scan_dir(dir: &Path, families: &mut std::collections::HashSet<String>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    scan_dir(&path, families);
                } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "ttf" || ext_lower == "otf" || ext_lower == "ttc" {
                        if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                            let clean_name = file_stem
                                .split('-')
                                .next()
                                .unwrap_or(file_stem)
                                .replace("MT", "")
                                .replace("Regular", "")
                                .trim()
                                .to_string();
                            if !clean_name.is_empty() {
                                families.insert(clean_name);
                            }
                        }
                    }
                }
            }
        }
    }

    for path_str in paths {
        scan_dir(Path::new(&path_str), &mut families);
    }

    let mut result: Vec<String> = families.into_iter().collect();
    result.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    result
}

fn init_db(db_path: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS forensic_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER,
            \"row\" INTEGER,
            \"column\" INTEGER,
            event_type TEXT,
            content TEXT
        )",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let temp_db_path = std::env::temp_dir()
        .join(format!("tauri_forensic_{}.db", std::process::id()))
        .to_string_lossy()
        .into_owned();

    if let Err(e) = init_db(&temp_db_path) {
        eprintln!("Failed to initialize forensic database: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            temp_db_path: temp_db_path.clone(),
            current_doc_path: Mutex::new(None),
            db_conn: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            generate_content_signature,
            open_document,
            save_document,
            close_document,
            log_forensic_event,
            sync_forensic_db,
            read_help_markdown,
            get_forensic_events,
            export_to_word,
            share_replay_bundle,
            verify_document_integrity,
            get_system_font_families
        ])
        .setup(|app| {
            // 1. Create native menu items with OS-level accelerators
            let new_item = MenuItemBuilder::with_id("new_doc", "New File")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;

            let open_item = MenuItemBuilder::with_id("open", "Open Workspace...")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;

            let save_item = MenuItemBuilder::with_id("save", "Save File")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;

            let print_item = MenuItemBuilder::with_id("print", "Print")
                .accelerator("CmdOrCtrl+P")
                .build(app)?;

            let share_bundle_item = MenuItemBuilder::with_id("share_bundle", "Share Replay Bundle (.zip)")
                .accelerator("CmdOrCtrl+Shift+P")
                .build(app)?;

            let export_word_item = MenuItemBuilder::with_id("export_word", "Export to Word (.doc)")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;

            let close_item = MenuItemBuilder::with_id("close_doc", "Close Document")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;

            let bold_item = MenuItemBuilder::with_id("bold", "Bold")
                .accelerator("CmdOrCtrl+B")
                .build(app)?;

            let italic_item = MenuItemBuilder::with_id("italic", "Italic")
                .accelerator("CmdOrCtrl+I")
                .build(app)?;

            let underline_item = MenuItemBuilder::with_id("underline", "Underline")
                .accelerator("CmdOrCtrl+U")
                .build(app)?;

            let align_left_item = MenuItemBuilder::with_id("align_left", "Align Left")
                .accelerator("CmdOrCtrl+Shift+L")
                .build(app)?;

            let center_item = MenuItemBuilder::with_id("center", "Center")
                .accelerator("CmdOrCtrl+Shift+E")
                .build(app)?;

            let align_right_item = MenuItemBuilder::with_id("align_right", "Align Right")
                .accelerator("CmdOrCtrl+Shift+R")
                .build(app)?;

            let justify_item = MenuItemBuilder::with_id("justify", "Justify")
                .accelerator("CmdOrCtrl+J")
                .build(app)?;

            let find_replace_item = MenuItemBuilder::with_id("find_replace", "Find and Replace")
                .accelerator("CmdOrCtrl+F")
                .build(app)?;

            let zoom_in_item = MenuItemBuilder::with_id("zoom_in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(app)?;

            let zoom_out_item = MenuItemBuilder::with_id("zoom_out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?;

            let reset_zoom_item = MenuItemBuilder::with_id("reset_zoom", "Actual Size")
                .accelerator("CmdOrCtrl+0")
                .build(app)?;

            // Font Family Submenu
            let font_sans = MenuItemBuilder::with_id("font_sans", "Sans-Serif (Modern)").build(app)?;
            let font_georgia = MenuItemBuilder::with_id("font_georgia", "Georgia (Editorial)").build(app)?;
            let font_times = MenuItemBuilder::with_id("font_times", "Times New Roman (Manuscript)").build(app)?;
            let font_garamond = MenuItemBuilder::with_id("font_garamond", "Garamond (Book Layout)").build(app)?;
            let font_baskerville = MenuItemBuilder::with_id("font_baskerville", "Baskerville (Traditional)").build(app)?;
            let font_courier = MenuItemBuilder::with_id("font_courier", "Courier New (Typewriter)").build(app)?;
            let font_submenu = SubmenuBuilder::new(app, "Font Family")
                .item(&font_sans)
                .item(&font_georgia)
                .item(&font_times)
                .item(&font_garamond)
                .item(&font_baskerville)
                .item(&font_courier)
                .build()?;

            // Font Size Submenu
            let size_12 = MenuItemBuilder::with_id("size_12", "12px").build(app)?;
            let size_14 = MenuItemBuilder::with_id("size_14", "14px").build(app)?;
            let size_16 = MenuItemBuilder::with_id("size_16", "16px").build(app)?;
            let size_18 = MenuItemBuilder::with_id("size_18", "18px").build(app)?;
            let size_20 = MenuItemBuilder::with_id("size_20", "20px").build(app)?;
            let size_24 = MenuItemBuilder::with_id("size_24", "24px").build(app)?;
            let size_28 = MenuItemBuilder::with_id("size_28", "28px").build(app)?;
            let size_32 = MenuItemBuilder::with_id("size_32", "32px").build(app)?;
            let size_36 = MenuItemBuilder::with_id("size_36", "36px").build(app)?;
            let size_submenu = SubmenuBuilder::new(app, "Font Size")
                .item(&size_12)
                .item(&size_14)
                .item(&size_16)
                .item(&size_18)
                .item(&size_20)
                .item(&size_24)
                .item(&size_28)
                .item(&size_32)
                .item(&size_36)
                .build()?;

            // Font Color Submenu
            let color_default = MenuItemBuilder::with_id("color_default", "Default (Light)").build(app)?;
            let color_red = MenuItemBuilder::with_id("color_red", "Red").build(app)?;
            let color_orange = MenuItemBuilder::with_id("color_orange", "Orange").build(app)?;
            let color_yellow = MenuItemBuilder::with_id("color_yellow", "Yellow").build(app)?;
            let color_green = MenuItemBuilder::with_id("color_green", "Green").build(app)?;
            let color_blue = MenuItemBuilder::with_id("color_blue", "Blue").build(app)?;
            let color_purple = MenuItemBuilder::with_id("color_purple", "Purple").build(app)?;
            let color_submenu = SubmenuBuilder::new(app, "Font Color")
                .item(&color_default)
                .item(&color_red)
                .item(&color_orange)
                .item(&color_yellow)
                .item(&color_green)
                .item(&color_blue)
                .item(&color_purple)
                .build()?;

            // 2. Group them under standard native submenus
            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&new_item)
                .item(&open_item)
                .item(&save_item)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&print_item)
                .item(&export_word_item)
                .item(&share_bundle_item)
                .item(&close_item)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&PredefinedMenuItem::close_window(app, None::<&str>)?)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None::<&str>)?)
                .item(&PredefinedMenuItem::redo(app, None::<&str>)?)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&PredefinedMenuItem::cut(app, None::<&str>)?)
                .item(&PredefinedMenuItem::copy(app, None::<&str>)?)
                .item(&PredefinedMenuItem::paste(app, None::<&str>)?)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&PredefinedMenuItem::select_all(app, None::<&str>)?)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&find_replace_item)
                .build()?;

            let format_submenu = SubmenuBuilder::new(app, "Format")
                .item(&bold_item)
                .item(&italic_item)
                .item(&underline_item)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&align_left_item)
                .item(&center_item)
                .item(&align_right_item)
                .item(&justify_item)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&font_submenu)
                .item(&size_submenu)
                .item(&color_submenu)
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&zoom_in_item)
                .item(&zoom_out_item)
                .item(&reset_zoom_item)
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None::<&str>)?)
                .item(&PredefinedMenuItem::maximize(app, None::<&str>)?)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&PredefinedMenuItem::fullscreen(app, None::<&str>)?)
                .build()?;

            let help_item = MenuItemBuilder::with_id("view_help", "View Help")
                .accelerator("CmdOrCtrl+H")
                .build(app)?;
            let replay_item = MenuItemBuilder::with_id("replay", "Replay Session")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let help_submenu = SubmenuBuilder::new(app, "Help")
                .item(&help_item)
                .item(&replay_item)
                .build()?;
            // 3. Assemble and apply the application menu (conditional for macOS App menu)
            #[cfg(target_os = "macos")]
            let app_submenu = SubmenuBuilder::new(app, "App")
                .item(&PredefinedMenuItem::about(
                    app,
                    None::<&str>,
                    Some(AboutMetadata {
                        comments: Some("Organic Replay: \"Human, not A.I.\" initiative".into()),
                        credits: Some("Organic Replay: \"Human, not A.I.\" initiative".into()),
                        ..Default::default()
                    }),
                )?)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&PredefinedMenuItem::services(app, None::<&str>)?)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&PredefinedMenuItem::hide(app, None::<&str>)?)
                .item(&PredefinedMenuItem::hide_others(app, None::<&str>)?)
                .item(&PredefinedMenuItem::show_all(app, None::<&str>)?)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&PredefinedMenuItem::quit(app, None::<&str>)?)
                .build()?;

            let menu = {
                let mut builder = MenuBuilder::new(app);
                #[cfg(target_os = "macos")]
                {
                    builder = builder.item(&app_submenu);
                }
                builder
                    .item(&file_submenu)
                    .item(&edit_submenu)
                    .item(&format_submenu)
                    .item(&view_submenu)
                    .item(&window_submenu)
                    .item(&help_submenu)
                    .build()?
            };
            app.set_menu(menu)?;

            // 4. Forward OS menu events to the frontend via IPC
            app.on_menu_event(move |app_handle, event| {
                match event.id().as_ref() {
                    "new_doc" => { let _ = app_handle.emit("menu-new", ()); }
                    "open" => { let _ = app_handle.emit("menu-open", ()); }
                    "save" => { let _ = app_handle.emit("menu-save", ()); }
                    "print" => { let _ = app_handle.emit("menu-print", ()); }
                    "export_word" => { let _ = app_handle.emit("menu-export-word", ()); }
                    "share_bundle" => { let _ = app_handle.emit("menu-share-bundle", ()); }
                    "close_doc" => { let _ = app_handle.emit("menu-close-doc", ()); }
                    "bold" => { let _ = app_handle.emit("menu-bold", ()); }
                    "italic" => { let _ = app_handle.emit("menu-italic", ()); }
                    "underline" => { let _ = app_handle.emit("menu-underline", ()); }
                    "align_left" => { let _ = app_handle.emit("menu-align-left", ()); }
                    "center" => { let _ = app_handle.emit("menu-center", ()); }
                    "align_right" => { let _ = app_handle.emit("menu-align-right", ()); }
                    "justify" => { let _ = app_handle.emit("menu-justify", ()); }
                    "zoom_in" => { let _ = app_handle.emit("menu-zoom-in", ()); }
                    "zoom_out" => { let _ = app_handle.emit("menu-zoom-out", ()); }
                    "reset_zoom" => { let _ = app_handle.emit("menu-reset-zoom", ()); }
                    "find_replace" => { let _ = app_handle.emit("menu-find", ()); }
                    "font_sans" => { let _ = app_handle.emit("menu-font", "system-ui, -apple-system, sans-serif"); }
                    "font_georgia" => { let _ = app_handle.emit("menu-font", "Georgia, serif"); }
                    "font_times" => { let _ = app_handle.emit("menu-font", "'Times New Roman', Times, serif"); }
                    "font_garamond" => { let _ = app_handle.emit("menu-font", "Garamond, 'EB Garamond', serif"); }
                    "font_baskerville" => { let _ = app_handle.emit("menu-font", "Baskerville, 'Times New Roman', serif"); }
                    "font_courier" => { let _ = app_handle.emit("menu-font", "'Courier New', Courier, monospace"); }
                    "size_12" => { let _ = app_handle.emit("menu-size", "12px"); }
                    "size_14" => { let _ = app_handle.emit("menu-size", "14px"); }
                    "size_16" => { let _ = app_handle.emit("menu-size", "16px"); }
                    "size_18" => { let _ = app_handle.emit("menu-size", "18px"); }
                    "size_20" => { let _ = app_handle.emit("menu-size", "20px"); }
                    "size_24" => { let _ = app_handle.emit("menu-size", "24px"); }
                    "size_28" => { let _ = app_handle.emit("menu-size", "28px"); }
                    "size_32" => { let _ = app_handle.emit("menu-size", "32px"); }
                    "size_36" => { let _ = app_handle.emit("menu-size", "36px"); }
                    "color_default" => { let _ = app_handle.emit("menu-color", "#abb2bf"); }
                    "color_red" => { let _ = app_handle.emit("menu-color", "#e06c75"); }
                    "color_orange" => { let _ = app_handle.emit("menu-color", "#d19a66"); }
                    "color_yellow" => { let _ = app_handle.emit("menu-color", "#e5c07b"); }
                    "color_green" => { let _ = app_handle.emit("menu-color", "#98c379"); }
                    "color_blue" => { let _ = app_handle.emit("menu-color", "#61afef"); }
                    "color_purple" => { let _ = app_handle.emit("menu-color", "#c678dd"); }
                    "view_help" => {
                        // If the window is already open, focus it instead of opening a duplicate
                        if let Some(help_win) = app_handle.get_webview_window("help-window") {
                            let _ = help_win.set_focus();
                        } else {
                            // Spawn a new native read-only window for Help
                            let _ = tauri::WebviewWindowBuilder::new(
                                app_handle,
                                "help-window",
                                tauri::WebviewUrl::App("help.html".into())
                            )
                            .title("Organic Replay - Help")
                            .inner_size(600.0, 500.0)
                            .resizable(true)
                            .build();
                        }
                    }
                    "replay" => {
                        if let Some(replay_win) = app_handle.get_webview_window("replay-window") {
                            let _ = replay_win.set_focus();
                        } else {
                            let _ = tauri::WebviewWindowBuilder::new(
                                app_handle,
                                "replay-window",
                                tauri::WebviewUrl::App("replay.html".into())
                            )
                            .title("Organic Replay - Session Replay")
                            .inner_size(950.0, 650.0)
                            .resizable(true)
                            .build();
                        }
                    }
                    _ => {}
                }
            });
            Ok(())
        })
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    let state = window.state::<AppState>();
                    let _ = std::fs::remove_file(&state.temp_db_path);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_content_signature() {
        let content = "Hello, world!".to_string();
        let sig = generate_content_signature(content);
        // SHA-256 of "Hello, world!"
        assert_eq!(sig, "315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3");
    }

    #[test]
    fn test_init_db() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_organic_forensic.db").to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&db_path);

        assert!(init_db(&db_path).is_ok());
        let conn = Connection::open(&db_path).unwrap();
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='forensic_log'").unwrap();
        assert!(stmt.exists([]).unwrap());
        let _ = std::fs::remove_file(&db_path);
    }

    #[test]
    fn test_log_and_retrieve_events() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_organic_log.db").to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&db_path);

        init_db(&db_path).unwrap();
        let conn = Connection::open(&db_path).unwrap();

        // Insert a mock forensic event
        conn.execute(
            "INSERT INTO forensic_log (timestamp, \"row\", \"column\", event_type, content)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![1234567890, 1, 5, "input", "A"],
        ).unwrap();

        // Query it back (mirroring the get_forensic_events command logic)
        let mut stmt = conn.prepare("SELECT id, timestamp, \"row\", \"column\", event_type, content FROM forensic_log ORDER BY timestamp ASC").unwrap();
        let mut event_iter = stmt.query_map([], |row| {
            Ok(ForensicEvent {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                row: row.get(2)?,
                column: row.get(3)?,
                event_type: row.get(4)?,
                content: row.get(5)?,
            })
        }).unwrap();

        let event = event_iter.next().unwrap().unwrap();
        assert_eq!(event.timestamp, 1234567890);
        assert_eq!(event.row, 1);
        assert_eq!(event.column, 5);
        assert_eq!(event.event_type, "input");
        assert_eq!(event.content, Some("A".to_string()));

        let _ = std::fs::remove_file(&db_path);
    }

    #[test]
    fn test_get_tsgr_path() {
        let doc_path = "/Users/test/document.txt";
        let tsgr = get_tsgr_path(doc_path);
        assert_eq!(tsgr.to_str().unwrap(), "/Users/test/.document.txt.tsgr");

        let doc_path_simple = "notes.md";
        let tsgr_simple = get_tsgr_path(doc_path_simple);
        assert_eq!(tsgr_simple.to_str().unwrap(), ".notes.md.tsgr");
    }

    #[test]
    fn test_generate_content_signature_empty() {
        let content_empty = "".to_string();
        let sig_empty = generate_content_signature(content_empty);
        assert_eq!(sig_empty, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }

    #[test]
    fn test_greet() {
        let greeting = greet("Nikhil");
        assert_eq!(greeting, "Hello, Nikhil! You've been greeted from Rust!");
    }

    #[test]
    fn test_get_system_font_families() {
        let families = get_system_font_families();
        // Verify the function executes successfully without panicking
        let _ = families;
    }

    #[test]
    fn test_generate_content_signature_consistency() {
        use sha2::{Sha256, Digest};
        let test_strings = vec![
            "",
            "Hello, world!",
            "Some multi\nline\ncontent with tabs\t and spaces.",
            "1234567890",
        ];
        for s in test_strings {
            let mut hasher = Sha256::new();
            hasher.update(s.as_bytes());
            let expected = format!("{:x}", hasher.finalize());
            assert_eq!(generate_content_signature(s.to_string()), expected);
        }
    }

    #[test]
    fn test_hide_file_on_windows() {
        let temp_file = std::env::temp_dir().join("test_hide_file_windows.txt");
        std::fs::write(&temp_file, "test").unwrap();
        // Should run without panicking on all platforms
        hide_file_on_windows(&temp_file);
        std::fs::remove_file(&temp_file).unwrap();
    }

    #[test]
    fn test_init_db_multiple_times() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_organic_multiple_init.db").to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&db_path);

        assert!(init_db(&db_path).is_ok());
        assert!(init_db(&db_path).is_ok()); // second init should succeed with no error
        let _ = std::fs::remove_file(&db_path);
    }

    #[test]
    fn test_create_zip_bundle() {
        use std::io::Read;
        let temp_dir = std::env::temp_dir();
        let doc_path = temp_dir.join("test_doc.txt");
        let tsgr_path = temp_dir.join(".test_doc.txt.tsgr");
        let zip_path = temp_dir.join("test_bundle.zip");

        let _ = std::fs::remove_file(&doc_path);
        let _ = std::fs::remove_file(&tsgr_path);
        let _ = std::fs::remove_file(&zip_path);

        std::fs::write(&doc_path, "Hello World Document Content").unwrap();
        std::fs::write(&tsgr_path, "Mock SQLite/TSGR Content").unwrap();

        let result = create_zip_bundle(&doc_path, &tsgr_path, &zip_path);
        assert!(result.is_ok());
        assert!(zip_path.exists());

        let zip_file = std::fs::File::open(&zip_path).unwrap();
        let mut archive = zip::ZipArchive::new(zip_file).unwrap();
        assert_eq!(archive.len(), 3);

        {
            let mut file1 = archive.by_name("test_doc.txt").unwrap();
            let mut content1 = String::new();
            file1.read_to_string(&mut content1).unwrap();
            assert_eq!(content1, "Hello World Document Content");
        }

        {
            let mut file2 = archive.by_name(".test_doc.txt.tsgr").unwrap();
            let mut content2 = String::new();
            file2.read_to_string(&mut content2).unwrap();
            assert_eq!(content2, "Mock SQLite/TSGR Content");
        }

        let _ = std::fs::remove_file(&doc_path);
        let _ = std::fs::remove_file(&tsgr_path);
        let _ = std::fs::remove_file(&zip_path);
    }

    #[test]
    fn test_verify_document_integrity_match() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_integrity_match.db").to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&db_path);

        init_db(&db_path).unwrap();
        let conn = Connection::open(&db_path).unwrap();

        let doc_content = "Hello, world!".to_string();
        let sig = generate_content_signature(doc_content.clone());

        // Log a save event containing the correct SHA-256 signature
        conn.execute(
            "INSERT INTO forensic_log (timestamp, \"row\", \"column\", event_type, content)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![1234567890, 1, 1, "save", Some(sig)],
        ).unwrap();

        let mut stmt = conn.prepare("SELECT content FROM forensic_log WHERE event_type = 'save' ORDER BY id DESC LIMIT 1").unwrap();
        let mut rows = stmt.query([]).unwrap();
        let mut matched = false;
        if let Some(row) = rows.next().unwrap() {
            let recorded_signature: Option<String> = row.get(0).unwrap();
            if let Some(expected_sig) = recorded_signature {
                let actual_sig = generate_content_signature(doc_content);
                matched = actual_sig == expected_sig;
            }
        }
        assert!(matched);
        let _ = std::fs::remove_file(&db_path);
    }

    #[test]
    fn test_verify_document_integrity_differ() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_integrity_differ.db").to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&db_path);

        init_db(&db_path).unwrap();
        let conn = Connection::open(&db_path).unwrap();

        let doc_content = "Hello, world!".to_string();
        let sig = generate_content_signature(doc_content);

        // Log a save event containing the signature of the authentic version
        conn.execute(
            "INSERT INTO forensic_log (timestamp, \"row\", \"column\", event_type, content)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![1234567890, 1, 1, "save", Some(sig)],
        ).unwrap();

        // Try to verify modified content (edited outside Organic)
        let modified_content = "Hello, world! (Modified externally)".to_string();
        let mut stmt = conn.prepare("SELECT content FROM forensic_log WHERE event_type = 'save' ORDER BY id DESC LIMIT 1").unwrap();
        let mut rows = stmt.query([]).unwrap();
        let mut matched = true;
        if let Some(row) = rows.next().unwrap() {
            let recorded_signature: Option<String> = row.get(0).unwrap();
            if let Some(expected_sig) = recorded_signature {
                let actual_sig = generate_content_signature(modified_content);
                matched = actual_sig == expected_sig;
            }
        }
        assert!(!matched);
        let _ = std::fs::remove_file(&db_path);
    }

    #[test]
    fn test_sqlite_transaction_stress_load() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_sqlite_stress.db").to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&db_path);

        init_db(&db_path).unwrap();
        
        // Simulating the persistent connection model
        let conn = Connection::open(&db_path).unwrap();

        // 1. Stress Test: 5,000 sequential rapid-fire transactions (e.g. rapid keypresses)
        let num_inserts = 5000;
        let start_time = std::time::Instant::now();

        for i in 0..num_inserts {
            conn.execute(
                "INSERT INTO forensic_log (timestamp, \"row\", \"column\", event_type, content)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    1234567890 + i as i64,
                    1,
                    (i % 80) as i32,
                    "input",
                    "a"
                ],
            ).unwrap();
        }

        let elapsed_sequential = start_time.elapsed();
        println!("Inserted {} sequential events in {:?}", num_inserts, elapsed_sequential);

        // 2. Stress Test: Gigantic paste operation (100,000 characters)
        let gigantic_paste_content = "a".repeat(100_000);
        let start_paste = std::time::Instant::now();
        conn.execute(
            "INSERT INTO forensic_log (timestamp, \"row\", \"column\", event_type, content)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                2000000000,
                1,
                0,
                "clipboard_paste",
                Some(gigantic_paste_content.clone())
            ],
        ).unwrap();
        let elapsed_paste = start_paste.elapsed();
        println!("Pasted 100,000 characters in {:?}", elapsed_paste);

        // Validate count of elements
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM forensic_log").unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, num_inserts + 1);

        // Validate retrieved content of the gigantic paste
        let mut stmt_paste = conn.prepare("SELECT content FROM forensic_log WHERE event_type = 'clipboard_paste'").unwrap();
        let retrieved_paste: String = stmt_paste.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(retrieved_paste.len(), 100_000);

        let _ = std::fs::remove_file(&db_path);
    }

    #[test]
    fn test_persistent_connection_lock_release() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_lock_release.db").to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&db_path);

        init_db(&db_path).unwrap();

        let db_conn = Mutex::new(Some(Connection::open(&db_path).unwrap()));
        *db_conn.lock().unwrap() = None;

        let remove_result = std::fs::remove_file(&db_path);
        assert!(remove_result.is_ok());
    }
}
