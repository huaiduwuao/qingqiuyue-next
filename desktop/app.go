package main

import (
	"context"
	"os/exec"
	"runtime"
)

// App 暴露给前端的系统能力 struct。
// 前端调用方式:window.qq.App.SystemInfo() → 走 Wails 自动生成的 JS 绑定。
type App struct {
	ctx context.Context
}

// NewApp 构造器
func NewApp() *App {
	return &App{}
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
//
// 开发期:指向部署机的 APISIX 网关(或 localhost:9080)
// 生产期:用户首次启动时通过 UI 配置(保存到本地 JSON)
func (a *App) GetAPIBase() string {
	// TODO: 实际从本地配置文件 ~/Library/Application Support/qingqiuyue-desktop/config.json 读取
	// 当前 hardcode 返回,作为默认
	return "http://localhost:9080"
}

// SetAPIBase 写入配置(占位,实现待补)
func (a *App) SetAPIBase(url string) error {
	// TODO: 持久化到本地
	return nil
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

// ShowToast 显示系统通知(简化实现:写日志 + 前端 Snackbar)
//
// 完整实现应调:
func (a *App) ShowToast(message string) {
	// TODO: 接 OS native toast
	// macOS: osascript -e 'display notification "..." with title "清秋月"'
	// Windows: BurntToast 或 msg.exe
	// Linux: notify-send
}