'use client';

// AI 短剧生成 5 步看板视图
//
// 需求 G1:把原本 8 个后端 step 聚合成 5 步看板,直观呈现项目进度。
// 映射:
//   1. 剧本       = screenwriter + script
//   2. 主题(视觉与角色一致性) = visual_design
//   3. 分镜提示词 = storyboard
//   4. 故事板分镜图 = visual_gen
//   5. 成片合成   = pacing + qc + 后期(localize / dubbing / compose / distribute)
//
// 每个步骤卡显示:图标 + 标题 + 描述 + 当前状态(完成/进行中/待办) +
// 后端实际步骤(小标签)+ 一键启动按钮(若该步未开始)。

import React from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import QueueRoundedIcon from '@mui/icons-material/QueueRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import { type Step, type Task, STEP_LABELS } from '@/apis/shortdrama';

// 后端 8 个 step → 5 步看板的映射
export interface BoardStep {
  /** 看板步骤 1-5 */
  index: 1 | 2 | 3 | 4 | 5;
  title: string;
  desc: string;
  icon: React.ReactElement;
  /** 该看板步对应的后端 step(一个或多个,显示在卡片下方) */
  backendSteps: Step[];
  /** 该步的颜色,渐变方向 */
  gradient: string;
}

export const BOARD_STEPS: BoardStep[] = [
  {
    index: 1,
    title: '剧本',
    desc: '从故事意图到分集剧本:编剧先写故事框架与角色,再生成各集分场台词。',
    icon: <AutoStoriesRoundedIcon sx={{ fontSize: 28 }} />,
    backendSteps: ['screenwriter', 'script'],
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #C4B5FD 100%)',
  },
  {
    index: 2,
    title: '主题',
    desc: '视觉与角色一致性:角色美术、场景、道具的视觉提示词与定妆照。',
    icon: <PaletteRoundedIcon sx={{ fontSize: 28 }} />,
    backendSteps: ['visual_design'],
    gradient: 'linear-gradient(135deg, #FE2C55 0%, #FF6B8A 100%)',
  },
  {
    index: 3,
    title: '分镜提示词',
    desc: '把每集剧本拆成镜头列表:运镜、构图、对话、画面提示词(image_prompt)。',
    icon: <QueueRoundedIcon sx={{ fontSize: 28 }} />,
    backendSteps: ['storyboard'],
    gradient: 'linear-gradient(135deg, #25F4EE 0%, #5DF7F2 100%)',
  },
  {
    index: 4,
    title: '故事板分镜图',
    desc: '按镜头列表逐张出图,角色一致性由主题阶段提示词约束。',
    icon: <ImageRoundedIcon sx={{ fontSize: 28 }} />,
    backendSteps: ['visual_gen'],
    gradient: 'linear-gradient(135deg, #FFB400 0%, #FDBA74 100%)',
  },
  {
    index: 5,
    title: '成片合成',
    desc: '节奏调整 + 质检,再配音、上字幕,合成带多语种版本的竖屏成片。',
    icon: <MovieFilterRoundedIcon sx={{ fontSize: 28 }} />,
    backendSteps: ['pacing', 'qc', 'dubbing', 'compose'],
    gradient: 'linear-gradient(135deg, #5DDB96 0%, #10B981 100%)',
  },
];

/** 把后端 step 状态(字符串 stage)映射到 5 步看板的当前/完成步。
 *  stage 取值:intent/script/visual/storyboard/pacing/render/qc/post/done */
export function stageToBoardIndex(stage: string | undefined): number {
  switch (stage) {
    case 'intent':
    case 'script':
      return 1;
    case 'visual':
      return 2;
    case 'storyboard':
      return 3;
    case 'pacing':
    case 'render':
      return 4;
    case 'qc':
    case 'post':
    case 'done':
      return 5;
    default:
      return 1;
  }
}

export function FiveStepBoard({
  currentStage,
  status,
  running,
  canStart,
  onStartStep,
  disabled,
}: {
  /** 后端当前 stage(以决定哪步是「进行中」) */
  currentStage: string | undefined;
  /** 项目 status:active/done */
  status?: string;
  /** 当前正在跑的 step(用于 loading 标识) */
  running?: Step | string | Task | null;
  canStart: boolean;
  /** 用户点了某步的「开始」(该步对应后端第一个未完成的 step) */
  onStartStep: (bs: BoardStep) => void;
  disabled?: boolean;
}) {
  const currentIdx = status === 'done' ? 6 : stageToBoardIndex(currentStage);
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const isStepRunning = (bs: BoardStep) =>
    !!running && bs.backendSteps.some((s) => {
      if (typeof running === 'string') return running === s;
      if (typeof running === 'object' && running !== null && 'step' in running) return (running as Task).step === s;
      return bs.backendSteps.includes(running as Step);
    });

  // 手机:五张 180px 的卡片横排要占半屏、还得左右划。换成一行步骤条(序号 + 名字),
  // 下面只留当前这一步的说明和「开始」按钮。
  if (narrow) {
    const current = BOARD_STEPS.find((bs) => bs.index === currentIdx);
    const currentRunning = current ? isStepRunning(current) : false;
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {BOARD_STEPS.map((bs, i) => {
            const isDone = currentIdx > bs.index;
            const isCurrent = currentIdx === bs.index;
            return (
              <React.Fragment key={bs.index}>
                {i > 0 && <Box sx={{ flex: '1 1 0', minWidth: 4, height: 2, borderRadius: 1, bgcolor: isDone || isCurrent ? 'primary.main' : 'divider' }} />}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: isDone || isCurrent ? '#fff' : 'text.secondary',
                      background: isDone || isCurrent ? bs.gradient : 'none',
                      border: isDone || isCurrent ? 0 : '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {isDone ? <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> : bs.index}
                  </Box>
                  <Typography sx={{ fontSize: 10.5, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'text.primary' : 'text.secondary', whiteSpace: 'nowrap' }}>
                    {bs.title}
                  </Typography>
                </Box>
              </React.Fragment>
            );
          })}
        </Box>
        {current && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25 }}>
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
              {current.desc}
            </Typography>
            <Button
              size="small"
              variant="contained"
              disabled={disabled || !canStart || currentRunning}
              onClick={() => onStartStep(current)}
              startIcon={currentRunning ? <CircularProgress size={12} color="inherit" /> : <PlayArrowRoundedIcon sx={{ fontSize: 14 }} />}
              sx={{ flexShrink: 0, textTransform: 'none', fontSize: 12, background: current.gradient, '&:hover': { filter: 'brightness(1.1)' } }}
            >
              {currentRunning ? '生成中…' : `开始「${current.title}」`}
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
        {BOARD_STEPS.map((bs) => {
          const isDone = currentIdx > bs.index;
          const isCurrent = currentIdx === bs.index;
          const isRunning = running && bs.backendSteps.some((s) => {
        if (typeof running === 'string') return running === s;
        if (typeof running === 'object' && running !== null && 'step' in running) {
          return (running as Task).step === s;
        }
        return bs.backendSteps.includes(running as Step);
      });
          return (
            <Box
              key={bs.index}
              sx={{
                position: 'relative',
                flex: '1 1 0',
                minWidth: 180,
                p: 2,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '2px solid',
                borderColor: isCurrent ? 'primary.main' : 'divider',
                boxShadow: isCurrent ? '0 4px 16px rgba(254, 44, 85, 0.15)' : 'none',
                transition: 'all 0.18s',
              }}
            >
              {/* 状态徽标 */}
              <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                {isDone ? (
                  <Chip
                    size="small"
                    color="success"
                    icon={<CheckCircleRoundedIcon sx={{ fontSize: 14 }} />}
                    label="完成"
                    sx={{ height: 20, fontSize: 10 }}
                  />
                ) : isCurrent ? (
                  isRunning ? (
                    <Chip
                      size="small"
                      color="primary"
                      icon={<CircularProgress size={10} sx={{ color: 'primary.main' }} />}
                      label="进行中"
                      sx={{ height: 20, fontSize: 10 }}
                    />
                  ) : (
                    <Chip
                      size="small"
                      color="primary"
                      label="当前"
                      sx={{ height: 20, fontSize: 10 }}
                    />
                  )
                ) : (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<RadioButtonUncheckedRoundedIcon sx={{ fontSize: 14 }} />}
                    label="待办"
                    sx={{ height: 20, fontSize: 10 }}
                  />
                )}
              </Box>

              {/* 图标 */}
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1.5,
                  background: bs.gradient,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1,
                  opacity: isDone || isCurrent ? 1 : 0.45,
                }}
              >
                {bs.icon}
              </Box>

              {/* 标题 */}
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                {bs.index}. {bs.title}
              </Typography>

              {/* 描述 */}
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5, lineHeight: 1.5, minHeight: 44 }}>
                {bs.desc}
              </Typography>

              {/* 后端步骤标签 */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1, mb: 1 }}>
                {bs.backendSteps.map((s) => (
                  <Chip
                    key={s}
                    size="small"
                    label={STEP_LABELS[s] ?? s}
                    variant="outlined"
                    sx={{ height: 18, fontSize: 9 }}
                  />
                ))}
              </Box>

              {/* 操作按钮 */}
              {isCurrent && !isDone && (
                <Tooltip title={canStart ? '' : '需要先配置 LLM 供应商'}>
                  <span>
                    <Button
                      fullWidth
                      size="small"
                      variant="contained"
                      disabled={disabled || !canStart || !!isRunning}
                      onClick={() => onStartStep(bs)}
                      startIcon={
                        isRunning ? (
                          <CircularProgress size={12} color="inherit" />
                        ) : (
                          <PlayArrowRoundedIcon sx={{ fontSize: 14 }} />
                        )
                      }
                      sx={{
                        textTransform: 'none',
                        fontSize: 11,
                        background: bs.gradient,
                        '&:hover': { filter: 'brightness(1.1)' },
                      }}
                    >
                      {isRunning ? '生成中…' : '开始这一步'}
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
