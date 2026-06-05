import type { SignatureMeaning } from './types'

export interface CreateSignatureResult {
  ok: boolean
  signatureId?: number
  error?: string
  passwordRequired?: boolean
}

export interface SignatureView {
  id: number
  recordId: number
  signerId: number
  signerName: string
  meaning: SignatureMeaning
  ts: string
  sigHash: string
}

export interface EsignStatus {
  enabled: boolean
  actions: string[]
}
