// src/lib.rs - Tauri 应用逻辑
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

const DEFAULT_API_BASE: &str = "http://localhost:9080";
const SERVER_PORT: u16 = 3000;

// 应用配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub api_base: String,
}

// 系统信息
#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    os: String,
    arch: String,
    #[serde(rename = "rustVersion")]
    rust_version: String,
    #[serde(rename = "numCpu")]
    num_cpu: usize,
    #[serde(rename = "tauriBuild")]
    tauri_build: bool,
}

// 获取配置路径
fn get_config_path() -> PathBuf {
    let dir = match std::env::consts::OS {
        "windows" => dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("qingqiuyue-desktop"),
        "macos" => dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library/Application Support/qingqiuyue-desktop"),
        _ => dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".config/qingqiuyue-desktop"),
    };
    fs::create_dir_all(&dir).ok();
    dir.join("config.json")
}

// 读取配置
fn read_config() -> AppConfig {
    let path = get_config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or(AppConfig {
            api_base: DEFAULT_API_BASE.to_string(),
        })
    } else {
        AppConfig {
            api_base: DEFAULT_API_BASE.to_string(),
        }
    }
}

// 写入配置
fn write_config(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path();
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

// 启动 Node.js 服务器
fn start_server(exe_dir: PathBuf) -> Option<std::process::Child> {
    let server_path = exe_dir.join("server.js");
    if !server_path.exists() {
        log::warn!("server.js not found at {:?}", server_path);
        return None;
    }

    // 设置环境变量
    let mut env_vars = std::env::vars().collect::<std::collections::HashMap<_, _>>();
    env_vars.insert("PORT".to_string(), SERVER_PORT.to_string());
    env_vars.insert("HOSTNAME".to_string(), "127.0.0.1".to_string());
    env_vars.insert("NODE_ENV".to_string(), "production".to_string());

    log::info!("Starting Next.js server from {:?}", server_path);

    match Command::new("node")
        .arg(server_path)
        .envs(&env_vars)
        .current_dir(&exe_dir)
        .spawn()
    {
        Ok(child) => {
            log::info!("Next.js server started successfully");
            Some(child)
        }
        Err(e) => {
            log::error!("Failed to start Next.js server: {}", e);
            None
        }
    }
}

// Tauri 命令
#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        rust_version: env!("CARGO_PKG_VERSION").to_string(),
        num_cpu: num_cpus(),
        tauri_build: true,
    }
}

#[tauri::command]
fn get_api_base() -> String {
    read_config().api_base
}

#[tauri::command]
fn set_api_base(url: String) -> Result<(), String> {
    let mut config = read_config();
    config.api_base = url;
    write_config(&config)
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if url.is_empty() {
        return Ok(());
    }
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_version() -> String {
    "0.1.0".to_string()
}

#[tauri::command]
fn is_dev() -> bool {
    std::env::var("TAURI_DEBUG").is_ok() || cfg!(debug_assertions)
}

fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1)
}

// 服务器进程管理
struct ServerChild(Option<std::process::Child>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("qingqiuyue-desktop starting...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_api_base,
            set_api_base,
            open_external,
            get_version,
            is_dev,
        ])
        .setup(|app| {
            log::info!("[qingqiuyue-desktop] setup complete");

            // 获取可执行文件所在目录
            let exe_path = std::env::current_exe()
                .expect("Failed to get current executable path");
            let exe_dir = exe_path.parent()
                .expect("Failed to get parent directory")
                .to_path_buf();

            log::info!("Executable directory: {:?}", exe_dir);

            // 启动 Node.js 服务器
            if let Some(child) = start_server(exe_dir) {
                app.manage(ServerChild(Some(child)));
                log::info!("Server process managed by Tauri");
            } else {
                log::warn!("Server not started, will use embedded server");
            }

            // 等待服务器启动
            std::thread::sleep(std::time::Duration::from_secs(2));

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log::info!("Window close requested, cleaning up...");
                // 窗口关闭时，服务器进程会被自动清理
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
