import {
  FMP4Muxer,
  H264Encoder,
  HEVCDecoder,
  MSEController,
} from '@hevcjs/core';

import {
  decryptMp4ForNativePlayback,
  decryptSample,
  parseMp4,
  sampleBytes,
  splitNalUnits,
  toAnnexB,
  type Mp4Track,
} from './cenc';

export type HongguoPlaybackMode = 'native' | 'transcode';

export type HongguoPlaybackStatus =
  | 'downloading'
  | 'parsing'
  | 'decrypting'
  | 'transcoding'
  | 'playing'
  | 'ended'
  | 'error';

export interface HongguoPlaybackEvents {
  onStatus?: (status: HongguoPlaybackStatus, detail?: string) => void;
  onProgress?: (ratio: number) => void;
  onMode?: (mode: HongguoPlaybackMode) => void;
  onError?: (error: Error) => void;
  onDuration?: (seconds: number) => void;
}

export interface HongguoPlayerOptions extends HongguoPlaybackEvents {
  video: HTMLVideoElement;
  /** 红果 CDN 的直链 MP4（带签名，会过期） */
  playUrl: string;
  /** 后端 /play 下发的 32 位十六进制内容密钥；未加密时可为空 */
  contentKey?: string;
  /** 强制走 WASM 转码（调试用） */
  forceTranscode?: boolean;
  /** WASM 资源目录，默认 /hevcjs/ */
  wasmBase?: string;
}

const HEVC_PROBES = [
  'video/mp4; codecs="hvc1.1.6.L93.B0"',
  'video/mp4; codecs="hev1.1.6.L93.B0"',
  'video/mp4; codecs="hvc1.1.6.L120.90"',
];

/** 浏览器是否原生支持 HEVC（Safari、带硬件解码的 Chrome/Edge） */
export function canPlayHevcNatively(video: HTMLVideoElement): boolean {
  return HEVC_PROBES.some((type) => {
    const result = video.canPlayType(type);
    return result === 'probably' || result === 'maybe';
  });
}

/**
 * hevc-decode.js 是 Emscripten 的 UMD/classic 脚本，不是 ES Module，
 * 不能用 import() 加载。这里用 <script> 注入，让它挂在 globalThis 上，
 * 然后 HEVCDecoder.create 会走 globalThis.HEVCDecoderModule 分支。
 */
async function loadHevcGlue(scriptUrl: string): Promise<void> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.HEVCDecoderModule === 'function') return;
  if (typeof document === 'undefined') throw new Error('HEVC 解码器只能在浏览器里加载');

  await new Promise<void>((resolve, reject) => {
    const existed = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    const done = () => {
      if (typeof g.HEVCDecoderModule === 'function') resolve();
      else reject(new Error('HEVC 解码器脚本加载后未导出 HEVCDecoderModule'));
    };
    if (existed) {
      existed.addEventListener('load', done, { once: true });
      existed.addEventListener('error', () => reject(new Error('HEVC 解码器脚本加载失败')), {
        once: true,
      });
      if (typeof g.HEVCDecoderModule === 'function') done();
      return;
    }
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = done;
    script.onerror = () => reject(new Error('HEVC 解码器脚本加载失败'));
    document.head.appendChild(script);
  });
}

async function download(url: string, onProgress?: (ratio: number) => void): Promise<Uint8Array> {
  // 红果 CDN 防盗链：带 Referer 直接 403；Origin 无影响（CORS 为 *），禁用 Referer 即可
  const res = await fetch(url, { mode: 'cors', cache: 'no-store', referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error(`视频下载失败: ${res.status}`);

  const total = Number(res.headers.get('content-length') || 0);
  if (!res.body) {
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      if (total > 0) onProgress?.(Math.min(1, loaded / total));
    }
  }

  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function pickAudioCodec(track: Mp4Track | null): string | null {
  if (!track || !track.asc || track.asc.length === 0) return null;
  const objectType = track.asc[0] >> 3;
  return `mp4a.40.${objectType || 2}`;
}

function estimateFps(track: Mp4Track): number {
  if (track.duration > 0) {
    const fps = track.samples.length / (track.duration / track.timescale);
    if (Number.isFinite(fps) && fps > 0) return fps;
  }
  const avg =
    track.samples.reduce((sum, s) => sum + s.duration, 0) / Math.max(1, track.samples.length);
  return avg > 0 ? track.timescale / avg : 25;
}

function estimateBitrate(height: number, fps: number): number {
  if (height >= 1000) return 5_000_000;
  if (height >= 700) return 2_500_000;
  if (height >= 500) return 1_400_000;
  return Math.max(700_000, Math.round(640 * 360 * fps * 0.15));
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * 红果短剧播放器：
 * 1) 拉 MP4（浏览器直连红果 CDN，不经过后端）
 * 2) 解析 MP4 + 用 contentKey 做 CENC AES-CTR 解密
 * 3) H.264 → 解密后直接原生播放（所有浏览器）
 *    HEVC → 原生支持则原生播放（Safari/硬件 HEVC），
 *           不支持则 WASM 解码 HEVC + WebCodecs 转 H.264 + fMP4 喂 MSE
 */
export class HongguoPlayer {
  private options: HongguoPlayerOptions;
  private disposed = false;
  private mode: HongguoPlaybackMode = 'transcode';
  private blobUrl: string | null = null;
  private mse: MSEController | null = null;
  private decoder: HEVCDecoder | null = null;
  private encoder: H264Encoder | null = null;
  private started = false;
  private width = 0;
  private height = 0;

  constructor(options: HongguoPlayerOptions) {
    this.options = options;
  }

  get playbackMode(): HongguoPlaybackMode {
    return this.mode;
  }

  private status(status: HongguoPlaybackStatus, detail?: string) {
    if (this.disposed) return;
    this.options.onStatus?.(status, detail);
  }

  private fail(error: Error) {
    if (this.disposed) return;
    this.options.onStatus?.('error', error.message);
    this.options.onError?.(error);
  }

  dispose() {
    this.disposed = true;
    try {
      this.decoder?.destroy();
    } catch {
      /* noop */
    }
    try {
      this.encoder?.close();
    } catch {
      /* noop */
    }
    try {
      this.mse?.destroy();
    } catch {
      /* noop */
    }
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    const video = this.options.video;
    if (video) {
      video.removeAttribute('src');
      video.load();
    }
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      this.status('downloading');
      const bytes = await download(this.options.playUrl, (ratio) =>
        this.options.onProgress?.(ratio)
      );
      if (this.disposed) return;

      this.status('parsing');
      const parsed = parseMp4(bytes);
      const videoTrack = parsed.video;
      if (!videoTrack) throw new Error('视频里没有找到视频轨');

      if (videoTrack.duration > 0) {
        this.options.onDuration?.(videoTrack.duration / videoTrack.timescale);
      }

      const isH264 = videoTrack.containerFormat === 'avc1';
      const useNative =
        !this.options.forceTranscode &&
        (isH264 || canPlayHevcNatively(this.options.video));

      if (useNative) {
        this.mode = 'native';
        this.options.onMode?.(this.mode);
        this.status(
          'decrypting',
          isH264 ? 'H.264 片源，解密后原生播放' : '浏览器原生支持 HEVC，跳过转码'
        );
        const plain = videoTrack.encrypted
          ? await decryptMp4ForNativePlayback(
              bytes,
              parsed,
              this.options.contentKey || '',
              (done, total) => this.options.onProgress?.(total ? done / total : 0)
            )
          : bytes;
        if (this.disposed) return;

        this.blobUrl = URL.createObjectURL(new Blob([plain], { type: 'video/mp4' }));
        const video = this.options.video;
        video.src = this.blobUrl;
        video.load();
        this.status('playing');
        await video.play().catch(() => {
          /* 自动播放被拦截时由用户手动点播放 */
        });
        return;
      }

      this.mode = 'transcode';
      this.options.onMode?.(this.mode);
      this.status('transcoding', '正在用 WASM 解码 HEVC 并转码 H.264');
      await this.startTranscode(bytes, videoTrack, parsed.audio);
    } catch (error) {
      this.fail(error as Error);
    }
  }

  private async startTranscode(
    bytes: Uint8Array,
    videoTrack: Mp4Track,
    audioTrack: Mp4Track | null
  ): Promise<void> {
    const fps = Math.min(60, Math.max(1, Math.round(estimateFps(videoTrack))));
    const wasmBase = this.options.wasmBase || '/hevcjs/';
    await loadHevcGlue(`${wasmBase}hevc-decode.js`);
    const decoder = await HEVCDecoder.create({
      wasmUrl: `${wasmBase}hevc-decode.js`,
      wasmBinaryUrl: `${wasmBase}hevc-decode.wasm`,
    });
    if (this.disposed) {
      decoder.destroy();
      return;
    }
    this.decoder = decoder;

    if (!(await H264Encoder.checkSupport())) {
      throw new Error('当前浏览器不支持 WebCodecs H.264 编码，无法转码播放');
    }

    const mse = new MSEController(this.options.video);
    this.mse = mse;
    const muxer = new FMP4Muxer();
    const outputTimescale = 90000;
    const audioCodec = audioTrack ? pickAudioCodec(audioTrack) : null;
    const canPassAudio = Boolean(audioTrack && audioCodec && audioTrack.asc);
    const keyHex = this.options.contentKey || '';

    // TS 4.9 闭包收窄问题：用 ref 对象持有 encoder
    const encoderRef: { current: H264Encoder | null } = { current: null };
    let avcC: Uint8Array | null = null;
    let codecString = 'avc1.42E01E';
    let chunks: Array<{ data: Uint8Array; timestamp: number; isKeyframe: boolean }> = [];
    const ptsList = videoTrack.samples.map((s) => s.pts).sort((a, b) => a - b);
    let displayIndex = 0;
    let audioCursor = 0;
    let initSent = false;
    let framesEncoded = 0;
    let lastSegmentBaseUs = 0;
    const gop = Math.max(12, Math.round(fps * 2)); // 每 2 秒一个关键帧，段边界与 GOP 对齐

    const ensureEncoder = (width: number, height: number): H264Encoder => {
      if (encoderRef.current) return encoderRef.current;
      this.width = width;
      this.height = height;
      const encoder = new H264Encoder({
        width,
        height,
        fps,
        bitrate: estimateBitrate(height, fps),
      });
      encoder.onChunk = (chunk) => {
        chunks.push({
          data: chunk.data,
          timestamp: chunk.timestamp,
          isKeyframe: chunk.isKeyframe,
        });
      };
      encoder.onCodecDescription = (description) => {
        avcC = description;
        codecString = encoder.codec;
      };
      encoderRef.current = encoder;
      return encoder;
    };

    const nextFrameTimestampUs = () => {
      const timescale = videoTrack.timescale || 1;
      const slot = Math.min(displayIndex, ptsList.length - 1);
      displayIndex++;
      return Math.round((ptsList[slot] * 1_000_000) / timescale);
    };

    /** 把音频样本按时间窗口解密出来，供 muxSegmentAV 使用 */
    const collectAudio = async (endUs: number) => {
      if (!canPassAudio || !audioTrack) return [];
      const collected: Array<{ data: Uint8Array; pts: number; duration: number }> = [];
      const timescale = audioTrack.timescale || 1;
      while (audioCursor < audioTrack.samples.length) {
        const sample = audioTrack.samples[audioCursor];
        const ptsUs = (sample.pts * 1_000_000) / timescale;
        if (ptsUs > endUs) break;
        const raw = sampleBytes(bytes, sample);
        const data = audioTrack.encrypted
          ? await decryptSample(audioTrack, sample, raw.slice(), keyHex)
          : raw.slice();
        collected.push({ data, pts: ptsUs, duration: sample.duration });
        audioCursor++;
      }
      return collected;
    };

    /** 把当前累计的 chunks + 音频混流成一个 fMP4 段并 append */
    const flushSegment = async (final = false) => {
      const activeEncoder = encoderRef.current;
      if (!activeEncoder || chunks.length === 0) return;
      await activeEncoder.flush();
      if (chunks.length === 0) return;

      if (!initSent) {
        if (!avcC) return; // 首个关键帧还没产出 avcC
        const videoInit = {
          width: this.width,
          height: this.height,
          timescale: outputTimescale,
          avcC,
        };
        if (canPassAudio && audioTrack && audioTrack.asc) {
          const initSegment = muxer.generateInitAV(videoInit, {
            timescale: audioTrack.timescale,
            channelCount: audioTrack.channelCount || 2,
            sampleRate: audioTrack.sampleRate || 44100,
            sampleSize: 16,
            asc: audioTrack.asc,
          });
          await mse.init(initSegment, `${codecString},${audioCodec}`);
        } else {
          const initSegment = muxer.generateInit(videoInit);
          await mse.init(initSegment, codecString);
        }
        initSent = true;
        lastSegmentBaseUs = chunks[0].timestamp;
      }

      const segBaseUs = chunks[0].timestamp;
      const frameDur90k = Math.round(outputTimescale / fps);
      const videoSamples = chunks.map((c) => ({
        data: c.data,
        duration: frameDur90k,
        isKeyframe: c.isKeyframe,
      }));
      const videoBase90k = Math.round(((segBaseUs - lastSegmentBaseUs) * outputTimescale) / 1e6);

      let segment: Uint8Array;
      if (canPassAudio && audioTrack) {
        const endUs = chunks[chunks.length - 1].timestamp;
        const audioSamples = await collectAudio(endUs + 1);
        const audioBase = audioSamples.length
          ? Math.round(audioSamples[0].pts / (1e6 / (audioTrack.timescale || 44100)))
          : 0;
        segment = muxer.muxSegmentAV(
          videoSamples,
          videoBase90k,
          audioSamples.map((a) => ({ data: a.data, duration: a.duration })),
          audioBase
        );
      } else {
        segment = muxer.muxSegment(videoSamples, videoBase90k);
      }
      chunks = [];
      await mse.appendSegment(segment);
      if (final) mse.endOfStream();
    };

    // 逐样本：解密 → Annex B → feed → drain → encode → 按 GOP 切段
    for (let i = 0; i < videoTrack.samples.length; i++) {
      if (this.disposed) return;
      const sample = videoTrack.samples[i];
      const raw = sampleBytes(bytes, sample);
      const plain = videoTrack.encrypted
        ? await decryptSample(videoTrack, sample, raw.slice(), keyHex)
        : raw.slice();
      decoder.feed(toAnnexB(splitNalUnits(plain, videoTrack.nalLengthSize)));

      const suppressed = decoder.takeSuppressedPictures();
      displayIndex += suppressed.length;

      const frames = decoder.drain();
      for (const frame of frames) {
        const enc = ensureEncoder(frame.width, frame.height);
        const tsUs = nextFrameTimestampUs();
        const keyFrame = framesEncoded % gop === 0;
        enc.encode(frame, tsUs, keyFrame);
        framesEncoded++;
        if (framesEncoded % gop === 0) {
          await flushSegment();
          await yieldToEventLoop();
        }
      }
      this.options.onProgress?.((i + 1) / videoTrack.samples.length);
      if (i % 30 === 0) await yieldToEventLoop();
    }

    // 收尾：冲刷解码器里剩余的帧
    const tailFrames = decoder.flush();
    for (const frame of tailFrames) {
      if (this.disposed) return;
      const enc = ensureEncoder(frame.width, frame.height);
      const tsUs = nextFrameTimestampUs();
      enc.encode(frame, tsUs, framesEncoded % gop === 0);
      framesEncoded++;
    }
    await flushSegment();
    const finalEncoder = encoderRef.current;
    if (finalEncoder) await finalEncoder.flush();
    // 冲刷后若还有残余 chunks（不足一个 GOP），作为最后一段
    if (chunks.length > 0) {
      await flushSegment(true);
    } else if (initSent) {
      mse.endOfStream();
    }
    this.status('playing');
  }
}
