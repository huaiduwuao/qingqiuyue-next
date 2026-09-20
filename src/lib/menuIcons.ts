/**
 * 管理后台菜单图标注册表
 *
 * 字符串 → MUI 组件的映射。数据库 menu.icon 字段存的是去掉 "Icon" 后缀的
 * PascalCase 名(如 'AdminPanelSettingsRounded')。前端拿到后从这里取组件渲染。
 *
 * 这里只列 menu-config.tsx 实际用到的 38 个图标;新增菜单图标时
 * 同步登记到这里,菜单管理页的 Autocomplete 才能列出来。
 *
 * fallback 图标:CircleOutlined —— 比 HelpOutline 更中性,告诉管理员"图标字段
 * 填了但我们没认出来",比直接报错好。
 */

import * as Icons from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

export const MENU_ICON_MAP: Record<string, SvgIconComponent> = {
  AdminPanelSettings: Icons.AdminPanelSettingsRounded,
  AccountTree: Icons.AccountTreeRounded,
  Lock: Icons.LockRounded,
  VpnKey: Icons.VpnKeyRounded,
  People: Icons.PeopleRounded,
  SmartToy: Icons.SmartToyRounded,
  MilitaryTech: Icons.MilitaryTechRounded,
  Stars: Icons.StarsRounded,
  ReportProblem: Icons.ReportProblemRounded,
  HeadsetMic: Icons.HeadsetMicRounded,
  Block: Icons.BlockRounded,
  Collections: Icons.CollectionsRounded,
  DynamicFeed: Icons.DynamicFeedRounded,
  Apps: Icons.AppsRounded,
  SettingsApplications: Icons.SettingsApplicationsRounded,
  Publish: Icons.PublishRounded,
  Hub: Icons.HubRounded,
  MenuBook: Icons.MenuBookRounded,
  Tune: Icons.TuneRounded,
  LocationOn: Icons.LocationOnRounded,
  ChatBubbleOutline: Icons.ChatBubbleOutlineRounded,
  Dns: Icons.DnsRounded,
  Storage: Icons.StorageRounded,
  Event: Icons.EventRounded,
  Payment: Icons.PaymentRounded,
  AccountBalanceWallet: Icons.AccountBalanceWalletRounded,
  Storefront: Icons.StorefrontRounded,
  ShowChart: Icons.ShowChartRounded,
  History: Icons.HistoryRounded,
  BarChart: Icons.BarChartRounded,
  RecordVoiceOver: Icons.RecordVoiceOverRounded,
  PsychologyAlt: Icons.PsychologyAltRounded,
  Language: Icons.LanguageRounded,
  CardMembership: Icons.CardMembershipRounded,
  Terminal: Icons.TerminalRounded,
  CloudSync: Icons.CloudSyncRounded,
  TravelExplore: Icons.TravelExploreRounded,
  CloudDownload: Icons.CloudDownloadRounded,
};

/**
 * 把菜单 icon 字符串翻译成 MUI 组件;找不到时返回 CircleOutlined fallback。
 *
 * 注意返回的是组件本身(不是 JSX);调用方负责包 sx 等 props:
 *   const Icon = resolveMenuIcon(m.icon);
 *   return <Icon sx={{ fontSize: 18 }} />;
 */
export function resolveMenuIcon(name?: string | null): SvgIconComponent {
  if (!name) return Icons.CircleOutlined;
  return MENU_ICON_MAP[name] ?? Icons.CircleOutlined;
}

/** 菜单管理页 Autocomplete 候选列表;按字母序方便查找。 */
export const MENU_ICON_NAMES = Object.keys(MENU_ICON_MAP).sort();
