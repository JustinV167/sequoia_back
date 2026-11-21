import { resolve } from 'node:path'

import type { ConfigService } from '@nestjs/config'

/**
 * Uploaded course images and videos live outside the database under
 * `courses/{courseId}/{images|videos}/...`. The default points inside the
 * docker-compose source bind mount so files survive container restarts in
 * development; configure `UPLOADS_DIR` for production deployments.
 */
export function getUploadsDir(config: ConfigService): string {
  return resolve(
    process.cwd(),
    config.get<string>('UPLOADS_DIR', 'src/uploads/files'),
  )
}
