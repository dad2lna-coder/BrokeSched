use std::fs;
use std::path::{Path, PathBuf};

fn username() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "OPERATOR".to_string())
}

fn first_existing(paths: &[PathBuf]) -> Option<PathBuf> {
    paths.iter().find(|p| p.exists()).cloned()
}

fn discover_schedule_builder() -> PathBuf {
    let user = username();
    let home = PathBuf::from(format!("C:\\Users\\{}", user));
    let mut candidates = vec![
        home.join("OneDrive - USTSA").join("Schedule Builder"),
        home.join("OneDrive - Transportation Security Administration")
            .join("Schedule Builder"),
        home.join("OneDrive").join("Schedule Builder"),
    ];
    if let Ok(rd) = fs::read_dir(&home) {
        for entry in rd.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.to_ascii_lowercase().starts_with("onedrive") {
                candidates.push(entry.path().join("Schedule Builder"));
            }
        }
    }
    if let Some(found) = first_existing(&candidates) {
        return found;
    }
    home.join("OneDrive - USTSA").join("Schedule Builder")
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
fn onedrive_hints() -> Vec<String> {
    vec![shared_folder_path()]
}

#[tauri::command]
fn write_shared_bytes(
    folder: Option<String>,
    filename: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let root = folder
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(discover_schedule_builder);
    if !root.exists() {
        fs::create_dir_all(&root).map_err(|e| {
            format!("Cannot create {}: {}", root.display(), e)
        })?;
    }
    let dest = root.join(filename);
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;
    Ok(dest.display().to_string())
}

#[allow(dead_code)]
fn _touch(path: &Path) {
    let _ = path;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_operator,
            shared_folder_path,
            onedrive_hints,
            write_shared_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running BLADE");
}
