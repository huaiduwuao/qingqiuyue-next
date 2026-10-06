'use client';

import Box from '@mui/material/Box';
import { CoverImage } from '@/components/common/CoverImage';

/**
 * 黑胶唱片 + 唱臂(音乐详情页的封面)。
 *
 * 往真实里做的几处:
 * - 33⅓ 转/分(1.8 秒一圈),暂停时停在原地(animation-play-state),不是跳回 0°;
 * - 唱片上的反光不跟着转 —— 光源是房间里的灯,所以高光单独一层、静止;
 * - 纹路分区:外沿光边、密纹区、内圈走带区(光面)、封面贴在标签纸位置、中心轴;
 * - 唱臂播放时落到外圈,随播放进度向内移动,暂停 / 未播放时抬回托架。
 */
export function VinylRecord({
  cover,
  alt,
  playing,
  progress = 0,
}: {
  cover?: string | null;
  alt?: string;
  playing: boolean;
  /** 播放进度 0..1,唱臂随之向内移动 */
  progress?: number;
}) {
  const p = Math.min(1, Math.max(0, progress || 0));
  // 角度按唱片 / 唱臂的相对位置算的:18° 针尖落在外圈(约 86% 半径),28° 到走带区边上。
  const armAngle = playing ? 18 + p * 10 : 0;

  return (
    <Box sx={{ position: 'relative', width: '100%', maxWidth: 340, mx: 'auto', aspectRatio: '1 / 1' }}>
      {/* 唱片 */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: '8%',
          width: '84%',
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          boxShadow: '0 22px 44px rgba(0,0,0,0.55), 0 6px 14px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* 转动层:纹路 + 封面标签 */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            animation: 'vinyl-spin 1.8s linear infinite',
            animationPlayState: playing ? 'running' : 'paused',
            '@keyframes vinyl-spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
            background: [
              // 压制时留下的不均匀:转起来才看得出唱片在动
              'conic-gradient(from 0deg, rgba(255,255,255,0.025), rgba(255,255,255,0) 25%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 75%, rgba(255,255,255,0.025))',
              // 外沿光边 / 歌曲之间的间隔光带 / 内圈走带区
              'radial-gradient(circle, transparent 0 38%, #070707 38% 41%, transparent 41% 63%, rgba(0,0,0,0.6) 63% 63.8%, transparent 63.8% 78%, rgba(0,0,0,0.6) 78% 78.8%, transparent 78.8% 96.5%, #161616 96.5% 99%, #050505 99%)',
              // 密纹
              'repeating-radial-gradient(circle, #0b0b0b 0 1px, #1b1b1b 1.4px, #0e0e0e 2px)',
            ].join(','),
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: '32%',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: '0 0 0 2px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            <CoverImage src={cover} alt={alt} loading="eager" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </Box>
        </Box>
        {/* 静止的反光:两道对角高光 + 整体一点弧面明暗 */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            pointerEvents: 'none',
            background: [
              'conic-gradient(from 20deg, transparent 0deg, rgba(255,255,255,0.16) 18deg, rgba(255,255,255,0.04) 34deg, transparent 52deg, transparent 180deg, rgba(255,255,255,0.12) 198deg, rgba(255,255,255,0.03) 214deg, transparent 232deg)',
              'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.07), transparent 60%)',
            ].join(','),
            // 反光只落在胶面上,封面标签是纸,不反光
            WebkitMaskImage: 'radial-gradient(circle, transparent 0 18.2%, #000 18.6%)',
            maskImage: 'radial-gradient(circle, transparent 0 18.2%, #000 18.6%)',
          }}
        />
        {/* 中心轴 */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '3.2%',
            aspectRatio: '1 / 1',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #f4f4f4, #9a9a9a 55%, #4a4a4a)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        />
      </Box>

      {/* 唱臂:绕右上角的轴转 */}
      <Box
        component="svg"
        aria-hidden
        viewBox="0 0 100 300"
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '30%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
          transformOrigin: '70% 15%',
          transform: `rotate(${armAngle}deg)`,
          // 落臂 / 抬臂慢一点,播放中随进度挪动则几乎看不出在动
          transition: 'transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: 'drop-shadow(4px 10px 6px rgba(0,0,0,0.45))',
        }}
      >
        <defs>
          <linearGradient id="vinyl-arm-metal" x1="0" x2="1">
            <stop offset="0" stopColor="#8d8d8d" />
            <stop offset="0.45" stopColor="#f2f2f2" />
            <stop offset="1" stopColor="#7a7a7a" />
          </linearGradient>
          <radialGradient id="vinyl-arm-base" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#e8e8e8" />
            <stop offset="0.6" stopColor="#9b9b9b" />
            <stop offset="1" stopColor="#474747" />
          </radialGradient>
        </defs>
        {/* 配重 */}
        <rect x="61" y="0" width="18" height="20" rx="3" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
        {/* 轴座 */}
        <circle cx="70" cy="30" r="13" fill="url(#vinyl-arm-base)" />
        <circle cx="70" cy="30" r="4" fill="#3a3a3a" />
        {/* 臂管 */}
        <path d="M70 30 L70 222 L55 252" fill="none" stroke="url(#vinyl-arm-metal)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        {/* 唱头 */}
        <g transform="rotate(28 55 252)">
          <rect x="47" y="246" width="16" height="22" rx="2" fill="#1f1f1f" stroke="#666" strokeWidth="1" />
          <rect x="62" y="250" width="7" height="2.5" rx="1" fill="#bbb" />
        </g>
      </Box>
    </Box>
  );
}
