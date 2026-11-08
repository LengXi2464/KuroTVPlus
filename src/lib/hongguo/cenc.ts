/**
 * 红果短剧浏览器端 MP4 解析 + CENC(AES-CTR) 解密。
 *
 * 覆盖红果片源的实际形态：渐进式单文件 MP4，moov 在前，HEVC(hvc1/bytevc1)
 * 或 H.264(avc1) + AAC，cenc scheme，每样本 8 字节 IV 存于 senc box，
 * 视频子样本（clear/cipher 段）加密，音频全样本加密。
 * 不依赖 mp4box；浏览器与 Node 18+ 均可运行（用全局 WebCrypto）。
 */

export interface Mp4Sample {
  offset: number;
  size: number;
  dts: number;
  pts: number;
  duration: number;
  isKeyframe: boolean;
  iv?: Uint8Array;
  subsamples?: Array<{ clear: number; cipher: number }>;
}

export interface Mp4Track {
  kind: 'video' | 'audio';
  trackId: number;
  timescale: number;
  duration: number;
  /** 容器层实际格式（hvc1/bytevc1/avc1/mp4a） */
  format: string;
  /** 加密样本条目的原始格式（frma），未加密时等于 format */
  containerFormat: string;
  /** 样本条目 box type 字段的绝对偏移（原生播放改写 encv->hvc1 用） */
  formatBoxOffset: number;
  width: number;
  height: number;
  channelCount: number;
  sampleRate: number;
  /** HEVC 参数集（Annex B 起始码后的 NAL 列表） */
  parameterSets: Uint8Array[];
  /** 原始 hvcC（转码/MSE 用） */
  hvcc?: Uint8Array;
  /** 原始 avcC */
  avcc?: Uint8Array;
  /** AAC AudioSpecificConfig */
  asc?: Uint8Array;
  encrypted: boolean;
  scheme: string;
  defaultIvSize: number;
  constantIv?: Uint8Array;
  nalLengthSize: number;
  /** 解密后需要改写为 free 的 box type 字段绝对偏移（sinf/senc/saiz/saio） */
  encryptionBoxOffsets: number[];
  samples: Mp4Sample[];
}

export interface Mp4Info {
  tracks: Mp4Track[];
  video: Mp4Track | null;
  audio: Mp4Track | null;
}

interface BoxInfo {
  type: string;
  start: number; // box 起始（含 size/type 头）
  size: number;
  headerSize: number;
  contentStart: number; // start + headerSize
}

const textDecoder = new TextDecoder();

function readU32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function readU64(b: Uint8Array, o: number): number {
  const hi = readU32(b, o);
  const lo = readU32(b, o + 4);
  return hi * 0x100000000 + lo;
}
function readU16(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}
function readType(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
}

/** 枚举 [start,end) 范围内的直接子 box。 */
function childBoxes(b: Uint8Array, start: number, end: number): BoxInfo[] {
  const out: BoxInfo[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = readU32(b, p);
    const type = readType(b, p + 4);
    let headerSize = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = readU64(b, p + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < headerSize || p + size > end) break;
    out.push({ type, start: p, size, headerSize, contentStart: p + headerSize });
    p += size;
  }
  return out;
}

function findChild(b: Uint8Array, start: number, end: number, type: string): BoxInfo | null {
  const boxes = childBoxes(b, start, end);
  for (const box of boxes) if (box.type === type) return box;
  return null;
}

interface EncryptionInfo {
  formatBoxOffset: number;
  originalFormat: string;
  scheme: string;
  ivSize: number;
  constantIv?: Uint8Array;
  encryptionBoxOffsets: number[];
}

interface ParsedStsd {
  format: string;
  width: number;
  height: number;
  channelCount: number;
  sampleRate: number;
  hvcc?: Uint8Array;
  avcc?: Uint8Array;
  asc?: Uint8Array;
  parameterSets: Uint8Array[];
  nalLengthSize: number;
  encryption: EncryptionInfo | null;
}

/** 解析 hvcC：取 NAL 长度字段宽度与 VPS/SPS/PPS。 */
function parseHvcc(data: Uint8Array): { parameterSets: Uint8Array[]; nalLengthSize: number } {
  const sets: Uint8Array[] = [];
  let nalLengthSize = 4;
  if (data.length < 23) return { parameterSets: sets, nalLengthSize };
  nalLengthSize = (data[21] & 0x03) + 1;
  const numArrays = data[22];
  let p = 23;
  for (let a = 0; a < numArrays && p + 3 <= data.length; a++) {
    const nalType = data[p] & 0x3f;
    const count = readU16(data, p + 1);
    p += 3;
    for (let i = 0; i < count && p + 2 <= data.length; i++) {
      const len = readU16(data, p);
      p += 2;
      if (p + len > data.length) break;
      if (nalType === 32 || nalType === 33 || nalType === 34) {
        sets.push(data.slice(p, p + len));
      }
      p += len;
    }
  }
  return { parameterSets: sets, nalLengthSize };
}

/** 解析 esds：取 AudioSpecificConfig（tag 0x05）。 */
function parseEsds(data: Uint8Array): Uint8Array | undefined {
  let p = 4; // 跳过 version/flags
  while (p < data.length) {
    const tag = data[p];
    p++;
    let len = 0;
    for (let i = 0; i < 4 && p < data.length; i++) {
      const c = data[p++];
      len = (len << 7) | (c & 0x7f);
      if (!(c & 0x80)) break;
    }
    if (p + len > data.length) return undefined;
    if (tag === 0x05) return data.slice(p, p + len);
    if (tag === 0x04) {
      // DecoderConfigDescriptor：objectType(1)+streamType(1)+bufferSize(3)+maxBitrate(4)+avgBitrate(4)
      // 之后紧跟 DecoderSpecificInfo(0x05)，继续在其内部找
      const inner = data.slice(p, p + len);
      let q = 13;
      while (q < inner.length) {
        const t2 = inner[q];
        q++;
        let l2 = 0;
        for (let i = 0; i < 4 && q < inner.length; i++) {
          const c = inner[q++];
          l2 = (l2 << 7) | (c & 0x7f);
          if (!(c & 0x80)) break;
        }
        if (t2 === 0x05 && q + l2 <= inner.length) return inner.slice(q, q + l2);
        q += l2;
      }
      return undefined;
    }
    p += len;
  }
  return undefined;
}

/**
 * 解析加密样本条目（encv/enca）内的 sinf 链：
 * frma(原始格式) + schm(scheme) + schi/tenc(默认 IV 信息)。
 */
function parseSinf(
  b: Uint8Array,
  subStart: number,
  subEnd: number,
  entryStart: number
): EncryptionInfo | null {
  let info: EncryptionInfo | null = null;
  const sinf = findChild(b, subStart, subEnd, 'sinf');
  if (!sinf) return null;
  const sinfBoxes = childBoxes(b, sinf.contentStart, sinf.start + sinf.size);
  let originalFormat = '';
  let scheme = '';
  let ivSize = 0;
  let constantIv: Uint8Array | undefined;
  for (const box of sinfBoxes) {
    if (box.type === 'frma') {
      originalFormat = readType(b, box.contentStart);
    } else if (box.type === 'schm') {
      scheme = readType(b, box.contentStart + 4);
    } else if (box.type === 'schi') {
      const tenc = findChild(b, box.contentStart, box.start + box.size, 'tenc');
      if (tenc) {
        // contentStart 指向 box 数据起始（version/flags 之前）
        const base = tenc.contentStart + 4; // 跳过 version(1)+flags(3)
        ivSize = b[base + 3]; // default_Per_Sample_IV_Size
        const constantIvSize = b[base + 20];
        if (ivSize === 0 && constantIvSize > 0) {
          constantIv = b.slice(base + 21, base + 21 + constantIvSize);
        }
      }
    }
  }
  info = {
    formatBoxOffset: entryStart + 4, // 样本条目 type 字段位置（encv/enca）
    originalFormat: originalFormat || 'hvc1',
    scheme: scheme || 'cenc',
    ivSize,
    constantIv,
    encryptionBoxOffsets: [sinf.start + 4],
  };
  return info;
}

function parseStsd(b: Uint8Array, box: BoxInfo, kind: 'video' | 'audio'): ParsedStsd | null {
  const entryCount = readU32(b, box.contentStart + 4);
  if (entryCount < 1) return null;
  let p = box.contentStart + 8;
  if (p + 8 > box.start + box.size) return null;
  const entrySize = readU32(b, p);
  const format = readType(b, p + 4);
  const entryEnd = p + entrySize;

  const out: ParsedStsd = {
    format,
    width: 0,
    height: 0,
    channelCount: 0,
    sampleRate: 0,
    parameterSets: [],
    nalLengthSize: 4,
    encryption: null,
  };

  const isEncrypted = format === 'encv' || format === 'enca';
  const payloadStart = p + 8;
  // 样本条目固定头之后才是子 box 区（视频 78 字节、音频 28 字节）
  const subStart = kind === 'video' ? payloadStart + 78 : payloadStart + 28;

  if (kind === 'video') {
    // VisualSampleEntry：6 保留 + 2 dataref + 16 保留，随后 width/height
    out.width = readU16(b, payloadStart + 24);
    out.height = readU16(b, payloadStart + 26);
    const sub = childBoxes(b, subStart, entryEnd);
    for (const s of sub) {
      if (s.type === 'hvcC') {
        out.hvcc = b.slice(s.start, s.start + s.size);
        const parsed = parseHvcc(b.slice(s.contentStart, s.start + s.size));
        out.parameterSets = parsed.parameterSets;
        out.nalLengthSize = parsed.nalLengthSize;
      } else if (s.type === 'avcC') {
        out.avcc = b.slice(s.start, s.start + s.size);
        if (s.contentStart + 4 < s.start + s.size) {
          out.nalLengthSize = (b[s.contentStart + 4] & 0x03) + 1;
        }
      }
    }
  } else {
    // AudioSampleEntry：6 保留 + 2 dataref + 8 保留 + channel(2)+size(2)+pre(2)+res(2)+rate(4)
    out.channelCount = readU16(b, payloadStart + 16);
    out.sampleRate = readU32(b, payloadStart + 24) >>> 16;
    const sub = childBoxes(b, subStart, entryEnd);
    for (const s of sub) {
      if (s.type === 'esds') {
        out.asc = parseEsds(b.slice(s.contentStart, s.start + s.size));
      }
    }
  }

  if (isEncrypted) {
    out.encryption = parseSinf(b, subStart, entryEnd, p);
  }
  return out;
}

interface TableRefs {
  stts?: BoxInfo;
  ctts?: BoxInfo;
  stss?: BoxInfo;
  stsc?: BoxInfo;
  stsz?: BoxInfo;
  stco?: BoxInfo;
  senc?: BoxInfo;
  saiz?: BoxInfo;
  saio?: BoxInfo;
}

function buildSamples(b: Uint8Array, refs: TableRefs, ivSize: number, constantIv?: Uint8Array): Mp4Sample[] {
  if (!refs.stsc || !refs.stsz || !refs.stco || !refs.stts) return [];

  // stsz
  const stszC = refs.stsz.contentStart;
  const defaultSize = readU32(b, stszC + 4);
  const sampleCount = readU32(b, stszC + 8);
  const sizes = new Array<number>(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    sizes[i] = defaultSize !== 0 ? defaultSize : readU32(b, stszC + 12 + i * 4);
  }

  // stco / co64
  const coC = refs.stco.contentStart;
  const isCo64 = refs.stco.type === 'co64';
  const chunkCount = readU32(b, coC + 4);
  const chunkOffsets = new Array<number>(chunkCount);
  for (let i = 0; i < chunkCount; i++) {
    chunkOffsets[i] = isCo64 ? readU64(b, coC + 8 + i * 8) : readU32(b, coC + 8 + i * 4);
  }

  // stsc
  const stscC = refs.stsc.contentStart;
  const stscCount = readU32(b, stscC + 4);
  const stsc: Array<{ firstChunk: number; samplesPerChunk: number }> = [];
  for (let i = 0; i < stscCount; i++) {
    stsc.push({
      firstChunk: readU32(b, stscC + 8 + i * 12),
      samplesPerChunk: readU32(b, stscC + 8 + i * 12 + 4),
    });
  }

  // 样本 offset
  const offsets = new Array<number>(sampleCount).fill(0);
  let sampleIdx = 0;
  for (let c = 1; c <= chunkCount && sampleIdx < sampleCount; c++) {
    let entry = stsc[0];
    for (const e of stsc) {
      if (e.firstChunk <= c) entry = e;
      else break;
    }
    let offset = chunkOffsets[c - 1];
    for (let i = 0; i < entry.samplesPerChunk && sampleIdx < sampleCount; i++) {
      offsets[sampleIdx] = offset;
      offset += sizes[sampleIdx];
      sampleIdx++;
    }
  }

  // stts：dts 与时长
  const sttsC = refs.stts.contentStart;
  const sttsCount = readU32(b, sttsC + 4);
  const dtsList = new Array<number>(sampleCount).fill(0);
  const durations = new Array<number>(sampleCount).fill(0);
  let dts = 0;
  let si = 0;
  for (let i = 0; i < sttsCount && si < sampleCount; i++) {
    const count = readU32(b, sttsC + 8 + i * 8);
    const delta = readU32(b, sttsC + 8 + i * 8 + 4);
    for (let j = 0; j < count && si < sampleCount; j++) {
      dtsList[si] = dts;
      durations[si] = delta;
      dts += delta;
      si++;
    }
  }

  // ctts：pts 偏移（version 1 为有符号）
  const pts = dtsList.slice();
  if (refs.ctts) {
    const cttsC = refs.ctts.contentStart;
    const version = b[cttsC];
    const cttsCount = readU32(b, cttsC + 4);
    let idx = 0;
    for (let i = 0; i < cttsCount && idx < sampleCount; i++) {
      const count = readU32(b, cttsC + 8 + i * 8);
      let off = readU32(b, cttsC + 8 + i * 8 + 4);
      if (version === 1 && off >= 0x80000000) off -= 0x100000000;
      for (let j = 0; j < count && idx < sampleCount; j++) {
        pts[idx] = dtsList[idx] + off;
        idx++;
      }
    }
  }

  // stss：关键帧
  const keyframes = new Set<number>();
  if (refs.stss) {
    const stssC = refs.stss.contentStart;
    const n = readU32(b, stssC + 4);
    for (let i = 0; i < n; i++) keyframes.add(readU32(b, stssC + 8 + i * 4) - 1);
  }

  const samples: Mp4Sample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    samples.push({
      offset: offsets[i],
      size: sizes[i],
      dts: dtsList[i],
      pts: pts[i],
      duration: durations[i],
      isKeyframe: refs.stss ? keyframes.has(i) : true,
    });
  }

  // senc：每样本 IV 与子样本布局
  if (refs.senc) {
    const sencC = refs.senc.contentStart;
    const flags = (b[sencC + 1] << 16) | (b[sencC + 2] << 8) | b[sencC + 3];
    const count = readU32(b, sencC + 4);
    const hasSubsamples = (flags & 0x02) !== 0;
    const perIv = ivSize > 0 ? ivSize : 8;
    let p = sencC + 8;
    for (let i = 0; i < count && i < samples.length; i++) {
      if (p + perIv > b.length) break;
      samples[i].iv = b.slice(p, p + perIv);
      p += perIv;
      if (hasSubsamples && p + 2 <= b.length) {
        const subCount = readU16(b, p);
        p += 2;
        const subs: Array<{ clear: number; cipher: number }> = [];
        for (let s = 0; s < subCount && p + 6 <= b.length; s++) {
          subs.push({ clear: readU16(b, p), cipher: readU32(b, p + 2) });
          p += 6;
        }
        samples[i].subsamples = subs;
      }
    }
  }

  if (constantIv) {
    for (const s of samples) if (!s.iv) s.iv = constantIv;
  }
  return samples;
}

/** 解析整个 MP4，返回音视频轨（含加密信息与样本表）。 */
export function parseMp4(buffer: Uint8Array): Mp4Info {
  const top = childBoxes(buffer, 0, buffer.length);
  const moov = top.find((t) => t.type === 'moov');
  if (!moov) throw new Error('MP4 缺少 moov box');
  const tracks: Mp4Track[] = [];

  for (const trak of childBoxes(buffer, moov.contentStart, moov.start + moov.size)) {
    if (trak.type !== 'trak') continue;
    const tkhd = findChild(buffer, trak.contentStart, trak.start + trak.size, 'tkhd');
    const mdia = findChild(buffer, trak.contentStart, trak.start + trak.size, 'mdia');
    if (!mdia) continue;
    const mdhd = findChild(buffer, mdia.contentStart, mdia.start + mdia.size, 'mdhd');
    const hdlr = findChild(buffer, mdia.contentStart, mdia.start + mdia.size, 'hdlr');
    const minf = findChild(buffer, mdia.contentStart, mdia.start + mdia.size, 'minf');
    if (!mdhd || !hdlr || !minf) continue;
    const stbl = findChild(buffer, minf.contentStart, minf.start + minf.size, 'stbl');
    if (!stbl) continue;

    const mdhdC = mdhd.contentStart;
    const mdhdVersion = buffer[mdhdC];
    const timescale = readU32(buffer, mdhdC + (mdhdVersion === 1 ? 20 : 12));
    const duration = mdhdVersion === 1
      ? readU64(buffer, mdhdC + 24)
      : readU32(buffer, mdhdC + 16);

    // handler: version/flags(4) + pre_defined(4) + handler_type(4)
    const handlerType = readType(buffer, hdlr.contentStart + 8);
    const kind: 'video' | 'audio' | null =
      handlerType === 'vide' ? 'video' : handlerType === 'soun' ? 'audio' : null;
    if (!kind) continue;

    let trackId = 0;
    if (tkhd) {
      const v = buffer[tkhd.contentStart];
      trackId = readU32(buffer, tkhd.contentStart + (v === 1 ? 20 : 12));
    }

    const refs: TableRefs = {};
    let stsdBox: BoxInfo | null = null;
    for (const box of childBoxes(buffer, stbl.contentStart, stbl.start + stbl.size)) {
      if (box.type === 'stsd') stsdBox = box;
      else if (box.type === 'stts') refs.stts = box;
      else if (box.type === 'ctts') refs.ctts = box;
      else if (box.type === 'stss') refs.stss = box;
      else if (box.type === 'stsc') refs.stsc = box;
      else if (box.type === 'stsz') refs.stsz = box;
      else if (box.type === 'stco' || box.type === 'co64') refs.stco = box;
      else if (box.type === 'senc') refs.senc = box;
      else if (box.type === 'saiz') refs.saiz = box;
      else if (box.type === 'saio') refs.saio = box;
    }
    if (!stsdBox) continue;
    const stsd = parseStsd(buffer, stsdBox, kind);
    if (!stsd) continue;

    const enc = stsd.encryption;
    const encryptionBoxOffsets = enc ? enc.encryptionBoxOffsets.slice() : [];
    if (refs.senc) encryptionBoxOffsets.push(refs.senc.start + 4);
    if (refs.saiz) encryptionBoxOffsets.push(refs.saiz.start + 4);
    if (refs.saio) encryptionBoxOffsets.push(refs.saio.start + 4);

    const samples = buildSamples(
      buffer,
      refs,
      enc ? enc.ivSize : 0,
      enc ? enc.constantIv : undefined
    );

    tracks.push({
      kind,
      trackId,
      timescale,
      duration,
      format: enc ? enc.originalFormat : stsd.format,
      containerFormat: enc ? enc.originalFormat : stsd.format,
      formatBoxOffset: enc ? enc.formatBoxOffset : 0,
      width: stsd.width,
      height: stsd.height,
      channelCount: stsd.channelCount,
      sampleRate: stsd.sampleRate,
      parameterSets: stsd.parameterSets,
      hvcc: stsd.hvcc,
      avcc: stsd.avcc,
      asc: stsd.asc,
      encrypted: enc !== null,
      scheme: enc ? enc.scheme : '',
      defaultIvSize: enc ? enc.ivSize : 0,
      constantIv: enc ? enc.constantIv : undefined,
      nalLengthSize: stsd.nalLengthSize,
      encryptionBoxOffsets,
      samples,
    });
  }

  let video: Mp4Track | null = null;
  let audio: Mp4Track | null = null;
  for (const t of tracks) {
    if (t.kind === 'video' && !video) video = t;
    if (t.kind === 'audio' && !audio) audio = t;
  }
  return { tracks, video, audio };
}

// ==================== CENC 解密 ====================

const keyCache = new Map<string, Promise<CryptoKey>>();

function importKey(keyHex: string): Promise<CryptoKey> {
  let p = keyCache.get(keyHex);
  if (!p) {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) bytes[i] = parseInt(keyHex.substr(i * 2, 2), 16);
    p = crypto.subtle.importKey('raw', bytes, { name: 'AES-CTR' }, false, ['decrypt']);
    keyCache.set(keyHex, p);
  }
  return p;
}

function ctrBlock(iv: Uint8Array): Uint8Array {
  const counter = new Uint8Array(16);
  if (iv.length >= 16) counter.set(iv.subarray(0, 16));
  else counter.set(iv, 0); // 8 字节 IV + 8 字节 0
  return counter;
}

/** 解密一个样本（原地不动，返回新数组）。子样本只解密 cipher 段，且 keystream 连续。 */
export async function decryptSample(
  track: Mp4Track,
  sample: Mp4Sample,
  encrypted: Uint8Array,
  keyHex: string
): Promise<Uint8Array> {
  const iv = sample.iv || track.constantIv;
  if (!iv) throw new Error('样本缺少 IV');
  const key = await importKey(keyHex);
  const counter = ctrBlock(iv);
  const alg = { name: 'AES-CTR', counter, length: 64 };

  if (!sample.subsamples || sample.subsamples.length === 0) {
    const plain = await crypto.subtle.decrypt(alg, key, encrypted);
    return new Uint8Array(plain);
  }

  // 拼接所有 cipher 段一次解密（CTR keystream 连续），再按布局回填
  let cipherTotal = 0;
  for (const s of sample.subsamples) cipherTotal += s.cipher;
  const cipherBuf = new Uint8Array(cipherTotal);
  {
    let src = 0;
    let dst = 0;
    for (const s of sample.subsamples) {
      src += s.clear;
      cipherBuf.set(encrypted.subarray(src, src + s.cipher), dst);
      src += s.cipher;
      dst += s.cipher;
    }
  }
  const plainCipher = new Uint8Array(await crypto.subtle.decrypt(alg, key, cipherBuf));
  const out = encrypted.slice();
  {
    let src = 0;
    let dst = 0;
    for (const s of sample.subsamples) {
      src += s.clear;
      out.set(plainCipher.subarray(dst, dst + s.cipher), src);
      src += s.cipher;
      dst += s.cipher;
    }
  }
  return out;
}

/** 取样本密文字节。 */
export function sampleBytes(buffer: Uint8Array, sample: Mp4Sample): Uint8Array {
  return buffer.subarray(sample.offset, sample.offset + sample.size);
}

/**
 * 整文件解密 + 去加密信令，产出可被浏览器 <video> 原生播放的 MP4：
 *  - 逐样本 AES-CTR 解密（原地写回拷贝）
 *  - 样本条目 encv/enca 改写为原始格式（hvc1/avc1/mp4a）
 *  - sinf/senc/saiz/saio box type 改写为 free
 */
export async function decryptMp4ForNativePlayback(
  buffer: Uint8Array,
  parsed: Mp4Info,
  keyHex: string,
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const plain = buffer.slice();
  const jobs: Array<{ track: Mp4Track; sample: Mp4Sample }> = [];
  for (const track of parsed.tracks) {
    if (!track.encrypted) continue;
    for (const sample of track.samples) jobs.push({ track, sample });
  }
  let done = 0;
  const CONCURRENCY = 8;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(({ track, sample }) =>
        decryptSample(track, sample, sampleBytes(plain, sample), keyHex)
      )
    );
    for (let j = 0; j < batch.length; j++) {
      plain.set(results[j], batch[j].sample.offset);
    }
    done += batch.length;
    onProgress?.(done, jobs.length);
  }
  for (const track of parsed.tracks) {
    if (!track.encrypted) continue;
    writeType(plain, track.formatBoxOffset, track.containerFormat);
    for (const off of track.encryptionBoxOffsets) writeType(plain, off, 'free');
  }
  return plain;
}

function writeType(b: Uint8Array, offset: number, type: string) {
  for (let i = 0; i < 4; i++) b[offset + i] = type.charCodeAt(i);
}

// ==================== NAL 工具（转码路径用） ====================

/** 把 MP4 长度前缀格式的样本拆成 NAL 单元列表。 */
export function splitNalUnits(data: Uint8Array, nalLengthSize: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  let p = 0;
  while (p + nalLengthSize <= data.length) {
    let len = 0;
    for (let i = 0; i < nalLengthSize; i++) len = len * 256 + data[p + i];
    p += nalLengthSize;
    if (len <= 0 || p + len > data.length) break;
    out.push(data.subarray(p, p + len));
    p += len;
  }
  return out;
}

const START_CODE = new Uint8Array([0, 0, 0, 1]);

/** NAL 列表拼接为 Annex B 流。 */
export function toAnnexB(nals: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const n of nals) total += n.length + 4;
  const out = new Uint8Array(total);
  let p = 0;
  for (const n of nals) {
    out.set(START_CODE, p);
    out.set(n, p + 4);
    p += n.length + 4;
  }
  return out;
}
