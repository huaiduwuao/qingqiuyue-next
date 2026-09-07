/**
 * Dynamic UI —— 遗留的弹窗式动态 UI
 *
 * ⚠️ 现状:数字人下发的列表/网格/表单已改走 `../scene-ui`(AG-UI 的
 * ui_show_list / ui_show_grid / ui_show_form 工具 → 3D 场景内面板)。
 * 这里只剩 `<ui:{json}/>` 文本指令那条老路的渲染器,实际只有 iframe
 * (开网页/放视频)还在用,其余分支保留作兼容兜底。
 *
 * 新功能请加到 ../scene-ui,不要往这里扩。
 *
 * 已删除:useIntentHub / useIntentHubIntegration / useDigitalHumanIntentFlow
 * 那套 Intent Hub 层。它们请求的是 `/api/hermes/intents/analyze`,而后端
 * 从来没有这个服务(Go 仓里的 "hermes" 是个无关的容器运行时),
 * 且全站没有任何地方 import 过。同时删掉的还有它们配套的
 * ListRenderer / GridRenderer / FormRenderer —— 三个渲染器只在本文件里
 * 被 re-export 过,从没被挂载。
 */

export * from './types'
export { DynamicUIModal } from './DynamicUIModal'
