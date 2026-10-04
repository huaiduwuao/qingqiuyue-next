/**
 * lib/world/voice/packet.ts — 创世四期:房间语音的二进制包(和 core-api worldapp/voice.go 对齐)
 *
 *   上行  [0x01][flags][seq u16][n][{len u16, opus}×n]
 *   下行  [0x01][idLen][id…][flags][seq u16][n][{len u16, opus}×n]   服务端在前面插上是谁在说
 *
 * flags 第 0 位 = 这一段话说完了(闸门关上 / 松开按键),收的那边据此尽快收起「在说话」。
 * 多字节整数一律大端。服务端不解析负载,只看总长度(≤ 1400 字节)。
 */

export const VOICE_KIND = 0x01;
export const FLAG_END = 0x01;
export const MAX_UP_BYTES = 1400;

export interface VoicePacket {
  seq: number;
  end: boolean;
  frames: Uint8Array[];
}

export function encodeUp(p: VoicePacket): Uint8Array {
  let size = 5;
  for (const f of p.frames) size += 2 + f.length;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  out[0] = VOICE_KIND;
  out[1] = p.end ? FLAG_END : 0;
  dv.setUint16(2, p.seq & 0xffff);
  out[4] = p.frames.length;
  let o = 5;
  for (const f of p.frames) {
    dv.setUint16(o, f.length);
    out.set(f, o + 2);
    o += 2 + f.length;
  }
  return out;
}

/** 解析 [flags][seq][n][frames…],从 off 开始 */
function decodePayload(b: Uint8Array, off: number): VoicePacket | null {
  if (b.length < off + 4) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const end = (b[off] & FLAG_END) !== 0;
  const seq = dv.getUint16(off + 1);
  const n = b[off + 3];
  let o = off + 4;
  const frames: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    if (o + 2 > b.length) return null;
    const len = dv.getUint16(o);
    if (o + 2 + len > b.length) return null;
    frames.push(b.subarray(o + 2, o + 2 + len));
    o += 2 + len;
  }
  return { seq, end, frames };
}

export function decodeDown(buf: ArrayBuffer | Uint8Array): { id: string; packet: VoicePacket } | null {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b.length < 2 || b[0] !== VOICE_KIND) return null;
  const idLen = b[1];
  if (b.length < 2 + idLen) return null;
  const id = new TextDecoder().decode(b.subarray(2, 2 + idLen));
  const packet = decodePayload(b, 2 + idLen);
  return packet ? { id, packet } : null;
}

/** 服务端做的事:上行包前面插上说话人 id(测试台的 JS 集线器和单测用) */
export function relayFrame(up: Uint8Array, id: string): Uint8Array {
  const idb = new TextEncoder().encode(id);
  const out = new Uint8Array(up.length + 1 + idb.length);
  out[0] = VOICE_KIND;
  out[1] = idb.length;
  out.set(idb, 2);
  out.set(up.subarray(1), 2 + idb.length);
  return out;
}
