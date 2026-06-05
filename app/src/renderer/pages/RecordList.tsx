import { useEffect, useState } from 'react'
import type { RecordDetail, RecordListItem } from '../../shared/record.types'
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

export default function RecordList({ user }: RecordListProps): JSX.Element {
  const [records, setRecords] = useState<RecordListItem[]>([])
  const [selected, setSelected] = useState<RecordDetail | null>(null)
  const [signatures, setSignatures] = useState<SignatureView[]>([])
  const [esignStatus, setEsignStatus] = useState<EsignStatus | null>(null)
  const [signMeaning, setSignMeaning] = useState<SignatureMeaning>('approve')
  const [signPassword, setSignPassword] = useState('')
  const [signError, setSignError] = useState<string | null>(null)
  const [signSuccess, setSignSuccess] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canSignReviewApprove = user.role === 'reviewer' || user.role === 'admin'

  useEffect(() => {
    loadRecords()
    window.api.sign.getStatus().then(setEsignStatus).catch(() => {})
  }, [])

  async function loadRecords(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.record.list({ limit: 50 })
      setRecords(data)
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
        <button type="button" className="secondary-btn" onClick={loadRecords}>
          새로고침
        </button>
      </div>

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

          <p className="detail-hint">조회자: {user.username}</p>
        </div>
      )}
    </div>
  )
}
