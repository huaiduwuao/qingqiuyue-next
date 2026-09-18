// src/lib.rs - Tauri 应用逻辑 (CSR 静态模式)
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const DEFAULT_API_BASE: &str = "http://localhost:9080";

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

// 用 shell 插件而不是 open crate:open 只认桌面,安卓上打不开系统浏览器,
// 而微信授权恰恰必须走系统浏览器。
#[tauri::command]
fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if url.is_empty() {
        return Ok(());
    }
    use tauri_plugin_shell::ShellExt;
    app.shell().open(url, None).map_err(|e| e.to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("qingqiuyue-desktop starting (CSR mode)...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
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

            // qingqiuyue://social-login?... —— 系统浏览器里授权完成后,微信回调把人送回这里。
            // Windows/Linux 上开发运行时协议没写进注册表,register_all 补一下;打包安装的版本由安装器注册。
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(e) = app.deep_link().register_all() {
                    log::warn!("[deep-link] register_all failed: {e}");
                }
            }
            {
                use tauri::Emitter;
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                    log::info!("[deep-link] opened: {urls:?}");
                    // 前端用 window.__TAURI__.event.listen('deep-link://open') 收
                    if let Err(e) = handle.emit("deep-link://open", urls) {
                        log::warn!("[deep-link] emit failed: {e}");
                    }
                });
            }

            // 获取可执行文件所在目录
            let exe_path = std::env::current_exe()
                .expect("Failed to get current executable path");
            let exe_dir = exe_path.parent()
                .expect("Failed to get parent directory")
                .to_path_buf();

            log::info!("Executable directory: {:?}", exe_dir);
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log::info!("Window close requested");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
