#!/bin/bash
# Tauri 多平台构建脚本
# 用于在 Mac 上构建 iOS/macOS 应用

set -e

echo "=========================================="
echo "  Tauri 多平台构建脚本"
echo "=========================================="
echo ""

# 检查平台
PLATFORM=$(uname -s)
if [ "$PLATFORM" != "Darwin" ]; then
    echo "错误: 此脚本需要在 macOS 上运行"
    exit 1
fi

# 检查 Xcode
if ! command -v xcodebuild &> /dev/null; then
    echo "错误: 请先安装 Xcode Command Line Tools"
    echo "运行: xcode-select --install"
    exit 1
fi

# 检查 Rust
if ! command -v rustc &> /dev/null; then
    echo "正在安装 Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "正在安装 pnpm..."
    npm install -g pnpm
fi

echo "环境检查完成"
echo ""

# 构建函数
build_ios() {
    echo "正在构建 iOS..."
    pnpm tauri build --target aarch64-apple-ios
    echo "iOS 构建完成!"
}

build_ios_sim() {
    echo "正在构建 iOS 模拟器版本..."
    pnpm tauri build --target aarch64-apple-ios-sim
    echo "iOS 模拟器版本构建完成!"
}

build_macos() {
    echo "正在构建 macOS..."
    pnpm tauri build --target universal-apple-darwin
    echo "macOS 构建完成!"
}

build_all() {
    echo "正在构建所有 Apple 平台..."
    build_ios
    build_ios_sim
    build_macos
    echo ""
    echo "=========================================="
    echo "  所有平台构建完成!"
    echo "=========================================="
    echo ""
    echo "构建产物位置:"
    echo "  macOS:   src-tauri/target/release/bundle/macos/"
    echo "  iOS:     src-tauri/target/release/bundle/ios/"
}

# 显示菜单
show_menu() {
    echo "请选择构建目标:"
    echo "  1) iOS (真机)"
    echo "  2) iOS (模拟器)"
    echo "  3) macOS"
    echo "  4) 全部 (iOS + macOS)"
    echo "  0) 退出"
    echo ""
    read -p "请输入选项 [1-4, 0]: " choice
}

# 主循环
while true; do
    show_menu
    case $choice in
        1) build_ios; break ;;
        2) build_ios_sim; break ;;
        3) build_macos; break ;;
        4) build_all; break ;;
        0) echo "退出"; exit 0 ;;
        *) echo "无效选项，请重试" ;;
    esac
done
