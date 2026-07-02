'use client';

/**
 * 录音训练小月唤醒词 — 管理员页面
 *
 * 流程:
 *   1. 点 [开始录音] → 浏览器用 MediaRecorder 录 1.5s
 *   2. 自动回放 + 推进下一条(用户可重新录或跳过)
 *   3. 录到 30+ 条 → 点 [开始训练] → POST /api/train-wake-word
 *   4. 后端跑 Python 训练脚本, 返回新模型
 *   5. 浏览器刷新, 新模型生效
 *
 * 推荐: 录 50-100 条真人声, 5-10 分钟。
 * 越多越准: 100+ 条有显著提升。
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box, Button, Typography, LinearProgress, IconButton, Alert, Chip,
  TextField, Card, CardContent, Divider, Switch, FormControlLabel,
} from '@mui/material';

import MicRoundedIcon from '@mui/icons-material/MicRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';

const TARGET_PHRASE = '小月';
const TARGET_COUNT = 50;  // 目标录音数(够 5 分钟训练)
const RECORD_DURATION_MS = 1500;

interface RecordedClip {
  blob: Blob
  url: string
  duration: number
}

export default function RecordWakePage() {
  const [clips, setClips] = useState<RecordedClip[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [isTraining, setIsTraining] = useState(false)
  const [trainStatus, setTrainStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoRecord, setAutoRecord] = useState(false)
  const [currentModel, setCurrentModel] = useState<string>('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // 加载当前模型状态
  useEffect(() => {
    fetch('/api/train-wake-word')
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setCurrentModel(d.model || '未部署')
        }
      })
      .catch(() => {})
  }, [])

  // 启动麦克风
  const initMic = useCallback(async () => {
    if (streamRef.current) return streamRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      return stream
    } catch (e: any) {
      setError(`麦克风权限被拒: ${e.message}`)
      throw e
    }
  }, [])

  // 录一条
  const recordOne = useCallback(async (): Promise<RecordedClip | null> => {
    setError(null)
    const stream = await initMic()
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    const mr = new MediaRecorder(stream, { mimeType: mime })
    mediaRecorderRef.current = mr
    chunksRef.current = []
    startTimeRef.current = Date.now()

    return new Promise((resolve) => {
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime })
        const duration = Date.now() - startTimeRef.current
        resolve({ blob, url: URL.createObjectURL(blob), duration })
      }
      mr.start()
      setIsRecording(true)

      // 自动停止 RECORD_DURATION_MS 后
      setTimeout(() => {
        if (mr.state === 'recording') {
          mr.stop()
          setIsRecording(false)
        }
      }, RECORD_DURATION_MS)
    })
  }, [initMic])

  // 重新录当前条
  const handleRecord = useCallback(async () => {
    const clip = await recordOne()
    if (!clip) return
    setClips(prev => {
      const next = [...prev]
      next[currentIdx] = clip
      return next
    })
  }, [recordOne, currentIdx])

  // 跳到下一条
  const handleNext = useCallback(() => {
    setCurrentIdx(i => Math.min(i + 1, TARGET_COUNT - 1))
  }, [])

  // 跳过
  const handleSkip = useCallback(() => {
    setClips(prev => {
      const next = [...prev]
      delete next[currentIdx]
      return next
    })
    handleNext()
  }, [currentIdx, handleNext])

  // 删除一条
  const handleDelete = useCallback((idx: number) => {
    setClips(prev => prev.filter((_, i) => i !== idx))
    setCurrentIdx(i => Math.max(0, i - 1))
  }, [])

  // 自动连续录音模式
  useEffect(() => {
    if (!autoRecord) return
    if (currentIdx >= TARGET_COUNT) return

    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      const clip = await recordOne()
      if (cancelled) return
      if (clip) {
        setClips(prev => {
          const next = [...prev]
          next[currentIdx] = clip
          return next
        })
        // 自动推进
        if (currentIdx + 1 < TARGET_COUNT) {
          setTimeout(() => setCurrentIdx(i => i + 1), 800)
        }
      }
    }
    tick()
    return () => { cancelled = true }
  }, [autoRecord, currentIdx, recordOne])

  // 全部录完 → 训练
  const handleTrain = useCallback(async () => {
    const valid = clips.filter((c): c is RecordedClip => !!c)
    if (valid.length < 10) {
      setError(`至少需要 10 条样本, 现在 ${valid.length} 条`)
      return
    }
    setIsTraining(true)
    setTrainStatus(`上传 ${valid.length} 条样本...`)
    setError(null)
    try {
      const fd = new FormData()
      valid.forEach((c, i) => {
        // 把 webm 改成 wav 后缀(后端不做转码, 直接存)
        // TODO: 实际应前端 ffmpeg.wasm 转 wav
        fd.append('files', c.blob, `小月_${String(i + 1).padStart(3, '0')}.webm`)
      })
      const r = await fetch('/api/train-wake-word', { method: 'POST', body: fd })
      const data = await r.json()
      if (!data.ok) {
        setError(data.error || '训练失败')
        setTrainStatus(null)
      } else {
        setTrainStatus(`✓ 训练完成! ${data.saved} 样本, 用时 ${(data.duration / 1000).toFixed(1)}s. 刷新页面加载新模型`)
        // 重新加载模型状态
        fetch('/api/train-wake-word').then(r => r.json()).then(d => {
          if (d.ok) setCurrentModel(d.model)
        })
      }
    } catch (e: any) {
      setError(`请求失败: ${e.message}`)
      setTrainStatus(null)
    } finally {
      setIsTraining(false)
    }
  }, [clips])

  // 释放麦克风
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioContextRef.current?.close()
    }
  }, [])

  const progress = clips.filter(Boolean).length
  const currentClip = clips[currentIdx]

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{  display: "flex", flexDirection: "row", alignItems: "center", gap: 2, mb: 3  }}>
        <SmartToyRoundedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
        <Box>
          <Typography component="h5" variant="h5" sx={{ fontWeight: 600,  }}>训练 "小月" 唤醒词</Typography>
          <Typography component="p" variant="body2" color="text.secondary">
            录你的真人声替换合成数据, 数字人才能真正识别"小月"
          </Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{  display: "flex", flexDirection: "row", alignItems: "center", mb: 1  }}>
            <Typography component="p" variant="body2" color="text.secondary">
              当前模型: <code style={{ fontSize: 11 }}>{currentModel || '加载中...'}</code>
            </Typography>
            <Chip
              size="small"
              label={`${progress} / ${TARGET_COUNT} 条`}
              color={progress >= 30 ? 'success' : progress >= 10 ? 'warning' : 'default'}
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={(progress / TARGET_COUNT) * 100}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {trainStatus && <Alert severity="success" sx={{ mb: 2 }}>{trainStatus}</Alert>}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{  display: "flex", flexDirection: "row", alignItems: "center", gap: 2, mb: 2  }}>
            <Typography component="h6" variant="h6">第 {currentIdx + 1} / {TARGET_COUNT} 条</Typography>
            <Chip label={`请说: "${TARGET_PHRASE}"`} color="primary" />
            <Box sx={{ flex: 1 }} />
            <FormControlLabel
              control={<Switch checked={autoRecord} onChange={(_, v) => setAutoRecord(v)} />}
              label="自动连续"
              sx={{ ml: 2 }}
            />
          </Box>

          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            py: 4, border: '2px dashed', borderColor: 'divider', borderRadius: 2, mb: 2,
            bgcolor: isRecording ? 'error.lighter' : 'transparent',
            transition: 'all 0.2s',
          }}>
            <IconButton
              size="large"
              disabled={isRecording || isTraining}
              onClick={handleRecord}
              sx={{
                width: 80, height: 80,
                bgcolor: isRecording ? 'error.main' : 'primary.main',
                color: 'white',
                '&:hover': { bgcolor: isRecording ? 'error.dark' : 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'grey.300' },
              }}
            >
              {isRecording ? <StopRoundedIcon sx={{ fontSize: 36 }} /> : <MicRoundedIcon sx={{ fontSize: 36 }} />}
            </IconButton>
            <Typography component="p" variant="body2" sx={{ mt: 2,  }} color="text.secondary">
              {isRecording ? `录音中... (${RECORD_DURATION_MS}ms)` : '点麦克风录 1.5 秒'}
            </Typography>
          </Box>

          {currentClip && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'success.lighter', borderRadius: 1 }}>
              <audio src={currentClip.url} controls style={{ flex: 1, height: 36 }} />
              <Chip label={`${currentClip.duration}ms`} size="small" />
              <IconButton size="small" onClick={() => handleDelete(currentIdx)} title="删除">
                <SkipNextRoundedIcon />
              </IconButton>
            </Box>
          )}

          <Box sx={{  display: "flex", flexDirection: "row", gap: 1, mt: 2  }}>
            <Button
              variant="outlined"
              onClick={handleRecord}
              disabled={isRecording || isTraining}
              startIcon={<ReplayRoundedIcon />}
            >
              重录
            </Button>
            <Button
              variant="outlined"
              onClick={handleSkip}
              disabled={isRecording || isTraining}
            >
              跳过
            </Button>
            <Button
              variant="outlined"
              onClick={handleNext}
              disabled={isRecording || isTraining || currentIdx >= TARGET_COUNT - 1}
            >
              下一条
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              size="large"
              onClick={handleTrain}
              disabled={isTraining || progress < 10}
              startIcon={<SmartToyRoundedIcon />}
            >
              {isTraining ? '训练中...' : `开始训练 (${progress} 样本)`}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography component="p" variant="body2" sx={{ fontWeight: 600, mb: 0.5 }} >使用提示</Typography>
        <Typography component="p" variant="caption" >
          • 录音时说"小月"两字(自然语速, 不要刻意慢或快)<br />
          • 变化语调/距离/角度, 让模型更鲁棒<br />
          • 至少 10 条可训练, 30+ 条显著提升, 50+ 条接近产品级<br />
          • 训练在浏览器后台跑 (~30-60s), 完成后刷新页面即生效
        </Typography>
      </Alert>
    </Box>
  )
}