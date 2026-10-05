'use client';

import React from 'react';
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import WatchLaterRoundedIcon from '@mui/icons-material/WatchLaterRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RecommendRoundedIcon from '@mui/icons-material/RecommendRounded';
import WalletRoundedIcon from '@mui/icons-material/WalletRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';
import StarsIcon from '@mui/icons-material/Stars';
import { ACCENT } from '@/constants/accents';
import { WALLET_HREF } from '@/apis/wallet';

export const MAIN_TABS: { key: string; label: string; icon: React.ReactNode; locked?: boolean }[] = [
  { key: 'works', label: '作品', icon: <VideoLibraryOutlinedIcon sx={{ fontSize: 14 }} /> },
  // 书架/歌单 是用户主动攒的列表,比「推荐/喜欢」这类被动流更该排在前面 —— 窄屏只露出前 5 个页签,
  // 之前它们排在第 6/7 位,被推到屏幕外要横滑才够得着。
  { key: 'bookshelf', label: '书架', icon: <MenuBookRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'playlist', label: '歌单', icon: <QueueMusicRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'recommend', label: '推荐', icon: <RecommendRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'like', label: '喜欢', icon: <FavoriteBorderRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'collect', label: '收藏', icon: <BookmarkRoundedIcon sx={{ fontSize: 14 }} /> },
  // 自建收藏夹(PG user_my_list)。以前只有「作品 → 合集」一个子页签能看到合集,
  // 而它打的还是作品的接口 —— 歌单和书架在「我的」页里根本没有入口。
  { key: 'collection', label: '作品合集', icon: <CollectionsBookmarkRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'history', label: '观看历史', icon: <HistoryRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'later', label: '稍后再看', icon: <WatchLaterRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'order', label: '我的预约', icon: <EventNoteRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'ai', label: 'AI 笔记', icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} /> },
];

export const QUICK_LINKS: { key: string; label: string; icon: React.ReactNode; href: string; accent: string }[] = [
  { key: 'wallet', label: '我的钱包', icon: <WalletRoundedIcon sx={{ fontSize: 20 }} />, href: WALLET_HREF, accent: ACCENT.red.main },
  { key: 'points', label: '积分中心', icon: <StarsIcon sx={{ fontSize: 20 }} />, href: '/user/points', accent: ACCENT.purple.main },
  { key: 'order', label: '我的订单', icon: <ReceiptLongRoundedIcon sx={{ fontSize: 20 }} />, href: '/account/orders', accent: ACCENT.blue.main },
  { key: 'purchases', label: '我的购买', icon: <ShoppingBagRoundedIcon sx={{ fontSize: 20 }} />, href: '/account/purchases', accent: ACCENT.orange.main },
  { key: 'vip', label: '会员中心', icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 20 }} />, href: '/account/vip', accent: ACCENT.gold.main },
  // 设置在左侧抽屉菜单里,这一格放积分商城(积分兑换)
  { key: 'mall', label: '积分商城', icon: <RedeemRoundedIcon sx={{ fontSize: 20 }} />, href: '/account/points-mall', accent: ACCENT.cyan.main },
];
