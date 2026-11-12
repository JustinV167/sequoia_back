import type { Request } from 'express'

export interface ClientMeta {
  ipAddress: string | null
  userAgent: string | null
}

export function getClientMeta(request: Request): ClientMeta {
  return {
    ipAddress: request.ip || null,
    userAgent: request.get('user-agent') ?? null,
  }
}
