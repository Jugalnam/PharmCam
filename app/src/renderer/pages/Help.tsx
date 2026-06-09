import type { SessionUser } from '../../shared/auth.types'

interface HelpProps {
  user: SessionUser
}

/** 인앱 도움말/가이드 (URS-092). 비개발자(QC 실무자) 대상 사용 안내. */
export default function Help({ user }: HelpProps): JSX.Element {
  return (
    <div className="settings-page help-page">
      <div className="list-header">
        <h2>도움말 (Help / Guide)</h2>
      </div>
      <p className="settings-hint">
        PharmCam은 GMP 검체·시료 사진 기록 시스템입니다. 아래는 주요 기능 사용 안내입니다. 절차나
        용어가 익숙하지 않으면 관리자(admin)에게 문의하세요.
      </p>

      <section className="help-section">
        <h3>1. 시작하기 · 로그인</h3>
        <ul>
          <li>개인 계정으로만 로그인합니다(공용 계정 금지). 모든 기록은 로그인한 사용자에게 귀속됩니다.</li>
          <li>최초 로그인 또는 관리자 발급 직후에는 비밀번호를 변경해야 다른 기능을 사용할 수 있습니다.</li>
          <li>일정 시간 미사용 시 자동 로그아웃되며, 로그인 실패가 반복되면 계정이 잠깁니다.</li>
        </ul>
      </section>

      <section className="help-section">
        <h3>2. 역할과 권한</h3>
        <ul>
          <li>
            <strong>작업자(operator)</strong>: 촬영·저장, 본인 기록·감사추적 조회.
          </li>
          <li>
            <strong>검토자(reviewer)</strong>: 위 + 전자서명·검토, 전체 기록 조회, 내보내기.
          </li>
          <li>
            <strong>관리자(admin)</strong>: 위 + 계정 관리·설정·환경 점검.
          </li>
          <li>역할별 권한은 [계정 관리] 탭 하단 "역할별 권한" 표에서 확인할 수 있습니다(관리자).</li>
        </ul>
      </section>

      <section className="help-section">
        <h3>3. 촬영 · 저장</h3>
        <ul>
          <li>상단 "촬영 대상 확인"에서 시험번호·작업자를 반드시 확인해 오촬영을 예방합니다.</li>
          <li>시험번호는 필수이며, 회사가 지정한 추가 항목(예: 배치번호)도 필수면 입력해야 저장됩니다.</li>
          <li>촬영 후 미리보기에서 "재촬영" 또는 "저장"을 선택합니다. 저장 성공·실패는 화면에 명확히 표시됩니다.</li>
          <li>저장공간이 부족하면 경고가 표시됩니다 — 관리자에게 문의하세요.</li>
        </ul>
      </section>

      <section className="help-section">
        <h3>4. 기록 조회 · 통제 인쇄</h3>
        <ul>
          <li>
            [기록 목록]은 기본으로 <strong>오늘</strong> 기록을 보여주며, 날짜로 필터링할 수 있습니다.
          </li>
          <li>작업자는 본인 기록만, 검토자·관리자는 전체 기록을 조회할 수 있습니다.</li>
          <li>
            종이 출력이 필요하면 기록 상세의 <strong>"통제 인쇄"</strong>를 사용하세요. 미리보기에
            사용자·시험번호·촬영일시·기록 ID·파일명이 표시되고, 인쇄 행위가 감사추적에 남습니다.
          </li>
          <li>
            저장 폴더의 이미지 파일을 직접(OS·외부 프로그램으로) 인쇄한 출력물은{' '}
            <strong>공식 출력본이 아닙니다.</strong>
          </li>
        </ul>
      </section>

      <section className="help-section">
        <h3>5. 감사추적 (Audit Trail)</h3>
        <ul>
          <li>모든 행위(로그인·촬영·설정변경·인쇄 등)가 누가·언제·무엇을 기준으로 기록됩니다.</li>
          <li>
            감사추적은 <strong>수정·삭제가 불가능</strong>하며(append-only), 해시체인으로 변조를
            탐지합니다.
          </li>
          <li>
            [감사추적] 탭에서 사용자·행위·날짜로 필터링하고, 검토자/관리자는 CSV·PDF로 내보낼 수
            있습니다.
          </li>
        </ul>
      </section>

      <section className="help-section">
        <h3>6. 관리자 기능</h3>
        <ul>
          <li>
            <strong>계정 관리</strong>: 계정 생성·비활성화(삭제 불가), 역할별 권한 확인.
          </li>
          <li>
            <strong>설정</strong>: 전자서명·백업·비밀번호 정책 등(무결성 코어는 잠금). 저장 위치 지정,
            촬영 메타데이터 항목 구성, 저장공간 경고 임계치.
          </li>
          <li>
            <strong>환경 점검</strong>: 설치·무결성 자가점검(IQ) — 키 저장소·쓰기권한·해시체인·코어
            잠금 확인.
          </li>
        </ul>
      </section>

      <section className="help-section">
        <h3>7. 데이터 무결성 원칙 (ALCOA+)</h3>
        <p className="settings-hint">
          기록은 귀속성(Attributable)·가독성(Legible)·동시성(Contemporaneous)·원본성(Original)·정확성(Accurate)
          및 완전·일관·항구·가용성을 만족하도록 설계되어 있습니다. 원본 이미지는 해시로 보호되며
          읽기전용으로 보관됩니다.
        </p>
      </section>

      <p className="detail-hint">
        로그인: {user.username} ({user.role})
      </p>
    </div>
  )
}
