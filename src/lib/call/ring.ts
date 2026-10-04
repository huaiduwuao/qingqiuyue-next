'use client';

/**
 * 铃声:WebAudio 现合成,不带音频文件。来电是两声一组的双音,去电是长「嘟——」。
 * 浏览器在用户没点过页面时不让出声(AudioContext 是 suspended),这时只能靠界面和手机振动。
 */

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function beep(ac: AudioContext, at: number, dur: number, freqs: number[], vol: number) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.02);
  g.gain.setValueAtTime(vol, at + dur - 0.03);
  g.gain.linearRampToValueAtTime(0, at + dur);
  g.connect(ac.destination);
  for (const f of freqs) {
    const o = ac.createOscillator();
    o.frequency.value = f;
    o.connect(g);
    o.start(at);
    o.stop(at + dur);
  }
}

export function startRing(kind: 'incoming' | 'outgoing') {
  stopRing();
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AC) {
    try {
      ctx = new AC();
      void ctx.resume().catch(() => {});
    } catch {
      ctx = null;
    }
  }
  const play = () => {
    if (kind === 'incoming') {
      try {
        navigator.vibrate?.([400, 200, 400]);
      } catch {
        /* 不支持振动 */
      }
    }
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.05;
    if (kind === 'incoming') {
      beep(ctx, t, 0.4, [880, 1100], 0.12);
      beep(ctx, t + 0.55, 0.4, [880, 1100], 0.12);
    } else {
      beep(ctx, t, 1.0, [440, 480], 0.06);
    }
  };
  play();
  timer = setInterval(play, kind === 'incoming' ? 2500 : 4000);
}

export function stopRing() {
  if (timer) clearInterval(timer);
  timer = null;
  try {
    navigator.vibrate?.(0);
  } catch {
    /* 不支持振动 */
  }
  if (ctx) {
    void ctx.close().catch(() => {});
    ctx = null;
  }
}
