import type { ConfigEntry } from './types'

export interface SetConfigResult {
  ok: boolean
  error?: string
}

export type ConfigurationSpec = ConfigEntry[]

/** 저장 위치 디스크 여유 공간(URS-063). lowSpace=true면 임계치 미만 경고. */
export interface StorageSpace {
  /** 여유 공간(MB). 측정 실패 시 null */
  freeMb: number | null
  /** 전체 용량(MB) */
  totalMb: number | null
  /** 경고 임계치(MB) — storage.minFreeMb */
  minFreeMb: number
  /** freeMb < minFreeMb 이면 true */
  lowSpace: boolean
}

/** 현재 저장 위치 정보(표시용). root = 데이터 루트, imagesDir = 실제 이미지 폴더. */
export interface StorageInfo {
  /** 현재 적용 중인 데이터 루트 절대경로 */
  root: string
  /** 신규 원본 이미지가 저장되는 폴더(root/images) */
  imagesDir: string
  /** 기본값(userData/data) 사용 중이면 true, 사용자가 지정했으면 false */
  isDefault: boolean
  /** 이미지 폴더가 실제로 존재하는지 */
  exists: boolean
}
