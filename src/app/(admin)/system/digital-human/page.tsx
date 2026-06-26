'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { alpha } from '@mui/material/styles';

/**
 * 数字人资产管理页(Blender + COLMAP + 3DGS 路线)。
 *
 * 不走 SMPL-X / FLAME(邮箱 + license 卡死商用)。
 * 完整流水线:
 *   拍摄视频 → COLMAP 重建 → 3DGS(可选)→ clean-mesh → Blender 绑骨 → GLB
 *   一键脚本:bash scripts/avatar-pipeline.sh --input <video> --out <work>
 */
export default function SystemDigitalHumanPage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>
          数字人资产(Blender + COLMAP + 3DGS 路线)
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
          完全开源 · 浏览器本地驱动 · 商用干净(无 SMPL-X / FLAME license)
        </Typography>
      </Box>

      {/* 现状 */}
      <Box sx={{
        p: 2.5, borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: 'background.paper',
        display: 'flex', flexDirection: 'column', gap: 1.5,
      }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>现状</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          前端 three.js + WebGPURenderer 加载 <code>public/avatars/model.glb</code>
          (Blender 导出的可驱动数字人,含 mesh + skeleton + 12 个 BlendShape + animations)。
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          LLM(<code>/api/avatar/chat</code>)决策 <code>emotion / action</code>,
          Edge-TTS 生成音频 + 文本驱动 viseme 时间线;数字人张嘴 + 表情 + 动作。
        </Typography>
      </Box>

      {/* 当前 model.glb 状态卡 */}
      <Box sx={{
        p: 2.5, borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: 'background.paper',
        display: 'flex', flexDirection: 'column', gap: 1.5,
      }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>当前资产</Typography>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <Box component="tbody">
            <Box component="tr">
              <Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>主模型</Box>
              <Box component="td"><code>public/avatars/model.glb</code></Box>
            </Box>
            <Box component="tr">
              <Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>换装</Box>
              <Box component="td">
                <code>outfits/casual.glb</code> · <code>outfits/suit.glb</code> · <code>outfits/sports.glb</code>
              </Box>
            </Box>
            <Box component="tr">
              <Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>场景</Box>
              <Box component="td">
                <code>scenes/office.glb</code> · <code>scenes/park.glb</code>
              </Box>
            </Box>
            <Box component="tr">
              <Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>BlendShape</Box>
              <Box component="td">
                表情:smile / angry / sad / surprised / blink
                <br />
                口型:aa / ih / ou / E / O / U / closed
              </Box>
            </Box>
            <Box component="tr">
              <Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>动作</Box>
              <Box component="td">idle / wave / walk (+ Mixamo 导入的额外动作)</Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 一键管线 */}
      <Box sx={{
        p: 2.5, borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: 'background.paper',
        display: 'flex', flexDirection: 'column', gap: 1.5,
      }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>如何生成 / 替换数字人</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          <strong>方式 A —— Web UI 一键(推荐,二次元 5 分钟 / 真人 30~60 分钟)</strong>
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 2 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            · 二次元:从 10 个预制角色里点选 → 命名 → 完成
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            · 真人:上传本人视频 → 自动过 COLMAP + 3DGS + Blender 绑骨
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1 }}>
          <strong>方式 B —— 命令行(适合自动化 / CI)</strong>
        </Typography>
        <Box sx={{
          p: 1.5, borderRadius: 1,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
          fontFamily: 'monospace', fontSize: 12,
        }}>
          <Box>{`# 1) 手机拍 30 秒慢转 360° 的视频(竖屏,1080p+,充足漫射光)`}</Box>
          <Box>{`bash scripts/capture.sh --input input.mp4 --out work/`}</Box>
          <Box>{`# 2) COLMAP SfM + 稠密重建`}</Box>
          <Box>{`bash scripts/reconstruct-colmap.sh --work work/xiaoqiu`}</Box>
          <Box>{`# 3) 3DGS 训练(可选,需 NVIDIA GPU 8GB+)`}</Box>
          <Box>{`bash scripts/train-3dgs.sh --work work/xiaoqiu`}</Box>
          <Box>{`# 4) 点云 → GLB mesh(需 open3d)`}</Box>
          <Box>{`python scripts/clean-mesh.py --ply work/xiaoqiu/gs/point_cloud/iteration_30000/point_cloud.ply --out work/xiaoqiu/mesh/cleaned.glb`}</Box>
          <Box>{`# 5) Blender 绑骨 + 雕 12 个 BlendShape + 导出`}</Box>
          <Box>{`blender --background --python scripts/blender/rig_mesh.py -- --input work/xiaoqiu/mesh/cleaned.glb --output public/avatars/model.glb`}</Box>
          <Box>{`# 或一条龙:`}</Box>
          <Box>{`bash scripts/avatar-pipeline.sh --input input.mp4 --name xiaoqiu --out work/xiaoqiu [--skip-3dgs] [--mixamo mixamo/]`}</Box>
        </Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          <strong>无视频时(纯程序化占位 demo)</strong>
        </Typography>
        <Box sx={{
          p: 1.5, borderRadius: 1,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
          fontFamily: 'monospace', fontSize: 12,
        }}>
          <Box>{`blender --background --python scripts/blender/build_avatar.py -- --output public/avatars/model.glb`}</Box>
          <Box>{`# 或写实版:`}</Box>
          <Box>{`blender --background --python scripts/blender/build_realistic.py -- --output public/avatars/model-realistic.glb`}</Box>
        </Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          <strong>Mixamo 动作导入</strong>:到 <code>https://www.mixamo.com</code> 下载 FBX,
          用 <code>scripts/blender/import_mixamo.py --fbx &lt;动作&gt;.fbx --target model.glb --output model.glb --action-name 动作名</code> 追加。
        </Typography>
      </Box>

      {/* License 表 */}
      <Box sx={{
        p: 2.5, borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: 'background.paper',
        display: 'flex', flexDirection: 'column', gap: 1.5,
      }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>完全开源链路</Typography>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <Box component="tbody">
            <Box component="tr"><Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>拍摄协议</Box><Box component="td">用户自有视频(无 license)</Box></Box>
            <Box component="tr"><Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>COLMAP</Box><Box component="td">BSD-3,免费商用</Box></Box>
            <Box component="tr"><Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>3DGS</Box><Box component="td">gaussian-splatting(独立子项目),非商用研究 license;商用前确认上游条款</Box></Box>
            <Box component="tr"><Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>Open3D</Box><Box component="td">MIT,免费商用</Box></Box>
            <Box component="tr"><Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>Blender</Box><Box component="td">GPL(Blender 软件本体);导出的 .glb / .fbx 只是数据,不受 GPL 传染</Box></Box>
            <Box component="tr"><Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>Mixamo</Box><Box component="td">免费 Adobe 账号;license 干净,允许商用(详见 Adobe Mixamo 条款)</Box></Box>
            <Box component="tr"><Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>渲染</Box><Box component="td">three.js(MIT)+ WebGPURenderer(W3C 标准)</Box></Box>
            <Box component="tr"><Box component="td" sx={{ py: 0.75, pr: 2, color: 'text.secondary' }}>LLM / TTS</Box><Box component="td">Qwen2.5(Apache 2.0)+ Edge-TTS / CosyVoice2(开源)</Box></Box>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 12, color: 'warning.main', mt: 1 }}>
          ⚠️ 不使用 SMPL-X / FLAME —— 它们的 license 禁商用,且需要学术邮箱注册,本路线完全绕开。
        </Typography>
      </Box>

      {/* 跳转 */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Link href="/avatar-pipeline" style={{ color: 'inherit' }}>
          <Box sx={{
            px: 2, py: 1, borderRadius: 1,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.4)}`,
            fontSize: 13, fontWeight: 600,
          }}>
            Web UI 创建数字人 →
          </Box>
        </Link>
        <Link href="/digital-human" style={{ color: 'inherit' }}>
          <Box sx={{
            px: 2, py: 1, borderRadius: 1,
            border: (t) => `1px solid ${t.palette.divider}`,
            fontSize: 13, fontWeight: 600,
          }}>
            打开数字人页 →
          </Box>
        </Link>
      </Box>
    </Box>
  );
}