import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { StorageModule } from '../storage/storage.module'
import { FfmpegService } from './ffmpeg.service'
import { ImageCompressionService } from './image-compression.service'
import { UploadsController } from './uploads.controller'
import { VideoCompressionService } from './video-compression.service'

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [UploadsController],
  providers: [
    FfmpegService,
    ImageCompressionService,
    VideoCompressionService,
  ],
})
export class UploadsModule {}
