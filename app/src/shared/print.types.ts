export interface ControlledPrintPreviewResult {
  ok: boolean
  html?: string
  error?: string
}

export interface ControlledPrintResult {
  ok: boolean
  printJobId?: number
  error?: string
}

export interface ControlledPrintTemplateInput {
  recordId: number
  testNo: string
  captureTs: string
  userId: string
  fileName: string
  imageDataUrl: string
}

