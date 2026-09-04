use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn get_operator() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "OPERATOR".to_string())
}

#[tauri::command]
fn onedrive_hints() -> Vec<String> {
    let keys = ["OneDriveCommercial", "OneDriveConsumer", "OneDrive"];
    let mut out = Vec::new();
    for key in keys {
        if let Ok(p) = std::env::var(key) {
            if !p.is_empty() && !out.contains(&p) {
                out.push(p);
            }
        }
    }
    out
}

#[tauri::command]
fn write_shared_bytes(folder: String, filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let mut path = PathBuf::from(folder);
    if !path.exists() {
        return Err(format!("Shared folder does not exist: {}", path.display()));
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
            onedrive_hints,
            write_shared_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running BLADE");
}
