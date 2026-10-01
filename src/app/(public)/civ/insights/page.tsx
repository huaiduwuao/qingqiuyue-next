'use client';

// 专题看板:人生感悟与文明图谱「哪里吸引人」。只给内容运营(后端校验,页面只负责说清楚)。
//
// 一行筛选(7 / 14 / 30 天)管住下面所有数字;总览五个数和上一个同长窗口比;
// 走势是同一把尺子上的三条计数线(访问人数 / 打开 / 节点里点开作品),带十字线与表格视图;
// 下面是排行:最吸引人的节点、上升最快、看到了却没点、被点开的作品、领域占比、新长出的分支、语义归位。
// 数据来自 topic_event(埋点见 lib/topicTrack),后端 internal/handler/topic_insights.go。

import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import DetailHeader from '@/components/detail/DetailHeader';
import { topicInsights, type TopicInsights, type TopicNodeRow } from '@/apis/topicInsights';
import { ago } from '@/components/insight/Branches';
import { civHref, ORIGIN_LABEL, SERIF } from '@/components/civ/CivParts';
import { useContentNavigate } from '@/lib/contentRoute';
import type { CivOrigin } from '@/apis/civ';

// 参考色板前三个槽位(蓝 / 橙 / 青),亮暗各一套,三色两两都过色弱检查(dataviz 参考色板)。
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70'];

const nodeHref = (key: string) =>
  key.startsWith('c.')
    ? civHref(key)
    : key.includes('.')
      ? `/insight/branch?key=${encodeURIComponent(key)}`
      : `/insight/theme?key=${encodeURIComponent(key)}`;

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

function delta(cur: number, prev: number): { text: string; up: boolean | null } {
  if (!prev) return { text: cur ? '新增' : '—', up: cur ? true : null };
  const d = (cur - prev) / prev;
  return { text: `${d >= 0 ? '+' : ''}${(d * 100).toFixed(0)}%`, up: d === 0 ? null : d > 0 };
}

function StatTile({ label, value, prev, fmt, hint }: { label: string; value: number; prev: number; fmt?: (n: number) => string; hint?: string }) {
  const d = delta(value, prev);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
        {fmt ? fmt(value) : value.toLocaleString()}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
        <Box component="span" sx={{ fontWeight: 600 }}>
          {d.up === null ? '' : d.up ? '▲ ' : '▼ '}
          {d.text}
        </Box>{' '}
        比上一段{hint ? ` · ${hint}` : ''}
      </Typography>
    </Box>
  );
}

/** 每天的走势:三条计数线,一把尺子。悬停出十字线 + 一个读数框;可以切成表格。 */
function TrendChart({ data }: { data: TopicInsights['daily'] }) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const colors = dark ? SERIES_DARK : SERIES_LIGHT;
  const series = [
    { key: 'people' as const, label: '访问人数' },
    { key: 'opens' as const, label: '打开节点' },
    { key: 'works' as const, label: '点开作品' },
  ];
  const wrap = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(640);
  const [hover, setHover] = React.useState<number | null>(null);
  const [asTable, setAsTable] = React.useState(false);
  React.useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 220;
  const pad = { l: 36, r: 64, t: 12, b: 26 };
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key])));
  const nice = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const x = (i: number) => pad.l + (data.length <= 1 ? 0 : (i * (w - pad.l - pad.r)) / (data.length - 1));
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  const ticks = [0, nice / 2, nice];
  const labelEvery = Math.ceil(data.length / 7);
  // 线尾标签:按值排开,彼此至少隔 12px,且不压到日期轴
  const endY: Record<string, number> = {};
  const lastRow = data[data.length - 1];
  if (lastRow) {
    const order = [...series].sort((a, b) => y(lastRow[a.key]) - y(lastRow[b.key]));
    let prevY = -Infinity;
    order.forEach((s) => {
      const yy = Math.max(y(lastRow[s.key]) + 4, prevY + 12);
      endY[s.key] = yy;
      prevY = yy;
    });
    const overflow = prevY - (H - pad.b - 2);
    if (overflow > 0) order.forEach((s) => (endY[s.key] -= overflow));
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        {series.map((s, i) => (
          <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: 'text.secondary' }}>
            <Box sx={{ width: 14, height: 2, bgcolor: colors[i], borderRadius: 1 }} />
            {s.label}
          </Box>
        ))}
        <Typography
          component="button"
          onClick={() => setAsTable((v) => !v)}
          sx={{ ml: 'auto', fontSize: 12, color: 'primary.main', background: 'none', border: 0, cursor: 'pointer', p: 0 }}
        >
          {asTable ? '看走势图' : '看表格'}
        </Typography>
      </Box>
      {asTable ? (
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, '& td, & th': { py: 0.5, px: 1, textAlign: 'right', borderBottom: '1px solid', borderColor: 'divider' }, '& th:first-of-type, & td:first-of-type': { textAlign: 'left' } }}>
          <thead>
            <tr>
              <th>日期</th>
              {series.map((s) => (
                <th key={s.key}>{s.label}</th>
              ))}
              <th>曝光</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}>
                <td>{d.day}</td>
                {series.map((s) => (
                  <td key={s.key}>{d[s.key]}</td>
                ))}
                <td>{d.impressions}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      ) : (
        <Box ref={wrap} sx={{ position: 'relative', width: '100%' }}>
          <svg
            width={w}
            height={H}
            role="img"
            aria-label="每天的访问人数、打开节点与点开作品"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            style={{ display: 'block', touchAction: 'pan-y' }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={theme.palette.divider} strokeWidth={1} />
                <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={theme.palette.text.secondary}>
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <text key={d.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={theme.palette.text.secondary}>
                  {d.day}
                </text>
              ) : null,
            )}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke={theme.palette.text.secondary} strokeWidth={1} opacity={0.5} />
            )}
            {series.map((s, si) => {
              const pts = data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(' ');
              const last = data[data.length - 1];
              return (
                <g key={s.key}>
                  <polyline points={pts} fill="none" stroke={colors[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {hover !== null && (
                    <circle cx={x(hover)} cy={y(data[hover][s.key])} r={4} fill={colors[si]} stroke={theme.palette.background.paper} strokeWidth={2} />
                  )}
                  {/* 线尾直接标名,颜色只做身份,文字用正文色 */}
                  {last && (
                    <text x={x(data.length - 1) + 6} y={endY[s.key]} fontSize={11} fill={theme.palette.text.secondary}>
                      {s.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && data[hover] && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: Math.min(Math.max(x(hover) + 10, 0), w - 150),
                pointerEvents: 'none',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                px: 1.25,
                py: 0.75,
                boxShadow: 2,
                minWidth: 130,
              }}
            >
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.25 }}>{data[hover].day}</Typography>
              {series.map((s, si) => (
                <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12 }}>
                  <Box sx={{ width: 10, height: 2, bgcolor: colors[si] }} />
                  <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {data[hover][s.key]}
                  </Box>
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    {s.label}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{title}</Typography>
      {hint && <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.25, mb: 1.5 }}>{hint}</Typography>}
      {!hint && <Box sx={{ mb: 1.5 }} />}
      {children}
    </Box>
  );
}

function Empty({ text }: { text: string }) {
  return <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 1 }}>{text}</Typography>;
}

/** 一行一个节点:名字 + 路径,右侧一条按 value 比例的细条和数值。 */
function NodeBars({ rows, value, max, render }: { rows: TopicNodeRow[]; value: (r: TopicNodeRow) => number; max?: number; render: (r: TopicNodeRow) => string }) {
  const router = useRouter();
  const theme = useTheme();
  const color = theme.palette.mode === 'dark' ? SERIES_DARK[0] : SERIES_LIGHT[0];
  const m = max ?? Math.max(1, ...rows.map(value));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.map((r) => (
        <Box
          key={r.key}
          onClick={() => router.push(nodeHref(r.key))}
          title={`${r.path} › ${r.name}`}
          sx={{ cursor: 'pointer', minWidth: 0, '&:hover .bar': { opacity: 0.8 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {r.path}
            </Typography>
            <Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{render(r)}</Typography>
          </Box>
          <Box sx={{ height: 6, mt: 0.5, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
            <Box className="bar" sx={{ height: '100%', width: `${Math.max(2, (value(r) / m) * 100)}%`, bgcolor: color, borderRadius: 3 }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function TopicInsightsPage() {
  const router = useRouter();
  const go = useContentNavigate();
  const [days, setDays] = React.useState(7);
  const q = useQuery({
    queryKey: ['topic', 'insights', days],
    queryFn: () => topicInsights(days),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const d = q.data;
  const cur = d?.kpi.cur;
  const prev = d?.kpi.prev;
  const noData = !!d && d.kpi.cur.people === 0;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <DetailHeader title="专题看板" />
      <Container maxWidth="lg" sx={{ py: 3, pb: 8 }}>
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 24, md: 30 }, fontWeight: 700, letterSpacing: '0.15em' }}>专题看板</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            人生感悟与文明图谱:用户在哪里停下、点开了什么、哪些热点长成了有人看的分支
          </Typography>
        </Box>

        {/* 一行筛选,管住下面全部 */}
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          {[7, 14, 30].map((n) => (
            <Box
              key={n}
              component="button"
              onClick={() => setDays(n)}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 5,
                fontSize: 13,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: days === n ? 'text.primary' : 'divider',
                bgcolor: days === n ? 'text.primary' : 'transparent',
                color: days === n ? 'background.default' : 'text.primary',
                fontWeight: days === n ? 600 : 400,
              }}
            >
              近 {n} 天
            </Box>
          ))}
        </Box>

        {q.isError ? (
          <Card title="看不了">
            <Empty text="这个看板只给内容运营看。请用运营账号登录;已经登录的话,可能是登录过期了。" />
          </Card>
        ) : q.isLoading || !d || !cur || !prev ? (
          <>
            <Skeleton variant="rounded" height={100} sx={{ mb: 3 }} />
            <Skeleton variant="rounded" height={260} />
          </>
        ) : (
          <Box sx={{ opacity: q.isFetching ? 0.6 : 1, transition: 'opacity .2s' }}>
            {noData && (
              <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontSize: 13 }}>
                  这段时间还没有用户在专题里留下行为。埋点 10 月 1 日起才开始记,有人逛 /insight 和 /civ 之后,这里会一天天长出来。
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
                gap: 2.5,
                mb: 3,
              }}
            >
              <StatTile label="访问人数" value={cur.people} prev={prev.people} />
              <StatTile label="打开节点" value={cur.opens} prev={prev.opens} hint={`${cur.openPeople} 人`} />
              <StatTile label="点击率" value={cur.ctr} prev={prev.ctr} fmt={(n) => (cur.impressions ? pct(n) : '—')} hint="打开 / 曝光" />
              <StatTile label="节点里点开作品" value={cur.works} prev={prev.works} />
              <StatTile label="人均停留" value={cur.dwellMin} prev={prev.dwellMin} fmt={(n) => `${n} 分钟`} />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Card title="每天" hint="同一把尺子上的三种计数;悬停看当天,也可以切成表格">
                <TrendChart data={d.daily} />
              </Card>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
              <Card title="最吸引人的节点" hint="按打开过的人数;右边是 打开人数 · 点击率 · 人均停留">
                {d.top.length ? (
                  <NodeBars
                    rows={d.top.slice(0, 12)}
                    value={(r) => r.people}
                    render={(r) => `${r.people} 人 · ${r.impressions ? pct(r.ctr) : '—'} · ${r.dwellMin ? `${r.dwellMin}分` : '—'}`}
                  />
                ) : (
                  <Empty text="还没有人打开过节点。" />
                )}
              </Card>

              <Card title="上升最快" hint="近 24 小时的打开,比这段时间的日均多出多少">
                {d.rising.length ? (
                  <NodeBars rows={d.rising} value={(r) => r.rise} render={(r) => `今天 ${r.opens24} · 日均 ${r.dailyAvg}`} />
                ) : (
                  <Empty text="近 24 小时没有明显变热的节点。" />
                )}
              </Card>

              <Card title="看到了却没点" hint="曝光 20 次以上、点击率最低的:标题或位置可能没打动人">
                {d.ignored.length ? (
                  <NodeBars
                    rows={d.ignored}
                    value={(r) => r.impressions}
                    render={(r) => `曝光 ${r.impressions} · 点击率 ${pct(r.ctr)}`}
                  />
                ) : (
                  <Empty text="还没有曝光够多的节点可比。" />
                )}
              </Card>

              <Card title="各领域 / 主题" hint="按打开次数,看兴趣落在文明的哪一块">
                {d.domains.length ? (
                  <NodeBars
                    rows={d.domains.map((x) => ({
                      key: x.kind === 'civ' ? `c.${x.domain}` : x.domain,
                      name: x.name,
                      path: x.kind === 'civ' ? '文明图谱' : '人生感悟',
                      opens: x.opens,
                    })) as unknown as TopicNodeRow[]}
                    value={(r) => r.opens}
                    render={(r) => `${r.opens} 次`}
                  />
                ) : (
                  <Empty text="还没有数据。" />
                )}
              </Card>

              <Card title="从节点里被点开的作品" hint="用户在专题里真正点进去看的东西">
                {d.works.length ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {d.works.map((w) => (
                      <Box key={w.node + w.id} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', minWidth: 0 }}>
                        <Typography
                          onClick={() => go(w.contentType, w.id)}
                          sx={{ fontSize: 13, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, '&:hover': { textDecoration: 'underline' } }}
                        >
                          {w.title}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>在「{w.nodeName}」</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{w.clicks} 次</Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Empty text="还没有人从节点里点开作品。" />
                )}
              </Card>

              <Card title="新长出来的分支" hint="这段时间里热点、搜索或用户嫁接开出的分支,各自拉来了多少人">
                {d.grown.length ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {d.grown.slice(0, 14).map((g) => (
                      <Box
                        key={g.key}
                        onClick={() => router.push(nodeHref(g.key))}
                        sx={{ display: 'flex', gap: 1, alignItems: 'baseline', cursor: 'pointer', minWidth: 0 }}
                      >
                        <Typography sx={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{g.name}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {g.path} · {ORIGIN_LABEL[g.origin as CivOrigin] || (g.origin === 'need' ? '心事长出' : g.origin)} · {ago(g.openedAt)}
                        </Typography>
                        <Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: g.people ? 'text.primary' : 'text.disabled' }}>
                          {g.people} 人
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Empty text="这段时间没有新分支。" />
                )}
              </Card>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Card
                title="热点是怎么归位的"
                hint={
                  d.round?.total
                    ? `最近一轮 ${d.round.total} 条热搜,归位 ${d.round.placed} 条(${ago(d.round.at)});字面认不出的靠语义归位`
                    : '字面认不出的热搜,按语义向量挂到最近的门类'
                }
              >
                {d.semantic.length ? (
                  d.semantic.map((s) => (
                    <Box key={s.word + s.node} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', mb: 0.75, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.word}</Typography>
                      <Typography
                        onClick={() => router.push(civHref(s.node))}
                        sx={{ fontSize: 12, color: 'primary.main', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        → {s.nodeName}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>相似度 {s.sim}</Typography>
                    </Box>
                  ))
                ) : (
                  <Empty text="这段时间没有靠语义归位的热点。" />
                )}
                {(d.round?.unplaced?.length ?? 0) > 0 && (
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
                    还没地方挂的:{d.round!.unplaced.map((u) => u.word).join(' / ')}
                  </Typography>
                )}
              </Card>
            </Box>

            <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 4, lineHeight: 1.8 }}>
              「人」= 登录用户按账号、游客按浏览器随机 id 去重;日期按北京时间。点击率 = 打开 / 曝光。
              <br />
              数据只记专题里的行为(topic_event),作品详情页的观看另有统计。
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}
