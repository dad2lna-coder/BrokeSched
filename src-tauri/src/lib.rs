use std::fs;
use std::path::PathBuf;

fn username() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "OPERATOR".to_string())
}

fn walk_for_schedule_builder(root: &PathBuf, depth: u8) -> Option<PathBuf> {
    if depth == 0 {
        return None;
    }
    let target = root.join("Schedule Builder");
    if target.is_dir() {
        return Some(target);
    }
    if let Ok(rd) = fs::read_dir(root) {
        for entry in rd.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
                if name.starts_with("onedrive") || name.contains("ustsa") || name.contains("sharepoint") {
                    if let Some(found) = walk_for_schedule_builder(&path, depth - 1) {
                        return Some(found);
                    }
                }
            }
        }
    }
    None
}

fn discover_schedule_builder() -> PathBuf {
    let user = username();
    let home = PathBuf::from(format!("C:\\Users\\{}", user));
    let preferred = home.join("OneDrive - USTSA").join("Schedule Builder");
    if preferred.is_dir() {
        return preferred;
    }
    if let Some(found) = walk_for_schedule_builder(&home, 3) {
        return found;
    }
    preferred
}

#[tauri::command]
fn get_operator() -> String {
    username()
}

#[tauri::command]
fn shared_folder_path() -> String {
    discover_schedule_builder().display().to_string()
}

#[tauri::command]
fn write_shared_bytes(filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let root = discover_schedule_builder();
    if !root.exists() {
        fs::create_dir_all(&root)
            .map_err(|e| format!("Cannot create {}: {}", root.display(), e))?;
    }
    let dest = root.join(filename);
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;
    Ok(dest.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_operator,
            shared_folder_path,
            write_shared_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running BLADE");
}
