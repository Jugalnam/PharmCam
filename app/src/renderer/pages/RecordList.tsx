import { Fragment, useEffect, useState } from 'react'
import type {
  MetadataField,
  RecordDetail,
  RecordFilter,
  RecordListItem,
  RecordUserOption
} from '../../shared/record.types'
import type { SessionUser } from '../../shared/auth.types'
import type { EsignStatus, SignatureView } from '../../shared/sign.types'
import type { SignatureMeaning } from '../../shared/types'

interface RecordListProps {
  user: SessionUser
}

const MEANING_LABELS: Record<SignatureMeaning, string> = {
  author: '작성 (author)',
  review: '검토 (review)',
  approve: '승인 (approve)'
}

function todayLocalDate(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayStartIso(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined
}

function dayEndIso(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined
}

export default function RecordList({ user }: RecordListProps): JSX.Element {
  const [records, setRecords] = useState<RecordListItem[]>([])
  const [selected, setSelected] = useState<RecordDetail | null>(null)
  const [metaFields, setMetaFields] = useState<MetadataField[]>([])
  const [recordUsers, setRecordUsers] = useState<RecordUserOption[]>([])
  const [fromDate, setFromDate] = useState(todayLocalDate())
  const [toDate, setToDate] = useState(todayLocalDate())
  const [operatorFilter, setOperatorFilter] = useState('')
  const [signatures, setSignatures] = useState<SignatureView[]>([])
  const [esignStatus, setEsignStatus] = useState<EsignStatus | null>(null)
  const [signMeaning, setSignMeaning] = useState<SignatureMeaning>('approve')
  const [signPassword, setSignPassword] = useState('')
  const [signError, setSignError] = useState<string | null>(null)
  const [signSuccess, setSignSuccess] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [printPreviewHtml, setPrintPreviewHtml] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const [printSuccess, setPrintSuccess] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canSignReviewApprove = user.role === 'reviewer' || user.role === 'admin'
  const canFilterByUser = user.role === 'reviewer' || user.role === 'admin'

  useEffect(() => {
    loadRecords()
    window.api.metadata.getFields().then(setMetaFields).catch(() => {})
    window.api.sign.getStatus().then(setEsignStatus).catch(() => {})
    if (canFilterByUser) {
      window.api.record.listUsers().then(setRecordUsers).catch(() => {})
    }
  }, [])

  async function loadRecords(
    override?: { fromDate?: string; toDate?: string; operatorFilter?: string }
  ): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const effectiveFrom = override?.fromDate ?? fromDate
      const effectiveTo = override?.toDate ?? toDate
      const effectiveOperator = override?.operatorFilter ?? operatorFilter
      const filter: RecordFilter = {
        fromTs: dayStartIso(effectiveFrom),
        toTs: dayEndIso(effectiveTo),
        limit: 200
      }
      if (canFilterByUser && effectiveOperator) {
        filter.operatorId = Number(effectiveOperator)
      }
      const data = await window.api.record.list(filter)
      setRecords(data)
      if (selected && !data.some((r) => r.id === selected.id)) {
        setSelected(null)
      }
    } catch {
      setError('기록 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(id: number): Promise<void> {
    setSignError(null)
    setSignSuccess(null)
    setSignPassword('')
    setPrintPreviewHtml(null)
    setPrintError(null)
    setPrintSuccess(null)
    try {
      const [detail, sigs] = await Promise.all([
        window.api.record.get(id),
        window.api.sign.list(id)
      ])
      setSelected(detail)
      setSignatures(sigs)
    } catch {
      setError('기록 상세를 불러올 수 없습니다.')
    }
  }

  async function handleOpenPrintPreview(): Promise<void> {
    if (!selected) {
      return
    }

    setPreviewLoading(true)
    setPrintError(null)
    setPrintSuccess(null)

    try {
      const result = await window.api.record.getPrintPreview(selected.id)
      if (result.ok && result.html) {
        setPrintPreviewHtml(result.html)
      } else {
        setPrintError(result.error ?? '인쇄 미리보기를 생성할 수 없습니다.')
      }
    } catch (err) {
      setPrintError(
        err instanceof Error ? err.message : '인쇄 미리보기 생성 중 오류가 발생했습니다.'
      )
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleControlledPrint(): Promise<void> {
    if (!selected) {
      return
    }

    setPrinting(true)
    setPrintError(null)
    setPrintSuccess(null)

    try {
      const result = await window.api.record.printControlled(selected.id)
      if (result.ok) {
        setPrintSuccess(`통제 인쇄 기록 완료 (Print Job ID: ${result.printJobId})`)
        setPrintPreviewHtml(null)
      } else {
        setPrintError(result.error ?? '인쇄가 실패하거나 취소되었습니다.')
      }
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : '인쇄 처리 중 오류가 발생했습니다.')
    } finally {
      setPrinting(false)
    }
  }

  async function handleSign(): Promise<void> {
    if (!selected) {
      return
    }

    setSigning(true)
    setSignError(null)
    setSignSuccess(null)

    try {
      const result = await window.api.sign.create(selected.id, signMeaning, signPassword)
      if (result.ok) {
        setSignSuccess(`서명 완료 (ID: ${result.signatureId})`)
        setSignPassword('')
        const sigs = await window.api.sign.list(selected.id)
        setSignatures(sigs)
      } else {
        setSignError(result.error ?? '서명에 실패했습니다.')
      }
    } catch (err) {
      setSignError(err instanceof Error ? err.message : '서명 처리 중 오류가 발생했습니다.')
    } finally {
      setSigning(false)
    }
  }

  // 회사별 추가 메타데이터(meta_json) 표시 — 저장·감사된 커스텀 항목을 검토 화면에 노출(URS-031/045)
  function renderCustomMeta(): JSX.Element | null {
    if (!selected?.metaJson) {
      return null
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(selected.metaJson) as Record<string, unknown>
    } catch {
      return null // 암호화되었거나 파싱 불가한 경우 생략
    }
    const entries = Object.entries(parsed).filter(([, v]) => v !== null && v !== '')
    if (entries.length === 0) {
      return null
    }
    return (
      <>
        {entries.map(([key, value]) => (
          <Fragment key={key}>
            <dt>{metaFields.find((f) => f.key === key)?.label ?? key}</dt>
            <dd>{String(value)}</dd>
          </Fragment>
        ))}
      </>
    )
  }

  const showSignForm =
    esignStatus?.enabled &&
    esignStatus.actions.includes(signMeaning) &&
    canSignReviewApprove

  const availableMeanings = (['approve', 'review', 'author'] as SignatureMeaning[]).filter(
    (m) => esignStatus?.enabled && esignStatus.actions.includes(m)
  )

  return (
    <div className="record-list-page">
      <div className="list-header">
        <h2>촬영 기록</h2>
        <button type="button" className="secondary-btn" onClick={() => loadRecords()}>
          새로고침
        </button>
      </div>

      <div className="record-filters">
        <label>
          시작일
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label>
          종료일
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        {canFilterByUser && (
          <label>
            작업자
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
            >
              <option value="">전체 작업자</option>
              {recordUsers.map((recordUser) => (
                <option key={recordUser.id} value={recordUser.id}>
                  {recordUser.username} (#{recordUser.id})
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" onClick={() => loadRecords()} disabled={loading}>
          조회
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            const today = todayLocalDate()
            setFromDate(today)
            setToDate(today)
            setOperatorFilter('')
            loadRecords({ fromDate: today, toDate: today, operatorFilter: '' })
          }}
          disabled={loading}
        >
          오늘
        </button>
      </div>

      <p className="record-scope-hint">
        {user.role === 'operator'
          ? '작업자는 본인이 촬영한 기록만 조회할 수 있습니다.'
          : '검토자/관리자는 전체 기록 조회와 작업자별 필터를 사용할 수 있습니다.'}
      </p>

      {loading && <p className="status-inline">불러오는 중…</p>}
      {error && <p className="login-error">{error}</p>}

      {!loading && records.length === 0 && (
        <p className="status-inline">저장된 기록이 없습니다.</p>
      )}

      {records.length > 0 && (
        <table className="record-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>시험번호</th>
              <th>시료 ID</th>
              <th>작업자</th>
              <th>촬영 시각</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr
                key={r.id}
                className={selected?.id === r.id ? 'selected' : ''}
                onClick={() => handleSelect(r.id)}
              >
                <td>{r.id}</td>
                <td>{r.testNo}</td>
                <td>{r.sampleId ?? '—'}</td>
                <td>{r.operatorName}</td>
                <td>{new Date(r.captureTs).toLocaleString('ko-KR')}</td>
                <td>
                  <span className={`status-badge status-${r.status}`}>{r.status}</span>
                  {r.correctionOf && (
                    <span className="correction-ref"> ← #{r.correctionOf}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div className="record-detail">
          <h3>기록 #{selected.id} 상세</h3>
          <dl>
            <dt>시험번호</dt>
            <dd>{selected.testNo}</dd>
            <dt>시료 ID</dt>
            <dd>{selected.sampleId ?? '—'}</dd>
            {renderCustomMeta()}
            <dt>작업자</dt>
            <dd>{selected.operatorName}</dd>
            <dt>촬영 시각</dt>
            <dd>{new Date(selected.captureTs).toLocaleString('ko-KR')}</dd>
            <dt>이미지 해시</dt>
            <dd className="mono">{selected.imageHash}</dd>
            <dt>무결성 검증</dt>
            <dd className={selected.integrityOk ? 'integrity-ok' : 'integrity-fail'}>
              {selected.integrityOk ? '통과' : '실패 — 관리자에게 보고하세요'}
            </dd>
          </dl>

          <div className="signature-section">
            <h4>전자서명 이력</h4>
            {esignStatus && (
              <p className="esign-status">
                전자서명: {esignStatus.enabled ? '활성' : '비활성'}
                {esignStatus.enabled && ` (적용: ${esignStatus.actions.join(', ')})`}
              </p>
            )}

            {signatures.length === 0 ? (
              <p className="status-inline">서명 없음</p>
            ) : (
              <table className="signature-table">
                <thead>
                  <tr>
                    <th>서명자</th>
                    <th>의미</th>
                    <th>시각</th>
                    <th>sig_hash</th>
                  </tr>
                </thead>
                <tbody>
                  {signatures.map((s) => (
                    <tr key={s.id}>
                      <td>{s.signerName}</td>
                      <td>{MEANING_LABELS[s.meaning]}</td>
                      <td>{new Date(s.ts).toLocaleString('ko-KR')}</td>
                      <td className="mono">{s.sigHash.slice(0, 16)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showSignForm && (
              <div className="sign-form">
                <h4>서명 (비밀번호 재인증 필요)</h4>
                {availableMeanings.length > 1 && (
                  <label>
                    서명 의미
                    <select
                      value={signMeaning}
                      onChange={(e) => setSignMeaning(e.target.value as SignatureMeaning)}
                    >
                      {availableMeanings.map((m) => (
                        <option key={m} value={m}>
                          {MEANING_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  비밀번호
                  <input
                    type="password"
                    value={signPassword}
                    onChange={(e) => setSignPassword(e.target.value)}
                    placeholder="재인증용 비밀번호"
                    disabled={signing}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSign}
                  disabled={signing || !signPassword}
                >
                  {signing ? '서명 중…' : `${MEANING_LABELS[signMeaning]} 서명`}
                </button>
                {signError && <p className="login-error">{signError}</p>}
                {signSuccess && <p className="save-success">{signSuccess}</p>}
              </div>
            )}

            {esignStatus && !esignStatus.enabled && (
              <p className="esign-skip-hint">전자서명이 비활성화되어 서명 단계가 생략됩니다.</p>
            )}

            {esignStatus?.enabled && !canSignReviewApprove && (
              <p className="esign-skip-hint">
                검토·승인 서명은 reviewer/admin 권한이 필요합니다.
              </p>
            )}
          </div>

          <div className="controlled-print-section">
            <h4>통제 인쇄</h4>
            <p className="esign-status">
              PharmCam 통제 인쇄 기능으로 출력한 문서만 공식 출력본으로 인정됩니다.
            </p>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleOpenPrintPreview}
              disabled={previewLoading}
            >
              {previewLoading ? '미리보기 생성 중…' : '인쇄 미리보기'}
            </button>
            {printError && <p className="login-error">{printError}</p>}
            {printSuccess && <p className="save-success">{printSuccess}</p>}
          </div>

          <p className="detail-hint">조회자: {user.username}</p>
        </div>
      )}

      {printPreviewHtml && selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="print-modal">
            <div className="print-modal-header">
              <div>
                <h3>통제 인쇄 미리보기</h3>
                <p>기록 #{selected.id} 공식 출력본</p>
              </div>
              <button
                type="button"
                className="text-btn"
                onClick={() => setPrintPreviewHtml(null)}
                disabled={printing}
              >
                닫기
              </button>
            </div>
            <iframe
              className="print-preview-frame"
              title={`기록 #${selected.id} 통제 인쇄 미리보기`}
              srcDoc={printPreviewHtml}
            />
            <div className="print-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setPrintPreviewHtml(null)}
                disabled={printing}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleControlledPrint}
                disabled={printing}
              >
                {printing ? '인쇄 처리 중…' : '공식 출력본 인쇄'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
