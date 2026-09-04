use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

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

fn sanitize_airport(code: &str) -> String {
    code.chars()
        .filter(|c| c.is_ascii_alphabetic())
        .map(|c| c.to_ascii_uppercase())
        .take(3)
        .collect()
}

fn airport_dir(code: &str) -> Result<PathBuf, String> {
    let c = sanitize_airport(code);
    if c.len() != 3 {
        return Err("Airport code must be 3 letters".into());
    }
    Ok(find_schedule_builder().join(c))
}

fn update_dir() -> PathBuf {
    find_schedule_builder().join("BLADE-Update")
}

fn parse_ver(s: &str) -> (u32, u32, u32) {
    let mut parts = s
        .split(|c: char| !c.is_ascii_digit())
        .filter(|p| !p.is_empty())
        .filter_map(|p| p.parse::<u32>().ok());
    (
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    )
}

fn ver_gt(a: (u32, u32, u32), b: (u32, u32, u32)) -> bool {
    a > b
}

fn current_version() -> (u32, u32, u32) {
    parse_ver(env!("CARGO_PKG_VERSION"))
}

fn version_from_name(name: &str) -> Option<(u32, u32, u32)> {
    let lower = name.to_ascii_lowercase();
    if !(lower.contains("blade") && (lower.ends_with(".exe") || lower.ends_with(".msi"))) {
        return None;
    }
    Some(parse_ver(name))
}

fn newest_installer(dir: &Path) -> Option<(PathBuf, (u32, u32, u32))> {
    let rd = fs::read_dir(dir).ok()?;
    let mut best: Option<(PathBuf, (u32, u32, u32))> = None;
    for entry in rd.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name()?.to_string_lossy().to_string();
        if let Some(ver) = version_from_name(&name) {
            if best.as_ref().map(|b| ver_gt(ver, b.1)).unwrap_or(true) {
                best = Some((path, ver));
            }
        }
    }
    best
}

fn launch_installer(path: &Path) -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", "", &path.display().to_string()])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_operator() -> String {
    username()
}

#[tauri::command]
fn shared_folder_path() -> Result<String, String> {
    let root = find_schedule_builder();
    ensure_dir(&root)?;
    let updates = update_dir();
    ensure_dir(&updates)?;
    let readme = updates.join("DROP_NEW_INSTALLER_HERE.txt");
    if !readme.exists() {
        let _ = fs::write(
            readme,
            "Drop a newer BLADE installer here, named like:\r\n\
BLADE_0.2.4_x64-setup.exe\r\n",
        );
    }
    Ok(root.display().to_string())
}

#[tauri::command]
fn ensure_airport_folder(airport: String) -> Result<String, String> {
    let dir = airport_dir(&airport)?;
    ensure_dir(&dir)?;
    Ok(dir.display().to_string())
}

#[tauri::command]
fn write_shared_bytes(filename: String, bytes: Vec<u8>, airport: Option<String>) -> Result<String, String> {
    let dest_dir = match airport {
        Some(code) if sanitize_airport(&code).len() == 3 => airport_dir(&code)?,
        _ => find_schedule_builder(),
    };
    ensure_dir(&dest_dir)?;
    let dest = dest_dir.join(filename);
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;
    Ok(dest.display().to_string())
}

#[tauri::command]
fn apply_share_update() -> Result<String, String> {
    let _ = shared_folder_path()?;
    let dir = update_dir();
    let current = current_version();
    match newest_installer(&dir) {
        Some((path, ver)) if ver_gt(ver, current) => {
            launch_installer(&path)?;
            Ok(format!(
                "Update {}.{}.{} found. Starting {}",
                ver.0,
                ver.1,
                ver.2,
                path.file_name().unwrap_or_default().to_string_lossy()
            ))
        }
        Some((_, ver)) => Ok(format!(
            "Share installer {}.{}.{} is not newer than this build {}.{}.{}",
            ver.0, ver.1, ver.2, current.0, current.1, current.2
        )),
        None => Ok(format!(
            "No installer in BLADE-Update (running {}.{}.{})",
            current.0, current.1, current.2
        )),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_operator,
            shared_folder_path,
            ensure_airport_folder,
            write_shared_bytes,
            apply_share_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running BLADE");
}
