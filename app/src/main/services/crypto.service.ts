import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { CryptoStatus } from '../../shared/module.types'
import type { ConfigService } from './config.service'

const KEY_FILE = '.data-key'
const MAGIC = Buffer.from('PHCAM1')
const IV_LEN = 12
const TAG_LEN = 16
const ENC_PREFIX = 'ENC:'

const TEST_KEY_PREFIX = 'TEST:'

const testSafeStorage = {
  isEncryptionAvailable(): boolean {
    return true
  },
  encryptString(plain: string): Buffer {
    return Buffer.from(TEST_KEY_PREFIX + plain, 'utf8')
  },
  decryptString(encrypted: Buffer): string {
    return encrypted.toString('utf8').slice(TEST_KEY_PREFIX.length)
  }
}

function getSafeStorage(): Electron.SafeStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as typeof import('electron')
    const real = electron.safeStorage
    if (real?.isEncryptionAvailable()) {
      return real
    }
  } catch {
    // Electron Main 미실행 환경
  }

  if (process.env.PHARMCAM_TEST_M8 === '1') {
    return testSafeStorage as unknown as Electron.SafeStorage
  }

  return null
}

export function isUsingTestSafeStorage(): boolean {
  const ss = getSafeStorage()
  return ss === (testSafeStorage as unknown as Electron.SafeStorage)
}

export class CryptoService {
  private readonly keyDir: string

  constructor(
    private readonly configService: ConfigService,
    keyDir?: string
  ) {
    this.keyDir = keyDir ?? join(app.getPath('userData'), 'data')
    mkdirSync(this.keyDir, { recursive: true })
  }

  isEnabled(): boolean {
    return this.configService.get('encryption.enabled') === 'true'
  }

  getStatus(): CryptoStatus {
    const keyPath = join(this.keyDir, KEY_FILE)
    const ss = getSafeStorage()
    return {
      enabled: this.isEnabled(),
      safeStorageAvailable: ss?.isEncryptionAvailable() ?? false,
      keyStored: existsSync(keyPath)
    }
  }

  ensureKey(): Buffer {
    const keyPath = join(this.keyDir, KEY_FILE)
    const ss = getSafeStorage()

    if (ss?.isEncryptionAvailable()) {
      if (existsSync(keyPath)) {
        const encrypted = readFileSync(keyPath)
        const hex = ss.decryptString(encrypted)
        return Buffer.from(hex, 'hex')
      }

      const key = randomBytes(32)
      const encrypted = ss.encryptString(key.toString('hex'))
      writeFileSync(keyPath, encrypted)
      return key
    }

    throw new Error('safeStorage(DPAPI)를 사용할 수 없습니다.')
  }

  encrypt(data: Buffer): Buffer {
    const key = this.ensureKey()
    const iv = randomBytes(IV_LEN)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([MAGIC, iv, tag, encrypted])
  }

  decrypt(data: Buffer): Buffer {
    const key = this.ensureKey()
    if (data.length < MAGIC.length + IV_LEN + TAG_LEN) {
      throw new Error('암호화 데이터가 손상되었습니다.')
    }
    if (!data.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('알 수 없는 암호화 형식입니다.')
    }

    const iv = data.subarray(MAGIC.length, MAGIC.length + IV_LEN)
    const tag = data.subarray(MAGIC.length + IV_LEN, MAGIC.length + IV_LEN + TAG_LEN)
    const ciphertext = data.subarray(MAGIC.length + IV_LEN + TAG_LEN)

    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  encryptString(plain: string): string {
    const enc = this.encrypt(Buffer.from(plain, 'utf8'))
    return ENC_PREFIX + enc.toString('base64')
  }

  decryptString(stored: string): string {
    if (!stored.startsWith(ENC_PREFIX)) {
      return stored
    }
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64')
    return this.decrypt(buf).toString('utf8')
  }

  encryptFile(data: Buffer): Buffer {
    return this.encrypt(data)
  }

  isEncryptedFile(path: string): boolean {
    return path.endsWith('.enc')
  }
}
