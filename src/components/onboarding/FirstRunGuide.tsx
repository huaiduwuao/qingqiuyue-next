'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';

import { BrandSeal } from '@/components/brand/BrandLogo';
import { fetchContentTypes } from '@/apis/home-discover';
import {
  CONTENT_CATALOG,
  listCatalogEntries,
  recommendOnboardingEntries,
  type ContentCatalogEntry,
} from '@/lib/contentCatalog';
import {
  BUILTIN_TYPE_SECTIONS,
  HomeSection,
  RECOMMEND_SECTION,
  builtinSection,
  makeTagSection,
  typeSectionId,
} from '@/lib/homeSections';
import { useHomeSections } from '@/lib/sectionPrefs';
import { useResponsive } from '@/hooks/useResponsive';
import {
  dismissOnboarding,
  markOnboardingCompleted,
  shouldShowOnboarding,
  useOnboarding,
} from '@/lib/onboardingPrefs';

/**
 * 首屏引导弹窗 —— 给冷启动用户(尤其只想看小说 / 只听音乐的那种)一条最短路径。
 *
 *  流程(3 步):
 *    1. 自我介绍:平台是什么,为什么你会看到这一屏
 *    2. 兴趣选择:多选 1~5 个内容类型,每张卡片有"一句话说明 + 可播放性"
 *    3. 生成频道:把勾选映射到首页预置频道,落进 sectionPrefs;用户立刻看到自己的页签栏
 *
 *  触发条件(见 shouldShowOnboarding):未完成 && 7 天内没点过"先逛逛"。
 *  时机:进入首页 800ms 后才弹,让瀑布流先渲出一些卡片,避免空白 + 弹窗孤立。
 *
 *  后续管理入口:"以后可在首页右上角 Tune 图标里随时增减" ——
 *  这个提示在 Step 3 底部明示,降低弹窗关闭后的二次发现成本。
 */

const MAX_PICKS = 5;
const MIN_PICKS = 1;
const POP_DELAY_MS = 800;

const STEPS = ['认识清秋月', '选你常看的内容', '生成你的首页'];

interface Props {
  /** 测试用:可以传 false 把 800ms 延迟去掉 */
  noDelay?: boolean;
}

export default function FirstRunGuide({ noDelay }: Props = {}) {
  const router = useRouter();
  const { isMobile } = useResponsive();
  const [prefs] = useOnboarding();
  const [, sectionApi] = useHomeSections();

  // SSR / 首帧 hydration 期间一律不开(mounted=false),避免 useMediaQuery 引发的钩子数量不一致
  const { mounted } = useResponsive();
  const [mounted2, setMounted2] = useState(false);
  useEffect(() => setMounted2(true), []);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);

  // 决定要不要弹:mounted 后再读 prefs + 时间戳,避免 SSR 期间提前 setOpen 引出 hydration 警告
  useEffect(() => {
    if (!mounted || !mounted2) return;
    if (shouldShowOnboarding()) {
      const t = setTimeout(() => setOpen(true), noDelay ? 0 : POP_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [mounted, mounted2, prefs.completed, prefs.dismissedAt, noDelay]);

  // 字典表拉到的话,字典的 label 优先于目录里的 label
  const typesQuery = useQuery({
    queryKey: ['first-run', 'types'],
    queryFn: () =>
      fetchContentTypes()
        .then((r: any) => (r?.list ?? []) as { code: string; name: string }[])
        .catch(() => []),
    enabled: open,
    staleTime: 10 * 60_000,
  });

  // 候选条目:字典有的用字典名,没有的全部由 contentCatalog 兜底
  const entries: ContentCatalogEntry[] = useMemo(() => {
    const dict = typesQuery.data ?? [];
    if (!dict.length) return listCatalogEntries();
    const byCode = new Map(dict.map((d) => [d.code, d.name]));
    return CONTENT_CATALOG.map((e) =>
      byCode.has(e.code) && byCode.get(e.code) !== e.label
        ? { ...e, label: byCode.get(e.code)! }
        : e,
    );
  }, [typesQuery.data]);

  const recommendedCodes = useMemo(
    () => new Set(recommendOnboardingEntries().map((e) => e.code)),
    [],
  );

  const toggle = (code: string) => {
    setPicked((cur) => {
      if (cur.includes(code)) return cur.filter((c) => c !== code);
      if (cur.length >= MAX_PICKS) return cur;
      return [...cur, code];
    });
  };

  const close = () => setOpen(false);

  const onFinish = (mode: 'enter' | 'browse') => {
    if (mode === 'enter') {
      const sections = buildSectionsFromPicks(picked);
      sectionApi.replaceAll(sections);
      markOnboardingCompleted(picked);
    } else {
      dismissOnboarding();
    }
    setOpen(false);
    setStep(0);
    setPicked([]);
  };

  const onLater = () => {
    dismissOnboarding();
    setOpen(false);
  };

  const canNext = step === 0 ? true : picked.length >= MIN_PICKS;
  const onNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onFinish('enter');
  };
  const onBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      fullScreen={isMobile}
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } }}
      aria-labelledby="first-run-title"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2, pb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="first-run-title" sx={{ fontSize: 16, fontWeight: 800 }}>
            欢迎来到清秋月
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            花一分钟挑出你想看的内容,首页只留这些
          </Typography>
        </Box>
        <Tooltip title="先逛逛,7 天内不再提示">
          <Button size="small" variant="text" sx={{ fontSize: 12 }} onClick={onLater}>
            先逛逛
          </Button>
        </Tooltip>
        <IconButton size="small" onClick={close} aria-label="关闭">
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, pb: 1 }}>
        <Stepper
          activeStep={step}
          alternativeLabel
          sx={{
            '& .MuiStepIcon-root': { fontSize: 18 },
            '& .MuiStepIcon-text': { fontSize: 9, fontWeight: 700 },
            '& .MuiStepLabel-label': { fontSize: 11 },
          }}
        >
          {STEPS.map((s) => (
            <Step key={s}>
              <StepLabel>{s}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Box
        sx={{
          px: 2,
          pb: 2,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {step === 0 && <StepIntro seenWelcome={prefs.seenWelcome} />}
        {step === 1 && (
          <StepPick
            entries={entries}
            recommendedCodes={recommendedCodes}
            loading={typesQuery.isLoading}
            picked={picked}
            onToggle={toggle}
            max={MAX_PICKS}
          />
        )}
        {step === 2 && <StepPreview entries={entries} picked={picked} />}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 'auto', pt: 2 }}>
          {step > 0 && (
            <Button size="small" onClick={onBack} sx={{ fontSize: 12 }}>
              上一步
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <Button
              size="small"
              variant="contained"
              disabled={!canNext}
              onClick={onNext}
              sx={{ fontSize: 12 }}
            >
              下一步
            </Button>
          ) : (
            <>
              <Button size="small" onClick={() => onFinish('browse')} sx={{ fontSize: 12 }}>
                先逛逛
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => onFinish('enter')}
                sx={{ fontSize: 12 }}
              >
                进入清秋月
              </Button>
            </>
          )}
        </Box>
        {step === STEPS.length - 1 && (
          <Typography sx={{ fontSize: 10.5, color: 'text.disabled', mt: 1.5, textAlign: 'center' }}>
            以后可在首页右上角 <TuneRoundedIcon sx={{ fontSize: 11, verticalAlign: '-2px' }} /> 图标里随时增减频道
          </Typography>
        )}
      </Box>
    </Dialog>
  );
}

// ─────────────────────────── 步骤组件 ───────────────────────────

function StepIntro({ seenWelcome }: { seenWelcome: boolean }) {
  return (
    <Stack spacing={1.5} sx={{ pt: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <BrandSeal size={44} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 800 }}>把想看的,都收进一屏</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            十年清秋 · 问心明月
          </Typography>
        </Box>
      </Box>
      {!seenWelcome && (
        <>
          <Typography sx={{ fontSize: 13, lineHeight: 1.8 }}>
            清秋月把全网内容(小说 / 漫画 / 影视 / 音乐 / 资讯 …)聚合到自己那一屏,
            <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>不被算法牵着走</Box>。
          </Typography>
          <Typography sx={{ fontSize: 13, lineHeight: 1.8 }}>
            你只管选接下来想看什么,页签栏就长成你想要的样子。
          </Typography>
        </>
      )}
      <Box
        sx={{
          mt: 1,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'action.hover',
          border: '1px dashed',
          borderColor: 'divider',
        }}
      >
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.75 }}>
          如果只想做一件事,选下面 1～3 项就够:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {recommendOnboardingEntries().map((e) => (
            <Chip key={e.code} label={e.label} size="small" sx={{ fontSize: 11 }} />
          ))}
        </Box>
      </Box>
    </Stack>
  );
}

interface StepPickProps {
  entries: ContentCatalogEntry[];
  recommendedCodes: Set<string>;
  loading: boolean;
  picked: string[];
  onToggle: (code: string) => void;
  max: number;
}

function StepPick({ entries, recommendedCodes, loading, picked, onToggle, max }: StepPickProps) {
  return (
    <Box sx={{ pt: 0.5 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
        已选 <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>{picked.length}</Box> / {max}
        项;至少选 1 项
      </Typography>
      {loading ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" width={88} height={56} />
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 0.75,
          }}
        >
          {entries.map((e) => {
            const selected = picked.includes(e.code);
            const disabled = !selected && picked.length >= max;
            const recommended = recommendedCodes.has(e.code);
            return (
              <Box
                key={e.code}
                role="button"
                tabIndex={0}
                onClick={() => !disabled && onToggle(e.code)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    if (!disabled) onToggle(e.code);
                  }
                }}
                sx={{
                  position: 'relative',
                  p: 1,
                  borderRadius: 1.5,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
                  border: '1.5px solid',
                  borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected ? 'action.selected' : 'transparent',
                  transition: 'all .15s',
                  '&:hover': disabled ? {} : { borderColor: 'primary.main' },
                }}
              >
                {recommended && !selected && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      fontSize: 9,
                      px: 0.5,
                      py: 0.1,
                      borderRadius: 1,
                      bgcolor: 'secondary.main',
                      color: '#fff',
                      fontWeight: 700,
                      lineHeight: 1.4,
                    }}
                  >
                    推荐
                  </Box>
                )}
                {selected && (
                  <CheckRoundedIcon
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      fontSize: 14,
                      color: 'primary.main',
                    }}
                  />
                )}
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, mb: 0.25 }}>{e.label}</Typography>
                <Typography
                  sx={{
                    fontSize: 10.5,
                    color: 'text.secondary',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {e.shortDesc}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function StepPreview({ entries, picked }: { entries: ContentCatalogEntry[]; picked: string[] }) {
  const pickedEntries = picked
    .map((c) => entries.find((e) => e.code === c))
    .filter(Boolean) as ContentCatalogEntry[];
  return (
    <Stack spacing={1.5} sx={{ pt: 0.5 }}>
      <Typography sx={{ fontSize: 13, lineHeight: 1.7 }}>
        接下来会按你选的 {pickedEntries.length} 项内容,生成这样的首页页签:
      </Typography>
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', pb: 0.5 }}>
          <Chip
            icon={<CheckRoundedIcon sx={{ fontSize: '13px !important' }} />}
            label={RECOMMEND_SECTION.label}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontSize: 11, fontWeight: 700, flexShrink: 0 }}
          />
          {pickedEntries.map((e) => (
            <Chip
              key={e.code}
              label={e.label}
              size="small"
              sx={{ fontSize: 11, flexShrink: 0 }}
            />
          ))}
        </Box>
        <Typography sx={{ fontSize: 10.5, color: 'text.disabled', mt: 1 }}>
          进首页后,页签栏就是这个样子;不喜欢?右上角 Tune 图标随时换。
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.7 }}>
        已选内容类型:
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {pickedEntries.map((e) => (
          <Chip
            key={e.code}
            label={e.label}
            size="small"
            onDelete={() => {}}
            sx={{ fontSize: 11 }}
          />
        ))}
      </Box>
    </Stack>
  );
}

// ─────────────────────────── 工具 ───────────────────────────

/**
 * 把用户选的 code 列表映射成 HomeSection 数组,落进 sectionPrefs。
 * 优先复用预置项(id/label 都跟 BUILTIN_TYPE_SECTIONS 对齐),没在预置里的用 makeTypeSection 兜底。
 */
export function buildSectionsFromPicks(codes: string[]): HomeSection[] {
  const builtinByCode = new Map(BUILTIN_TYPE_SECTIONS.map((s) => [s.contentType, s]).filter((p) => p[0]) as [string, HomeSection][]);
  const seen = new Set<string>();
  const out: HomeSection[] = [];
  for (const code of codes) {
    const builtin = builtinByCode.get(code) ?? builtinSection(code);
    if (builtin && !seen.has(builtin.id)) {
      seen.add(builtin.id);
      out.push({ ...builtin, builtin: true });
      continue;
    }
    // 没在预置里(例如运营后台新加的字典项):直接造一个 type 频道
    const entry = CONTENT_CATALOG.find((e) => e.code === code);
    const id = typeSectionId(code);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: entry?.label || code,
      kind: 'type',
      contentType: code,
      builtin: false,
    });
  }
  return out;
}

// 标签频道型 kind:'tag' 在 BUILTIN 里也有(game/food/...);暴露出来便于将来扩展"按标签选"
export const _internal = { makeTagSection };
