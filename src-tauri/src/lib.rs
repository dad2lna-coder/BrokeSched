use std::fs;
use std::path::PathBuf;

fn username() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "OPERATOR".to_string())
}

fn user_home() -> PathBuf {
    PathBuf::from(format!("C:\\Users\\{}", username()))
}

fn find_onedrive_root() -> PathBuf {
    let home = user_home();
    let preferred = home.join("OneDrive - USTSA");
    if preferred.is_dir() {
        return preferred;
    }
    if let Ok(rd) = fs::read_dir(&home) {
        let mut matches: Vec<PathBuf> = rd
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .filter(|p| {
                let n = p
                    .file_name()
                    .map(|s| s.to_string_lossy().to_ascii_lowercase())
                    .unwrap_or_default();
                n.starts_with("onedrive")
            })
            .collect();
        matches.sort();
        if let Some(found) = matches.into_iter().next() {
            return found;
        }
    }
    preferred
}

fn find_schedule_builder() -> PathBuf {
    let od = find_onedrive_root();
    let preferred = od.join("Schedule Builder");
    if preferred.is_dir() {
        return preferred;
    }
    if let Ok(rd) = fs::read_dir(&od) {
        for entry in rd.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
                if name.contains("schedule") && name.contains("builder") {
                    return path;
                }
            }
        }
    }
    preferred
}

fn ensure_dir(path: &PathBuf) -> Result<(), String> {
    if path.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(path).map_err(|e| format!("Cannot create {}: {}", path.display(), e))
}

#[tauri::command]
fn get_operator() -> String {
    username()
}

#[tauri::command]
fn shared_folder_path() -> Result<String, String> {
    let root = find_schedule_builder();
    ensure_dir(&root)?;
    Ok(root.display().to_string())
}

#[tauri::command]
fn write_shared_bytes(filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let root = find_schedule_builder();
    ensure_dir(&root)?;
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
