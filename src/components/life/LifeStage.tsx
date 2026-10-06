'use client';

// 人生轮回的舞台:一世,一场一场地活(docs/LIFE-CYCLE.md)。
//
// 一场际遇 = 一串镜头。点一下往下走;到抉择处必须选,到反问处可以写也可以跳过。
// 一场过去了,年岁往前走,再进下一场;一生走完进「一生回看」:写一句、挑一样东西带进下一世。
// 一世之内不能回档 —— 想看另一条路,就再活一世。
// 舞台固定深色,不跟站点主题走。

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  getRun,
  lifeChoose,
  lifeChooseFree,
  lifeExplore,
  lifeFinish,
  lifeNext,
  lifePlace,
  lifeReflect,
  lifeReview,
  lifeTap,
  lifeTick,
  type LifeEcho,
  type LifeFrame,
  type LifeHistEntry,
  type LifeMark,
  type LifePlace,
  type LifeRun,
  type LifeSecret,
  type LifeStepResult,
  type LifeView,
} from '@/apis/life';
import { errMessage } from '@/lib/errMessage';

export const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';
const ACCENT = '#C8A27A';
const WORDS_MAX = 300;
const FREE_MAX = 200;

/** 镜头底色:没有画面素材时就靠它 */
const TONES: Record<string, string> = {
  dawn: 'linear-gradient(180deg, #1d2236 0%, #4a4458 55%, #8c6e5c 100%)',
  day: 'linear-gradient(180deg, #24303c 0%, #3c4c5c 60%, #5d6f7e 100%)',
  dusk: 'linear-gradient(180deg, #1b1622 0%, #3e2632 55%, #7a4436 100%)',
  night: 'linear-gradient(180deg, #07090f 0%, #0f1424 60%, #1a2236 100%)',
  rain: 'linear-gradient(180deg, #11161b 0%, #1f282f 60%, #2f3a42 100%)',
  snow: 'linear-gradient(180deg, #1f252d 0%, #39424d 60%, #6a737d 100%)',
  dark: '#0c0c10',
};
const toneOf = (t?: string) => TONES[t || ''] || TONES.dark;

/** 一句宇宙说的话 / 宿慧:淡入,停一会儿 */
function Says({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      {lines.map((s, i) => (
        <Typography
          key={`${i}-${s}`}
          sx={{
            fontFamily: SERIF,
            fontSize: 14,
            color: 'rgba(255,255,255,0.62)',
            fontStyle: 'italic',
            lineHeight: 1.9,
            animation: 'lifeFade 1.2s ease both',
            animationDelay: `${i * 0.5}s`,
            '@keyframes lifeFade': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
          }}
        >
          {s}
        </Typography>
      ))}
    </Box>
  );
}

function LifeHud({ life, run, onBack }: { life?: LifeView; run?: LifeRun; onBack: () => void }) {
  return (
    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 1, px: { xs: 1, md: 2 }, py: 1, zIndex: 2 }}>
      <IconButton onClick={onBack} aria-label="返回" sx={{ color: 'rgba(255,255,255,0.8)' }}>
        <ArrowBackIcon />
      </IconButton>
      {life && (
        <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          第 {life.no} 世{run ? ` · ${run.universeName}` : ''} · {Math.floor(life.age)} 岁{life.stageName ? ` · ${life.stageName}` : ''}
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      {life?.vars &&
        Object.entries(life.vars).map(([k, v]) => (
          <Chip
            key={k}
            size="small"
            label={`${k} ${Math.round(v)}`}
            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', fontSize: 12, display: { xs: k.length > 2 ? 'none' : 'flex', sm: 'flex' } }}
          />
        ))}
    </Box>
  );
}

function EchoLine({ echo, options }: { echo: LifeEcho; options: string[] }) {
  const same = echo.counts[String(echo.mine)] || 0;
  const other = echo.other;
  return (
    <Box sx={{ mt: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.9 }}>
      <Typography sx={{ fontSize: 13 }}>
        {echo.total === 0 ? '坐在这个位置上的人里,你是第一个走到这儿的。' : `坐在这个位置上的 ${echo.total} 个人里,${same} 个和你选得一样。`}
      </Typography>
      {echo.total > 0 && (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          {options.map((o, i) => `${o} ${echo.counts[String(i)] || 0}`).join(' · ')}
        </Typography>
      )}
      {other && other.total > 0 && (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>
          那时坐在「{other.seatName}」位置上的人:{Object.entries(other.counts).map(([l, n]) => `${l} ${n}`).join(' · ')}
        </Typography>
      )}
    </Box>
  );
}

function Care() {
  return (
    <Box sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.9 }}>
      如果这些话也是你此刻的心情,不用一个人扛着。可以打 12356(全国心理援助热线)或 400-161-9995(希望 24 热线),
      有人会接,会听你说完。
    </Box>
  );
}

// ── 一场 ──────────────────────────────────────────────────────────────

/** 限时题的倒计时条(按题的 id 换 key,重新计时) */
function Countdown({ wait }: { wait: number }) {
  const [until] = React.useState(() => Date.now() + wait);
  const [left, setLeft] = React.useState(1);
  React.useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, (until - Date.now()) / wait)), 200);
    return () => clearInterval(t);
  }, [until, wait]);
  return <LinearProgress variant="determinate" value={left * 100} sx={{ mb: 1.5, height: 2, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />;
}

/** 反问:可以写,也可以跳过(按问题的 id 换 key,输入框清空) */
function ReflectBox({ question, busy, onReflect }: { question: string; busy: boolean; onReflect: (text: string) => void }) {
  const [text, setText] = React.useState('');
  return (
    <Box sx={{ mt: 3 }} onClick={(e) => e.stopPropagation()}>
      <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 18, md: 21 }, lineHeight: 1.9, mb: 2 }}>{question}</Typography>
      <TextField
        multiline
        minRows={3}
        maxRows={8}
        fullWidth
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, WORDS_MAX))}
        placeholder="写给自己,只有你看得到"
        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.35)', fontSize: 15, lineHeight: 1.9 } }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.2 }}>
        <Button size="small" disabled={busy} onClick={() => onReflect('')} sx={{ color: 'rgba(255,255,255,0.5)' }}>
          跳过
        </Button>
        <Button size="small" variant="outlined" disabled={busy || !text.trim()} onClick={() => onReflect(text.trim())} sx={{ borderColor: ACCENT, color: ACCENT }}>
          写下
        </Button>
      </Box>
    </Box>
  );
}

/** 用自己的话:回答一道题,或在这里做点什么。交给这个宇宙推演(要等一会儿) */
function FreeBox({ hint, busy, onSubmit }: { hint: string; busy: boolean; onSubmit: (text: string) => void }) {
  const [text, setText] = React.useState('');
  return (
    <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'flex-start' }} onClick={(e) => e.stopPropagation()}>
      <TextField
        size="small"
        fullWidth
        multiline
        maxRows={4}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, FREE_MAX))}
        placeholder={hint}
        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.35)', fontSize: 14 } }}
      />
      <Button
        variant="outlined"
        disabled={busy || !text.trim()}
        onClick={() => onSubmit(text.trim())}
        sx={{ flexShrink: 0, borderColor: ACCENT, color: ACCENT, minWidth: 64, py: 0.9 }}
      >
        推演
      </Button>
    </Box>
  );
}

/** 见到了一个奥秘 */
function Unveiled({ list }: { list: LifeSecret[] }) {
  return (
    <>
      {list.map((s) => (
        <Box
          key={s.key}
          sx={{ my: 2, p: 2, borderRadius: 1, border: '1px solid', borderColor: ACCENT, bgcolor: 'rgba(200,162,122,0.08)', animation: 'lifeIn 1.2s ease both' }}
        >
          <Typography sx={{ fontSize: 11, color: ACCENT, letterSpacing: '0.3em', mb: 0.8 }}>{s.all ? '跨宇宙的奥秘' : '奥秘'} · {s.key}</Typography>
          <Typography sx={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.9 }}>{s.text}</Typography>
        </Box>
      ))}
    </>
  );
}

/** 两场之间能去的地方 */
function Places({ places, busy, onPlace }: { places: LifePlace[]; busy: boolean; onPlace: (key: string) => void }) {
  if (places.length === 0) return null;
  return (
    <Box sx={{ mt: 3, mb: 1 }}>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', mb: 1 }}>往下活之前,也可以去</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {places.map((p) => (
          <Button key={p.key} size="small" variant="outlined" disabled={busy} onClick={() => onPlace(p.key)} title={p.intro}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }}>
            {p.name}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

function Scene({
  frame,
  busy,
  echo,
  care,
  places,
  onTap,
  onChoose,
  onReflect,
  onNext,
  onFree,
  onExplore,
  onPlace,
}: {
  frame: LifeFrame;
  busy: boolean;
  echo?: { echo: LifeEcho; options: string[] };
  care: boolean;
  places: LifePlace[];
  onTap: () => void;
  onChoose: (i: number) => void;
  onReflect: (text: string) => void;
  onNext: () => void;
  onFree: (text: string) => void;
  onExplore: (text: string) => void;
  onPlace: (key: string) => void;
}) {
  const shot = frame.shot;
  const choice = frame.choice;
  const waiting = !!choice || !!frame.reflect;
  const clickable = !waiting && !frame.ended && !busy;
  return (
    <Box
      onClick={clickable ? onTap : undefined}
      sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', px: { xs: 2.5, md: 8 }, pb: { xs: 5, md: 8 }, pt: 10, cursor: clickable ? 'pointer' : 'default' }}
    >
      <Box sx={{ maxWidth: 640, width: '100%', mx: 'auto' }}>
        <Typography sx={{ fontSize: 12, color: ACCENT, letterSpacing: '0.3em', mb: 2 }}>
          {frame.name} · {frame.seatName}
        </Typography>
        <Says lines={frame.says || []} />
        {shot?.caption && (
          <Typography key={shot.id + 'c'} sx={{ fontFamily: SERIF, fontSize: { xs: 19, md: 23 }, lineHeight: 2, letterSpacing: '0.04em', mb: 2, animation: 'lifeIn .8s ease both', '@keyframes lifeIn': { from: { opacity: 0 }, to: { opacity: 1 } } }}>
            {shot.caption}
          </Typography>
        )}
        {shot?.line && (
          <Box key={shot.id + 'l'} sx={{ mb: 2, animation: 'lifeIn .8s ease .2s both' }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>{shot.whoName || '有人'}</Typography>
            <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 20, md: 24 }, lineHeight: 1.9 }}>「{shot.line}」</Typography>
          </Box>
        )}

        {!!frame.unveiled?.length && <Unveiled list={frame.unveiled} />}

        {choice && (
          <Box sx={{ mt: 3 }} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', mb: 1.5 }}>{choice.text}</Typography>
            {!!choice.wait && <Countdown key={choice.id} wait={choice.wait} />}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              {choice.options.map((o, i) => (
                <Button
                  key={o.label}
                  disabled={busy}
                  onClick={() => onChoose(i)}
                  variant="outlined"
                  sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1.3, px: 2, fontSize: 15, borderColor: 'rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.92)', '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(200,162,122,0.08)' } }}
                >
                  {o.label}
                </Button>
              ))}
            </Box>
            {choice.free && <FreeBox key={choice.id} hint={choice.free} busy={busy} onSubmit={onFree} />}
          </Box>
        )}

        {frame.reflect && <ReflectBox key={frame.reflect.id} question={frame.reflect.text} busy={busy} onReflect={onReflect} />}

        {echo && !choice && <EchoLine echo={echo.echo} options={echo.options} />}
        {care && <Care />}

        {frame.explore && !waiting && !frame.ended && <FreeBox key={(shot?.id || '') + frame.juncture} hint="在这里,你想做点什么……" busy={busy} onSubmit={onExplore} />}
        {frame.ended && !frame.died && <Places places={places} busy={busy} onPlace={onPlace} />}

        {!waiting && (
          <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
            {frame.ended ? (
              <Button variant="contained" disabled={busy} onClick={onNext} sx={{ minWidth: 180, bgcolor: ACCENT, color: '#1a1410', '&:hover': { bgcolor: ACCENT, filter: 'brightness(1.08)' } }}>
                {frame.died ? '这一生' : frame.place ? '离开这里,往下活' : '往下活'}
              </Button>
            ) : (
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>{busy ? '这个世界在想……' : frame.place && !shot?.hasNext ? '点一下,离开这里' : '点一下,往下走'}</Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── 两场之间 / 一世开头 ────────────────────────────────────────────────

function Interlude({
  life,
  says,
  busy,
  places,
  onNext,
  onPlace,
}: {
  life?: LifeView;
  says: string[];
  busy: boolean;
  places: LifePlace[];
  onNext: () => void;
  onPlace: (key: string) => void;
}) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', px: { xs: 2.5, md: 8 } }}>
      <Box sx={{ maxWidth: 640, width: '100%', mx: 'auto' }}>
        {life && (
          <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 44, md: 60 }, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.1em', mb: 1 }}>
            {Math.floor(life.age)}
            <Box component="span" sx={{ fontSize: '0.4em', ml: 1, color: 'rgba(255,255,255,0.5)' }}>
              岁{life.stageName ? ` · ${life.stageName}` : ''}
            </Box>
          </Typography>
        )}
        <Says lines={says} />
        <Places places={places} busy={busy} onPlace={onPlace} />
        <Button variant="contained" disabled={busy} onClick={onNext} sx={{ mt: 2, minWidth: 180, bgcolor: ACCENT, color: '#1a1410', '&:hover': { bgcolor: ACCENT, filter: 'brightness(1.08)' } }}>
          {busy ? '…' : '往下活'}
        </Button>
      </Box>
    </Box>
  );
}

// ── 一生回看 ──────────────────────────────────────────────────────────

function Review({ runId, onAgain }: { runId: string; onAgain: () => void }) {
  const [data, setData] = React.useState<{ run: LifeRun; life: LifeView; history: LifeHistEntry[]; marks: LifeMark[] }>();
  const [words, setWords] = React.useState('');
  const [mark, setMark] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [care, setCare] = React.useState(false);
  React.useEffect(() => {
    lifeReview(runId).then(setData, (e) => setErr(errMessage(e) || '出错了,稍后再试'));
  }, [runId]);
  if (!data) return <Box sx={{ p: 4, color: 'rgba(255,255,255,0.6)' }}>{err || '…'}</Box>;
  const { run, life, history, marks } = data;
  const done = run.status === 'done';
  const finish = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await lifeFinish(runId, words.trim(), mark);
      setCare(!!r.care);
      setData({ ...data, run: r.run });
    } catch (e) {
      setErr(errMessage(e) || '出错了,稍后再试');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box sx={{ minHeight: '100dvh', px: { xs: 2.5, md: 8 }, pt: 10, pb: 8 }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        <Typography sx={{ fontSize: 12, color: ACCENT, letterSpacing: '0.3em', mb: 1 }}>
          第 {run.no} 世 · {run.universeName}
        </Typography>
        <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 34 }, letterSpacing: '0.08em', mb: 1 }}>
          {Math.floor(life.age)} 岁{life.cause ? `,${life.cause}` : ''}
        </Typography>
        {run.origin && (
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', mb: 4 }}>
            {[run.origin.birthYear && `${run.origin.birthYear} 年生`, run.origin.family, run.origin.gender, run.origin.temper && `性子${run.origin.temper}`, run.origin.sibling]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        )}

        <Box sx={{ borderLeft: '1px solid rgba(255,255,255,0.15)', pl: 2.5, mb: 5 }}>
          {history.map((h, i) => (
            <Box key={i} sx={{ mb: 3, position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: -25, top: 7, width: 9, height: 9, borderRadius: '50%', bgcolor: ACCENT }} />
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                {Math.floor(h.age)} 岁 · {h.seatName}
              </Typography>
              <Typography sx={{ fontFamily: SERIF, fontSize: 18, mb: 0.5 }}>{h.name}</Typography>
              {h.choices?.map((c, k) => (
                <React.Fragment key={k}>
                  <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
                    {c.auto ? '没来得及选:' : ''}
                    {c.label}
                    {c.feel && <Box component="span" sx={{ color: 'rgba(255,255,255,0.4)', ml: 1 }}>{c.feel}</Box>}
                  </Typography>
                  {c.free && (
                    <Typography sx={{ fontFamily: SERIF, fontSize: 13, color: 'rgba(255,255,255,0.55)', ml: 1.5 }}>你说:「{c.free}」</Typography>
                  )}
                </React.Fragment>
              ))}
              {h.words?.map((w, k) => (
                <Typography key={k} sx={{ fontFamily: SERIF, fontSize: 14, color: 'rgba(255,255,255,0.6)', mt: 0.5, lineHeight: 1.8 }}>
                  「{w.text}」
                </Typography>
              ))}
            </Box>
          ))}
        </Box>

        {done ? (
          <Box>
            {run.words && <Typography sx={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.9, mb: 2 }}>「{run.words}」</Typography>}
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', mb: 3 }}>
              {run.mark ? `你带走了「${run.mark}」。` : '你什么也没带走。'}这一世已记进
              <Box component="a" href="/insight/path" sx={{ color: ACCENT, textDecoration: 'none', mx: 0.5 }}>
                你的心路
              </Box>
            </Typography>
            {care && <Care />}
            <Button variant="contained" onClick={onAgain} sx={{ mt: 2, bgcolor: ACCENT, color: '#1a1410', '&:hover': { bgcolor: ACCENT, filter: 'brightness(1.08)' } }}>
              再入轮回
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 19, md: 22 }, mb: 2 }}>这一生,你想说什么?</Typography>
            <TextField
              multiline
              minRows={3}
              fullWidth
              value={words}
              onChange={(e) => setWords(e.target.value.slice(0, WORDS_MAX))}
              placeholder="可以不写"
              sx={{ mb: 3, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.35)', fontSize: 15, lineHeight: 1.9 } }}
            />
            <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', mb: 1.5 }}>
              {marks.length > 0 ? '挑一样,带进下一世' : '这一世没有留下什么要带走的东西'}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              {marks.map((m) => (
                <Box
                  key={m.key}
                  onClick={() => setMark(mark === m.key ? '' : m.key)}
                  sx={{ p: 1.5, borderRadius: 1, cursor: 'pointer', border: '1px solid', borderColor: mark === m.key ? ACCENT : 'rgba(255,255,255,0.15)', bgcolor: mark === m.key ? 'rgba(200,162,122,0.08)' : 'transparent' }}
                >
                  <Typography sx={{ fontSize: 15 }}>
                    {m.key}
                    {m.kind && <Box component="span" sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', ml: 1 }}>{m.kind}</Box>}
                  </Typography>
                  {m.text && <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', mt: 0.3 }}>{m.text}</Typography>}
                </Box>
              ))}
            </Box>
            {err && <Typography sx={{ color: 'error.main', fontSize: 13, mb: 1 }}>{err}</Typography>}
            <Button variant="contained" disabled={busy} onClick={finish} sx={{ bgcolor: ACCENT, color: '#1a1410', '&:hover': { bgcolor: ACCENT, filter: 'brightness(1.08)' } }}>
              {mark ? '带着它,放下这一世' : '放下这一世'}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── 舞台 ──────────────────────────────────────────────────────────────

/** 投胎时宇宙说的话,带到舞台上第一屏(页面跳转之间) */
export const pendingSays = new Map<string, string[]>();

function Stage({ runId }: { runId: string }) {
  const router = useRouter();
  const [run, setRun] = React.useState<LifeRun>();
  const [life, setLife] = React.useState<LifeView>();
  const [frame, setFrame] = React.useState<LifeFrame>();
  const [says, setSays] = React.useState<string[]>(() => pendingSays.get(runId) || []);
  const [echo, setEcho] = React.useState<{ echo: LifeEcho; options: string[] }>();
  const [care, setCare] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [review, setReview] = React.useState(false);
  const [places, setPlaces] = React.useState<LifePlace[]>([]);

  React.useEffect(() => {
    pendingSays.delete(runId);
    getRun(runId).then(
      (r) => {
        setRun(r.run);
        setLife(r.life);
        if (r.frame) setFrame(r.frame);
        if (r.run.status !== 'alive') setReview(true);
        setPlaces(r.places || []);
      },
      (e) => setErr(errMessage(e) || '出错了,稍后再试'),
    );
  }, [runId]);

  const apply = React.useCallback((r: LifeStepResult) => {
    if (r.run) setRun(r.run);
    setCare(!!r.care);
    setPlaces(r.places || []);
    if (r.frame) {
      setFrame(r.frame);
      setLife(r.frame.life);
      if (r.frame.echo) {
        setEcho((prev) => (r.frame!.echo ? { echo: r.frame!.echo, options: prev?.options || [] } : prev));
      }
    } else {
      setFrame(undefined);
      if (r.life) setLife(r.life);
      setSays(r.says || []);
    }
    if (r.died) setReview(true);
  }, []);

  const call = async (fn: () => Promise<LifeStepResult>) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      apply(await fn());
    } catch (e) {
      setErr(errMessage(e) || '出错了,稍后再试');
    } finally {
      setBusy(false);
    }
  };

  // 限时题 / wait 到点
  React.useEffect(() => {
    if (!frame?.nextTimer) return;
    const t = setTimeout(() => void call(() => lifeTick(runId)), frame.nextTimer + 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, runId]);

  const next = () => {
    setEcho(undefined);
    if (frame?.died) {
      setReview(true);
      return;
    }
    void call(async () => {
      const r = await lifeNext(runId);
      if (r.frame) setSays([]);
      return r;
    });
  };
  const choose = (i: number) => {
    const options = frame?.choice?.options.map((o) => o.label) || [];
    setEcho({ echo: { total: 0, counts: {}, mine: i }, options });
    void call(async () => {
      const r = await lifeChoose(runId, frame!.choice!.id, i);
      if (!r.frame?.echo) setEcho(undefined);
      return r;
    });
  };
  const tap = () => {
    setEcho(undefined);
    void call(() => lifeTap(runId));
  };
  const free = (text: string) => {
    const options = frame?.choice?.options.map((o) => o.label) || [];
    setEcho(undefined);
    void call(async () => {
      const r = await lifeChooseFree(runId, frame!.choice!.id, text);
      if (r.frame?.echo) setEcho({ echo: r.frame.echo, options });
      return r;
    });
  };
  const explore = (text: string) => void call(() => lifeExplore(runId, text));
  const goPlace = (key: string) => {
    setEcho(undefined);
    void call(() => lifePlace(runId, key));
  };

  const back = () => router.push('/life');
  const bg = review ? TONES.dark : toneOf(frame?.shot?.tone);
  return (
    <Box sx={{ position: 'relative', minHeight: '100dvh', color: 'text.primary', overflowX: 'hidden', background: bg, transition: 'background 1.2s ease' }}>
      {frame?.shot?.image && !review && (
        <Box
          component="img"
          src={frame.shot.image}
          alt=""
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
        />
      )}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.65) 100%)', pointerEvents: 'none' }} />
      <LifeHud life={life} run={run} onBack={back} />
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {review ? (
          <Review runId={runId} onAgain={() => router.push('/life')} />
        ) : frame ? (
          <Scene
            frame={frame}
            busy={busy}
            echo={echo}
            care={care}
            places={places}
            onTap={tap}
            onChoose={choose}
            onFree={free}
            onExplore={explore}
            onPlace={goPlace}
            onReflect={(t) => void call(() => lifeReflect(runId, frame.reflect!.id, t))}
            onNext={next}
          />
        ) : run ? (
          <Interlude life={life} says={says} busy={busy} places={places} onNext={next} onPlace={goPlace} />
        ) : null}
        {err && (
          <Typography sx={{ position: 'fixed', bottom: 16, left: 0, right: 0, textAlign: 'center', color: '#ff8a80', fontSize: 13, zIndex: 3 }}>{err}</Typography>
        )}
      </Box>
    </Box>
  );
}

/** 舞台固定深色:嵌一层深色主题,字体等沿用站点主题。 */
export function DarkStage({ children }: { children: React.ReactNode }) {
  const outer = useTheme();
  const dark = React.useMemo(
    () =>
      createTheme({
        palette: { mode: 'dark', background: { default: '#0c0c10', paper: '#16161c' } },
        typography: { fontFamily: outer.typography.fontFamily },
        shape: outer.shape,
      }),
    [outer.typography.fontFamily, outer.shape],
  );
  return <ThemeProvider theme={dark}>{children}</ThemeProvider>;
}

export default function LifeStage({ runId }: { runId: string }) {
  return (
    <DarkStage>
      <Stage runId={runId} />
    </DarkStage>
  );
}
