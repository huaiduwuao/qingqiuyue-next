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

/// 允许交给系统打开的地址:https 网页,以及分享面板唤起 App 用的裸 scheme。
/// 页面里一旦有 XSS,脚本就能调 open_external;不设限的话 file:///、UNC 路径、
/// 任意自定义协议都能被拿去启动本机程序。
///
/// http 只放行两种:与打包时的 API 网关同源(测试 / 预发环境网关常是 http,微信登录入口就在网关上),
/// 以及 debug 构建(tauri dev 时 cargo 拿不到 Next 的 .env,网关地址未知)。
const APP_LAUNCH_SCHEMES: &[&str] = &["xhsdiscover://", "snssdk1128://", "kwaiyewen://"];

/// 打包时的网关地址:`NEXT_PUBLIC_API_BASE_URL=... pnpm app:windows` 同一个环境变量也传给了 cargo,
/// 与前端烘进去的是同一个值(build.rs 里 rerun-if-env-changed,换了地址会重编)。
const BUILD_API_BASE: Option<&str> = option_env!("NEXT_PUBLIC_API_BASE_URL");

fn is_allowed_external(url: &str) -> bool {
    is_allowed_external_with(url, BUILD_API_BASE, cfg!(debug_assertions))
}

fn is_allowed_external_with(url: &str, api_base: Option<&str>, allow_any_http: bool) -> bool {
    if APP_LAUNCH_SCHEMES.contains(&url) {
        return true;
    }
    let u = match tauri::Url::parse(url) {
        Ok(u) => u,
        Err(_) => return false,
    };
    if u.host_str().map_or(true, |h| h.is_empty()) || !u.username().is_empty() || u.password().is_some() {
        return false;
    }
    match u.scheme() {
        "https" => true,
        "http" => {
            allow_any_http
                || api_base
                    .and_then(|b| tauri::Url::parse(b.trim()).ok())
                    .map_or(false, |b| b.scheme() == "http" && b.origin() == u.origin())
        }
        _ => false,
    }
}

// 用 shell 插件而不是 open crate:open 只认桌面,安卓上打不开系统浏览器,
// 而微信授权恰恰必须走系统浏览器。
#[tauri::command]
fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if url.is_empty() {
        return Ok(());
    }
    if !is_allowed_external(&url) {
        log::warn!("[open_external] rejected url (not https / api base)");
        return Err("only https (or the api base) urls can be opened".into());
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

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();
    // 单实例必须第一个注册。开了 deep-link feature 后,新进程带着 qingqiuyue:// 链接启动时,
    // 插件把链接转给已在运行的实例(那边的 on_open_url 会收到),新进程直接退出。
    // 这里只负责把已有窗口拉到前台,让用户看到登录结果。
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }));
        // 自动更新(公钥 / 清单地址在 tauri.conf.json 的 plugins.updater),前端见 components/client/AppUpdater.tsx
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_api_base,
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
                    // OpenUrlEvent::urls(self) 会拿走 event,只能调一次
                    let parsed = event.urls();
                    let urls: Vec<String> = parsed.iter().map(|u| u.to_string()).collect();
                    // 只记 scheme://host/path:query 里可能带登录凭据(code / session_id),不能进日志
                    let logged: Vec<String> = parsed
                        .iter()
                        .map(|u| format!("{}://{}{}", u.scheme(), u.host_str().unwrap_or(""), u.path()))
                        .collect();
                    log::info!("[deep-link] opened: {logged:?}");
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

#[cfg(test)]
mod tests {
    use super::is_allowed_external_with;

    #[test]
    fn open_external_allow_list() {
        let base = Some("http://10.9.1.2:10005");
        assert!(is_allowed_external_with(
            "https://qingqiuyue.com/api/core/oauth/login/wechat?from=%2F",
            None,
            false
        ));
        assert!(is_allowed_external_with("xhsdiscover://", None, false));
        // 测试环境网关是 http:与打包时的网关同源才放行
        assert!(is_allowed_external_with(
            "http://10.9.1.2:10005/api/core/oauth/login/wechat?from=%2F",
            base,
            false
        ));
        // debug 构建放行任意 http
        assert!(is_allowed_external_with("http://localhost:9080/x", None, true));
        for bad in [
            "http://example.com",
            "http://10.9.1.2:10006/",
            "http://10.9.1.2/",
            "file:///C:/Windows/System32/calc.exe",
            "\\\\evil\\share\\x.exe",
            "javascript:alert(1)",
            "smb://evil/share",
            "xhsdiscover://anything/else",
            "https://user:pw@example.com",
            "http://user:pw@10.9.1.2:10005/",
            "not a url",
        ] {
            assert!(!is_allowed_external_with(bad, base, false), "{bad}");
        }
        // 网关是 https 时不放行任何 http
        assert!(!is_allowed_external_with(
            "http://qingqiuyue.com/",
            Some("https://qingqiuyue.com"),
            false
        ));
        // debug 构建也不放行非 http(s)
        assert!(!is_allowed_external_with("file:///etc/passwd", None, true));
    }
}
