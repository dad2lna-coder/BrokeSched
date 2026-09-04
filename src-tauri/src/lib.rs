use std::fs;
use std::path::PathBuf;

fn username() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "OPERATOR".to_string())
}

#[tauri::command]
fn get_operator() -> String {
    username()
}

#[tauri::command]
fn shared_folder_path() -> String {
    let user = username();
    format!("C:\\Users\\{}\\OneDrive - USTSA\\Schedule Builder", user)
}

#[tauri::command]
fn onedrive_hints() -> Vec<String> {
    let mut out = vec![shared_folder_path()];
    for key in ["OneDriveCommercial", "OneDriveConsumer", "OneDrive"] {
        if let Ok(p) = std::env::var(key) {
            if !p.is_empty() && !out.contains(&p) {
                out.push(p);
            }
        }
    }
    out
}

#[tauri::command]
fn write_shared_bytes(folder: Option<String>, filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let folder = folder.filter(|s| !s.is_empty()).unwrap_or_else(shared_folder_path);
    let mut path = PathBuf::from(&folder);
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("Cannot create {}: {}", path.display(), e))?;
    }
    path.push(filename);
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
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
