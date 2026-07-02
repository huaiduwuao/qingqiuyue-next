// qingqiuyue-desktop —— 清秋月桌面客户端(Wails v3)
//
// 复用 qingqiuyue-next 前端,作为壳 + 系统 API 暴露层。
// 不实现任何业务 UI,所有页面复用 Next.js 现有组件。
//
// 构建:
//   1) 前端构建:cd ../ && pnpm build && pnpm export   # 产出 ../out
//   2) 桌面构建:wails build                            # 把 ../out embed 进二进制
//
// 开发热重载:wails dev  → 自动启 Next.js dev server (localhost:3000) + 启动 Wails 窗口
package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend_dist
var frontendAssets embed.FS

// wailsAssets 指向 qingqiuyue-next/out(若存在)或开发期 mock。
//
// 开发模式优先:WAILS_DEV=1 或检测到 ../out 不存在时,使用 mock placeholder 并由
// wails dev 接管 URL 加载(wails dev 启动时会自动打开 localhost:3000)。
//
// 生产模式:WAILS_DEV=0 且 ../out 存在时,embed 整个 out 目录。
var wailsAssets = buildAssets()

func main() {
	app := application.New(application.Options{
		Name:        "清秋月",
		Description: "qingqiuyue desktop client",
		Icon:        nil, // 生产打包时填 256x256 png
		Assets:      wailsAssets,
		OnStartup: func(ctx context.Context) {
			log.Println("[qingqiuyue-desktop] started, version dev")
		},
		OnDomReady: func(ctx context.Context) {
			log.Println("[qingqiuyue-desktop] DOM ready")
		},
		OnShutdown: func(ctx context.Context) {
			log.Println("[qingqiuyue-desktop] shutting down")
		},
		// 窗口默认配置
		Windows: &application.WindowsOptions{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
		Mac: &application.MacOptions{
			TitleBar: &application.MacTitleBar{
				TitlebarAppearsTransparent: true,
				HideTitle:                  false,
				HideTitleBar:               false,
				FullSizeContent:            false,
				UseToolbar:                 false,
				HideToolbarSeparator:       true,
			},
			Appearance:           application.NSAppearanceNameDarkAqua,
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})

	// 注册 App struct(暴露给前端 window.go.main.App.*)
	app.RegisterBinder(application.BindOpts{
		Namespace: "qq",
		Bind: []any{
			NewApp(),
		},
	})

	// 监听窗口事件
	app.On(events.Common.WindowClosing, func(ctx context.Context) {
		log.Println("[qingqiuyue-desktop] window closing")
	})

	if err := app.Run(); err != nil {
		log.Fatalf("[qingqiuyue-desktop] run error: %v", err)
	}
}