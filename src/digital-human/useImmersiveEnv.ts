'use client';

/**
 * ImmersiveDigitalHuman 的几块独立副作用(从组件文件拆出,effect 内容与顺序不变):
 * 窄屏判断、3DGS / 2D 形象资源、数字员工列表、system 意图、舞台状态推给 VrmStage。
 */
import React from 'react';
import { devLog } from '@/lib/dev-log';
import { API_PREFIX } from '@/lib/api/prefix';
import { authFetch } from '@/lib/api/auth'; // realtime-api 全部要登录
import { logout } from '@/apis/user';
import { probeClips } from './clip-avatar';
import type { VrmStageHandle } from './VrmStage';
import type { ScenePresetName, CameraPresetName, DanceStyle } from './vrm/types';
import { readyGsAssets, type GsAssetItem } from './immersiveUtils';

/** 手机宽度(<900px) */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return narrow;
}

/** 2D 片段能不能播 + 可选的 3DGS 资产(列表 / 当前选中) */
export function useAvatarAssets() {
  const [gsAssets, setGsAssets] = React.useState<GsAssetItem[]>([]);
  const [gsAsset, setGsAsset] = React.useState('');
  // 2D 片段是否真的能播(mp4 不进仓库,没放文件时静态站回退成 index.html)
  const [clipsProblem, setClipsProblem] = React.useState<string | null>('检查中');
  React.useEffect(() => {
    let alive = true;
    probeClips('/avatar/clips.json').then((p) => { if (alive) setClipsProblem(p); });
    return () => { alive = false; };
  }, []);
  React.useEffect(() => {
    const ac = new AbortController();
    authFetch(API_PREFIX + '/api/realtime/assets', { signal: ac.signal }).then((r) => r.json()).then((d) => {
      const list = readyGsAssets((d?.data?.list || []) as { id: string; name: string; mode: string; status: string; active?: boolean; assetUrl?: string }[]);
      setGsAssets((prev) => [...prev.filter((p) => p.id === 'config'), ...list]);
      const active = list.find((a) => a.name.endsWith('(当前)')) || list[0];
      if (active) setGsAsset((cur) => cur || active.assetUrl);
    }).catch(() => {});
    authFetch(API_PREFIX + '/api/realtime/config', { signal: ac.signal }).then((r) => r.json()).then((d) => {
      const u = d?.data?.assetUrl as string | undefined;
      if (u) {
        setGsAssets((prev) => (prev.some((a) => a.assetUrl === u) ? prev : [{ id: 'config', name: '默认资产', assetUrl: u }, ...prev]));
        setGsAsset((cur) => cur || u);
      }
    }).catch(() => {});
    return () => ac.abort();
  }, []);
  return { gsAssets, gsAsset, setGsAsset, clipsProblem };
}

/** 选哪个数字员工对话(worker / frontend / … / builder / 自定义):以前写死 worker,builder 根本没法从这里用 */
export function useStaffList() {
  const [staffList, setStaffList] = React.useState<{ agentId: string; name: string; description: string }[]>([]);
  React.useEffect(() => {
    const ac = new AbortController();
    fetch(API_PREFIX + '/api/agentmanager/multi-agent/staff', { signal: ac.signal }).then((r) => r.json()).then((d) => setStaffList(d.agents || [])).catch(() => {});
    return () => ac.abort();
  }, []);
  return staffList;
}

/** system 意图: 音量/主题/全屏/刷新/登出等实际浏览器操作 */
export function useSystemIntents(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  router: { push: (href: string) => void },
  setTheme: (mode: 'light' | 'dark') => void,
) {
  const preMuteVolumeRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    const applySystem = (e: Event) => {
      const detail = (e as CustomEvent<import('@/lib/intent/types').Intent>).detail
      if (!detail || detail.type !== 'system') return
      const { action: sysAction, params } = detail
      const audio = audioRef.current

      switch (sysAction) {
        case 'volume-up': {
          if (audio) audio.volume = Math.min(1, (audio.volume || 0.5) + 0.1)
          break
        }
        case 'volume-down': {
          if (audio) audio.volume = Math.max(0, (audio.volume || 0.5) - 0.1)
          break
        }
        case 'volume-set': {
          const level = typeof params?.level === 'number' ? params.level : Number(params?.level)
          if (audio && !Number.isNaN(level)) audio.volume = Math.max(0, Math.min(1, level))
          break
        }
        case 'mute': {
          if (audio) {
            preMuteVolumeRef.current = audio.volume
            audio.volume = 0
          }
          break
        }
        case 'unmute': {
          if (audio) {
            const restored = preMuteVolumeRef.current ?? 0.5
            audio.volume = restored > 0 ? restored : 0.5
          }
          break
        }
        case 'theme-light':
          setTheme('light')
          break
        case 'theme-dark':
          setTheme('dark')
          break
        case 'fullscreen-on': {
          const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
          el.requestFullscreen?.().catch(() => {})
          break
        }
        case 'fullscreen-off': {
          const d = document as Document & { exitFullscreen?: () => Promise<void> }
          d.exitFullscreen?.().catch(() => {})
          break
        }
        case 'reload':
          window.location.reload()
          break
        case 'logout': {
          logout().catch(() => {}).finally(() => {
            router.push('/user/login')
          })
          break
        }
        default:
          break
      }
    }
    window.addEventListener('digital-human-system', applySystem)
    return () => window.removeEventListener('digital-human-system', applySystem)
  }, [audioRef, router, setTheme])
}

export interface StageState {
  dancing: boolean;
  danceStyle: DanceStyle;
  bpm: number;
  danceAmp: number;
  scene: ScenePresetName;
  camera: CameraPresetName;
  confetti: boolean;
  autoBlink: boolean;
  lookAtCamera: boolean;
  fov: number;
  songOn: boolean;
  micOn: boolean;
  yOffset: number;
}

/** 把 UI state 推到 VrmStage.handle(每条都打日志,方便排查哪条没生效) */
export function useStageStateSync(stageHandle: VrmStageHandle | null, stageState: StageState) {
  React.useEffect(() => { devLog.debug('[Immersive→handle] setScene', stageState.scene, '| handle:', !!stageHandle); stageHandle?.setScene(stageState.scene); }, [stageHandle, stageState.scene]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setCameraPreset', stageState.camera, '| handle:', !!stageHandle); stageHandle?.setCameraPreset(stageState.camera); }, [stageHandle, stageState.camera]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setDanceStyle', stageState.danceStyle, '| handle:', !!stageHandle); stageHandle?.setDanceStyle(stageState.danceStyle); }, [stageHandle, stageState.danceStyle]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setDancing', stageState.dancing, '| handle:', !!stageHandle); stageHandle?.setDancing(stageState.dancing); }, [stageHandle, stageState.dancing]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setBpm', stageState.bpm, '| handle:', !!stageHandle); stageHandle?.setBpm(stageState.bpm); }, [stageHandle, stageState.bpm]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setDanceAmp', stageState.danceAmp, '| handle:', !!stageHandle); stageHandle?.setDanceAmp(stageState.danceAmp); }, [stageHandle, stageState.danceAmp]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setConfetti', stageState.confetti, '| handle:', !!stageHandle); stageHandle?.setConfetti(stageState.confetti); }, [stageHandle, stageState.confetti]);
  React.useEffect(() => { stageHandle?.setYOffset(stageState.yOffset); }, [stageHandle, stageState.yOffset]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setAutoBlink', stageState.autoBlink); }, [stageState.autoBlink]);  // autoBlink 走 prop，不走 handle
  React.useEffect(() => { devLog.debug('[Immersive→handle] setLookAtCamera', stageState.lookAtCamera); }, [stageState.lookAtCamera]);  // lookAtCamera 走 prop
  // 唱歌/麦克风：on 触发 start，off 触发 stop
  React.useEffect(() => { devLog.debug('[Immersive→handle] songOn', stageState.songOn, '| handle:', !!stageHandle); if (stageHandle) { if (stageState.songOn) stageHandle.startSong(); else stageHandle.stopSong(); } }, [stageHandle, stageState.songOn]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] micOn', stageState.micOn, '| handle:', !!stageHandle); if (stageHandle) { if (stageState.micOn) stageHandle.startMic(); else stageHandle.stopMic(); } }, [stageHandle, stageState.micOn]);
}
