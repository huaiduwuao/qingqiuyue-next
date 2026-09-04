// +build ignore

// 测试抖音视频播放功能
package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/playwright-community/playwright-go"
)

func main() {
	fmt.Println("==========================================")
	fmt.Println("抖音视频播放测试")
	fmt.Println("==========================================")

	// 启动浏览器
	pw, err := playwright.Run()
	if err != nil {
		log.Fatalf("启动 Playwright 失败: %v", err)
	}
	defer pw.Stop()

	// 启动 Chromium (headless 模式)
	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: func(b bool) *bool { return &b }(false), // 显示浏览器窗口
	})
	if err != nil {
		log.Fatalf("启动浏览器失败: %v", err)
	}
	defer browser.Close()

	// 创建上下文
	ctx, err := browser.NewContext(playwright.BrowserNewContextOptions{
		Viewport: &playwright.ViewportSize{Width: 1280, Height: 720},
	})
	if err != nil {
		log.Fatalf("创建浏览器上下文失败: %v", err)
	}
	defer ctx.Close()

	// 创建页面
	page, err := ctx.NewPage()
	if err != nil {
		log.Fatalf("创建页面失败: %v", err)
	}

	// 1. 打开首页
	fmt.Println("\n>>> 1. 打开首页...")
	if err := page.Goto("http://localhost:3000", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.IntPtr(30000),
	}); err != nil {
		log.Fatalf("打开首页失败: %v", err)
	}
	fmt.Println("首页加载成功!")

	// 等待页面稳定
	time.Sleep(2 * time.Second)

	// 2. 截图保存首页
	screenshot(page, "home.png")
	fmt.Println("首页截图已保存: home.png")

	// 3. 查找抖音热搜入口
	fmt.Println("\n>>> 2. 查找抖音热搜入口...")
	// 尝试点击抖音相关标签或按钮
	hotSelectors := []string{
		"[data-source='douyin_hot']",
		"button:has-text('抖音')",
		"a:has-text('抖音')",
		"[data-category='douyin']",
		"text=抖音",
	}

	var found bool
	for _, sel := range hotSelectors {
		if page.Locator(sel).First().IsVisible(playwright.LocatorIsVisibleOptions{Timeout: playwright.IntPtr(2000)}) == nil {
			fmt.Printf("  找到: %s\n", sel)
			found = true
			break
		}
	}

	// 4. 尝试直接导航到抖音详情页测试
	fmt.Println("\n>>> 3. 测试抖音视频播放...")
	testVideoURL := "https://www.douyin.com/video/7321456891735847168"

	// 先通过 content-api 解析播放地址
	fmt.Printf("解析视频: %s\n", testVideoURL)
	// 这里我们直接在前端页面测试

	if err := page.Goto(testVideoURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.IntPtr(30000),
	}); err != nil {
		fmt.Printf("直接打开抖音页面: %v (预期行为,可能有反爬)\n", err)
	}

	// 5. 在首页找一个视频卡片点击
	fmt.Println("\n>>> 4. 查找并点击视频卡片...")
	videoSelectors := []string{
		"[data-type='video']",
		".video-card",
		"[class*='video']",
		"[data-item-type]",
		"article",
	}

	for _, sel := range videoSelectors {
		count, _ := page.Locator(sel).Count()
		if count > 0 {
			fmt.Printf("  找到 %d 个元素: %s\n", count, sel)
			break
		}
	}

	// 6. 查找播放器
	fmt.Println("\n>>> 5. 检查播放器...")
	playerSelectors := []string{
		"video",
		"[class*='player']",
		"[class*='Player']",
		"[data-testid='player']",
	}

	for _, sel := range playerSelectors {
		if page.Locator(sel).First().IsVisible(playwright.LocatorIsVisibleOptions{Timeout: playwright.IntPtr(1000)}) == nil {
			fmt.Printf("  找到播放器: %s\n", sel)
			break
		}
	}

	// 7. 检查控制台错误
	fmt.Println("\n>>> 6. 检查控制台错误...")
	page.OnConsole(func(msg playwright.ConsoleMessage) {
		if msg.Type() == playwright.ConsoleMessageTypeError {
			fmt.Printf("  [ERROR] %s\n", msg.Text())
		}
	})

	// 等待几秒观察错误
	time.Sleep(3 * time.Second)

	// 8. 截图保存当前状态
	screenshot(page, "douyin_test.png")
	fmt.Println("测试截图已保存: douyin_test.png")

	fmt.Println("\n==========================================")
	fmt.Println("测试完成!")
	fmt.Println("==========================================")
}

func screenshot(page playwright.Page, filename string) {
	if err := page.Screenshot(playwright.PageScreenshotOptions{
		Path:     playwright.String(filename),
		FullPage: playwright.Bool(true),
	}); err != nil {
		fmt.Printf("截图失败: %v\n", err)
	}
}
