'use client';

// 心境:人生感悟的境界、修习阶梯、每日一问和「为你」。后端见 qingqiuyue-go internal/handler/mind.go。
//
// 境界取青原惟信的三般见解(见山是山 → 见山不是山 → 见山只是山),只由修习算;
// 修习四步:照见(点开一首歌 / 一段短片)→ 体味(一部电影 / 剧 / 书)→ 参悟(读一首诗)→ 自问(回答编者一问)。
// 前三步靠主题页里点开作品时的 topic_event 记下(lib/topicTrack),这里不另埋点。

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMindMe } from '@/components/insight/mindHooks';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import {
  forYou as fetchForYou,
  answer as postAnswer,
  type MindMe,
  type MindStepKey,
  type MindThemeProgress,
} from '@/apis/mind';
import { readNote, writeNote, type InsightTheme } from '@/apis/insight';
import { accentOf } from '@/components/insight/InsightCards';
import { ItemGrid } from '@/components/insight/ThemeWorks';
import { workClickCapture } from '@/lib/topicTrack';
import { loginHref } from '@/lib/auth/redirect';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

const STEP_FALLBACK: { key: MindStepKey; name: string; hint: string }[] = [
  { key: 'see', name: '照见', hint: '点开一首歌或一段短片' },
  { key: 'taste', name: '体味', hint: '看一部电影、剧或一本书' },
  { key: 'grasp', name: '参悟', hint: '读一首诗' },
  { key: 'ask', name: '自问', hint: '回答编者一问，记到心路' },
];

/** 境界那一行:名字 + 原句 + 三境的位置。 */
function StageLine({ m }: { m: MindMe }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, color: 'text.disabled', letterSpacing: '0.2em' }}>
          心境 · 第{['一', '二', '三'][m.stage.level - 1]}境
        </Typography>
        <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 26, md: 30 }, fontWeight: 700, letterSpacing: '0.18em' }}>
          {m.stage.name}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, pb: 1 }}>
        {m.stages.map((s) => (
          <Box
            key={s.level}
            title={s.name}
            sx={{
              width: 28,
              height: 4,
              borderRadius: 2,
              bgcolor: s.level <= m.stage.level ? 'primary.main' : 'divider',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

/** 升下一境的条件,一条一条摆出来。 */
function Needs({ m }: { m: MindMe }) {
  if (!m.next || !m.needs?.length) {
    return (
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1.5 }}>三境都走过了。层都已展开，随你看。</Typography>
    );
  }
  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 1 }}>
        往「{m.next.name}」:{m.next.intro}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
        {m.needs.map((n) => {
          const ok = n.have >= n.need;
          return (
            <Box key={n.key}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, mb: 0.5 }}>
                <Box component="span" sx={{ color: ok ? 'success.main' : 'text.secondary' }}>
                  {ok ? '✓ ' : ''}
                  {n.label}
                </Box>
                <Box component="span" sx={{ color: 'text.disabled' }}>
                  {Math.min(n.have, n.need)} / {n.need}
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (n.have / n.need) * 100)}
                color={ok ? 'success' : 'primary'}
                sx={{ height: 4, borderRadius: 2 }}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * 回答编者一问。登录了记到心路(只有自己看得到);没登录写在本机,和原来的「写给自己」是同一份草稿。
 */
export function AskBox({
  t,
  accent,
  title = '自问',
  compact,
}: {
  t: Pick<InsightTheme, 'key' | 'ask'>;
  accent: string;
  title?: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const m = useMindMe().data;
  const [text, setText] = React.useState('');
  const [state, setState] = React.useState<'' | 'local' | 'saving' | 'saved' | 'error'>('');
  const [err, setErr] = React.useState('');
  React.useEffect(() => {
    setText(readNote(t.key));
    setState('');
  }, [t.key]);
  const answered = !!m?.themes?.[t.key]?.steps.ask;
  const submit = async () => {
    const v = text.trim();
    if (!v) return;
    setState('saving');
    try {
      await postAnswer({ theme: t.key, text: v });
      writeNote(t.key, '');
      setText('');
      setState('saved');
      void qc.invalidateQueries({ queryKey: ['mind'] });
      void qc.invalidateQueries({ queryKey: ['lifepath'] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : '没记上，稍后再试');
      setState('error');
    }
  };
  return (
    <Box
      sx={{
        p: compact ? 0 : { xs: 2, md: 3 },
        borderRadius: 2,
        border: compact ? 'none' : '1px dashed',
        borderColor: 'divider',
      }}
    >
      {!compact && (
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{title}</Typography>
          {answered && <Typography sx={{ fontSize: 11, color: 'success.main' }}>✓ 答过了，可以再答</Typography>}
        </Box>
      )}
      <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mb: 1.5, lineHeight: 1.8 }}>
        <Box component="span" sx={{ color: accent, mr: 1 }}>
          问
        </Box>
        {t.ask}
      </Typography>
      <TextField
        multiline
        minRows={compact ? 2 : 3}
        fullWidth
        size="small"
        placeholder="想到什么就写什么"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (state !== 'saving') setState('');
        }}
        onBlur={() => {
          writeNote(t.key, text);
          if (!m?.loggedIn && text.trim()) setState('local');
        }}
        slotProps={{ htmlInput: { maxLength: 300 } }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
        {m?.loggedIn ? (
          <Button size="small" variant="contained" disabled={!text.trim() || state === 'saving'} onClick={submit}>
            记到心路
          </Button>
        ) : (
          <Button size="small" variant="outlined" href={loginHref()}>
            登录后记到心路
          </Button>
        )}
        <Typography sx={{ fontSize: 11, color: state === 'error' ? 'error.main' : 'text.disabled' }}>
          {state === 'saved'
            ? '记下了，在「我的心路」里，只有你自己看得到。'
            : state === 'error'
              ? err
              : state === 'local'
                ? '草稿存在这台设备上。'
                : m?.loggedIn
                  ? '只有你自己看得到。'
                  : '没登录时只保存在这台设备上。'}
        </Typography>
      </Box>
    </Box>
  );
}

/** 主题页的修习阶梯:四步 + 这个主题的回廊。 */
export function PracticeLadder({ themeKey, accent, hasJourney }: { themeKey: string; accent: string; hasJourney?: boolean }) {
  const q = useMindMe();
  const m = q.data;
  const steps = m?.steps ?? STEP_FALLBACK;
  const p: MindThemeProgress | undefined = m?.themes?.[themeKey];
  const doneN = steps.filter((s) => p?.steps[s.key]).length;
  const next = steps.find((s) => !p?.steps[s.key]);
  return (
    <Box sx={{ mb: 4, p: { xs: 2, md: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>修习</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
          {m?.loggedIn
            ? doneN === steps.length
              ? '这个主题四步都走过了'
              : `${doneN} / ${steps.length} · 下一步:${next?.name}，${next?.hint}`
            : '由浅入深四步，登录后记下你走到哪'}
        </Typography>
        {m && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 'auto' }}>
            心境 · {m.stage.name}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
        {steps.map((s, i) => {
          const done = !!p?.steps[s.key];
          const isNext = m?.loggedIn && next?.key === s.key;
          return (
            <Box
              key={s.key}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: done ? accent : isNext ? 'text.secondary' : 'divider',
                bgcolor: done ? `color-mix(in srgb, ${accent} 12%, transparent)` : 'transparent',
              }}
            >
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>第{i + 1}步</Typography>
              <Typography sx={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: done ? accent : 'text.primary' }}>
                {done ? '✓ ' : ''}
                {s.name}
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.6 }}>{s.hint}</Typography>
            </Box>
          );
        })}
      </Box>
      {hasJourney && (
        <Typography sx={{ fontSize: 12, color: p?.journey ? 'success.main' : 'text.disabled', mt: 1.25 }}>
          {p?.journey ? '✓ 回廊也走过了' : '走完上面的回廊，另记一笔修为'}
        </Typography>
      )}
      {!m?.loggedIn && !q.isLoading && (
        <Button size="small" href={loginHref()} sx={{ mt: 1, px: 0 }}>
          登录开始修习 →
        </Button>
      )}
    </Box>
  );
}

/** 首页的心境卡:境界、升境条件、今天的一问、为你(接着修 + 去走走)。 */
export function MindCard() {
  const router = useRouter();
  const q = useMindMe();
  const fy = useQuery({ queryKey: ['mind', 'foryou'], queryFn: fetchForYou, staleTime: 60_000 });
  const m = q.data;
  if (q.isLoading) return <Skeleton variant="rounded" height={260} sx={{ mb: 5 }} />;
  if (!m) return null;
  const open = (k: string) => router.push(`/insight/theme?key=${encodeURIComponent(k)}`);
  const todayAccent = accentOf(m.today.theme.group);
  const steps = m.steps ?? STEP_FALLBACK;
  const stepName = (k: string) => steps.find((s) => s.key === k)?.name ?? k;
  return (
    <Box sx={{ mb: 5, p: { xs: 2.5, md: 3.5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: { xs: 3, md: 4 } }}>
        <Box sx={{ minWidth: 0 }}>
          <StageLine m={m} />
          <Typography sx={{ fontFamily: SERIF, fontSize: 13, color: 'text.secondary', mt: 1 }}>
            「{m.stage.line}」—— {m.stageSrc}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1, lineHeight: 1.8 }}>{m.stage.intro}</Typography>
          {m.loggedIn ? (
            <>
              <Needs m={m} />
              <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 1.5 }}>
                修为 {m.counts?.score ?? 0}
                {m.streak ? ` · 连续自问 ${m.streak} 天` : ''} · 境界只由修习算，和积分、等级无关
              </Typography>
            </>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.8 }}>
                每个主题由浅入深四步:照见 → 体味 → 参悟 → 自问。走得越深，默认给你看的作品越深;更深的层一直都在，随时可以展开。
              </Typography>
              <Button size="small" variant="outlined" href={loginHref()} sx={{ mt: 1.5 }}>
                登录开始修习
              </Button>
            </Box>
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: 12, color: 'text.disabled', letterSpacing: '0.1em' }}>每日一问 · {m.today.date}</Typography>
            <Typography
              onClick={() => open(m.today.theme.key)}
              sx={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: todayAccent, cursor: 'pointer' }}
            >
              {m.today.theme.name}
            </Typography>
          </Box>
          {m.today.answered ? (
            <Typography sx={{ fontSize: 13.5, color: 'text.secondary', lineHeight: 1.8 }}>
              <Box component="span" sx={{ color: todayAccent, mr: 1 }}>
                问
              </Box>
              {m.today.theme.ask}
              <Box component="span" sx={{ display: 'block', fontSize: 12, color: 'success.main', mt: 1 }}>
                ✓ 今天答过了，明天换一问。
              </Box>
            </Typography>
          ) : (
            <AskBox t={m.today.theme} accent={todayAccent} compact />
          )}
        </Box>
      </Box>

      {(fy.data?.continue.length ?? 0) > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, mb: 1.5 }}>{m.loggedIn ? '接着修' : '从今天的主题开始'}</Typography>
          {fy.data!.continue.map((c) => {
            const accent = accentOf(c.theme.group);
            return (
              <Box key={c.theme.key} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
                  <Typography
                    onClick={() => open(c.theme.key)}
                    sx={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: accent, cursor: 'pointer' }}
                  >
                    {c.theme.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {steps.map((s) => (
                      <Box
                        key={s.key}
                        title={s.name}
                        sx={{ width: 16, height: 4, borderRadius: 2, bgcolor: c.steps[s.key] ? accent : 'divider' }}
                      />
                    ))}
                  </Box>
                  {c.next && (
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      下一步 · {stepName(c.next)}:{steps.find((s) => s.key === c.next)?.hint}
                    </Typography>
                  )}
                  <Typography onClick={() => open(c.theme.key)} sx={{ fontSize: 12, color: accent, cursor: 'pointer', ml: 'auto' }}>
                    进入 →
                  </Typography>
                </Box>
                {c.next === 'ask' ? (
                  <AskBox t={c.theme} accent={accent} compact />
                ) : (c.items?.length ?? 0) > 0 ? (
                  // 在这里点开也算这个主题的一步(同一个 topic_event)
                  <Box onClickCapture={workClickCapture(c.theme.key)}>
                    <ItemGrid list={c.items!} accent={accent} showType compact />
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Box>
      )}

      {(fy.data?.explore.length ?? 0) > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: 13, color: 'text.disabled', mb: 1 }}>还没走过</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {fy.data!.explore.map((t) => (
              <Box
                key={t.key}
                onClick={() => open(t.key)}
                sx={{
                  px: 1.75,
                  py: 0.75,
                  borderRadius: 5,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { borderColor: accentOf(t.group) },
                }}
              >
                <Box component="span" sx={{ fontFamily: SERIF, fontSize: 15, color: accentOf(t.group) }}>
                  {t.name}
                </Box>
                {t.why && (
                  <Box component="span" sx={{ fontSize: 11, color: 'text.disabled', ml: 1 }}>
                    {t.why}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
