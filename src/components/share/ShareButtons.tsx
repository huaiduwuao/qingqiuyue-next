'use client';

/**
 * 通用分享按钮组:抖音 / 快手 / 小红书 / 复制链接 / Web Share。
 *
 * 用法:
 *   <ShareButtons
 *     contentType="topic"
 *     contentId={topicId}
 *     title={title}
 *     url={url}
 *     cover={cover}
 *     desc={desc}
 *   />
 *
 * 行为:
 *   - 抖音/快手 → 弹 ShareTaskDialog 走 OpenAPI 真发布
 *   - 小红书   → 走引导式分享(html-to-image 转分享卡 PNG → 复制到剪贴板 + 唤起 App)
 *   - 复制 / Web Share 走 navigator 能力
 *   - Tauri 桌面端 navigator.share 不工作时降级复制
 */

import React, { useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
} from '@mui/material';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import ShareTaskDialog from './ShareTaskDialog';
import ShareCardPreview, { type ShareCardData } from './ShareCardPreview';
import type { EntityId } from '@/lib/id';

/** 简化版:Tauri 环境检测 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__;
}
/** 简化版:Tauri 命令调用 */
async function invokeTauri(cmd: string, args?: Record<string, unknown>): Promise<any> {
  if (typeof window === 'undefined') return null;
  const t = (window as any).__TAURI__;
  if (!t?.core?.invoke) return null;
  return t.core.invoke(cmd, args);
}

/** 小红书 App 唤起 scheme + 兜底 URL(用户没装 App 时跳应用商店) */
const XHS_SCHEME = 'xhsdiscover://';
const DOUYIN_SCHEME = 'snssdk1128://';
const KUAISHOU_SCHEME = 'kwaiyewen://';

export interface ShareButtonsProps {
  contentType: string;
  /** 内容 id 可能超 2^53,原样传字符串,别 Number()(见 lib/id.ts) */
  contentId: EntityId;
  title: string;
  url: string;          // 当前页 URL,或专题页/详情页拼接
  cover?: string;
  desc?: string;
  subtitle?: string;
  topicId?: string;
  defaultTags?: string[];
  /** icon:详情页头部那一排图标里用的单个分享按钮(点开菜单);row(默认):一排按钮 */
  variant?: 'icon' | 'menu' | 'row';
  /** compact:折叠成一个「分享」主按钮 + 平台/更多菜单,给移动端窄屏用(默认 row 不变) */
  compact?: boolean;
  onAfterShare?: (platform: string) => void;
}

const PLATFORMS = [
  { value: 'douyin', label: '抖音', color: '#FE2C55', icon: '抖音' },
  { value: 'kuaishou', label: '快手', color: '#FFA836', icon: '快手' },
  { value: 'xiaohongshu', label: '小红书', color: '#FF2442', icon: '小红书' },
] as const;

export default function ShareButtons(props: ShareButtonsProps) {
  const {
    contentType, contentId, title, url, cover, desc, subtitle, topicId, defaultTags,
    variant = 'row',
    compact = false,
    onAfterShare,
  } = props;

  const [taskDialogPlatform, setTaskDialogPlatform] = useState<'douyin' | 'kuaishou' | null>(null);
  const [xhsDialogOpen, setXhsDialogOpen] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' | 'info' }>({
    open: false, msg: '', severity: 'info',
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const showToast = (msg: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToast({ open: true, msg, severity });
  };

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast('链接已复制', 'success');
      } else {
        showToast('当前环境不支持复制', 'error');
      }
    } catch {
      showToast('复制失败', 'error');
    }
    onAfterShare?.('copy');
  };

  const handleWebShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await navigator.share({ title, text: desc || title, url });
      } else {
        // 降级到复制
        await handleCopy();
        return;
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') showToast('分享失败', 'error');
    }
    onAfterShare?.('web');
  };

  const handlePlatformClick = async (platform: string) => {
    if (platform === 'douyin' || platform === 'kuaishou') {
      setTaskDialogPlatform(platform);
      return;
    }
    if (platform === 'xiaohongshu') {
      setXhsDialogOpen(true);
      return;
    }
  };

  const handleXhsShare = async () => {
    // 1. 转分享卡为 PNG → 复制到剪贴板
    try {
      if (cardRef.current) {
        const blob = await toBlob(cardRef.current, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });
        if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob }),
            ]);
            showToast('已复制分享卡图片 + 链接,打开小红书粘贴即可', 'success');
          } catch {
            // 剪贴板图片权限失败时,降级复制链接
            await navigator.clipboard?.writeText(url);
            showToast('图片复制失败,已复制链接。请打开小红书 → 长按粘贴', 'info');
          }
        } else if (blob) {
          // 兜底:下载图片让用户手动上传
          const dataUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `share-card-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(dataUrl);
          await navigator.clipboard?.writeText(url);
          showToast('已下载分享卡 + 复制链接;请在小红书发布页上传图片并粘贴链接', 'info');
        }
      }
    } catch (e: any) {
      // html-to-image 失败时降级复制链接
      try {
        await navigator.clipboard?.writeText(url);
        showToast('图片生成失败,已复制链接。请手动打开小红书发布图文', 'info');
      } catch {
        showToast('复制失败', 'error');
      }
    }
    // 2. 唤起小红书 App
    try {
      if (isTauri()) {
        await invokeTauri('open_external', { url: XHS_SCHEME });
      } else {
        window.location.href = XHS_SCHEME;
      }
    } catch {
      // 用户没装 App,忽略
    }
    onAfterShare?.('xiaohongshu');
  };

  const cardData: ShareCardData = {
    title,
    subtitle,
    desc,
    cover: cover || '',
    url,
    platform: 'xiaohongshu',
  };

  // icon 变体:详情页头部本来就有一排图标按钮,再塞一排文字按钮会挤成两行,
  // 而且和页面原有的分享图标重复(旧的那个已经删掉,这里是唯一入口)。
  const iconEntry = (
    <>
      <IconButton
        aria-label="分享"
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{ color: 'text.tertiary' }}
      >
        <ShareRoundedIcon />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {PLATFORMS.map((p) => (
          <MenuItem
            key={p.value}
            onClick={() => {
              setMenuAnchor(null);
              handlePlatformClick(p.value);
            }}
          >
            分享到{p.label}
          </MenuItem>
        ))}
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            handleCopy();
          }}
        >
          复制链接
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            handleWebShare();
          }}
        >
          系统分享
        </MenuItem>
      </Menu>
    </>
  );

  const compactIconEntry = (
    <>
      <IconButton
        size="small"
        aria-label="分享"
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{ color: 'text.secondary', p: 0.75 }}
      >
        <ShareRoundedIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {PLATFORMS.map((p) => (
          <MenuItem
            key={p.value}
            onClick={() => {
              setMenuAnchor(null);
              handlePlatformClick(p.value);
            }}
          >
            分享到{p.label}
          </MenuItem>
        ))}
        <MenuItem onClick={() => { setMenuAnchor(null); handleCopy(); }}>复制链接</MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); handleWebShare(); }}>系统分享</MenuItem>
      </Menu>
    </>
  );

  return (
    <>
      {variant === 'icon' ? iconEntry : compact && variant !== 'menu' ? compactIconEntry : (
      <Box
        sx={
          compact
            ? { display: 'flex', alignItems: 'center', gap: 1, width: '100%' }
            : { display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }
        }
      >
        {compact ? (
          /* 窄屏:一个主「分享」按钮(WB/H5 上 = 系统分享)+ 一个菜单装下所有平台 */
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ShareRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={handleWebShare}
              sx={{ textTransform: 'none', fontSize: 12, borderRadius: 2, borderColor: 'var(--border-strong, transparent)', color: 'text.secondary', flex: 1 }}
            >
              分享
            </Button>
            <IconButton
              size="small"
              aria-label="更多分享方式"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ border: '1px solid var(--border-strong, transparent)', borderRadius: 2, color: 'text.secondary', p: 0.75 }}
            >
              <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
              {PLATFORMS.map((p) => (
                <MenuItem
                  key={p.value}
                  onClick={() => {
                    setMenuAnchor(null);
                    handlePlatformClick(p.value);
                  }}
                >
                  分享到{p.label}
                </MenuItem>
              ))}
              <MenuItem onClick={() => { setMenuAnchor(null); handleCopy(); }}>复制链接</MenuItem>
            </Menu>
          </>
        ) : (
          <>
            {PLATFORMS.map((p) => (
              <Button
                key={p.value}
                size="small"
                variant="outlined"
                onClick={() => handlePlatformClick(p.value)}
                sx={{
                  borderColor: p.color,
                  color: p.color,
                  fontSize: 12,
                  px: 1.5,
                  minWidth: 0,
                }}
              >
                {p.icon}
              </Button>
            ))}
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyRoundedIcon fontSize="small" />}
              onClick={handleCopy}
              sx={{ fontSize: 12 }}
            >
              复制
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ShareRoundedIcon fontSize="small" />}
              onClick={handleWebShare}
              sx={{ fontSize: 12 }}
            >
              分享
            </Button>
          </>
        )}
      </Box>
      )}

      {/* 抖音/快手 真发布对话框 */}
      {taskDialogPlatform && (
        <ShareTaskDialog
          open={!!taskDialogPlatform}
          onClose={() => setTaskDialogPlatform(null)}
          platform={taskDialogPlatform}
          contentType={contentType}
          contentId={contentId}
          defaultTitle={title}
          defaultCoverUrl={cover}
          defaultTags={defaultTags}
          topicId={topicId}
          onSuccess={() => onAfterShare?.(taskDialogPlatform)}
        />
      )}

      {/* 小红书 引导式分享 */}
      <Dialog open={xhsDialogOpen} onClose={() => setXhsDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>分享到小红书</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <ShareCardPreview {...cardData} previewRef={cardRef} />
          </Box>
          <Box sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.7 }}>
            小红书不开放图文 / 视频发布 API,请按下面步骤手动发布:
            <br />
            1. 点击「生成分享卡并复制」,自动生成带封面/标题/二维码的图片并复制到剪贴板
            <br />
            2. 点击「唤起小红书 App」,在小红书内 → 右上角「+」→ 发布图文
            <br />
            3. 长按粘贴图片 + 粘贴文案/链接
          </Box>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setXhsDialogOpen(false)}>取消</Button>
          <Button
            onClick={async () => {
              try {
                if (!cardRef.current) return;
                const blob = await toBlob(cardRef.current, {
                  cacheBust: true,
                  pixelRatio: 2,
                  backgroundColor: '#ffffff',
                });
                if (!blob) {
                  showToast('生成失败,请重试', 'error');
                  return;
                }
                if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
                  await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob }),
                  ]);
                  showToast('分享卡图片已复制到剪贴板', 'success');
                } else {
                  // 降级:下载
                  const dataUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = dataUrl;
                  a.download = `share-card-${Date.now()}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(dataUrl);
                  showToast('已下载分享卡图片', 'success');
                }
              } catch {
                showToast('生成失败,请检查浏览器权限', 'error');
              }
            }}
          >
            生成分享卡并复制
          </Button>
          <Button variant="contained" onClick={handleXhsShare}>
            唤起小红书 App
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </>
  );
}