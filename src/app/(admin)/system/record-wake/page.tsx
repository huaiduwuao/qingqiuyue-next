'use client';

/**
 * 录音训练小月唤醒词 — 管理员页面
 *
 * 流程:
 *   1. 点 [开始录音] → 浏览器用 MediaRecorder 录 1.5s
 *   2. 自动回放 + 推进下一条(用户可重新录或跳过)
 *   3. 录到 30+ 条 → 点 [开始训练] → POST /api/core/train-wake-word
 *   4. 后端跑 Python 训练脚本, 返回新模型
 *   5. 浏览器刷新, 新模型生效
 *
 * 推荐: 录 50-100 条真人声, 5-10 分钟。
 * 越多越准: 100+ 条有显著提升。
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Button, Typography, LinearProgress, IconButton, Alert, Chip,
  Card, CardContent, Switch, FormControlLabel } from '@mui/material';

import MicRoundedIcon from '@mui/icons-material/MicRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';

const TARGET_PHRASE = '小月';
const TARGET_COUNT = 50;  // 目标录音数(够 5 分钟训练)
const RECORD_DURATION_MS = 1500;

interface RecordedClip {
  blob: Blob
  url: string
  duration: number
}

// 将 AudioBuffer 编码为 WAV (PCM 16-bit mono)
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels
  const length = buffer.length * numOfChan * 2 + 44
  const arrBuffer = new ArrayBuffer(length)
  const view = new DataView(arrBuffer)
  const channels: Float32Array[] = []
  let sample = 0
  let offset = 0
  let pos = 0

  // write WAVE header
  setUint32(0x46464952) // "RIFF"
  setUint32(length - 8) // file length - 8
  setUint32(0x45564157) // "WAVE"

  setUint32(0x20746d66) // "fmt " chunk
  setUint32(16) // length = 16
  setUint16(1) // PCM (uncompressed)
  setUint16(numOfChan)
  setUint32(buffer.sampleRate)
  setUint32(buffer.sampleRate * 2 * numOfChan) // avg. bytes/sec
  setUint16(numOfChan * 2) // block-align
  setUint16(16) // 16-bit (hardcoded in this demo)

  setUint32(0x61746164) // "data" - chunk
  setUint32(length - pos - 4) // chunk length

  // write interleaved data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  while (pos < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][pos])) // clamp
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true) // write little endian
      offset += 2
    }
    pos++
  }

  return new Blob([arrBuffer], { type: 'audio/wav' })

  function setUint16(data: number) {
    view.setUint16(pos, data, true)
    pos += 2
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true)
    pos += 4
  }
}

// 使用 Web Audio API 将录制得到的 webm/opus 解码并转码为 WAV
async function convertClipToWav(clip: RecordedClip): Promise<Blob> {
  const mime = clip.blob.type || 'audio/webm'
  if (!mime.includes('audio/webm') && !mime.includes('audio/ogg')) {
    throw new Error(`不支持的音频格式: ${mime}`)
  }
  const ctx = new AudioContext()
  const arrayBuffer = await clip.blob.arrayBuffer()
  const decoded = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  // 下混为单声道(唤醒词训练需要单声道)
  const offline = new OfflineAudioContext(1, decoded.length, decoded.sampleRate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const mono = await offline.startRendering()
  return audioBufferToWav(mono)
}

async function tryLoadFfmpeg() {
  // 若项目后续安装 @ffmpeg/ffmpeg,可在此动态加载并转码;
  // 当前未安装,直接返回 null,让调用方使用 Web Audio API 兜底。
  return null
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
  const [modelDetail, setModelDetail] = useState<any>(null)
  const [hasAutoStarted, setHasAutoStarted] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // 加载当前模型状态
  const loadModelStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/core/train-wake-word')
      const d = await r.json()
      if (d.ok) {
        setCurrentModel(d.model || '未部署')
        setModelDetail(d)
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadModelStatus()
  }, [loadModelStatus])

  // 自动开始录音(进页面 2s 后, 让用户先看清界面)
  useEffect(() => {
    if (hasAutoStarted) return
    if (currentModel === '' && modelDetail === null) return
    const t = setTimeout(() => {
      setAutoRecord(true)
      setHasAutoStarted(true)
    }, 2000)
    return () => clearTimeout(t)
  }, [hasAutoStarted, currentModel, modelDetail])

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
    setTrainStatus(`转换 ${valid.length} 条音频格式...`)
    setError(null)
    try {
      const ffmpeg = await tryLoadFfmpeg()
      const wavBlobs: { blob: Blob; name: string }[] = []
      for (let i = 0; i < valid.length; i++) {
        const c = valid[i]
        if (!c.blob.type || (!c.blob.type.includes('audio/webm') && !c.blob.type.includes('audio/ogg'))) {
          throw new Error(`第 ${i + 1} 条音频格式不支持: ${c.blob.type || '未知'}`)
        }
        let wavBlob: Blob
        if (ffmpeg) {
          // 若 ffmpeg.wasm 可用,应走 ffmpeg 转码(当前未安装,预留)
          throw new Error('ffmpeg 转码未实现')
        } else {
          wavBlob = await convertClipToWav(c)
        }
        wavBlobs.push({
          blob: wavBlob,
          name: `小月_${String(i + 1).padStart(3, '0')}.wav`,
        })
      }
      setTrainStatus(`上传 ${valid.length} 条样本...`)
      const fd = new FormData()
      wavBlobs.forEach(({ blob, name }) => {
        fd.append('files', blob, name)
      })
      const r = await fetch('/api/core/train-wake-word', { method: 'POST', body: fd })
      const data = await r.json()
      if (!data.ok) {
        setError(data.error || '训练失败')
        setTrainStatus(null)
        setIsTraining(false)
        return
      }
      // 沙盒异步训练: POST 返回 taskId,轮询 GET 直到训练完成 + 模型自动部署
      if (!data.training || !data.taskId) {
        setTrainStatus(`✓ 已上传 ${data.saved} 样本`)
        setIsTraining(false)
        return
      }
      setTrainStatus(`样本已提交,沙盒训练中(约1-2分钟)...`)
      const deadline = Date.now() + 8 * 60 * 1000
      let done = false
      while (Date.now() < deadline) {
        await new Promise(res => setTimeout(res, 5000))
        try {
          const sr = await fetch('/api/core/train-wake-word')
          const sd = await sr.json()
          if (!sd.ok) continue
          if (sd.taskStatus === 'succeeded') {
            setTrainStatus(`✓ 训练完成,模型已自动部署! recall 见训练日志. 刷新页面即可用新模型唤醒`)
            fetch('/api/core/train-wake-word').then(r => r.json()).then(d => { if (d.ok) setCurrentModel(d.model) })
            done = true
            break
          }
          if (sd.taskStatus === 'failed' || sd.taskStatus === 'timeout') {
            setError(`训练失败(${sd.taskStatus}),查看沙盒任务日志`)
            done = true
            break
          }
          setTrainStatus(`沙盒训练中... (${sd.taskStatus || 'running'})`)
        } catch { /* 轮询失败继续 */ }
      }
      if (!done) setError('训练超时(8分钟未完成),请到沙盒任务页查看')
      setIsTraining(false)
    } catch (e: any) {
      setError(`处理失败: ${e.message}`)
      setTrainStatus(null)
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

      <Card sx={{ mb: 2, background: 'linear-gradient(135deg, rgba(254,44,85,0.08) 0%, rgba(139,92,246,0.08) 100%)' }}>
        <CardContent>
          <Box sx={{  display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", mb: 2  }}>
            <Box sx={{  display: "flex", flexDirection: "row", alignItems: "center", gap: 1  }}>
              <GraphicEqRoundedIcon color="primary" />
              <Typography component="h6" variant="h6" sx={{ fontWeight: 600,  }}>当前唤醒词模型</Typography>
            </Box>
            <Chip
              size="small"
              label={`${progress} / ${TARGET_COUNT} 条`}
              color={progress >= 30 ? 'success' : progress >= 10 ? 'warning' : 'default'}
            />
          </Box>
          {modelDetail ? (
            <Box sx={{  display: "grid", gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 2  }}>
              <Box>
                <Typography component="p" variant="caption" color="text.secondary">模型文件</Typography>
                <Typography component="p" variant="body2" sx={{ fontWeight: 600, fontSize: 13,  }}>
                  {modelDetail.modelSize > 0 ? `${(modelDetail.modelSize / 1024).toFixed(1)} KB` : '未部署'}
                </Typography>
              </Box>
              <Box>
                <Typography component="p" variant="caption" color="text.secondary">最后训练</Typography>
                <Typography component="p" variant="body2" sx={{ fontWeight: 600, fontSize: 13,  }}>
                  {modelDetail.modelMtime ? new Date(modelDetail.modelMtime).toLocaleString('zh-CN', { hour12: false }) : '-'}
                </Typography>
              </Box>
              <Box>
                <Typography component="p" variant="caption" color="text.secondary">正样本数</Typography>
                <Typography component="p" variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: 'primary.main'  }}>
                  {modelDetail.positiveSamples}
                </Typography>
              </Box>
              <Box>
                <Typography component="p" variant="caption" color="text.secondary">最后准确度</Typography>
                <Typography component="p" variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: modelDetail.trainingLog?.final_recall > 0.7 ? 'success.main' : 'warning.main' }}>
                  {modelDetail.trainingLog?.final_recall !== undefined
                    ? `recall ${(modelDetail.trainingLog.final_recall * 100).toFixed(0)}%`
                    : '-'}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography component="p" variant="body2" color="text.secondary">加载中...</Typography>
          )}
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