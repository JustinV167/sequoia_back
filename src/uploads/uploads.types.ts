/** Shape of a file parsed by multer's memory storage. */
export type UploadedFilePayload = {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}
