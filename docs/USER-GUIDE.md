# USER-GUIDE · 产品形态速查(给开发者看)

> 这是给前端 / 后端开发者看的「清秋月长什么样」速查 —— 站内用户向的「怎么用」
> 看 Web 的 `/welcome` 页(代码 `src/app/(public)/welcome/page.tsx`)。
> 本文件只解释产品形态、数据模型、与代码入口;要写代码请配合
> [`README.md`](../README.md) 一起看。

## 一、用户冷启动路径

```
   打开网站
      │
      ▼
   /home/recommend?tab=home (首页 / 精选)
      │
      ├─ 首次:800ms 后弹出 FirstRunGuide (src/components/onboarding/FirstRunGuide.tsx)
      │     │ Step 1 自我介绍 (品牌字标 + 三句话)
      │     │ Step 2 多选 1~5 个内容类型 (走 contentCatalog)
      │     │ Step 3 预览将要生成的页签栏,「进入清秋月」/「先逛逛」
      │     │ 完成后落进 sectionPrefs,首页页签栏立刻换
      │     │ 跳过的,7 天内不再弹 (lib/onboardingPrefs)
      │
      └─ 老用户:顶部页签栏已有自己的 9 个频道
                    │
                    ├─ 点页签切频道 (?section=<id>)
                    ├─ 点右上角 Tune 图标 → SectionManagerDialog
                    │   - 拖动排序 / × 移除
                    │   - 7 个候选组:内容分类 / 题材 / 热门标签 / 来源 / 意境 / 歌单 / 我关注的
                    │   - 搜不到直接建一个关键词频道
                    └─ 底部 / 侧栏导航:精选 / 推荐 / 排行榜 / AI / 我的 / 直播 / 动态 / 意境 / ...
```

冷启动逻辑代码:

- 弹窗入口:`src/app/(public)/home/layout.tsx` 末尾 `<FirstRunGuide />`(组件内部自决定 `open`)
- 弹窗内部:`src/components/onboarding/FirstRunGuide.tsx`
- 触发条件:`src/lib/onboardingPrefs.shouldShowOnboarding()`
- 落盘:`src/lib/sectionPrefs.useHomeSections()[1].replaceAll(...)`
- 欢迎页:`/welcome`(`src/app/(public)/welcome/page.tsx`),进入后调 `markWelcomeSeen()`,
  让 FirstRunGuide 的 Step 1 自动折叠重复段落。

## 二、首页频道模型

页签栏的每一格都是一条 `HomeSection`,见 `src/lib/homeSections.ts`:

| `kind` | 含义 | 后端怎么取 | 例子 |
|--------|------|-----------|------|
| `recommend` | 多类型交错的聚合流(固定第一项,不可删) | `feed?types=&size=&genre=&page=` | `recommend` |
| `type` | 一个内容大类,可再带一个题材(`contentType + genre`) | `module/content/list?contentType=&tag=<中文题材名>` | `t:NOVEL`、`t:NOVEL:xianxia` |
| `tag` | `module_content.tags` 里的一个标签 | `module/content/list?tag=` | `tag:游戏`、`tag:NOVEL:仙侠` |
| `topic` | 一个意境专题(社区话题) | `topics/{id}` 详情 + `module/content/list?topic=` | `topic:1234` |
| `playlist` | 一张歌单(平台编排 / 别人公开 / 自建) | `playlist/{id}` 详情 + `module/content/list?list=` | `pl:567` |
| `keyword` | 用户自己输的词,标题或标签命中即可 | `module/content/list?keyword=` | `kw:红楼梦` |

URL 驱动:`/home/recommend?section=<id>`,旧链接(无 `t:` 前缀)继续可用。

## 三、内容类型

`src/lib/contentCatalog.ts` 是全站事实源,15 个内容类型,每条记录:

```ts
{
  code: 'NOVEL',                      // 与后端 module_content.contentType 对齐
  label: '小说',                       // 中文名(运营可改字典表 label)
  shortDesc: '...',                   // 一句话说明
  sectionId: 'novel',                 // 对应 BUILTIN_TYPE_SECTIONS.id
  playability: 'playable',            // 类型默认可播放性
  recommendOnboarding?: true,         // 引导弹窗是否重点推荐
}
```

可播放性七种状态(详见 `contentCatalog.ts` 注释):

| 状态 | 含义 | 典型类型 |
|------|------|----------|
| `playable` | 本站可直接读 / 看 / 听 | NOVEL / MUSIC / POETRY / ARTICLE / NEWS / WALLPAPER / PICTURE / SHORT_DRAMA |
| `pending_repair` | 内容存在但播放链路待修 | 临时状态,具体记录上 |
| `not_applicable` | 实体本身不能播放 | PERSON |
| `live_offline` | 直播源当前离线 | LIVE 单条 |
| `bandwidth_limited` | 内容存在但带宽受限 | FILM / TELEPLAY |
| `embeddable` | 跳第三方平台 | COMICS / VSHOW / VIDEO / ANIMATION |
| `unknown` | 状态依赖源 / 实时判定 | LIVE(类型默认) |

`describePlayability(code)` 工具函数返回 `{ label, tone }`,UI 直接用。

## 四、四种典型"用户只想做一件事"的最佳路径

### 1. 只想看小说

- 入口:`/home/recommend?section=novel` 或「直达频道」(欢迎页 #types 卡片)
- 选题材:`/home/recommend?section=t:NOVEL:xianxia`(频道管理里选"题材"组 → NOVEL → 仙侠)
- 可播放性:`playable`(可站内读;少量外挂源需跳站)
- 详情路由:`/detail/novel-detail`

### 2. 只想听音乐

- 入口:`/home/recommend?section=music`
- 自建歌单:音乐详情页 → 加入歌单 / 新建歌单
- 关注别人歌单 → 歌单本身能加成首页频道(频道管理「歌单」组)
- 可播放性:`playable`
- 详情路由:`/detail/music-detail`

### 3. 只想看剧(电影 / 电视剧 / 短剧)

- 电影:`/home/recommend?section=film`(`bandwidth_limited`,大多跳站)
- 电视剧:`/home/recommend?section=teleplay`
- 短剧:`/home/recommend?section=drama`(`playable`,竖屏 1~3 分钟)
- 详情路由:`/detail/film-detail` / `/detail/teleplay-detail`(短剧复用)

### 4. 只想刷短视频 / 看综艺 / 看动漫

- 短视频:`/home/recommend?section=video`(`embeddable`,跳抖音 / 快手 / B站)
- 综艺:`/home/recommend?section=entertainment`
- 动漫:`/home/recommend?section=anime`
- 详情路由:`/detail/video-detail` / `/detail/vshow-detail` / `/detail/animation-detail`

## 五、与后端的数据契约

```
qingqiuyue-go/contracts/      ← 一手契约(YAML)
        │
        │ tools/gen-contract   ← 由 qingqiuyue-go 仓库里的 make 任务生成
        ▼
qingqiuyue-next/src/lib/contentType.gen.ts    ← 前端常量(勿手改)
```

新增 / 修改内容类型:

1. 改 `qingqiuyue-go/contracts/content_type.yaml`
2. `cd qingqiuyue-go && make gen-contract`
3. 前端 `pnpm i` 后 `contentType.gen.ts` 会跟着升级
4. **同时**改 `src/lib/contentCatalog.ts` 的 `shortDesc` / `playability` /
   `recommendOnboarding`(这一步是手动的,因为字典表不带这两个字段)

## 六、客户端持久化约定

| 数据 | 存储位置 | Hook |
|------|---------|------|
| 首页频道排布 | localStorage `qq-home-sections` (+ PG `user_home_section` 登录后同步) | `useHomeSections()` |
| AI 入口开关 | localStorage `qq-ai-prefs` | `useAIPrefs()` |
| 首屏引导偏好 | localStorage `qq-onboarding` | `useOnboarding()` |
| 歌单排布 | localStorage `qq-list-layout` | 见 `src/lib/listLayoutPrefs.ts` |
| 设置抽屉 | localStorage `qq-home-settings` | 见 `src/lib/useHomeSettings.ts` |

所有持久化都用 `useSyncExternalStore` 包 `localStorage` 的 module-level store,
**不要**在 `useState` 里读 localStorage —— 会导致多处打开时状态不同步
(见 `src/lib/aiPrefs.ts` 注释里 `useHomeSettings` 的反例)。

## 七、测试 / 调试快捷方式

- **清空本机偏好**:浏览器 DevTools → Application → Local Storage → 删 `qq-` 开头的 key。
- **强制重弹引导**:删 `qq-onboarding` 后刷新 `/home/recommend`。
- **重置频道**:点首页右上角 Tune 图标 → 频道管理 → 「恢复默认」。
- **强制 SSR 快照路径**:在 Network 面板勾选 "Disable cache" + "Slow 3G",
  第一次加载会看到首屏默认推荐流,800ms 后弹引导。
- **TypeScript 严格**:`pnpm lint` 跑 ESLint;`pnpm build` 含类型检查。
- **本仓库的 Next.js 与通常不一样** —— 改 API / 路由 / 目录前先翻
  `node_modules/next/dist/docs/`(`AGENTS.md` 警告)。
