'use client';

/**
 * PoseBoneEditor.tsx — 骨骼编辑器面板
 *
 * 与 VrmBoneEditor 配合使用：
 * - 左侧：3D 视图（骨骼可视化 + TransformControls）
 * - 右侧：选中骨骼的详细信息和手动输入
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Slider, Button, Divider, Paper,
} from '@mui/material';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { VrmBoneEditor, type VrmBoneEditorHandle } from './VrmPosePreview';

// 轴向颜色
const AXIS_COLORS = {
  x: '#ff6b6b', // 红色 - 控制手臂上下
  y: '#51cf66', // 绿色 - 控制手臂前后
  z: '#339af0', // 蓝色 - 控制手臂夹紧
};

const AXIS_LABELS = ['X (上下)', 'Y (前后)', 'Z (夹紧)'];

// 预设姿势
const PRESET_POSES: Record<string, Record<string, [number, number, number]>> = {
  idle: {
    leftUpperArm: [0, 0, -1.4], rightUpperArm: [0, 0, 1.4],
    leftLowerArm: [0.3, 0, 0], rightLowerArm: [0.3, 0, 0],
  },
  wave: {
    leftUpperArm: [0, 0, -1.4],
    rightUpperArm: [-1.8, 0, -0.5],
    rightLowerArm: [-0.5, 0, 0],
    leftLowerArm: [0.3, 0, 0],
    neck: [0, -0.15, 0], head: [0, -0.2, 0],
  },
  bothUp: {
    leftUpperArm: [-1.6, 0, -0.5], rightUpperArm: [-1.6, 0, 0.5],
    leftLowerArm: [-0.3, 0, 0], rightLowerArm: [-0.3, 0, 0],
  },
  akimbo: {
    leftUpperArm: [0, 0, -0.6], rightUpperArm: [0, 0, 0.6],
    leftLowerArm: [0, 0, -1.5], rightLowerArm: [0, 0, 1.5],
    spine: [0.1, 0, 0], chest: [0.1, 0, 0],
  },
  pray: {
    spine: [-0.05, 0, 0],
    leftUpperArm: [0.35, 0.0, 1.2], rightUpperArm: [0.35, 0.0, -1.2],
    leftLowerArm: [1.3, 0.0, 0.0], rightLowerArm: [1.3, 0.0, 0.0],
    leftHand: [0.0, 0.0, -0.6], rightHand: [0.0, 0.0, 0.6],
  },
};

export interface PoseBoneEditorHandle {
  getBoneRotations: () => Record<string, [number, number, number]>;
}

interface PoseBoneEditorProps {
  initialRotations?: Record<string, [number, number, number]>;
  onChange?: (rotations: Record<string, [number, number, number]>) => void;
}

export const PoseBoneEditor = forwardRef<PoseBoneEditorHandle, PoseBoneEditorProps>(
  function PoseBoneEditor({ initialRotations = {}, onChange }, ref) {
    const editorRef = useRef<VrmBoneEditorHandle>(null);
    const [boneRotations, setBoneRotations] = useState<Record<string, [number, number, number]>>({});
    const [selectedBone, setSelectedBone] = useState<string | null>(null);

    // 暴露方法
    useImperativeHandle(ref, () => ({
      getBoneRotations: () => editorRef.current?.getBoneRotations() ?? {},
    }), []);

    // 监听骨骼变化
    const handleBoneChange = useCallback((rotations: Record<string, [number, number, number]>) => {
      setBoneRotations(rotations);
      onChange?.(rotations);
    }, [onChange]);

    // 监听骨骼选中
    const handleBoneSelect = useCallback((boneName: string | null) => {
      setSelectedBone(boneName);
    }, []);

    // 应用预设姿势
    const applyPreset = useCallback((presetName: string) => {
      const preset = PRESET_POSES[presetName];
      if (!preset) return;
      editorRef.current?.applyBoneRotations(preset);
    }, []);

    // 重置选中骨骼
    const handleResetSelected = useCallback(() => {
      editorRef.current?.resetSelectedBone();
    }, []);

    // 重置全部
    const handleResetAll = useCallback(() => {
      editorRef.current?.resetToNatural();
      setSelectedBone(null);
    }, []);

    // 导出 JSON
    const handleExport = useCallback(() => {
      const json = JSON.stringify(boneRotations, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        alert('骨骼配置已复制到剪贴板');
      }).catch(() => {
        window.prompt('复制以下配置:', json);
      });
    }, [boneRotations]);

    // 获取选中骨骼的当前值
    const selectedBoneValue = selectedBone ? boneRotations[selectedBone] ?? [0, 0, 0] : null;

    // 骨骼中文名转换
    const boneNameToChinese = (name: string) => {
      return name
        .replace('left', '左').replace('right', '右')
        .replace('UpperArm', '大臂').replace('LowerArm', '小臂')
        .replace('Hand', '手').replace('UpperLeg', '大腿')
        .replace('LowerLeg', '小腿').replace('Foot', '脚')
        .replace('spine', '脊柱').replace('chest', '胸部')
        .replace('neck', '颈部').replace('head', '头部');
    };

    return (
      <Box sx={{ display: 'flex', gap: 2, height: 520 }}>
        {/* 左侧: 3D 编辑器 */}
        <Box sx={{ width: 480, flexShrink: 0 }}>
          <VrmBoneEditor
            ref={editorRef}
            modelUrl="/avatars/character.vrm"
            initialRotations={initialRotations}
            onBoneChange={handleBoneChange}
            onBoneSelect={handleBoneSelect}
          />
        </Box>

        {/* 右侧: 控制面板 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 预设姿势 */}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1, color: 'text.secondary' }}>
              预设姿势
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {Object.entries(PRESET_POSES).map(([name, _]) => (
                <Button
                  key={name}
                  size="small"
                  variant="outlined"
                  onClick={() => applyPreset(name)}
                  sx={{ fontSize: 11, minWidth: 56, height: 28 }}
                >
                  {name === 'idle' ? '自然' : name === 'wave' ? '挥手' : name === 'bothUp' ? '双手举' : name === 'akimbo' ? '叉腰' : '比心'}
                </Button>
              ))}
            </Stack>
          </Paper>

          {/* 选中骨骼详情 */}
          <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                选中骨骼
              </Typography>
              {selectedBone && (
                <Button
                  size="small"
                  startIcon={<RestartAltRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={handleResetSelected}
                  sx={{ fontSize: 11 }}
                >
                  重置
                </Button>
              )}
            </Box>

            {selectedBone ? (
              <>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#ff6b6b', mb: 1.5 }}>
                  {boneNameToChinese(selectedBone)} ({selectedBone})
                </Typography>

                <Stack spacing={1.5}>
                  {[0, 1, 2].map((axis) => (
                    <Box key={axis} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: 11, color: AXIS_COLORS[['x', 'y', 'z'][axis] as keyof typeof AXIS_COLORS], fontWeight: 600, width: 50 }}>
                        {AXIS_LABELS[axis]}
                      </Typography>
                      <Slider
                        size="small"
                        min={-Math.PI}
                        max={Math.PI}
                        step={0.01}
                        value={selectedBoneValue?.[axis] ?? 0}
                        onChange={(_, v) => {
                          if (!selectedBone) return;
                          const newRot = [...(selectedBoneValue ?? [0, 0, 0])];
                          newRot[axis] = v as number;
                          const newRotations = { ...boneRotations, [selectedBone]: newRot as [number, number, number] };
                          editorRef.current?.applyBoneRotations(newRotations);
                        }}
                        sx={{
                          flex: 1,
                          color: AXIS_COLORS[['x', 'y', 'z'][axis] as keyof typeof AXIS_COLORS],
                        }}
                      />
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', width: 60, textAlign: 'right', fontFamily: 'monospace' }}>
                        {(selectedBoneValue?.[axis] ?? 0).toFixed(2)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Typography sx={{ fontSize: 11, color: 'text.secondary', fontFamily: 'monospace' }}>
                  当前值: [{selectedBoneValue?.map(v => v.toFixed(2)).join(', ')}]
                </Typography>
              </>
            ) : (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                  点击左侧模型上的骨骼球体<br />来选中并进行编辑
                </Typography>
              </Box>
            )}
          </Paper>

          {/* 操作按钮 */}
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RestartAltRoundedIcon />}
              onClick={handleResetAll}
              sx={{ fontSize: 11 }}
            >
              重置全部
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={handleExport}
              sx={{ fontSize: 11 }}
            >
              导出配置
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }
);
