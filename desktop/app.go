package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// App 暴露给前端的系统能力 struct。
// 前端调用方式:window.qq.App.SystemInfo() → 走 Wails 自动生成的 JS 绑定。
type App struct {
	ctx        context.Context
	configPath string
	config     *AppConfig
}

// AppConfig 应用配置
type AppConfig struct {
	APIBase string `json:"apiBase"`
}

// NewApp 构造器
func NewApp() *App {
	cfg := &AppConfig{APIBase: "http://localhost:9080"}
	path := getConfigPath()
	if data, err := os.ReadFile(path); err == nil {
		json.Unmarshal(data, cfg)
	}
	return &App{ctx: context.Background(), configPath: path, config: cfg}
}

// getConfigPath 获取配置文件路径
func getConfigPath() string {
	var dir string
	switch runtime.GOOS {
	case "windows":
		dir = filepath.Join(os.Getenv("APPDATA"), "qingqiuyue-desktop")
	case "darwin":
		dir = filepath.Join(os.Getenv("HOME"), "Library", "Application Support", "qingqiuyue-desktop")
	default:
		dir = filepath.Join(os.Getenv("HOME"), ".config", "qingqiuyue-desktop")
	}
	os.MkdirAll(dir, 0755)
	return filepath.Join(dir, "config.json")
}

// SystemInfo 系统信息
type SystemInfo struct {
	OS         string `json:"os"`
	Arch       string `json:"arch"`
	GoVersion  string `json:"goVersion"`
	NumCPU     int    `json:"numCpu"`
	WailsBuild bool   `json:"wailsBuild"`
}

// SystemInfo 返回系统信息(前端用于能力检测)
func (a *App) SystemInfo() SystemInfo {
	return SystemInfo{
		OS:         runtime.GOOS,
		Arch:       runtime.GOARCH,
		GoVersion:  runtime.Version(),
		NumCPU:     runtime.NumCPU(),
		WailsBuild: true,
	}
}

// GetAPIBase 返回后端 API 网关地址。
func (a *App) GetAPIBase() string {
	return a.config.APIBase
}

// SetAPIBase 写入配置
func (a *App) SetAPIBase(url string) error {
	a.config.APIBase = url
	data, err := json.MarshalIndent(a.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.configPath, data, 0644)
}

// OpenExternal 用系统默认浏览器打开 URL(支付页面、协议链接等)
func (a *App) OpenExternal(url string) error {
	if url == "" {
		return nil
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}

// GetVersion 应用版本
func (a *App) GetVersion() string {
	return "0.1.0"
}

// IsDev 是否开发模式(影响前端 API base、日志级别等)
func (a *App) IsDev() bool {
	return isDevMode()
}

// ShowToast 显示系统通知
func (a *App) ShowToast(message string) {
	if message == "" {
		return
	}
	switch runtime.GOOS {
	case "windows":
		// Windows: 使用 PowerShell 显示 toast
		cmd := exec.Command("powershell", "-Command",
			fmt.Sprintf(`[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $text = $template.GetElementsByTagName("text"); $text[0].AppendChild($template.CreateTextElement("清秋月")) | Out-Null; $text[1].AppendChild($template.CreateTextElement("%s")) | Out-Null; [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("qingqiuyue").Show([Windows.UI.Notifications.ToastNotification]::new($template))`, message))
		cmd.Run()
	case "darwin":
		// macOS: 使用 osascript 显示通知
		cmd := exec.Command("osascript", "-e",
			fmt.Sprintf(`display notification "%s" with title "清秋月"`, message))
		cmd.Run()
	default:
		// Linux: 使用 notify-send
		cmd := exec.Command("notify-send", "清秋月", message)
		cmd.Run()
	}
}