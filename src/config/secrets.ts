import { ConfigService } from '@nestjs/config'

export function getSecret(
  config: ConfigService,
  key: string,
  developmentFallback: string,
): string {
  const value = config.get<string>(key)

  if (value && value.trim().length > 0) {
    return value
  }

  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error(`${key} must be set in production`)
  }

  return developmentFallback
}
