'use client';

import React, { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import LibraryAddCheckOutlinedIcon from '@mui/icons-material/LibraryAddCheckOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import LockIcon from '@mui/icons-material/Lock';
import type { ContentItem } from '@/hooks/useContentItems';
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  READER_ACCENT,
  READER_FONTS,
  READER_THEMES,
  READER_WIDTHS,
  noiseLayer,
  type ReaderPrefs,
  type ReaderTheme,
} from './prefs';

export type ReaderPanel = 'toc' | 'settings' | null;

export const RAIL_TOP = 136;
const RAIL_SIZE = 64;

/** 工具栏贴在正文栏右侧 12px;窗口太窄放不下时贴住窗口右边。 */
export function railLeft(columnWidth: number) {
  return `min(calc(50% + ${columnWidth / 2 + 12}px), calc(100% - ${RAIL_SIZE + 12}px))`;
}

interface ReaderChromeProps {
  isMobile: boolean;
  theme: ReaderTheme;
  prefs: ReaderPrefs;
  onPrefs: (patch: Partial<ReaderPrefs>) => void;
  onToggleNight: () => void;
  columnWidth: number;
  panel: ReaderPanel;
  onPanel: (panel: ReaderPanel) => void;
  /** 移动端:点正文呼出/收起上下菜单 */
  mobileChrome: boolean;
  chapters: ContentItem[];
  current: number;
  onGo: (index: number) => void;
  title: string;
  progress: number;
  onBack: () => void;
  onBookInfo: () => void;
  onComments: () => void;
  onTop: () => void;
  shelved: boolean;
  onShelf: () => void;
  liked: boolean;
  onLike: () => void;
}

export function ReaderChrome(props: ReaderChromeProps) {
  const { isMobile, theme, panel, onPanel, progress } = props;
  const paperBg = { backgroundColor: theme.paper, backgroundImage: noiseLayer(theme.dark) };

  const panelBody = panel === 'toc' ? <TocPanel {...props} /> : panel === 'settings' ? <SettingsPanel {...props} /> : null;

  return (
    <>
      {/* 顶部细进度条 */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 1300, pointerEvents: 'none' }}>
        <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: READER_ACCENT, transition: 'width .15s linear' }} />
      </Box>

      {isMobile ? (
        <MobileBars {...props} paperBg={paperBg} />
      ) : (
        <Box
          component="nav"
          aria-label="阅读工具"
          data-reader-rail
          sx={{ position: 'fixed', top: RAIL_TOP, left: railLeft(props.columnWidth), zIndex: 1200, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <RailButton theme={theme} icon={<FormatListBulletedIcon />} label="目录" active={panel === 'toc'} onClick={() => onPanel(panel === 'toc' ? null : 'toc')} disabled={!props.chapters.length} />
          <RailButton theme={theme} icon={<MenuBookOutlinedIcon />} label="书详情" onClick={props.onBookInfo} />
          <RailButton
            theme={theme}
            icon={props.shelved ? <LibraryAddCheckOutlinedIcon /> : <LibraryAddOutlinedIcon />}
            label={props.shelved ? '已在书架' : '加书架'}
            active={props.shelved}
            onClick={props.onShelf}
          />
          <RailButton theme={theme} icon={props.liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />} label={props.liked ? '已赞' : '点赞'} active={props.liked} onClick={props.onLike} />
          <RailButton theme={theme} icon={<ChatBubbleOutlineIcon />} label="评论" onClick={props.onComments} />
          <RailButton
            theme={theme}
            icon={theme.dark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            label={theme.dark ? '日间' : '夜间'}
            onClick={props.onToggleNight}
          />
          <RailButton theme={theme} icon={<TuneIcon />} label="设置" active={panel === 'settings'} onClick={() => onPanel(panel === 'settings' ? null : 'settings')} />
          <RailButton theme={theme} icon={<VerticalAlignTopIcon />} label="顶部" onClick={props.onTop} />
        </Box>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={!!panel}
          onClose={() => onPanel(null)}
          slotProps={{ paper: { sx: { ...paperBg, color: theme.text, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '75vh' } } }}
        >
          {panelBody}
        </Drawer>
      ) : (
        panel && (
          <ClickAwayListener
            mouseEvent="onMouseDown"
            // 工具栏按钮自己负责开关面板,点它们不算"点到外面"
            onClickAway={(e) => !(e.target as Element | null)?.closest?.('[data-reader-rail]') && onPanel(null)}
          >
            <Box
              role="dialog"
              aria-label={panel === 'toc' ? '目录' : '阅读设置'}
              sx={{
                ...paperBg,
                position: 'fixed',
                top: RAIL_TOP,
                // 面板在工具栏左侧
                right: `calc(100% - ${railLeft(props.columnWidth)} + 12px)`,
                width: 400,
                maxHeight: `calc(100vh - ${RAIL_TOP + 40}px)`,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1250,
                color: theme.text,
                borderRadius: '12px',
                border: `1px solid ${theme.line}`,
                boxShadow: theme.dark ? '0 8px 32px rgba(0,0,0,.6)' : '0 8px 32px rgba(0,0,0,.12)',
                animation: 'qqReaderPanelIn .18s ease-out',
                '@keyframes qqReaderPanelIn': { from: { opacity: 0, transform: 'translateX(8px)' }, to: { opacity: 1, transform: 'none' } },
              }}
            >
              {panelBody}
            </Box>
          </ClickAwayListener>
        )
      )}
    </>
  );
}

function RailButton({ theme, icon, label, onClick, active, disabled }: { theme: ReaderTheme; icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        width: RAIL_SIZE,
        height: RAIL_SIZE,
        borderRadius: '8px',
        flexDirection: 'column',
        gap: '2px',
        fontSize: 12,
        lineHeight: '16px',
        backgroundColor: theme.paper,
        backgroundImage: noiseLayer(theme.dark),
        color: active ? READER_ACCENT : theme.text,
        boxShadow: active ? (theme.dark ? '0 2px 12px rgba(0,0,0,.5)' : '0 2px 12px rgba(0,0,0,.08)') : 'none',
        opacity: disabled ? 0.4 : 1,
        transition: 'color .15s, box-shadow .15s',
        '& svg': { fontSize: 22 },
        '&:hover': { color: READER_ACCENT, boxShadow: theme.dark ? '0 2px 12px rgba(0,0,0,.5)' : '0 2px 12px rgba(0,0,0,.08)' },
      }}
    >
      {icon}
      {label}
    </ButtonBase>
  );
}

function PanelHeader({ theme, title, extra, onClose }: { theme: ReaderTheme; title: string; extra?: React.ReactNode; onClose: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, pt: 2.5, pb: 1.5, borderBottom: `1px solid ${theme.line}` }}>
      <Box sx={{ fontSize: 18, fontWeight: 600 }}>{title}</Box>
      <Box sx={{ fontSize: 13, color: theme.sub, flex: 1 }}>{extra}</Box>
      <IconButton size="small" onClick={onClose} aria-label="关闭" sx={{ color: theme.sub }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function TocPanel({ theme, chapters, current, onGo, onPanel }: ReaderChromeProps) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-current="true"]');
    el?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <>
      <PanelHeader theme={theme} title="目录" extra={`共 ${chapters.length} 章`} onClose={() => onPanel(null)} />
      <Box ref={listRef} sx={{ overflowY: 'auto', flex: 1, py: 1, minHeight: 0 }}>
        {chapters.map((c, i) => {
          const on = i === current;
          return (
            <ButtonBase
              key={c.id}
              data-current={on}
              onClick={() => onGo(i)}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                gap: 1,
                px: 3,
                py: 1.25,
                fontSize: 14,
                textAlign: 'left',
                color: on ? READER_ACCENT : theme.text,
                fontWeight: on ? 600 : 400,
                '&:hover': { bgcolor: theme.fill },
              }}
            >
              <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.title || `第 ${i + 1} 章`}
              </Box>
              {c.locked && <LockIcon sx={{ fontSize: 14, color: theme.sub }} />}
            </ButtonBase>
          );
        })}
      </Box>
    </>
  );
}

function Pill({ theme, active, onClick, children, grow }: { theme: ReaderTheme; active: boolean; onClick: () => void; children: React.ReactNode; grow?: boolean }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        flex: grow ? 1 : 'none',
        minWidth: 52,
        height: 36,
        px: 1.5,
        borderRadius: '18px',
        fontSize: 14,
        border: `1px solid ${active ? READER_ACCENT : theme.line}`,
        color: active ? READER_ACCENT : theme.text,
        bgcolor: active ? 'transparent' : theme.fill,
      }}
    >
      {children}
    </ButtonBase>
  );
}

function Row({ theme, label, children }: { theme: ReaderTheme; label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.25 }}>
      <Box sx={{ width: 64, flexShrink: 0, fontSize: 14, color: theme.sub }}>{label}</Box>
      <Box sx={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>{children}</Box>
    </Box>
  );
}

function SettingsPanel({ theme, prefs, onPrefs, onPanel, isMobile }: ReaderChromeProps) {
  return (
    <>
      <PanelHeader theme={theme} title="阅读设置" onClose={() => onPanel(null)} />
      <Box sx={{ px: 3, py: 1.5, overflowY: 'auto' }}>
        <Row theme={theme} label="阅读主题">
          {READER_THEMES.map((t) => {
            const on = prefs.theme === t.id;
            return (
              <ButtonBase
                key={t.id}
                title={t.label}
                aria-label={t.label}
                aria-pressed={on}
                onClick={() => onPrefs({ theme: t.id })}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: t.paper,
                  backgroundImage: noiseLayer(t.dark),
                  border: `1px solid ${on ? READER_ACCENT : 'rgba(0,0,0,.08)'}`,
                  color: on ? READER_ACCENT : 'rgba(255,255,255,.4)',
                }}
              >
                {on ? <CheckIcon sx={{ fontSize: 18 }} /> : t.dark ? <DarkModeOutlinedIcon sx={{ fontSize: 16 }} /> : null}
              </ButtonBase>
            );
          })}
        </Row>
        <Row theme={theme} label="正文字体">
          {READER_FONTS.map((f) => (
            <Pill key={f.id} theme={theme} grow active={prefs.font === f.id} onClick={() => onPrefs({ font: f.id })}>
              <Box component="span" sx={{ fontFamily: f.css }}>{f.label}</Box>
            </Pill>
          ))}
        </Row>
        <Row theme={theme} label="字体大小">
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', height: 36, borderRadius: '18px', bgcolor: theme.fill, border: `1px solid ${theme.line}` }}>
            <ButtonBase
              aria-label="减小字号"
              disabled={prefs.fontSize <= FONT_SIZE_MIN}
              onClick={() => onPrefs({ fontSize: prefs.fontSize - 2 })}
              sx={{ flex: 1, height: '100%', borderRadius: '18px 0 0 18px', fontSize: 14, color: theme.text, '&.Mui-disabled': { opacity: 0.35 } }}
            >
              A-
            </ButtonBase>
            <Box sx={{ minWidth: 48, textAlign: 'center', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{prefs.fontSize}</Box>
            <ButtonBase
              aria-label="增大字号"
              disabled={prefs.fontSize >= FONT_SIZE_MAX}
              onClick={() => onPrefs({ fontSize: prefs.fontSize + 2 })}
              sx={{ flex: 1, height: '100%', borderRadius: '0 18px 18px 0', fontSize: 18, color: theme.text, '&.Mui-disabled': { opacity: 0.35 } }}
            >
              A+
            </ButtonBase>
          </Box>
        </Row>
        {!isMobile && (
          <Row theme={theme} label="页面宽度">
            {READER_WIDTHS.map((w) => (
              <Pill key={w} theme={theme} active={prefs.width === w} onClick={() => onPrefs({ width: w })}>
                {w === 0 ? '自动' : w}
              </Pill>
            ))}
          </Row>
        )}
        <Row theme={theme} label="翻页模式">
          <Pill theme={theme} grow active={prefs.mode === 'page'} onClick={() => onPrefs({ mode: 'page' })}>
            章节翻页
          </Pill>
          <Pill theme={theme} grow active={prefs.mode === 'scroll'} onClick={() => onPrefs({ mode: 'scroll' })}>
            滚动翻页
          </Pill>
        </Row>
        <Box sx={{ fontSize: 12, color: theme.sub, pt: 0.5, pb: 1 }}>
          {prefs.mode === 'scroll' ? '读到章末自动接上下一章' : '每次只显示一章,在章末切换'}
        </Box>
      </Box>
    </>
  );
}

function MobileBars(props: ReaderChromeProps & { paperBg: object }) {
  const { theme, mobileChrome, paperBg, chapters, current, onGo, onPanel } = props;
  const bar = {
    ...paperBg,
    position: 'fixed',
    left: 0,
    right: 0,
    zIndex: 1200,
    color: theme.text,
    transition: 'transform .25s ease',
    boxShadow: theme.dark ? '0 0 16px rgba(0,0,0,.6)' : '0 0 16px rgba(0,0,0,.08)',
  } as const;
  const iconBtn = (icon: React.ReactNode, label: string, onClick: () => void, active?: boolean) => (
    <ButtonBase onClick={onClick} sx={{ flex: 1, flexDirection: 'column', gap: '2px', py: 0.75, fontSize: 11, color: active ? READER_ACCENT : theme.text, '& svg': { fontSize: 22 } }}>
      {icon}
      {label}
    </ButtonBase>
  );
  const navBtn = (label: string, target: number) => (
    <ButtonBase
      disabled={!chapters[target]}
      onClick={() => onGo(target)}
      sx={{ px: 1.5, height: 32, borderRadius: '16px', fontSize: 13, color: theme.text, bgcolor: theme.fill, '&.Mui-disabled': { opacity: 0.35 } }}
    >
      {label}
    </ButtonBase>
  );

  return (
    <>
      <Box sx={{ ...bar, top: 0, transform: mobileChrome ? 'none' : 'translateY(-110%)', display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, height: 48, pt: 'env(safe-area-inset-top)' }}>
        <IconButton onClick={props.onBack} aria-label="返回" sx={{ color: theme.text }}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{props.title}</Box>
        <IconButton onClick={props.onShelf} aria-label="加书架" sx={{ color: props.shelved ? READER_ACCENT : theme.text }}>
          {props.shelved ? <LibraryAddCheckOutlinedIcon /> : <LibraryAddOutlinedIcon />}
        </IconButton>
      </Box>
      <Box sx={{ ...bar, bottom: 0, transform: mobileChrome ? 'none' : 'translateY(110%)', pb: 'env(safe-area-inset-bottom)' }}>
        {chapters.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, pt: 1.25 }}>
            {navBtn('上一章', current - 1)}
            <Box sx={{ flex: 1, textAlign: 'center', fontSize: 12, color: theme.sub }}>
              {current + 1} / {chapters.length}
            </Box>
            {navBtn('下一章', current + 1)}
          </Box>
        )}
        <Box sx={{ display: 'flex', px: 1, py: 0.5 }}>
          {iconBtn(<FormatListBulletedIcon />, '目录', () => onPanel('toc'))}
          {iconBtn(theme.dark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />, theme.dark ? '日间' : '夜间', props.onToggleNight)}
          {iconBtn(<TuneIcon />, '设置', () => onPanel('settings'))}
          {iconBtn(props.liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />, '点赞', props.onLike, props.liked)}
          {iconBtn(<ChatBubbleOutlineIcon />, '评论', props.onComments)}
        </Box>
      </Box>
    </>
  );
}
