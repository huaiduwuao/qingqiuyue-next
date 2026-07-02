/**
 * Streaming ASR — 把 VAD 抓到的人声片段送去 audio-gateway
 *
 * 用 Web Audio API 把 Float32Array 编码成 WAV, 通过 OpenAI 兼容 multipart 上传
 * 返回 { text, language }
 */

const GATEWAY_DEFAULT = typeof window !== 'undefined' ? `${window.location.origin}/api/audio` : 'http://127.0.0.1:8001/v1'

export interface ASROptions {
  gatewayUrl?: string
  model?: string
  language?: string
}

export interface ASRResult {
  text: string
  language: string
}

/** Float32 → 16-bit PCM WAV Blob */
export function encodeWAV(samples: Float32Array, sampleRate = 16000): Blob {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  const writeStr = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)          // fmt chunk size
  view.setUint16(20, 1, true)           // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM data
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

export async function transcribe(samples: Float32Array, opts: ASROptions = {}): Promise<ASRResult> {
  const gateway = opts.gatewayUrl || GATEWAY_DEFAULT
  // 兼容两种 base URL:
  //   - 直连 gateway: "http://localhost:8001/v1"  → 加 /audio/transcriptions
  //   - 经 Next.js 代理: "/api/audio"             → 加 /transcriptions
  // 规则: base 已含 /v1 时再加 /audio, 否则直接加 /audio
  const url = gateway.endsWith('/v1')
    ? `${gateway}/audio/transcriptions`
    : `${gateway.replace(/\/$/, '')}/transcriptions`
  const wav = encodeWAV(samples, 16000)
  const fd = new FormData()
  fd.append('file', wav, 'speech.wav')
  fd.append('model', opts.model || 'qwen3-asr-0.6b')
  fd.append('language', opts.language || 'zh')
  fd.append('response_format', 'json')

  const r = await fetch(url, { method: 'POST', body: fd })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`ASR ${r.status}: ${body.slice(0, 200)}`)
  }
  const j = await r.json()
  return { text: String(j.text || '').trim(), language: j.language || 'zh' }
}