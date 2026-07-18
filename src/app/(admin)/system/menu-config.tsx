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
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import StarsRoundedIcon2 from '@mui/icons-material/StarsRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import SettingsApplicationsRoundedIcon from '@mui/icons-material/SettingsApplicationsRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PaymentRoundedIcon from '@mui/icons-material/PaymentRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
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
    title: '资源管理',
    items: [
      { id: 'app', label: '应用管理', path: '/system/app', icon: <AppsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main', permission: PERMISSIONS.SYSTEM_APP.VIEW },
      { id: 'app-config', label: '应用配置', path: '/system/app-config', icon: <SettingsApplicationsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main', permission: PERMISSIONS.SYSTEM_APP_CONFIG.VIEW },
      { id: 'app-service', label: '应用服务', path: '/system/app-service', icon: <DnsRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6', permission: PERMISSIONS.SYSTEM_APP_SERVICE.VIEW },
      { id: 'resource', label: '资源管理', path: '/system/resource', icon: <StorageRoundedIcon sx={{ fontSize: 18 }} />, accent: 'warning.main', permission: PERMISSIONS.SYSTEM_RESOURCE.VIEW },
    ],
  },
  {
    title: '基础数据',
    items: [
      { id: 'dict', label: '字典管理', path: '/system/dict/dict-type', icon: <MenuBookRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF', permission: PERMISSIONS.SYSTEM_DICT.VIEW },
      { id: 'website-dict', label: '网站字典', path: '/system/website-dict', icon: <LanguageRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D', permission: PERMISSIONS.SYSTEM_WEBSITE_DICT.VIEW },
      { id: 'address', label: '地址管理', path: '/system/address/province', icon: <LocationOnRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main', permission: PERMISSIONS.SYSTEM_ADDRESS.VIEW },
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
      { id: 'dash-analysis', label: '分析页', path: '/system/dashboard/analysis', icon: <AccountTreeRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF' },
      { id: 'dash-monitor', label: '监控页', path: '/system/dashboard/monitor', icon: <StorageRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D' },
      { id: 'dash-workplace', label: '工作台', path: '/system/dashboard/workplace', icon: <AppsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main' },
    ],
  },
  {
    title: '财务中心',
    items: [
      { id: 'payment-config', label: '支付配置', path: '/system/payment-config', icon: <PaymentRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'recharge-records', label: '充值记录', path: '/system/recharge-records', icon: <AccountBalanceWalletRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FE2C55' },
      { id: 'withdraw-review', label: '提现审核', path: '/system/withdraw-review', icon: <AccountBalanceWalletRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FFB400' },
    ],
  },
  {
    title: '访问统计',
    items: [
      { id: 'stats-visitor', label: '站点流量', path: '/system/stats/visitor', icon: <ShowChartRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FE2C55' },
      { id: 'stats-active', label: '用户活跃', path: '/system/stats/active', icon: <HistoryRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FFB400' },
      { id: 'stats-content', label: '内容热度', path: '/system/stats/content', icon: <BarChartRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
    ],
  },
  {
    title: '数字人',
    items: [
      { id: 'dh-studio', label: '数字人工作台', path: '/system/digital-human', icon: <StarsRoundedIcon2 sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
      { id: 'dh-instructions', label: '数字人指令维护', path: '/system/digital-human-instructions', icon: <StarsRoundedIcon2 sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'dh-config', label: '数字人配置', path: '/system/digital-human-config', icon: <StarsRoundedIcon2 sx={{ fontSize: 18 }} />, accent: '#FF6B6B' },
      { id: 'wake-word-train', label: '唤醒词训练', path: '/system/record-wake', icon: <RecordVoiceOverRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FE2C55' },
    ],
  },
  {
    title: 'Agent 管理',
    items: [
      { id: 'agent-manager', label: 'Agent 管理台', path: '/system/agentmanager', icon: <HubRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF' },
      { id: 'agent-chat', label: 'AI 对话', path: '/system/ai-chat', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
    ],
  },
  {
    title: '运维监控',
    items: [
      { id: 'log', label: '服务日志', path: '/system/log', icon: <TerminalRoundedIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE' },
    ],
  },
]