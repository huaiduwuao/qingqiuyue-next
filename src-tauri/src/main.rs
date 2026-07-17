// src/main.rs - Tauri 入口点
// Prevents additional console window on Windows in release
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

fn main() {
    qingqiuyue_desktop_lib::run()
}
