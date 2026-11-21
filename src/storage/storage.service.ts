import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import { getUploadsDir } from '../uploads/uploads.config'

export type StorageKind = 'images' | 'videos'

export type StoreFileOptions = {
  buffer: Buffer
  courseId: string
  kind: StorageKind
  extension: string
  contentType: string
}

type StorageDriver = 'local' | 'supabase'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Stores course assets under `courses/{courseId}/{images|videos}/{uuid}.{ext}`,
 * both on local disk and in Supabase Storage. Keeping the same key layout in
 * both drivers makes migrating existing files straightforward.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  constructor(private readonly config: ConfigService) {}

  async save(options: StoreFileOptions): Promise<string> {
    if (!UUID_PATTERN.test(options.courseId)) {
      throw new AppException(
        400,
        ErrorCodes.InvalidRequest,
        'A valid course id is required to upload files.',
      )
    }

    const key = `courses/${options.courseId}/${options.kind}/${randomUUID()}.${options.extension}`

    if (this.driver() === 'supabase') {
      return this.saveToSupabase(key, options)
    }

    return this.saveLocally(key, options.buffer)
  }

  private driver(): StorageDriver {
    return this.config.get<string>('STORAGE_DRIVER', 'local').toLowerCase() ===
      'supabase'
      ? 'supabase'
      : 'local'
  }

  private async saveLocally(key: string, buffer: Buffer): Promise<string> {
    const path = join(getUploadsDir(this.config), key)

    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, buffer)

    return `/uploads/${key}`
  }

  private async saveToSupabase(
    key: string,
    options: StoreFileOptions,
  ): Promise<string> {
    const url = this.config.get<string>('SUPABASE_URL')?.trim().replace(/\/$/, '')
    const serviceRoleKey = this.config
      .get<string>('SUPABASE_SERVICE_ROLE_KEY')
      ?.trim()
    const bucket =
      this.config.get<string>('SUPABASE_BUCKET')?.trim() || 'sequoia'
    const encodedKey = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')

    if (!url || !serviceRoleKey) {
      throw new AppException(
        500,
        ErrorCodes.InternalError,
        'Supabase storage is not configured.',
      )
    }

    let response: Response

    try {
      response = await fetch(
        `${url}/storage/v1/object/${bucket}/${encodedKey}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': options.contentType,
            'x-upsert': 'false',
          },
          // Node's fetch accepts a Buffer directly; the ambient typings do not
          // model it as BodyInit.
          body: options.buffer as unknown as BodyInit,
        },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Supabase upload failed: ${message}`)
      throw new AppException(
        502,
        ErrorCodes.BadGateway,
        'Could not reach the storage bucket.',
      )
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      this.logger.error(
        `Supabase upload failed (${response.status}): ${detail}`,
      )
      throw new AppException(
        502,
        ErrorCodes.BadGateway,
        'Could not store the file in the bucket.',
      )
    }

    const configuredBase = this.config
      .get<string>('SUPABASE_PUBLIC_BASE_URL')
      ?.trim()
      .replace(/\/$/, '')
    const publicBase =
      configuredBase || `${url}/storage/v1/object/public/${bucket}`

    return `${publicBase}/${encodedKey}`
  }
}
