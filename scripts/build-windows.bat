@echo off
chcp 65001 >nul
REM Tauri 多平台构建脚本 - Windows 版

echo ==========================================
echo   Tauri 多平台构建脚本 (Windows)
echo ==========================================
echo.

REM 设置环境变量
set "JAVA_HOME=C:\Java\jdk-21"
set "ANDROID_HOME=C:\Android\sdk"
set "PATH=%JAVA_HOME%\bin;%HOME%\.cargo\bin;%PATH%"

echo 环境变量已设置
echo.

REM 构建函数
:build_windows
echo 正在构建 Windows...
call pnpm tauri build --target x86_64-pc-windows-msvc
echo Windows 构建完成!
goto :end

:build_android
echo 正在构建 Android...
call pnpm tauri android build
echo Android 构建完成!
goto :end

:build_all
echo 正在构建 Windows + Android...
call pnpm tauri build --target x86_64-pc-windows-msvc
echo.
call pnpm tauri android build
echo.
echo ==========================================
echo   所有平台构建完成!
echo ==========================================
goto :end

:show_menu
echo 请选择构建目标:
echo   1) Windows
echo   2) Android
echo   3) 全部 (Windows + Android)
echo   0) 退出
echo.
set /p choice="请输入选项 [1-3, 0]: "

if "%choice%"=="1" goto build_windows
if "%choice%"=="2" goto build_android
if "%choice%"=="3" goto build_all
if "%choice%"=="0" exit /b
echo 无效选项，请重试
goto :show_menu

:end
echo.
echo 构建产物位置:
echo   Windows:  src-tauri\target\release\qingqiuyue-desktop.exe
echo   Android:  src-tauri\gen\android\app\build\outputs\apk\universal\release\
echo.
pause
