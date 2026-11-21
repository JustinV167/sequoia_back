import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FfmpegService } from './ffmpeg.service'
import type { UploadedFilePayload } from './uploads.types'

const INPUT_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
}

const DEFAULT_MIN_BYTES = 50 * 1024
const DEFAULT_TIMEOUT_MS = 60 * 1000

/**
 * Shrinks uploaded images **without any quality loss** by converting PNG and
 * GIF files to lossless WebP. JPEGs are also attempted: lossless WebP is
 * usually bigger for photos, and in that case the original file is kept.
 *
 * The original is returned whenever compression is disabled, the result is not
 * smaller, FFmpeg/WebP support is missing, or anything fails.
 */
@Injectable()
export class ImageCompressionService {
  private readonly logger = new Logger(ImageCompressionService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly ffmpeg: FfmpegService,
  ) {}

  async compress(file: UploadedFilePayload): Promise<UploadedFilePayload> {
    if (!this.booleanValue('IMAGE_COMPRESSION_ENABLED', true)) {
      return file
    }

    const extension = INPUT_EXTENSIONS[file.mimetype]

    if (!extension) {
      return file
    }

    if (file.size < this.numberValue('IMAGE_COMPRESSION_MIN_BYTES', DEFAULT_MIN_BYTES)) {
      return file
    }

    const animated = file.mimetype === 'image/gif'
    const encoder = animated ? 'libwebp_anim' : 'libwebp'

    if (!(await this.ffmpeg.hasEncoder(encoder))) {
      this.logger.warn(
        `ffmpeg has no ${encoder} encoder; keeping the original image.`,
      )
      return file
    }

    const timeoutMs = this.numberValue(
      'IMAGE_COMPRESSION_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
    )
    const workDir = await mkdtemp(join(tmpdir(), 'sequoia-image-'))
    const inputPath = join(workDir, `input.${extension}`)
    const outputPath = join(workDir, 'output.webp')

    try {
      await writeFile(inputPath, file.buffer)

      const args = [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inputPath,
        '-c:v',
        encoder,
        '-lossless',
        '1',
      ]

      // Lossless WebP keeps every pixel; compression_level only trades CPU for
      // a slightly smaller file.
      if (!animated) {
        args.push('-compression_level', '6')
      } else {
        args.push('-loop', '0')
      }

      args.push(outputPath)
      await this.ffmpeg.run(args, timeoutMs)

      const compressed = await stat(outputPath)

      if (compressed.size === 0 || compressed.size >= file.size) {
        this.logger.log(
          `Image kept as-is (original ${file.size} B, WebP ${compressed.size} B)`,
        )
        return file
      }

      this.logger.log(
        `Image compressed from ${file.size} B to ${compressed.size} B`,
      )

      return {
        buffer: await readFile(outputPath),
        mimetype: 'image/webp',
        originalname: `${file.originalname.replace(/\.[^.]+$/, '')}.webp`,
        size: compressed.size,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Image compression skipped: ${message}`)
      return file
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
    }
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
}
