/**
 * VideoStage —— 2D 真人数字人(视频片段库,对应公众号文章的做法)。
 * 画面是真实人物素材,状态机按动作切换/循环对应片段,看起来就是真人。
 *
 * 资产来源(任选,自托管友好):
 *   - 真人实拍:idle / speaking / greet / dance ... 各录一小段
 *   - AI 生成:Seedance / HeyGen / 可灵 等,保持人物一致性批量生成
 *
 * 清单格式见 public/avatar/clips.example.json;放到 public/avatar/clips.json 即自动启用。
 *
 * 口型:片段自带嘴型(讲话片段就是在说话)。要"精确对上 TTS 文本"的口型,
 *       需接服务端 talking-head(SadTalker/LivePortrait/GeneFace)生成逐句视频,
 *       那时把 speaking 片段换成实时生成流即可(seam 已留好)。
 */
import type { IAvatarStage, DrivingFrame, AvatarAction } from './types';

export type ClipManifest = Partial<Record<AvatarAction, { url: string; loop?: boolean }>> & {
  idle: { url: string; loop?: boolean };
};

export class VideoStage implements IAvatarStage {
  available = false;
  private a: HTMLVideoElement | null = null; // 前台
  private b: HTMLVideoElement | null = null; // 后台(交叉淡入)
  private current: AvatarAction = 'idle';
  private manifest: ClipManifest;

  constructor(manifest: ClipManifest) {
    this.manifest = manifest;
  }

  static async fromUrl(url = '/avatar/clips.json'): Promise<ClipManifest | null> {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) return null;
      const m = (await r.json()) as ClipManifest;
      return m?.idle?.url ? m : null;
    } catch {
      return null;
    }
  }

  async mount(container: HTMLElement) {
    const mk = (z: number) => {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.loop = true;
      Object.assign(v.style, {
        position: 'absolute', inset: '0', width: '100%', height: '100%',
        objectFit: 'cover', zIndex: String(z), transition: 'opacity 0.35s', opacity: '0',
      } as CSSStyleDeclaration);
      container.appendChild(v);
      return v;
    };
    container.style.position = container.style.position || 'relative';
    this.a = mk(1);
    this.b = mk(0);
    await this.play(this.a, 'idle');
    this.a.style.opacity = '1';
    this.available = true;
  }

  async loadScene() {/* 真人场景可做绿幕抠像后叠背景,这里略 */}
  async loadAvatar() {/* 资产即 manifest */}

  applyFrame(frame: DrivingFrame) {
    if (frame.action !== this.current) this.switchTo(frame.action);
  }

  private clip(action: AvatarAction) {
    return this.manifest[action] ?? this.manifest.idle;
  }

  private async play(v: HTMLVideoElement, action: AvatarAction) {
    const c = this.clip(action);
    if (v.src.endsWith(c.url)) return;
    v.src = c.url;
    v.loop = c.loop ?? (action === 'idle' || action === 'speaking');
    try { await v.play(); } catch {/* autoplay 策略 */}
  }

  private async switchTo(action: AvatarAction) {
    if (!this.a || !this.b) return;
    this.current = action;
    // 后台切到新片段,交叉淡入
    await this.play(this.b, action);
    this.b.style.opacity = '1';
    this.a.style.opacity = '0';
    [this.a, this.b] = [this.b, this.a];
  }

  dispose() {
    this.a?.remove();
    this.b?.remove();
  }
}
