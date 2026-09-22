/**
 * 管理后台系统菜单配置
 *
 * 拆出到独立文件的原因:
 *   Next.js 16 layout 模块只允许导出 default + 标准 segment config 字段
 *   (config / generateStaticParams / dynamic / runtime 等)
 *   多导出一个常量都会被 checkFields<Diff<...>> 拦截, type check 失败。
 *   所以 MENU_GROUPS 和 MenuItemDef 都放到这个独立文件供 layout 和 page 共同 import。
 */

import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import CardMembershipRoundedIcon from '@mui/icons-material/CardMembershipRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import StarsRoundedIcon2 from '@mui/icons-material/StarsRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import SettingsApplicationsRoundedIcon from '@mui/icons-material/SettingsApplicationsRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PaymentRoundedIcon from '@mui/icons-material/PaymentRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import SyncProblemRoundedIcon from '@mui/icons-material/SyncProblemRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import PsychologyAltRoundedIcon from '@mui/icons-material/PsychologyAltRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import DynamicFeedRoundedIcon from '@mui/icons-material/DynamicFeedRounded';
import { PERMISSIONS } from '@/lib/permissions';

export interface MenuItemDef {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  accent: string;
  /** 查看该菜单所需的权限码,缺省则不限制 */
  permission?: string;
}

export const MENU_GROUPS: { title: string; items: MenuItemDef[] }[] = [
  {
    title: '认证授权',
    items: [
      { id: 'role', label: '角色管理', path: '/system/role', icon: <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main', permission: PERMISSIONS.SYSTEM_ROLE.VIEW },
      { id: 'menu', label: '菜单管理', path: '/system/menu', icon: <AccountTreeRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main', permission: PERMISSIONS.SYSTEM_MENU.VIEW },
      { id: 'permission', label: '权限管理', path: '/system/permission', icon: <LockRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6', permission: PERMISSIONS.SYSTEM_PERMISSION.VIEW },
      { id: 'data-permission', label: '数据权限', path: '/system/data-permission', icon: <VpnKeyRoundedIcon sx={{ fontSize: 18 }} />, accent: 'warning.main', permission: PERMISSIONS.SYSTEM_DATA_PERMISSION.VIEW },
    ],
  },
  {
    title: '用户管理',
    items: [
      { id: 'user', label: '用户列表', path: '/system/user', icon: <PeopleRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF', permission: PERMISSIONS.SYSTEM_USER.VIEW },
      { id: 'bot', label: '假人管理', path: '/system/bot', icon: <SmartToyRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6', permission: PERMISSIONS.SYSTEM_BOT.VIEW },
      { id: 'user-level', label: '用户等级', path: '/system/user-level', icon: <MilitaryTechRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D', permission: PERMISSIONS.SYSTEM_USER_LEVEL.VIEW },
      { id: 'user-point', label: '用户积分', path: '/system/user-point', icon: <StarsRoundedIcon2 sx={{ fontSize: 18 }} />, accent: 'success.main', permission: PERMISSIONS.SYSTEM_USER_POINT.VIEW },
    ],
  },
  {
    title: '内容治理',
    items: [
      {
        id: 'moderation-reports',
        label: '举报审核',
        path: '/system/moderation/reports',
        icon: <ReportProblemRoundedIcon sx={{ fontSize: 18 }} />,
        accent: '#FE2C55',
        permission: PERMISSIONS.SYSTEM_MODERATION.REPORT_LIST,
      },
      {
        id: 'kf',
        label: '客服工作台',
        path: '/system/kf',
        icon: <HeadsetMicRoundedIcon sx={{ fontSize: 18 }} />,
        accent: '#5B8DEF',
        // 没有独立权限码:后端按内容运营角色放行(kfapp.staffOnly),这里不再加一层
      },
      {
        id: 'moderation-words',
        label: '敏感词管理',
        path: '/system/moderation/sensitive-words',
        icon: <BlockRoundedIcon sx={{ fontSize: 18 }} />,
        accent: '#8B5CF6',
        permission: PERMISSIONS.SYSTEM_MODERATION.SENSITIVE_WORD_LIST,
      },
    ],
  },
  {
    title: '内容管理',
    items: [
      { id: 'topic', label: '专题管理', path: '/system/topic', icon: <CollectionsRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D' },
      { id: 'feed', label: '动态管理', path: '/system/feed', icon: <DynamicFeedRoundedIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE' },
    ],
  },
  {
    title: '资源管理',
    items: [
      { id: 'app', label: '应用管理', path: '/system/app', icon: <AppsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main', permission: PERMISSIONS.SYSTEM_APP.VIEW },
      { id: 'app-config', label: '应用配置', path: '/system/app-config', icon: <SettingsApplicationsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main', permission: PERMISSIONS.SYSTEM_APP_CONFIG.VIEW },
      { id: 'app-submission', label: '应用提交资料', path: '/system/app-submission', icon: <PublishRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160', permission: PERMISSIONS.SYSTEM_APP_SUBMISSION.VIEW },
    ],
  },
  {
    title: '基础数据',
    items: [
      { id: 'dict-type', label: '字典类型', path: '/system/dict/dict-type', icon: <MenuBookRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF', permission: PERMISSIONS.SYSTEM_DICT.VIEW },
      { id: 'dict-data', label: '字典数据', path: '/system/dict/dict-data', icon: <ListAltRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF', permission: PERMISSIONS.SYSTEM_DICT.VIEW },
      { id: 'filter', label: '筛选配置', path: '/system/filter', icon: <TuneRoundedIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE' },
      { id: 'address-province', label: '省份管理', path: '/system/address/province', icon: <LocationOnRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main', permission: PERMISSIONS.SYSTEM_ADDRESS.VIEW },
      { id: 'address-city', label: '城市管理', path: '/system/address/city', icon: <LocationOnRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main', permission: PERMISSIONS.SYSTEM_ADDRESS.VIEW },
      { id: 'address-area', label: '区县管理', path: '/system/address/area', icon: <LocationOnRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main', permission: PERMISSIONS.SYSTEM_ADDRESS.VIEW },
      { id: 'address-street', label: '街道管理', path: '/system/address/street', icon: <LocationOnRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main', permission: PERMISSIONS.SYSTEM_ADDRESS.VIEW },
      { id: 'wx-config', label: '微信配置', path: '/system/wx-config', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
    ],
  },
  {
    title: '微信公众号',
    items: [
      { id: 'wx-mp-menu', label: '公众号菜单', path: '/system/wx/mp/menu', icon: <MenuBookRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'wx-mp-auto-reply', label: '自动回复', path: '/system/wx/mp/auto-reply', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'wx-mp-msg', label: '消息管理', path: '/system/wx/mp/msg', icon: <DnsRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'wx-mp-user', label: '公众号用户', path: '/system/wx/mp/user', icon: <PeopleRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
    ],
  },
  {
    title: '数据看板',
    items: [
      { id: 'dash-monitor', label: '监控页', path: '/system/dashboard/monitor', icon: <StorageRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D' },
      { id: 'dash-workplace', label: '工作台', path: '/system/dashboard/workplace', icon: <AppsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main' },
      { id: 'activity', label: '创作者活动', path: '/system/activity', icon: <EventRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FE2C55' },
    ],
  },
  {
    title: '财务中心',
    items: [
      { id: 'payment-config', label: '支付配置', path: '/system/payment-config', icon: <PaymentRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'recharge-records', label: '充值记录', path: '/system/recharge-records', icon: <AccountBalanceWalletRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FE2C55' },
      { id: 'withdraw-review', label: '提现审核', path: '/system/withdraw-review', icon: <AccountBalanceWalletRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FFB400' },
      { id: 'shop', label: '商城与礼物', path: '/system/shop', icon: <StorefrontRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
    ],
  },
  {
    title: '访问统计',
    items: [
      { id: 'dash-analysis', label: '综合分析', path: '/system/dashboard/analysis', icon: <AccountTreeRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF' },
      { id: 'stats-visitor', label: '站点流量', path: '/system/stats/visitor', icon: <ShowChartRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FE2C55' },
      { id: 'stats-active', label: '用户活跃', path: '/system/stats/active', icon: <HistoryRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FFB400' },
      { id: 'stats-content', label: '内容热度', path: '/system/stats/content', icon: <BarChartRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
    ],
  },
  // ── 数字员工闭环:定义 → 装备能力 → 执行 → 观测(每一页都是真接口,没有摆设项)──
  {
    title: '数字员工',
    items: [
      { id: 'staff', label: '员工列表', path: '/system/staff', icon: <SmartToyRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF' },
      { id: 'dh-config', label: '形象与场景', path: '/system/digital-human-config', icon: <StarsRoundedIcon2 sx={{ fontSize: 18 }} />, accent: '#FF6B6B' },
      { id: 'dh-studio', label: '形象资产(3DGS / 2D)', path: '/system/digital-human', icon: <CollectionsRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
      { id: 'dh-instructions', label: '人设指令', path: '/system/digital-human-instructions', icon: <MenuBookRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'wake-word-train', label: '唤醒词训练', path: '/system/record-wake', icon: <RecordVoiceOverRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FE2C55' },
    ],
  },
  {
    title: '能力',
    items: [
      { id: 'skills', label: '技能库', path: '/system/skills', icon: <TuneRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FFB400' },
      { id: 'drafts', label: '草稿箱', path: '/system/drafts', icon: <PsychologyAltRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
      { id: 'mcp', label: 'MCP 服务', path: '/system/mcp', icon: <HubRoundedIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE' },
      { id: 'workflows', label: '工作流', path: '/system/workflows', icon: <AccountTreeRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D' },
      { id: 'models', label: '模型供应商', path: '/system/models', icon: <StorageRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF' },
      { id: 'gateway', label: '网关与配额', path: '/system/gateway', icon: <LanguageRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'gateway-packages', label: '配额套餐', path: '/system/gateway/packages', icon: <CardMembershipRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D' },
    ],
  },
  {
    title: '执行',
    items: [
      { id: 'agent-chat', label: '对话调试', path: '/system/ai-chat', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'runs', label: '后台运行', path: '/system/runs', icon: <DynamicFeedRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF' },
      { id: 'tasks', label: '任务看板', path: '/system/tasks', icon: <AppsRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FFB400' },
      { id: 'sandbox-images', label: '沙盒镜像', path: '/system/sandbox/images', icon: <TerminalRoundedIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE' },
      { id: 'sandbox-tasks', label: '沙盒任务', path: '/system/sandbox/tasks', icon: <TerminalRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
    ],
  },
  {
    title: '观测与治理',
    items: [
      { id: 'agent-overview', label: '总览', path: '/system/agent-overview', icon: <BarChartRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF' },
      { id: 'conversations', label: '会话与复现', path: '/system/conversations', icon: <HistoryRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FFB400' },
      { id: 'agent-audit', label: '调用审计', path: '/system/agent-audit', icon: <ReportProblemRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FE2C55' },
    ],
  },
  {
    title: '运维监控',
    items: [
      { id: 'deployment', label: '部署管理', path: '/system/deployment', icon: <CloudSyncIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE' },
      { id: 'log', label: '服务日志', path: '/system/log', icon: <TerminalRoundedIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE' },
      { id: 'ops-task', label: '数据迁移任务', path: '/system/ops/tasks', icon: <StorageRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FE2C55', permission: PERMISSIONS.SYSTEM_OPS_TASK.VIEW },
    ],
  },
  {
    title: '爬虫运营',
    items: [
      { id: 'spider', label: '爬虫管理', path: '/system/spider', icon: <TravelExploreIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF', permission: PERMISSIONS.SYSTEM_SPIDER.SOURCE_LIST },
      { id: 'crawled', label: '抓取内容', path: '/system/crawled', icon: <CloudDownloadIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D', permission: PERMISSIONS.SYSTEM_SPIDER.ITEM_LIST },
      { id: 'spider-backfill', label: '内容补全', path: '/system/spider/backfill', icon: <SyncProblemRoundedIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE', permission: PERMISSIONS.SYSTEM_SPIDER.BACKFILL_RUN },
      { id: 'spider-repair', label: '内容修复', path: '/system/spider/repair', icon: <BuildRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF6B6B', permission: PERMISSIONS.SYSTEM_SPIDER.REPAIR_RUN },
    ],
  },
]