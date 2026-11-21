import { Injectable } from '@nestjs/common'
import { spawn } from 'node:child_process'

/**
 * Thin wrapper around the FFmpeg binary: runs commands with a timeout and
 * reports which encoders the installed build actually supports. Both the video
 * and the image compressors use it so the process handling lives in one place.
 */
@Injectable()
export class FfmpegService {
  private encodersPromise?: Promise<Set<string>>

  run(args: string[], timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // ffmpeg writes logs to stderr; stdout stays unused, so it is ignored to
      // avoid filling an unread pipe while the encoder runs.
      const child = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      let stderr = ''

      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`ffmpeg timed out after ${timeoutMs} ms`))
      }, timeoutMs)

      child.stderr.on('data', (chunk: Buffer) => {
        stderr = `${stderr}${chunk.toString()}`
        if (stderr.length > 4000) {
          stderr = stderr.slice(-4000)
        }
      })

      child.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })

      child.once('close', (code) => {
        clearTimeout(timer)

        if (code === 0) {
          resolve()
          return
        }

        reject(
          new Error(
            `ffmpeg exited with code ${code ?? 'null'}: ${stderr.trim()}`,
          ),
        )
      })
    })
  }

  async hasEncoder(name: string): Promise<boolean> {
    const encoders = await this.encoders()
    return encoders.has(name)
  }

  private encoders(): Promise<Set<string>> {
    if (!this.encodersPromise) {
      this.encodersPromise = new Promise((resolve) => {
        const child = spawn('ffmpeg', ['-hide_banner', '-encoders'], {
          stdio: ['ignore', 'pipe', 'ignore'],
        })
        let output = ''

        child.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString()
        })

        child.once('error', () => resolve(new Set()))

        child.once('close', (code) => {
          if (code !== 0) {
            resolve(new Set())
            return
          }

          const names = new Set<string>()
          const pattern = /^\s*[A-Z.]{6}\s+(\S+)/gm
          let match: RegExpExecArray | null

          while ((match = pattern.exec(output)) !== null) {
            names.add(match[1])
          }

          resolve(names)
        })
      })
    }

    return this.encodersPromise
  }
}
