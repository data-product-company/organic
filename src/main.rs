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

use tauri::command;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

#[command]
async fn open_document() -> Result<(String, String), String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Text & Word Documents", &["txt", "md", "html", "doc"])
        .pick_file()
        .await;

    if let Some(file) = file {
        let path = file.path().to_string_lossy().into_owned();
        let content = std::fs::read_to_string(file.path()).map_err(|e| e.to_string())?;
        Ok((path, content))
    } else {
        Err("Cancelled".into())
    }
}

#[command]
async fn save_document(path: Option<String>, content: String) -> Result<String, String> {
    let file_path = match path {
        Some(p) => std::path::PathBuf::from(p),
        None => {
            let save_dialog = rfd::AsyncFileDialog::new()
                .add_filter("Text Documents", &["txt", "md", "html"])
                .save_file()
                .await;
            
            match save_dialog {
                Some(f) => f.path().to_owned(),
                None => return Err("Cancelled".into()),
            }
        }
    };

    std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().into_owned())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_document, save_document])
        .setup(|app| {
            // 1. Create native menu items with OS-level accelerators
            let open_item = MenuItemBuilder::with_id("open", "Open File")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;

            let save_item = MenuItemBuilder::with_id("save", "Save File")
                .accelerator("CmdOrCtrl+S")
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

            // 2. Group them under a native "File" submenu
            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&open_item)
                .item(&save_item)
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&zoom_in_item)
                .item(&zoom_out_item)
                .item(&reset_zoom_item)
                .build()?;

            // 3. Assemble and apply the application menu
            let menu = MenuBuilder::new(app)
                .item(&file_submenu)
                .item(&view_submenu)
                .build()?;
            app.set_menu(menu)?;

            // 4. Forward OS menu events to the frontend via IPC
            app.on_menu_event(move |app_handle, event| {
                match event.id().as_ref() {
                    "open" => { let _ = app_handle.emit("menu-open", ()); }
                    "save" => { let _ = app_handle.emit("menu-save", ()); }
                    "zoom_in" => { let _ = app_handle.emit("menu-zoom-in", ()); }
                    "zoom_out" => { let _ = app_handle.emit("menu-zoom-out", ()); }
                    "reset_zoom" => { let _ = app_handle.emit("menu-reset-zoom", ()); }
                    _ => {}
                }
            });
            Ok(())
        })
        .run(tauri::generate_context())
        .expect("error while running tauri application");
}