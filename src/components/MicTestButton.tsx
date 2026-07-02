'use client'

/**
 * 麦克风测试组件 — 用于诊断麦克风信号
 *
 * 点开后:
 *  1. 实时显示原始能量 + getUserMedia 实际配置
 *  2. 看说话时能量是否变化 (是否被 AGC 压扁)
 *  3. 录音 5 秒回放 (听自己录到没)
 */

import React from 'react'
import { Box, IconButton, Typography, Button, Switch, FormControlLabel } from '@mui/material'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

export function MicTestButton() {
  const [open, setOpen] = React.useState(false)
  const [recording, setRecording] = React.useState(false)
  const [energy, setEnergy] = React.useState(0)
  const [peak, setPeak] = React.useState(0)
  const [level, setLevel] = React.useState(50)  // 0-100
  const [settings, setSettings] = React.useState<MediaTrackSettings | null>(null)
  const [bypassAgc, setBypassAgc] = React.useState(true)
  const [recordedUrl, setRecordedUrl] = React.useState<string | null>(null)
  const [deviceName, setDeviceName] = React.useState<string>('')
  const [copied, setCopied] = React.useState(false)

  const streamRef = React.useRef<MediaStream | null>(null)
  const ctxRef = React.useRef<AudioContext | null>(null)
  const procRef = React.useRef<ScriptProcessorNode | null>(null)
  const recRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const peakResetRef = React.useRef(0)

  const start = React.useCallback(async () => {
    if (recording) return
    setOpen(true)
    setRecordedUrl(null)
    chunksRef.current = []
    peakResetRef.current = 0

    try {
      const constraints: MediaStreamConstraints = {
        audio: bypassAgc ? {
          // 强制关掉所有处理
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Chrome 实验性: 显式告诉浏览器不要强制 AGC
          // @ts-expect-error Chrome 实验性约束,标准类型未包含
          googAutoGainControl: false,
        } : undefined
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      const track = stream.getAudioTracks()[0]
      setDeviceName(track.label || '未知设备')
      setSettings(track.getSettings())

      // AudioContext
      const ctx = new AudioContext()
      ctxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      procRef.current = proc

      proc.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0)
        let sum = 0
        let max = 0
        for (let i = 0; i < data.length; i++) {
          const v = data[i]
          sum += v * v
          if (Math.abs(v) > max) max = Math.abs(v)
        }
        const rms = Math.sqrt(sum / data.length)
        setEnergy(rms)
        // peak 在 2 秒内重置 (避免一直累加)
        if (Date.now() - peakResetRef.current > 2000) {
          setPeak(rms)
          peakResetRef.current = Date.now()
        } else if (rms > peak) {
          setPeak(rms)
        }
        // 根据 level 调整 (0-100 模拟系统麦克风音量条)
        const simLevel = Math.min(100, Math.max(0, Math.log10(rms * 1000 + 0.001) * 25 + 50))
        setLevel(simLevel)
      }
      src.connect(proc)
      const gain = ctx.createGain()
      gain.gain.value = 0
      proc.connect(gain)
      gain.connect(ctx.destination)

      // MediaRecorder 录 5 秒
      try {
        const rec = new MediaRecorder(stream)
        recRef.current = rec
        chunksRef.current = []
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          setRecordedUrl(URL.createObjectURL(blob))
        }
        rec.start()
        setRecording(true)
        // 5 秒后自动停止
        setTimeout(() => {
          if (rec.state === 'recording') {
            rec.stop()
            setRecording(false)
          }
        }, 5000)
      } catch (e) {
        console.warn('MediaRecorder not supported:', e)
      }
    } catch (e) {
      const err = e as Error
      console.error('麦克风启动失败:', err)
      alert('麦克风启动失败: ' + err.message)
      setOpen(false)
    }
  }, [recording, bypassAgc, peak])

  const stop = React.useCallback(() => {
    if (recRef.current && recRef.current.state === 'recording') {
      recRef.current.stop()
    }
    setRecording(false)
    if (procRef.current) { try { procRef.current.disconnect() } catch {} }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (ctxRef.current) { try { ctxRef.current.close() } catch {} ; ctxRef.current = null }
    setOpen(false)
  }, [])

  const copyResults = React.useCallback(async () => {
    const lines = [
      '【麦克风测试结果】',
      `设备: ${deviceName || '未知'}`,
      `实时能量 (RMS): ${energy.toFixed(6)} ${energy > 0.01 ? '✅ OK' : '⚠️ 偏低'}`,
      `2秒峰值: ${peak.toFixed(6)}`,
      `模拟音量: ${Math.round(level)}/100`,
      `强制关 AGC/降噪: ${bypassAgc ? '开' : '关'}`,
      `录音状态: ${recording ? '录音中 (5秒自动停)' : (recordedUrl ? '已停止, 回放已生成' : '已停止, 无回放')}`,
      settings ? '设备设置:' : '设备设置: 未获取',
      ...(settings ? [
        `  echoCancellation: ${String(settings.echoCancellation)}`,
        `  noiseSuppression: ${String(settings.noiseSuppression)}`,
        `  autoGainControl: ${String(settings.autoGainControl)} ${settings.autoGainControl ? '⚠️ 强制开了 AGC' : '✅ 已关'}`,
        `  sampleRate: ${settings.sampleRate || '?'} Hz`,
      ] : []),
      `浏览器: ${navigator.userAgent}`,
    ]
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('复制失败:', e)
      // fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [deviceName, energy, peak, level, bypassAgc, recording, recordedUrl, settings])

  // 自动清理
  React.useEffect(() => {
    return () => { if (recording) stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <IconButton
        size="small"
        data-no-drag
        onClick={(e) => { e.stopPropagation(); start() }}
        sx={{
          bgcolor: 'rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.7)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
        }}
        title="麦克风测试"
      >
        <GraphicEqIcon sx={{ fontSize: 14 }} />
      </IconButton>

      {open && (
        <Box
          data-no-drag
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'fixed',
            top: 80, right: 16, zIndex: 2000,
            width: 360,
            bgcolor: 'rgba(20,20,30,0.95)',
            color: 'white',
            borderRadius: 2,
            p: 2,
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(124,58,237,0.4)',
            boxShadow: 4,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>麦克风测试</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button
                size="small"
                startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                onClick={copyResults}
                sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, minWidth: 0, textTransform: 'none' }}
              >
                {copied ? '已复制' : '复制结果'}
              </Button>
              <IconButton size="small" onClick={stop}><CloseIcon fontSize="small" /></IconButton>
            </Box>
          </Box>

          <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mb: 0.5 }}>
            设备: {deviceName || '获取中...'}
          </Typography>

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={bypassAgc}
                onChange={(e) => setBypassAgc(e.target.checked)}
                disabled={recording}
              />
            }
            label={<Typography variant="caption">强制关 AGC/降噪</Typography>}
            sx={{ mb: 0.5 }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: recording ? '#ef4444' : '#10b981', animation: recording ? 'pulse 1s infinite' : 'none' }} />
            <Typography variant="caption">{recording ? '录音中 (5秒自动停)' : '点击开始测试'}</Typography>
          </Box>

          <Typography variant="caption" sx={{ display: 'block', opacity: 0.7 }}>
            实时能量 (RMS): <span style={{ color: energy > 0.01 ? '#10b981' : '#ef4444' }}>
              {energy.toFixed(6)}
            </span> {energy > 0.01 ? '✅ OK' : '⚠️ 偏低'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.7 }}>
            2秒峰值: {peak.toFixed(6)}
          </Typography>

          <Box sx={{
            height: 12, mt: 1, mb: 1,
            bgcolor: 'rgba(255,255,255,0.1)',
            borderRadius: 1, overflow: 'hidden', position: 'relative',
          }}>
            <Box sx={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${level}%`,
              bgcolor: level > 30 ? '#10b981' : level > 10 ? '#f59e0b' : '#ef4444',
              transition: 'width 100ms',
            }} />
          </Box>

          {settings && (
            <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, fontSize: 10, fontFamily: 'monospace' }}>
              <div>echoCancellation: {String(settings.echoCancellation)}</div>
              <div>noiseSuppression: {String(settings.noiseSuppression)}</div>
              <div style={{ color: settings.autoGainControl ? '#ef4444' : '#10b981' }}>
                autoGainControl: {String(settings.autoGainControl)} {settings.autoGainControl ? '⚠️ 强制开了 AGC' : '✅ 已关'}
              </div>
              <div>sampleRate: {settings.sampleRate || '?'} Hz</div>
            </Box>
          )}

          {recordedUrl && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.7, mb: 0.5 }}>
                录了 5 秒, 听回放 ↓
              </Typography>
              <audio src={recordedUrl} controls style={{ width: '100%', height: 32 }} />
            </Box>
          )}

          <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.5, fontSize: 10 }}>
            💡 说话时 RMS 应 &gt; 0.01。若始终 0.0001, 是 Chrome 强制 AGC, 关不掉
          </Typography>
        </Box>
      )}
    </>
  )
}
