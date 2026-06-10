/**
 * CanvasStage —— 零依赖的 2D 占位数字人。
 * 真高斯人/aholo 渲染就绪前,用它把"动作状态机 + 口型 + 情感"完整跑起来、肉眼可见。
 * 它实现 IAvatarStage,后续无缝替换成 AholoStage / GS 动画渲染器。
 */
import type { IAvatarStage, DrivingFrame, AvatarAction, AvatarEmotion } from './types';

const EMOTION_COLOR: Record<AvatarEmotion, string> = {
  neutral: '#5B8DEF',
  happy: '#FFB400',
  sad: '#8B9AC6',
  surprised: '#FE2C55',
  thinking: '#8B5CF6',
};

export class CanvasStage implements IAvatarStage {
  available = true;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private frame: DrivingFrame = { action: 'idle', emotion: 'neutral', mouthOpen: 0 };
  private t = 0;
  private raf: number | null = null;
  private point: 'left' | 'right' | null = null;

  constructor(private opts: { transparent?: boolean } = {}) {}

  /** 伸手指向(left/right),用于"告诉用户数据在哪" */
  setPoint(dir: 'left' | 'right' | null) {
    this.point = dir;
  }

  async mount(container: HTMLElement) {
    const c = document.createElement('canvas');
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.display = 'block';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const r = container.getBoundingClientRect();
      c.width = Math.max(1, r.width * dpr);
      c.height = Math.max(1, r.height * dpr);
    };
    container.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');
    resize();
    new ResizeObserver(resize).observe(container);
    this.loop();
  }

  async loadScene() {
    /* 占位:真实场景由 AholoStage 加载 */
  }
  async loadAvatar() {
    /* 占位 */
  }

  applyFrame(frame: DrivingFrame) {
    this.frame = frame;
  }

  dispose() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.canvas?.remove();
  }

  private loop = () => {
    this.t += 0.016;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw() {
    const ctx = this.ctx,
      c = this.canvas;
    if (!ctx || !c) return;
    const W = c.width,
      H = c.height,
      t = this.t;
    const { action, emotion, mouthOpen } = this.frame;
    ctx.clearRect(0, 0, W, H);

    // 背景渐变(透明模式跳过,用作悬浮形象)
    if (!this.opts.transparent) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0E1120');
      g.addColorStop(1, '#05060B');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const cx = W / 2;
    const baseY = H * 0.62;
    const color = EMOTION_COLOR[emotion];
    const bob = Math.sin(t * 2) * (action === 'idle' ? 4 : 8); // 呼吸/点头
    const sway = (action === 'dance' ? Math.sin(t * 6) * 40 : action === 'speaking' ? Math.sin(t * 3) * 8 : 0);
    const offstage = action === 'leave';
    const enterX = action === 'enter' ? (1 - Math.min(1, t)) * 200 : 0;
    const x = cx + sway + enterX + (offstage ? Math.min(1, t) * 300 : 0);

    const sit = action === 'sit';
    const headR = W * 0.06;
    const headY = baseY - headR * 4 + bob - (sit ? headR : 0);

    // 身体
    ctx.fillStyle = '#1A2030';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.beginPath();
    ctx.moveTo(x - headR * 1.4, headY + headR);
    ctx.lineTo(x + headR * 1.4, headY + headR);
    ctx.lineTo(x + headR * 1.8, baseY + (sit ? -headR : 0));
    ctx.lineTo(x - headR * 1.8, baseY + (sit ? -headR : 0));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 手臂(讲话/挥手/跳舞 摆动)
    const armWave = action === 'wave' || action === 'greet' ? Math.abs(Math.sin(t * 8)) : action === 'speaking' || action === 'dance' ? Math.sin(t * 5) * 0.5 + 0.5 : 0.1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + headR * 1.4, headY + headR * 1.2);
    ctx.lineTo(x + headR * 2.6, headY + headR * 1.2 - armWave * headR * 2.5);
    ctx.moveTo(x - headR * 1.4, headY + headR * 1.2);
    ctx.lineTo(x - headR * 2.4, headY + headR * 2);
    ctx.stroke();

    // 指向手势(伸长手臂 + 箭头)
    if (this.point) {
      const dir = this.point === 'right' ? 1 : -1;
      const sx = x + dir * headR * 1.4;
      const sy = headY + headR * 0.9;
      const ex = x + dir * headR * 3.4;
      const ey = headY + headR * 0.5;
      ctx.strokeStyle = '#FFB400';
      ctx.lineWidth = Math.max(3, headR * 0.16);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // 箭头
      ctx.fillStyle = '#FFB400';
      ctx.beginPath();
      ctx.moveTo(ex + dir * headR * 0.3, ey);
      ctx.lineTo(ex - dir * headR * 0.1, ey - headR * 0.25);
      ctx.lineTo(ex - dir * headR * 0.1, ey + headR * 0.25);
      ctx.closePath();
      ctx.fill();
    }

    // 头
    ctx.fillStyle = '#E8ECF4';
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // 眼(眨眼 + surprised 放大)
    const blink = (Math.sin(t * 0.8) > 0.97) ? 0.1 : 1;
    const eyeR = headR * (emotion === 'surprised' ? 0.22 : 0.14) * blink;
    ctx.fillStyle = '#1A2030';
    for (const dx of [-headR * 0.35, headR * 0.35]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, headY - headR * 0.1, headR * 0.14, eyeR, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 嘴(口型 + 情感弧度)
    const mouthW = headR * 0.5;
    const open = mouthOpen * headR * 0.5;
    const curve = emotion === 'happy' ? headR * 0.18 : emotion === 'sad' ? -headR * 0.18 : 0;
    ctx.strokeStyle = '#1A2030';
    ctx.lineWidth = Math.max(2, headR * 0.08);
    ctx.beginPath();
    ctx.moveTo(x - mouthW, headY + headR * 0.42);
    ctx.quadraticCurveTo(x, headY + headR * 0.42 + curve + open, x + mouthW, headY + headR * 0.42);
    if (open > headR * 0.1) {
      ctx.fillStyle = '#3A1020';
      ctx.fill();
    }
    ctx.stroke();

    // 思考气泡
    if (action === 'thinking' || emotion === 'thinking') {
      ctx.fillStyle = 'rgba(139,92,246,0.9)';
      for (let i = 0; i < 3; i++) {
        const a = (t * 2 + i) % 3;
        ctx.globalAlpha = 1 - a / 3;
        ctx.beginPath();
        ctx.arc(x + headR * 1.1, headY - headR * (0.8 + a * 0.4), headR * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 状态标签
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${Math.max(11, W * 0.018)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${labelOf(action)} · ${emotion}`, cx, H - 18);
  }
}

function labelOf(a: AvatarAction): string {
  const m: Record<AvatarAction, string> = {
    enter: '入场', idle: '待机', thinking: '思考', speaking: '讲话', greet: '打招呼',
    wave: '挥手', point: '指向', walk: '走动', dance: '跳舞', sing: '唱歌',
    sit: '坐下', leave: '离场',
  };
  return m[a] ?? a;
}
