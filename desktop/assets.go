package main

import (
	"embed"
	"io/fs"
	"os"
)

// 桌面端 embed 策略:
//
// 生产模式:前端构建产物(qingqiuyue-next/out/)被复制或软链到 desktop/frontend_dist/
//
// 开发模式:wails dev 自动从 frontend:dev:serverUrl 拉取,不需要 embed。
//
// 这个文件做以下事:
//   1. 若存在 ../out(Next.js 静态导出),尝试用 go:embed 加载它
//   2. 否则返回一个空 FS(Wails dev 模式接管 URL 加载)
//
// 注意:go:embed 不能直接引用父目录 ../,所以我们约定在 build 前把 ../out 复制到
// desktop/frontend_dist/。build.sh 脚本负责这一步。

//go:embed frontend_dist/*
var embeddedFS embed.FS

// buildAssets 选择运行时使用的资源 FS。
func buildAssets() fs.FS {
	// 检查 embeddedFS 是否真的有内容
	if _, err := fs.ReadFile(embeddedFS, "frontend_dist/index.html"); err == nil {
		sub, _ := fs.Sub(embeddedFS, "frontend_dist")
		return sub
	}
	// 兜底:开发模式空 FS(Wails dev 会接管 URL 加载)
	return emptyFS{}
}

// isDevMode 检测是否为开发模式(通过环境变量 WAILS_DEV / DEBUG / 资源缺失)
func isDevMode() bool {
	if _, err := fs.ReadFile(embeddedFS, "frontend_dist/index.html"); err != nil {
		return true
	}
	if _, set := os.LookupEnv("WAILS_DEV"); set {
		return true
	}
	return false
}

// emptyFS 兜底空 FS
type emptyFS struct{}

func (emptyFS) Open(name string) (fs.File, error) { return nil, os.ErrNotExist }