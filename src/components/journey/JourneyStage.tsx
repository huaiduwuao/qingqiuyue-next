'use client';

// 回廊的舞台:一次只演一拍。
//
// 走法:开场 → 一拍一拍往下(按钮 / 方向键 / 滚轮 / 上划),到抉择处必须选,到落笔处可以写也可以跳过。
// 走过的拍子可以往回翻着看,但选过的不能改 —— 想换一条路就「重走」。
// 进度每一拍都存在本机:中途点进一部作品再回来,接着走。
//
// 没登录也能走完:选择只留在本机、不计入回声,落笔也只留在本机。
// 舞台固定用深色,不跟站点主题走 —— 影像要压得住字。

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { CoverImage } from '@/components/common/CoverImage';
import { InsightCard, accentOf } from '@/components/insight/InsightCards';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { useContentNavigate } from '@/lib/contentRoute';
import {
  choose,
  clearLocal,
  finish,
  nodeData,
  readLocal,
  restart,
  writeLocal,
  writeNote,
  type JourneyLocal,
  type JourneyMine,
  type JourneyNode,
  type JourneyNodeData,
  type JourneyScript,
} from '@/apis/journey';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';
const NOTE_MAX = 200;
const STEP_COOLDOWN = 700; // 滚轮 / 划动连着触发时,两拍之间至少隔这么久
const SWIPE_MIN = 60;

const EMPTY: JourneyLocal = { trail: [], choices: {}, notes: {} };

const nodeOf = (s: JourneyScript, id?: string) => s.nodes.find((n) => n.id === id);

/** 按已有的选择从 start 往下走,走到第一处没选的抉择或结局为止。 */
function walk(s: JourneyScript, choices: Record<string, string>): string[] {
  const trail: string[] = [];
  let id: string | undefined = s.start;
  for (let i = 0; i < 64 && id; i++) {
    const n = nodeOf(s, id);
    if (!n) break;
    trail.push(n.id);
    if (n.type === 'ending') break;
    if (n.type === 'choice') {
      const o = n.options?.find((x) => x.key === choices[n.id]);
      if (!o) break;
      id = o.next;
    } else {
      id = n.next;
    }
  }
  return trail;
}

/** 这一趟每处抉择的感受词,结局卡上用。 */
function feelsOf(s: JourneyScript, local: JourneyLocal): string[] {
  return local.trail
    .map((id) => nodeOf(s, id))
    .filter((n): n is JourneyNode => !!n && n.type === 'choice')
    .map((n) => n.options?.find((o) => o.key === local.choices[n.id]))
    .map((o) => o?.feel || o?.label || '')
    .filter(Boolean);
}

function useNodeData(key: string, n: JourneyNode | undefined) {
  const need = !!n && (n.type === 'scene' ? !!n.media : n.type === 'reveal' || n.type === 'echo' || n.type === 'ending');
  return useQuery({
    queryKey: ['journey-node', key, n?.id],
    queryFn: () => nodeData(key, n!.id),
    enabled: need,
    // 回声和结局人数要新的;内容类的后端自己缓存了十分钟
    staleTime: n?.type === 'echo' || n?.type === 'ending' ? 0 : 5 * 60_000,
  });
}

// ── 各种拍子 ──────────────────────────────────────────────────────────────

function Quote({ line, src, accent, size }: { line: string; src?: string; accent: string; size?: number | object }) {
  return (
    <Box>
      <Typography
        sx={{
          fontFamily: SERIF,
          fontSize: size ?? { xs: 24, md: 32 },
          lineHeight: 1.8,
          letterSpacing: '0.1em',
          textWrap: 'balance',
        }}
      >
        {line}
      </Typography>
      {src && <Typography sx={{ fontSize: 12, color: accent, mt: 1.5, letterSpacing: '0.08em' }}>—— {src}</Typography>}
    </Box>
  );
}

function SceneBeat({ n, data, accent }: { n: JourneyNode; data?: JourneyNodeData; accent: string }) {
  const go = useContentNavigate();
  const m = data?.media;
  return (
    <Box>
      {n.line && <Quote line={n.line} src={n.lineSrc} accent={accent} />}
      {n.caption && (
        <Typography
          sx={{ fontSize: { xs: 15, md: 16 }, lineHeight: 2, color: 'text.secondary', mt: n.line ? 4 : 0, maxWidth: 560 }}
        >
          {n.caption}
        </Typography>
      )}
      {m && (
        <Box
          onClick={() => go(m.contentType, m.id)}
          sx={{
            mt: 5,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            maxWidth: '100%',
            px: 1.5,
            py: 0.75,
            borderRadius: 5,
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.18)',
            bgcolor: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(6px)',
            '&:hover': { borderColor: accent },
          }}
        >
          <Typography sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0 }}>画面</Typography>
          <Typography sx={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.contentType === 'POETRY' ? `${m.author || ''}《${m.title}》` : `《${m.title}》`}
          </Typography>
          <Typography sx={{ fontSize: 11, color: accent, flexShrink: 0 }}>
            {m.avail === 'play' ? '去看 ›' : m.avail === 'read' ? '去读 ›' : '详情 ›'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function ChoiceBeat({
  n,
  picked,
  accent,
  onPick,
}: {
  n: JourneyNode;
  picked?: string;
  accent: string;
  onPick: (key: string) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 20, md: 24 }, lineHeight: 1.8, mb: 3 }}>{n.prompt}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 440 }}>
        {(n.options || []).map((o) => {
          const on = picked === o.key;
          return (
            <Box
              key={o.key}
              role="button"
              tabIndex={picked ? -1 : 0}
              onClick={() => !picked && onPick(o.key)}
              onKeyDown={(e) => {
                if (!picked && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  e.stopPropagation();
                  onPick(o.key);
                }
              }}
              sx={{
                px: 2.5,
                py: 1.75,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                border: '1px solid',
                borderColor: on ? accent : 'rgba(255,255,255,0.18)',
                bgcolor: on ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)',
                opacity: picked && !on ? 0.4 : 1,
                cursor: picked ? 'default' : 'pointer',
                transition: 'border-color .15s, background-color .15s',
                ...(!picked && { '&:hover, &:focus-visible': { borderColor: accent, outline: 'none' } }),
              }}
            >
              <Typography sx={{ fontSize: 16 }}>{o.label}</Typography>
              {o.feel && <Typography sx={{ fontSize: 12, color: on ? accent : 'text.disabled' }}>{o.feel}</Typography>}
            </Box>
          );
        })}
      </Box>
      {picked && <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 2 }}>选过的不能改。想换一条路，走到结局后可以重走。</Typography>}
    </Box>
  );
}

function RevealBeat({ n, data, loading, accent }: { n: JourneyNode; data?: JourneyNodeData; loading: boolean; accent: string }) {
  const list = data?.items || [];
  const verses = list.filter((i) => i.contentType === 'POETRY');
  const works = list.filter((i) => i.contentType !== 'POETRY');
  return (
    <Box>
      <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 20, md: 24 }, lineHeight: 1.6 }}>{n.title}</Typography>
      {n.hint && <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.75, mb: 3 }}>{n.hint}</Typography>}
      {loading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </Box>
      ) : list.length === 0 ? (
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>这里暂时还没有收录到相关的作品。</Typography>
      ) : (
        <>
          {verses.length > 0 && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.5,
                mb: works.length ? 2 : 0,
              }}
            >
              {verses.map((it) => (
                <InsightCard key={String(it.id)} item={it} accent={accent} />
              ))}
            </Box>
          )}
          {works.length > 0 && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              {works.map((it) => (
                <InsightCard key={String(it.id)} item={it} accent={accent} showType />
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

function EchoBeat({
  n,
  data,
  mine,
  accent,
  counted,
}: {
  n: JourneyNode;
  data?: JourneyNodeData;
  mine?: string;
  accent: string;
  /** 我的选择有没有计入(登录了才计) */
  counted: boolean;
}) {
  const opts = data?.options || [];
  const total = data?.total || 0;
  const me = opts.find((o) => o.key === mine);
  // 还没人选过(或只有我没被计入)时,比例没有意义,不硬凑一句
  const text = total > 0 && me ? (n.text || '').replace('{pct}', `${me.pct}%`) : '';
  return (
    <Box>
      {text ? (
        <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 19, md: 22 }, lineHeight: 1.9, mb: 3 }}>{text}</Typography>
      ) : (
        <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 19, md: 22 }, lineHeight: 1.9, mb: 3 }}>
          {data ? '你是最早走到这里的人之一，还没有别人的回声。' : ' '}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, maxWidth: 440 }}>
        {opts.map((o) => (
          <Box key={o.key}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 13, color: o.key === mine ? 'text.primary' : 'text.secondary' }}>
                {o.label}
                {o.key === mine && (
                  <Typography component="span" sx={{ fontSize: 11, color: accent, ml: 1 }}>
                    你
                  </Typography>
                )}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{total > 0 ? `${o.pct}%` : '—'}</Typography>
            </Box>
            <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${total > 0 ? o.pct : 0}%`,
                  bgcolor: o.key === mine ? accent : 'rgba(255,255,255,0.35)',
                  transition: 'width .6s ease',
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 1.5 }}>
        {total > 0 ? `${total.toLocaleString()} 人走过这里` : ''}
        {!counted && ' · 登录后你的选择才会计入'}
      </Typography>
      {(data?.notes?.length ?? 0) > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 1.25 }}>走过这条回廊的人留下的话（匿名）</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data!.notes!.map((t, i) => (
              <Typography
                key={i}
                sx={{
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: 'text.secondary',
                  pl: 1.5,
                  borderLeft: '2px solid rgba(255,255,255,0.15)',
                  overflowWrap: 'anywhere',
                }}
              >
                {t}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function NoteBeat({
  n,
  saved,
  authed,
  accent,
  onSave,
}: {
  n: JourneyNode;
  saved: string;
  authed: boolean;
  accent: string;
  onSave: (text: string) => Promise<boolean | null>;
}) {
  const [text, setText] = React.useState(saved);
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved' | 'shared' | 'failed'>('idle');
  const dirty = text.trim() !== saved.trim();
  const save = async () => {
    if (!text.trim()) return;
    setState('saving');
    const r = await onSave(text.trim());
    setState(r === null ? 'failed' : r ? 'shared' : 'saved');
  };
  const canShare = n.visibility === 'echo';
  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 19, md: 22 }, lineHeight: 1.9, mb: 2.5 }}>{n.prompt}</Typography>
      <TextField
        multiline
        minRows={3}
        maxRows={8}
        fullWidth
        value={text}
        placeholder={n.placeholder}
        onChange={(e) => {
          setText(e.target.value.slice(0, NOTE_MAX));
          setState('idle');
        }}
        // 方向键、空格在输入框里是打字,不是翻拍
        onKeyDown={(e) => e.stopPropagation()}
        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.35)', fontSize: 15, lineHeight: 1.9 } }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, gap: 1 }}>
        <Typography sx={{ fontSize: 11, color: state === 'failed' ? 'error.main' : 'text.disabled' }}>
          {state === 'failed'
            ? '没存上，稍后再试'
            : state === 'shared'
              ? '已保存，会匿名出现在后来人的回声里'
              : state === 'saved'
                ? authed
                  ? canShare
                    ? '已保存，只有你自己看得到'
                    : '已保存到你的账号，只有你自己看得到'
                  : '已存在本机'
                : authed
                  ? canShare
                    ? '保存后会匿名给后来的人看到；不想公开就别写名字'
                    : '只有你自己看得到'
                  : '没登录，只会存在这台设备上'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
            {text.length}/{NOTE_MAX}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            disabled={!text.trim() || !dirty || state === 'saving'}
            onClick={save}
            sx={{ borderColor: accent, color: accent, '&:hover': { borderColor: accent } }}
          >
            保存
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function EndingBeat({
  n,
  data,
  feels,
  authed,
  accent,
  onRestart,
  onTheme,
}: {
  n: JourneyNode;
  data?: JourneyNodeData;
  feels: string[];
  authed: boolean;
  accent: string;
  onRestart: () => void;
  onTheme?: () => void;
}) {
  const e = n.ending!;
  return (
    <Box sx={{ maxWidth: 600 }}>
      <Typography sx={{ fontSize: 12, color: accent, letterSpacing: '0.2em', mb: 1 }}>
        结局{feels.length > 0 && ` · ${feels.join(' · ')}`}
      </Typography>
      <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 36 }, fontWeight: 700, letterSpacing: '0.1em', mb: 3 }}>
        {e.title}
      </Typography>
      {e.insight.map((p, i) => (
        <Typography key={i} sx={{ fontSize: { xs: 15, md: 16 }, lineHeight: 2.1, mb: 1.5, textIndent: '2em' }}>
          {p}
        </Typography>
      ))}
      <Typography sx={{ fontSize: 11, color: 'text.disabled', mb: 3 }}>编者观点 · 文中引文出自原典</Typography>
      {e.line && (
        <Box sx={{ borderLeft: `2px solid ${accent}`, pl: 2, py: 0.5, mb: 3 }}>
          <Quote line={e.line} src={e.lineSrc} accent={accent} size={{ xs: 17, md: 19 }} />
        </Box>
      )}
      <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 3 }}>
        {(data?.reached ?? 0) > 0 ? `${data!.reached!.toLocaleString()} 人走到了这个结局` : ''}
        {!authed ? (
          <>
            {(data?.reached ?? 0) > 0 && ' · '}
            <Box component="a" href={loginHref()} sx={{ color: accent, textDecoration: 'none' }}>
              登录
            </Box>
            后这一趟会记在你的账号里
          </>
        ) : (
          <>
            {(data?.reached ?? 0) > 0 && ' · '}
            这一趟已记进
            <Box component="a" href="/insight/path" sx={{ color: accent, textDecoration: 'none', mx: 0.5 }}>
              你的心路
            </Box>
          </>
        )}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={onRestart} sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'text.primary' }}>
          换一条路重走
        </Button>
        {onTheme && (
          <Button variant="outlined" onClick={onTheme} sx={{ borderColor: accent, color: accent, '&:hover': { borderColor: accent } }}>
            去看这个主题的全部作品
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ── 舞台 ──────────────────────────────────────────────────────────────────

export interface JourneyStageProps {
  script: JourneyScript;
  mine?: JourneyMine;
  /** 所属感悟主题的分组,决定主色 */
  group?: string;
}

function Stage({ script: s, mine, group }: JourneyStageProps) {
  const router = useRouter();
  const { isAuthenticated: authed } = useAuth();
  const accent = accentOf(group);

  // 本机进度优先;本机没有但账号里有选择(换了设备),按账号里的选择走到能走到的地方
  const [local, setLocal] = React.useState<JourneyLocal>(EMPTY);
  const [cursor, setCursor] = React.useState(-1); // -1 = 开场
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const saved = readLocal(s.key);
    let init = saved && saved.trail.every((id) => nodeOf(s, id)) ? saved : null;
    if (!init && mine && Object.keys(mine.choices).length > 0) {
      init = { trail: walk(s, mine.choices), choices: mine.choices, notes: {} };
    }
    if (init && init.trail.length > 0) {
      setLocal(init);
      setCursor(init.trail.length - 1);
    }
    setReady(true);
    // 只在进页面时恢复一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.key]);

  const update = React.useCallback(
    (next: JourneyLocal) => {
      setLocal(next);
      writeLocal(s.key, next);
    },
    [s.key],
  );

  const atTip = cursor === local.trail.length - 1;
  const node = cursor >= 0 ? nodeOf(s, local.trail[cursor]) : undefined;
  const { data, isLoading } = useNodeData(s.key, node);

  // 登录之前在本机选的,登录后补记一次,否则结局复核过不了
  const synced = React.useRef(false);
  React.useEffect(() => {
    if (!authed || !ready || synced.current) return;
    synced.current = true;
    const known = mine?.choices || {};
    Object.entries(local.choices)
      .filter(([n, o]) => known[n] !== o)
      .forEach(([n, o]) => void choose(s.key, n, o).catch(() => {}));
  }, [authed, ready, local.choices, mine, s.key]);

  // 走到结局:登录了就记一笔(服务端会沿图复核)
  const finished = React.useRef('');
  React.useEffect(() => {
    if (!authed || !node || node.type !== 'ending' || !atTip || finished.current === node.id) return;
    finished.current = node.id;
    const t = setTimeout(() => void finish(s.key, node.id).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [authed, node, atTip, s.key]);

  const push = (id?: string) => {
    if (!id || !nodeOf(s, id)) return;
    const next = { ...local, trail: [...local.trail, id] };
    update(next);
    setCursor(next.trail.length - 1);
  };

  /** 这一拍能不能直接往下走(抉择没选之前不能) */
  const canForward = !node ? ready : node.type !== 'ending' && (node.type !== 'choice' || !!local.choices[node.id]);

  const forward = () => {
    if (!canForward) return;
    if (!node) {
      // 开场 → 第一拍
      if (local.trail.length > 0) setCursor(0);
      else push(s.start);
      return;
    }
    if (!atTip) {
      setCursor(cursor + 1);
      return;
    }
    if (node.type === 'choice') {
      push(node.options?.find((o) => o.key === local.choices[node.id])?.next);
      return;
    }
    push(node.next);
  };

  const back = () => {
    if (cursor >= 0) setCursor(cursor - 1);
  };

  const pick = (key: string) => {
    if (!node || node.type !== 'choice' || local.choices[node.id]) return;
    const o = node.options?.find((x) => x.key === key);
    if (!o) return;
    if (authed) void choose(s.key, node.id, key).catch(() => {});
    const next = { ...local, choices: { ...local.choices, [node.id]: key }, trail: [...local.trail, o.next] };
    update(next);
    // 让选中的样子停一下再走
    setTimeout(() => setCursor(next.trail.length - 1), 450);
  };

  const saveNote = async (text: string): Promise<boolean | null> => {
    if (!node) return null;
    let shared = false;
    if (authed) {
      try {
        shared = (await writeNote(s.key, node.id, text)).shared;
      } catch {
        return null;
      }
    }
    update({ ...local, notes: { ...local.notes, [node.id]: text } });
    return shared;
  };

  const doRestart = () => {
    if (authed) void restart(s.key).catch(() => {});
    clearLocal(s.key);
    finished.current = '';
    // 落笔是写给自己的,重走不清
    const kept = { ...EMPTY, notes: local.notes };
    setLocal(kept);
    writeLocal(s.key, kept);
    setCursor(-1);
  };

  // 键盘 / 滚轮 / 划动。揭示和结局内容长,要留给页面自己滚,只认键盘和按钮。
  const last = React.useRef(0);
  const step = (dir: 1 | -1) => {
    const now = Date.now();
    if (now - last.current < STEP_COOLDOWN) return;
    last.current = now;
    if (dir === 1) forward();
    else back();
  };
  const stepRef = React.useRef(step);
  stepRef.current = step;
  const gesture = !node || node.type === 'scene' || node.type === 'echo';
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        stepRef.current(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        stepRef.current(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  React.useEffect(() => {
    if (!gesture) return;
    let y0: number | null = null;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 20) return;
      stepRef.current(e.deltaY > 0 ? 1 : -1);
    };
    const onStart = (e: TouchEvent) => {
      y0 = e.touches[0]?.clientY ?? null;
    };
    const onEnd = (e: TouchEvent) => {
      if (y0 === null) return;
      const dy = (e.changedTouches[0]?.clientY ?? y0) - y0;
      y0 = null;
      if (Math.abs(dy) >= SWIPE_MIN) stepRef.current(dy < 0 ? 1 : -1);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [gesture]);

  // 换拍回到顶上
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [cursor]);

  const cover = node?.type === 'scene' ? data?.media?.cover : undefined;
  const label =
    !node || node.type === 'ending'
      ? ''
      : node.type === 'choice'
        ? ''
        : node.type === 'note'
          ? local.notes[node.id]
            ? '继续'
            : '先不写，继续'
          : '继续';

  return (
    <Box sx={{ position: 'relative', minHeight: '100dvh', bgcolor: '#0c0c10', color: 'text.primary', overflowX: 'hidden' }}>
      {/* 影像层:当前这一拍的画面,压暗;没有画面时是一层主色的晕 */}
      <Box sx={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        {cover ? (
          <CoverImage
            key={cover}
            src={cover}
            alt=""
            loading="eager"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.42,
              filter: 'saturate(0.85)',
              animation: 'journeyFade .9s ease',
              '@keyframes journeyFade': { from: { opacity: 0 }, to: { opacity: 0.42 } },
            }}
          />
        ) : null}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: cover
              ? 'linear-gradient(180deg, rgba(12,12,16,0.55) 0%, rgba(12,12,16,0.35) 35%, rgba(12,12,16,0.92) 100%)'
              : `radial-gradient(120% 80% at 20% 0%, ${accent}26 0%, transparent 60%)`,
          }}
        />
      </Box>

      {/* 顶栏:返回 + 标题 + 走到第几拍 */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          pt: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          pb: 1,
        }}
      >
        <IconButton aria-label="返回" onClick={() => router.back()} sx={{ color: 'text.primary' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.title}
          {s.subtitle && (
            <Typography component="span" sx={{ fontSize: 12, color: 'text.disabled', ml: 1 }}>
              {s.subtitle}
            </Typography>
          )}
        </Typography>
        {cursor >= 0 && (
          <Typography sx={{ fontSize: 11, color: 'text.disabled', pr: 1.5, flexShrink: 0 }}>第 {cursor + 1} 拍</Typography>
        )}
      </Box>

      {/* 这一拍 */}
      <Box
        key={cursor}
        sx={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 760,
          mx: 'auto',
          px: { xs: 3, md: 4 },
          pt: { xs: 5, md: 9 },
          pb: 'calc(env(safe-area-inset-bottom, 0px) + 140px)',
          animation: 'journeyIn .5s ease',
          '@keyframes journeyIn': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'none' } },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        {!node ? (
          <Box>
            <Typography sx={{ fontSize: 12, color: accent, letterSpacing: '0.2em', mb: 1.5 }}>
              回廊{s.minutes ? ` · 约 ${s.minutes} 分钟` : ''}
            </Typography>
            <Typography
              sx={{ fontFamily: SERIF, fontSize: { xs: 34, md: 46 }, fontWeight: 700, letterSpacing: '0.12em', lineHeight: 1.3, mb: 3 }}
            >
              {s.title}
            </Typography>
            <Typography sx={{ fontSize: { xs: 15, md: 16 }, lineHeight: 2.1, color: 'text.secondary', maxWidth: 560, mb: 4 }}>
              {s.opening.situation}
            </Typography>
            {s.opening.line && (
              <Box sx={{ borderLeft: `2px solid ${accent}`, pl: 2, py: 0.5 }}>
                <Quote line={s.opening.line} src={s.opening.lineSrc} accent={accent} size={{ xs: 17, md: 19 }} />
              </Box>
            )}
          </Box>
        ) : node.type === 'scene' ? (
          <SceneBeat n={node} data={data} accent={accent} />
        ) : node.type === 'choice' ? (
          <ChoiceBeat n={node} picked={local.choices[node.id]} accent={accent} onPick={pick} />
        ) : node.type === 'reveal' ? (
          <RevealBeat n={node} data={data} loading={isLoading} accent={accent} />
        ) : node.type === 'echo' ? (
          <EchoBeat n={node} data={data} mine={local.choices[node.of || '']} accent={accent} counted={authed} />
        ) : node.type === 'note' ? (
          <NoteBeat key={node.id} n={node} saved={local.notes[node.id] || ''} authed={authed} accent={accent} onSave={saveNote} />
        ) : (
          <EndingBeat
            n={node}
            data={data}
            feels={feelsOf(s, local)}
            authed={authed}
            accent={accent}
            onRestart={doRestart}
            onTheme={s.theme ? () => router.push(`/insight/theme?key=${encodeURIComponent(s.theme!)}`) : undefined}
          />
        )}
      </Box>

      {/* 底栏:上一拍 / 继续 */}
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          px: 2,
          pt: 3,
          pb: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
          background: 'linear-gradient(180deg, transparent, rgba(12,12,16,0.92) 45%)',
          pointerEvents: 'none',
          '& > *': { pointerEvents: 'auto' },
        }}
      >
        {cursor >= 0 && (
          <IconButton aria-label="上一拍" onClick={back} sx={{ color: 'text.secondary', border: '1px solid rgba(255,255,255,0.18)' }}>
            <KeyboardArrowUpIcon />
          </IconButton>
        )}
        {!node ? (
          <Button
            variant="contained"
            disabled={!ready}
            onClick={forward}
            sx={{ minWidth: 200, py: 1.1, bgcolor: accent, color: '#fff', '&:hover': { bgcolor: accent, filter: 'brightness(1.1)' } }}
          >
            {local.trail.length > 0 ? '接着走' : '走进去'}
          </Button>
        ) : label ? (
          <Button
            variant="outlined"
            onClick={forward}
            sx={{ minWidth: 200, py: 1.1, borderColor: 'rgba(255,255,255,0.35)', color: 'text.primary', '&:hover': { borderColor: accent } }}
          >
            {atTip ? label : '下一拍'}
          </Button>
        ) : node.type === 'choice' && local.choices[node.id] ? (
          <Button
            variant="outlined"
            onClick={forward}
            sx={{ minWidth: 200, py: 1.1, borderColor: 'rgba(255,255,255,0.35)', color: 'text.primary', '&:hover': { borderColor: accent } }}
          >
            下一拍
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}

/** 舞台固定深色:嵌一层深色主题,字体等沿用站点主题。 */
export default function JourneyStage(props: JourneyStageProps) {
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
  return (
    <ThemeProvider theme={dark}>
      <Stage {...props} />
    </ThemeProvider>
  );
}
