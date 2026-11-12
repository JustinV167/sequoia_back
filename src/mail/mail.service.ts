import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name)
  private transporter: Transporter | null = null
  private readonly from: string

  constructor(private readonly config: ConfigService) {
    this.from = config.get<string>(
      'MAIL_FROM',
      'Sequoia <no-reply@sequoia.local>',
    )
  }

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST')

    if (!host) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new Error('SMTP_HOST must be set in production')
      }

      this.logger.warn(
        'SMTP_HOST is not set. OTP codes will be logged to the console.',
      )
      return
    }

    const user = this.config.get<string>('SMTP_USER')
    const password = this.config.get<string>('SMTP_PASSWORD')

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT', '587')),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth:
        user && password
          ? {
              user,
              pass: password,
            }
          : undefined,
    })
  }

  async sendRegistrationOtp(email: string, code: string): Promise<void> {
    const subject = 'Tu código de verificación de Sequoia'
    const text = [
      'Tu código de verificación es:',
      '',
      code,
      '',
      'El código vence en 10 minutos.',
      'Si no solicitaste este registro, ignorá este correo.',
    ].join('\n')

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h2 style="color: #14532d;">Verificá tu correo</h2>
        <p>Tu código de verificación es:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #14532d;">${code}</p>
        <p>El código vence en 10 minutos.</p>
        <p style="font-size: 13px; color: #6b7280;">Si no solicitaste este registro, ignorá este correo.</p>
      </div>
    `

    if (!this.transporter) {
      this.logger.log(`[DEV] Registration OTP for ${email}: ${code}`)
      return
    }

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      text,
      html,
    })
  }

  async sendPasswordResetOtp(email: string, code: string): Promise<void> {
    const subject = 'Restablece tu contraseña de Sequoia'
    const text = [
      'Tu código para restablecer la contraseña es:',
      '',
      code,
      '',
      'El código vence en 10 minutos.',
      'Si no solicitaste este cambio, ignorá este correo. Tu contraseña no se modificó.',
    ].join('\n')

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h2 style="color: #14532d;">Restablecé tu contraseña</h2>
        <p>Tu código de verificación es:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #14532d;">${code}</p>
        <p>El código vence en 10 minutos.</p>
        <p style="font-size: 13px; color: #6b7280;">Si no solicitaste este cambio, ignorá este correo. Tu contraseña no se modificó.</p>
      </div>
    `

    if (!this.transporter) {
      this.logger.log(`[DEV] Password reset OTP for ${email}: ${code}`)
      return
    }

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      text,
      html,
    })
  }
}
