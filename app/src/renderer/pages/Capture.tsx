import { useEffect, useRef, useState } from 'react'
import type { SessionUser } from '../../shared/auth.types'
import type { StorageSpace } from '../../shared/config.types'
import type { MetadataField } from '../../shared/record.types'

interface CaptureProps {
  user: SessionUser
}

export default function Capture({ user }: CaptureProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [testNo, setTestNo] = useState('')
  const [sampleId, setSampleId] = useState('')
  const [customFields, setCustomFields] = useState<MetadataField[]>([])
  const [metaValues, setMetaValues] = useState<Record<string, string>>({})
  const [space, setSpace] = useState<StorageSpace | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)

  // 카메라 스트림 시작/전환(URS-035). deviceId 지정 시 해당 장치, 없으면 후면(environment) 우선.
  async function startStream(targetDeviceId?: string): Promise<void> {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      const constraints: MediaStreamConstraints = {
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId } }
          : { facingMode: 'environment' },
        audio: false
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraError(null)
      const activeId =
        stream.getVideoTracks()[0]?.getSettings().deviceId ?? targetDeviceId ?? null
      setDeviceId(activeId)
      // 권한 부여 후 label이 채워진 장치 목록 열거
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'videoinput'))
    } catch {
      setCameraError('카메라를 사용할 수 없습니다. 연결 및 권한을 확인하세요.')
    }
  }

  // 다음 카메라로 전환(전면↔후면 또는 다중 카메라 순환)
  function handleSwitchCamera(): void {
    if (devices.length < 2) {
      return
    }
    const idx = devices.findIndex((d) => d.deviceId === deviceId)
    const next = devices[(idx + 1) % devices.length]
    void startStream(next.deviceId)
  }

  useEffect(() => {
    void startStream()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    // 회사별 추가 메타데이터 항목(URS-031) 로드
    window.api.metadata
      .getFields()
      .then((fields) => setCustomFields(fields))
      .catch(() => setCustomFields([]))
  }, [])

  useEffect(() => {
    void loadSpace()
  }, [])

  async function loadSpace(): Promise<void> {
    try {
      setSpace(await window.api.storage.getSpace())
    } catch {
      setSpace(null)
    }
  }

  function setMetaValue(key: string, value: string): void {
    setMetaValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleCapture(): void {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.drawImage(video, 0, 0)
    setPreview(canvas.toDataURL('image/png'))
    setSaveError(null)
    setSaveSuccess(null)
  }

  function handleRetake(): void {
    setPreview(null)
    setSaveError(null)
    setSaveSuccess(null)
  }

  async function handleSave(): Promise<void> {
    if (!preview) {
      return
    }
    if (!testNo.trim()) {
      setSaveError('시험번호는 필수 항목입니다.')
      return
    }

    // 사용자 정의 필수 항목 검증
    const missing = customFields
      .filter((f) => f.required && !(metaValues[f.key] ?? '').trim())
      .map((f) => f.label)
    if (missing.length > 0) {
      setSaveError(`필수 항목을 입력하세요: ${missing.join(', ')}`)
      return
    }

    // 비어있지 않은 추가 항목만 meta로 전달
    const meta: Record<string, string> = {}
    for (const f of customFields) {
      const v = (metaValues[f.key] ?? '').trim()
      if (v) {
        meta[f.key] = v
      }
    }

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(null)

    try {
      const result = await window.api.record.save({
        testNo: testNo.trim(),
        sampleId: sampleId.trim() || undefined,
        imageDataBase64: preview,
        meta: Object.keys(meta).length > 0 ? meta : undefined
      })

      if (result.ok && result.recordId) {
        setSaveSuccess(`기록 #${result.recordId} 저장 완료`)
        setPreview(null)
        void loadSpace()
      } else {
        setSaveError(result.error ?? '저장에 실패했습니다.')
      }
    } catch {
      setSaveError('저장 처리 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="capture-page">
      {space?.lowSpace && (
        <p className="login-error">
          ⚠ 저장공간 부족 경고 — 여유 {space.freeMb}MB (임계치 {space.minFreeMb}MB). 저장 실패가
          발생할 수 있으니 관리자에게 문의하세요. (URS-063)
        </p>
      )}
      <div className="capture-info-banner">
        <h2>촬영 대상 확인 (URS-034)</h2>
        <dl>
          <div>
            <dt>시험번호</dt>
            <dd className="highlight">{testNo.trim() || '— 미입력 —'}</dd>
          </div>
          <div>
            <dt>시료 ID</dt>
            <dd>{sampleId.trim() || '—'}</dd>
          </div>
          <div>
            <dt>작업자</dt>
            <dd className="highlight">
              {user.username} (ID: {user.id})
            </dd>
          </div>
          {customFields.map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>{(metaValues[f.key] ?? '').trim() || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="capture-layout">
        <section className="capture-form">
          <label>
            시험번호 <span className="required">*</span>
            <input
              value={testNo}
              onChange={(e) => setTestNo(e.target.value)}
              placeholder="예: T-2026-001"
            />
          </label>
          <label>
            시료 ID
            <input
              value={sampleId}
              onChange={(e) => setSampleId(e.target.value)}
              placeholder="선택"
            />
          </label>
          {customFields.map((f) => (
            <label key={f.key}>
              {f.label} {f.required && <span className="required">*</span>}
              <input
                value={metaValues[f.key] ?? ''}
                onChange={(e) => setMetaValue(f.key, e.target.value)}
                placeholder={f.required ? '필수' : '선택'}
              />
            </label>
          ))}
        </section>

        <section className="capture-preview">
          {cameraError && <p className="login-error">{cameraError}</p>}
          {/* video는 항상 마운트해 stream 연결을 유지한다(재촬영 시 카메라가 다시 보이도록). */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-video"
            style={{ display: !cameraError && !preview ? 'block' : 'none' }}
          />
          {!cameraError && !preview && devices.length > 0 && (
            <div className="camera-controls">
              <button
                type="button"
                className="secondary-btn"
                onClick={handleSwitchCamera}
                disabled={devices.length < 2}
                title={devices.length < 2 ? '연결된 카메라가 1개뿐입니다' : '다음 카메라로 전환'}
              >
                카메라 전환
              </button>
              <select
                className="setting-input"
                value={deviceId ?? ''}
                onChange={(e) => void startStream(e.target.value)}
                aria-label="카메라 선택"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `카메라 ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {preview && <img src={preview} alt="촬영 미리보기" className="captured-image" />}
          <canvas ref={canvasRef} className="hidden-canvas" />
        </section>
      </div>

      <div className="capture-actions">
        {!preview ? (
          <button type="button" onClick={handleCapture} disabled={!!cameraError}>
            촬영
          </button>
        ) : (
          <>
            <button type="button" className="secondary-btn" onClick={handleRetake} disabled={saving}>
              재촬영
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !testNo.trim()}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </>
        )}
      </div>

      {saveError && <p className="login-error">{saveError}</p>}
      {saveSuccess && <p className="save-success">{saveSuccess}</p>}
    </div>
  )
}
