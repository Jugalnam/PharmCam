import type { ConfigEntry } from './types'

export interface SetConfigResult {
  ok: boolean
  error?: string
}

export type ConfigurationSpec = ConfigEntry[]
