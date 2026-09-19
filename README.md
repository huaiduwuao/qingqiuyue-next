# qingqiuyue-next

清秋月 · 前端 + Tauri 桌面壳。

> ⚠️ **这个 Next.js 与通常的版本不一样** —— 见仓库根目录或本仓库 `AGENTS.md`:
> "This is NOT the Next.js you know"。改前请先翻 `node_modules/next/dist/docs/`
> 与项目 `CLAUDE.md` / `AGENTS.md`,API、约定、目录结构都可能与训练数据不同。

## 这是什么

清秋月是一个**意境聚合**平台:追踪全网热点榜单,把小说 / 漫画 / 影视 / 综艺 /
音乐 / 资讯 / 动漫 / 短视频 等内容聚合到自己那一屏,让用户不被算法牵着走。
本仓库是它的 C 端 Web 入口 + Tauri 桌面壳,与后端微服务
(`qingqiuyue-go/`)共用同一份 API。

- Web 入口:`/home/recommend`、`/home/recommend?tab=...`(精选 / 推荐 / 排行榜 / 动态 / 意境 ...)
- 内容详情:`/detail/<type>-detail`
- 用户/创作:`/account/...`(个人主页 / 内容管理 / 悬赏中心)
- 独立页:`/legal`、`/welcome`、`/search`、`/poetry`、`/download`

## 目录结构

```
qingqiuyue-next/
├─ src/
│  ├─ app/                 # Next.js App Router
│  │  ├─ (public)/         # C 端公开页(layout 组:home / search / welcome / legal ...)
│  │  └─ ...               # 其余业务路由
│  ├─ components/          # 组件库
│  │  ├─ brand/            # 朱印 / 字标 (BrandSeal / BrandWordmark)
│  │  ├─ home/             # 首页相关 (SectionManagerDialog, HomeSettingsDrawer, TrendingBoard, ...)
│  │  ├─ layout/           # 顶栏 / 底部导航 / 法律页脚 (PublicTopBar / MobileBottomNav / SiteLegalFooter)
│  │  └─ onboarding/       # 首屏引导 (FirstRunGuide)
│  ├─ lib/                 # 工具与本地偏好存储
│  │  ├─ aiPrefs.ts        # AI 入口 / 数字人介绍 开关(module-level useSyncExternalStore)
│  │  ├─ sectionPrefs.ts   # 首页频道排布(本机 + 登录后云端同步)
│  │  ├─ onboardingPrefs.ts# 首屏引导偏好(完成 / 跳过 / 兴趣)
│  │  ├─ contentCatalog.ts # 15 个内容类型 + 一句话说明 + 可播放性(全站事实源)
│  │  ├─ homeSections.ts   # 频道模型(5 种 kind,含 id 规则与查询参数)
│  │  ├─ contentType.gen.ts# 与后端同源的 ContentType 常量(由 tools/gen-contract 生成,勿手改)
│  │  └─ api/              # axios / fetch 客户端
│  ├─ apis/                # 后端 SDK(按域拆分:home-discover / community / my-list / leaderboard / ...)
│  ├─ contexts/            # AuthContext / AppContext
│  ├─ hooks/               # useResponsive / useTopbarHeight / ...
│  ├─ constants/           # site(ICP / 法律页锚点) / accents / gradients
│  └─ theme/               # MUI 主题与行草字标配置
├─ docs/                   # 设计/数据契约(见下)
├─ AGENTS.md / CLAUDE.md   # 「非标 Next.js」警告(改前必看)
├─ package.json            # pnpm
└─ next.config.ts          # /api/* rewrites 反代到 API_PROXY_TARGET
```

`docs/` 现有:

- `UNIFIED-ARCHITECTURE.md` —— 前后端整体架构
- `DIGITAL-HUMAN.md` / `avatar-pipeline.md` / `anime-characters.md` / `ANIME-REGEN.md` —— 数字人 / Avatar / 二次元再生
- `USER-GUIDE.md` —— 产品形态(给开发者看)

## 开发命令

```bash
pnpm install              # 装依赖
pnpm dev                  # Web 开发服(localhost:3000)
pnpm build                # 生产构建
pnpm start                # 跑生产构建
pnpm lint                 # ESLint(严格)
pnpm tauri dev            # Tauri 桌面壳开发模式(需 Rust 工具链)
pnpm tauri build          # 打桌面安装包(Win / macOS / Linux)
```

## 数据来源:只连真实后端(2026-09-08)

前端不再带任何假数据 —— 原 MSW(`src/mocks/*`,5200 行 / 360 个假端点)与 `NEXT_PUBLIC_USE_MOCK`
开关已删除,以免「功能做完」和「功能没做、mock 顶着」在界面上分不清。

连后端的两种姿势:

| 场景 | `NEXT_PUBLIC_API_BASE_URL` | 走向 |
|---|---|---|
| 本地联调 | 留空(同源) | `next.config.ts` 的 `rewrites` 把 `/api/*` 反代到 `API_PROXY_TARGET`(默认 qingqiuyue-go 起的 5 个服务) |
| 指向具体网关 | `http://gateway.xxx` | axios 直连,不走 rewrites |

后端未实现接口统一返回 **501**(body 带 `msg` 说明缺什么),前端据此渲染
「此功能尚未开放」。缺口清单见 `../qingqiuyue-go/docs/IMPLEMENTATION-GAPS.md`。

## 关键约定(改前必看)

- **本仓库的 Next.js 与通常不一样**:`AGENTS.md` / `CLAUDE.md` 写得很直白,
  改前必须先翻 `node_modules/next/dist/docs/` 里的对应章节。
- **客户端持久化**:凡是要在多处同时生效的本机偏好,统一用
  `useSyncExternalStore` 包 `localStorage` 的 module-level store,参考
  `src/lib/aiPrefs.ts` / `src/lib/sectionPrefs.ts` / `src/lib/onboardingPrefs.ts`。
  **不要**各自 `useState` 读 localStorage,会出现抽屉改完、其他位置不知道的脏状态。
- **Dialog 全屏**:移动端 `fullScreen={isMobile}`(`useResponsive()`),桌面端用
  `maxWidth`。`SectionManagerDialog` / `FirstRunGuide` 是范本。
- **类型常量**:`src/lib/contentType.gen.ts` 由 `tools/gen-contract` 从
  `qingqiuyue-go` 的 `contracts/content_type.yaml` 生成 —— 改类型请改 YAML,
  不要手改这个 `.gen.ts`。
- **内容类型事实源**:所有 15 个类型的中文名 / 一句话说明 / 可播放性默认值都从
  `src/lib/contentCatalog.ts` 取。`/welcome` / `FirstRunGuide` / `SectionManagerDialog`
  都走这里 —— 不要在别处再写一遍文案。
- **品牌字标 / 朱印**:`src/components/brand/BrandLogo.tsx` 导出 `BrandSeal`(朱砂印章
  SVG)和 `BrandWordmark`(行草字标);颜色主题用 `var(--brand-color, #FE2C55)`。
- **顶栏高度**:由 `hooks/useTopbarHeight` 写进 `--topbar-h`,任何 sticky 子栏的
  `scrollMarginTop` 用 `calc(var(--topbar-h, 60px) + 16px)` 让出空间。
- **底部导航**:`< md` 显示,`>= md` 显示侧栏;统一通过 `useResponsive().isMobile`,
  **不要**自己定义阈值(见 `hooks/useResponsive.ts` 注释,旧 768/1024 阈值曾引出过
  平板导航消失的 bug)。

## 与后端的边界

- 前端只**消费**后端 API,所有数据契约写进 `qingqiuyue-go/contracts/`;
  改前端 API 形状前先看 `docs/UNIFIED-ARCHITECTURE.md`。
- 登录同步层(`useHomeSectionSync`)负责把本机的频道排布推到 PG `user_home_section`,
  本机永远是第一手来源 —— 没登录 / 离线 / 请求失败时页签照常能用。
- 客户端打包(Tauri 桌面壳)与 Web 同一份代码,但 `--mobile` 类组件依赖浏览器 API
  的部分需要打桩(见 `tauri/` 目录)。
