import { VerificationPurpose } from '../verification/enums/verification-purpose.enum'

export interface RegistrationTokenPayload {
  sub: string
  email: string
  purpose: VerificationPurpose.Register
}
