export interface ApiSuccessResponse<T = unknown> {
  statusCode: number
  message: string
  data?: T
}

export interface ApiErrorResponse {
  statusCode: number
  message: string
  codeError: string
}
