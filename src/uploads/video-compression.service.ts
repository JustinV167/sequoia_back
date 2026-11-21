import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FfmpegService } from './ffmpeg.service'
import { VIDEO_EXTENSIONS } from './uploads.constants'
import type { UploadedFilePayload } from './uploads.types'

type VideoCodec = 'h264' | 'hevc' | 'av1'

type CodecDefaults = {
  encoder: string
  /** CRF that roughly matches x264 CRF 18 for each codec. */
  crf: number
  preset: string
  /** Extra output flags (e.g. the `hvc1` tag Safari needs). */
  extra: string[]
}

const ENCODERS: Record<VideoCodec, string> = {
  h264: 'libx264',
  hevc: 'libx265',
  av1: 'libsvtav1',
}

const CODEC_DEFAULTS: Record<VideoCodec, CodecDefaults> = {
  h264: {
    encoder: 'libx264',
    crf: 18,
    preset: 'medium',
    extra: [],
  },
  hevc: {
    encoder: 'libx265',
    crf: 23,
    preset: 'medium',
    extra: ['-tag:v', 'hvc1', '-x265-params', 'log-level=error'],
  },
  av1: {
    encoder: 'libsvtav1',
    crf: 28,
    preset: '8',
    extra: [],
  },
}

const DEFAULT_MIN_BYTES = 8 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000

/**
 * Re-encodes uploaded videos to shrink them without a perceivable quality loss.
 *
 * Supported codecs (selectable with `VIDEO_COMPRESSION_CODEC`):
 * - `h264` (default): universally compatible, CRF 18.
 * - `hevc`: ~40% smaller than H.264 at the same visual quality, CRF 23.
 * - `av1`:  ~45-50% smaller, CRF 28; slower to encode.
 *
 * HEVC/AV1 are not supported by every browser, so the service checks which
 * encoders the installed FFmpeg actually has and falls back automatically.
 * When the result is not smaller than the source, the original file is kept.
 */
@Injectable()
export class VideoCompressionService {
  private readonly logger = new Logger(VideoCompressionService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly ffmpeg: FfmpegService,
  ) {}

  async compress(file: UploadedFilePayload): Promise<UploadedFilePayload> {
    if (!this.booleanValue('VIDEO_COMPRESSION_ENABLED', true)) {
      return file
    }

    const extension = VIDEO_EXTENSIONS[file.mimetype]

    if (!extension) {
      return file
    }

    if (file.size < this.numberValue('VIDEO_COMPRESSION_MIN_BYTES', DEFAULT_MIN_BYTES)) {
      return file
    }

    const codec = await this.pickCodec()

    if (!codec) {
      this.logger.warn(
        'No supported video encoder found in ffmpeg; keeping the original file.',
      )
      return file
    }

    const requestedCodec = this.requestedCodec()

    if (codec !== requestedCodec) {
      this.logger.warn(
        `Encoder for ${requestedCodec} is unavailable; using ${codec} instead.`,
      )
    }

    const timeoutMs = this.numberValue(
      'VIDEO_COMPRESSION_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
    )
    const workDir = await mkdtemp(join(tmpdir(), 'sequoia-video-'))
    const inputPath = join(workDir, `input.${extension}`)
    const outputPath = join(workDir, 'output.mp4')

    try {
      await writeFile(inputPath, file.buffer)
      await this.ffmpeg.run(
        this.buildArgs(codec, inputPath, outputPath),
        timeoutMs,
      )

      const compressed = await stat(outputPath)

      if (compressed.size === 0 || compressed.size >= file.size) {
        this.logger.log(
          `Video kept as-is (original ${file.size} B, re-encoded ${compressed.size} B)`,
        )
        return file
      }

      this.logger.log(
        `Video compressed with ${codec} from ${file.size} B to ${compressed.size} B`,
      )

      return {
        buffer: await readFile(outputPath),
        mimetype: 'video/mp4',
        originalname: `${file.originalname.replace(/\.[^.]+$/, '')}.mp4`,
        size: compressed.size,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Video compression skipped: ${message}`)
      return file
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  private buildArgs(
    codec: VideoCodec,
    inputPath: string,
    outputPath: string,
  ): string[] {
    const defaults = CODEC_DEFAULTS[codec]
    const crf = this.clamp(
      this.numberValue('VIDEO_COMPRESSION_CRF', defaults.crf),
      0,
      codec === 'av1' ? 63 : 51,
    )
    let preset =
      this.config.get<string>('VIDEO_COMPRESSION_PRESET')?.trim() ||
      defaults.preset

    // SVT-AV1 presets are numeric (0-13); ignore textual values.
    if (codec === 'av1' && !/^\d+$/.test(preset)) {
      preset = defaults.preset
    }

    const audioBitrate =
      this.config.get<string>('VIDEO_COMPRESSION_AUDIO_BITRATE')?.trim() ||
      '128k'
    const maxHeight = this.numberValue('VIDEO_COMPRESSION_MAX_HEIGHT', 0)

    const args = [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputPath,
      '-c:v',
      defaults.encoder,
      '-preset',
      preset,
      '-crf',
      String(crf),
      '-pix_fmt',
      'yuv420p',
    ]

    // Resize only when explicitly configured: scaling always loses detail.
    if (maxHeight > 0) {
      args.push('-vf', `scale=-2:min(ih\\,${Math.round(maxHeight)})`)
    }

    args.push(
      ...defaults.extra,
      '-c:a',
      'aac',
      '-b:a',
      audioBitrate,
      '-movflags',
      '+faststart',
      outputPath,
    )

    return args
  }

  private requestedCodec(): VideoCodec {
    const value = this.config
      .get<string>('VIDEO_COMPRESSION_CODEC', 'h264')
      .toLowerCase()

    if (value === 'hevc' || value === 'h265') return 'hevc'
    if (value === 'av1') return 'av1'
    return 'h264'
  }

  /**
   * Uses the requested codec when available and otherwise degrades gracefully:
   * HEVC/AV1 requests fall back to the best remaining encoder, while an
   * explicit H.264 request is never upgraded (maximum compatibility).
   */
  private async pickCodec(): Promise<VideoCodec | null> {
    const requested = this.requestedCodec()
    const candidates: VideoCodec[] =
      requested === 'hevc'
        ? ['hevc', 'av1', 'h264']
        : requested === 'av1'
          ? ['av1', 'hevc', 'h264']
          : ['h264']

    for (const codec of candidates) {
      if (await this.ffmpeg.hasEncoder(ENCODERS[codec])) return codec
    }

    return null
  }

  private numberValue(key: string, fallback: number): number {
    const raw = this.config.get<string | number>(key)

    if (raw === undefined || raw === null || raw === '') {
      return fallback
    }

    const value = Number(raw)
    return Number.isFinite(value) ? value : fallback
  }

  private booleanValue(key: string, fallback: boolean): boolean {
    const raw = this.config.get<string | boolean>(key)

    if (raw === undefined || raw === null || raw === '') {
      return fallback
    }

    const value = String(raw).toLowerCase()
    return value !== 'false' && value !== '0'
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }
}
