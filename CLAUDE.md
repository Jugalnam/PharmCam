# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 프로젝트 정체성

**PharmCam** — 제약회사 QC팀이 쓰는 **GMP 밸리데이션된 검체·시료 사진 기록 데스크톱 앱**.

- 플랫폼: Windows, **Electron** 데스크톱 앱 (독립 실행 .exe로 배포)
- 핵심 기능: 검체/시료 촬영 → 메타데이터 자동 각인(시험번호·작업자·일시) → **감사추적(audit trail)** 기록
- 데이터 무결성 중심: ALCOA+ 원칙(Attributable, Legible, Contemporaneous, Original, Accurate +Complete/Consistent/Enduring/Available)을 코드 레벨에서 보장한다

**이 프로젝트는 두 개의 결과물을 동시에 만든다:**
1. 실제 동작하는 GMP 앱 (`app/`)
2. "비개발자가 Claude Code로 CSV를 직접 수행한다"는 **강의 콘텐츠** (`lectures/`)

→ 모든 단계는 강의 소재다. 산출물을 만들 때 "왜 이렇게 결정했는가"를 항상 명시적으로 남긴다.

## 가장 중요한 규칙 — CSV V-모델 순서를 지킨다

이 프로젝트는 일반 코딩이 아니라 **CSV(Computer System Validation)**다. 문서가 코드보다 먼저다.

```
VP  (밸리데이션 계획서)      docs/01_VP   ← 전체 활동의 헌법. 가장 먼저.
RA  (위험평가)              docs/02_RA   ← 검증 노력을 어디 집중할지
URS (사용자 요구사항 명세)   docs/03_URS  ─────────────┐ 검증 짝: PQ
DQ  (설계 적격성 평가)       docs/04_DQ   ──────┐ 검증 짝: OQ │
   ▼ ── 여기서부터 비로소 app/ 코드 작성 ──     │           │
IQ  (설치 적격성 평가)       docs/05_IQ   ──────┘           │
OQ  (운전 적격성 평가)       docs/06_OQ   ──────────────────┘
PQ  (성능 적격성 평가)       docs/07_PQ
```

**철칙:**
- **URS와 DQ가 승인되기 전에는 `app/`에 기능 코드를 작성하지 않는다.** (현재 VP·RA·URS·DQ 모두 확정 → 구현 진행됨)
- 모든 기능은 URS 항목에서 출발해 검증(OQ/PQ)까지 추적 가능해야 한다 → `docs/traceability_matrix.md`를 항상 함께 갱신한다.
- 각 문서는 고유 ID 체계를 쓴다: URS는 `URS-001`, 위험은 `RA-001`, 테스트는 `OQ-TC-001` 식. 이 ID로 서로를 참조(추적성)한다.
- 한 단계를 마치면 다음 단계로 넘어가기 전에 사용자(QC 실무자)의 승인을 받는다. CSV에서 단계 승인은 형식 요건이다.

## 현재 진행 상황 (2026-06-08 기준)

```
[✓] VP-001   확정 v1.0    (docs/01_VP)
[✓] RA-001   v1.1 Approved (2026-06-08)  (DAT-08 저장위치 위험 추가)
[✓] URS-001  v1.1 Approved (2026-06-08)  (URS-047 저장위치 신설, URS-040·073 문구보강)
[✓] DQ-001   v1.1 Approved (2026-06-08)  (D-11 저장위치 설계 추가)
[✓] app/ 구현 완료         (M1~M8 + 배포준비) + 2026-06-08 세션 추가구현(아래)
[ ] IQ  ← 다음 단계        (자가점검 화면이 IQ 검증 항목과 연결됨)
[ ] OQ / PQ
```

- 강의자료 4편 완료(`lectures/01~04`). 전자서명은 **도입(포함)** 결정됨.
- 빌드 명세서: `app/BUILD_SPEC.md` (DQ↔구현 상세 설계, M1~M8 마일스톤).

### 세션 로그 — 2026-06-08 (환경복구 + UX개선 + 신규기능)

**환경(새 PC):** Node 22.22.3(winget OpenJS.NodeJS.22) — PATH 미등록이라 PowerShell 앞에
`$env:Path="C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.22_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v22.22.3-win-x64;"+$env:Path` 프리픽스 필요. VS BuildTools+ClangCL 설치됨.

**구현 완료(코드 반영·typecheck/test 통과, 단 git 미커밋):**
- 재촬영 버그 수정(`Capture.tsx` video 항상 마운트) URS-032
- 설정 입력 위젯화(드롭다운/체크박스/숫자) `Settings.tsx`
- 계정 관리 UI `UserManagement.tsx`(생성/비활성화) URS-014
- **권한 매트릭스 읽기전용 조회**(계정관리 탭 하단) — `rbac.getPermissionMatrix()`+`auth:getPermissionMatrix`, URS-012/073
- **감사추적 사용자 가독표시** `admin (#1)` — `audit.listWithUsers()`(서버측 JOIN), 화면+CSV+PDF, 저장값·해시체인 불변, URS-040
- **저장 위치 지정** `storage.root` config — `record.service` 저장시점 경로해석·검증(로컬한정·UNC거부·쓰기권한)·마이그레이션X, `storage:*` IPC, 설정탭 "저장 위치" 섹션. URS-047/D-11
- **메타데이터 항목 구성** `metadata.fields` config — 촬영화면 동적입력+필수검증, 설정탭 "촬영 메타데이터 항목" 편집, `metadata:*` IPC. URS-031
- config 시드 `INSERT OR IGNORE`(멱등) → 기존 DB에도 신규키 추가. **config 18개**(테스트 기대값 18).

**미완료/다음 작업(우선순위순):**
1. **문서 마무리 잔여**: URS/RA/DQ v1.1 Approved·추적성 갱신 完(2026-06-08). 남은 것 = (규칙)v1.1 변경분 **HTML 변환·강의자료 생성** + **OQ-TC** 작성 + 추적성 OQ열 + **git 커밋(이번 세션 전부 미커밋)**.
2. **A-1 카메라 선택/전환**: 현재 `facingMode:'environment'` 고정 → 신규 **URS-035[설정가능]+RA+DQ** 필요(미작성).
3. URS-092 도움말 미구현 / 기록상세에 커스텀 meta 표시 후속 / 인쇄는 의식적 제외(저장위치 대체).

**배포(테스트용):** `npm run build` → `release/` 삭제 → `npx electron-builder --win portable`
(rcedit "Unable to commit changes"=Defender 잠금 추정 → release 정리+재시도로 해결).
산출물 `app/release/PharmCam-0.1.0-portable.exe`. **검증 전 테스트 빌드**(IQ/OQ/PQ 전).

## 폴더 구조

| 경로 | 역할 |
|---|---|
| `docs/01_VP` ~ `docs/07_PQ` | GMP 산출물. 각 단계 문서. 강의 콘텐츠의 원천 |
| `docs/traceability_matrix.md` | URS ↔ DQ ↔ OQ/PQ 추적성 매트릭스. **CSV의 심장** — 기능 추가/변경 시 반드시 갱신 |
| `app/` | Electron 앱 코드 (구현 완료). `BUILD_SPEC.md` = 상세 설계/구현 명세 |
| `lectures/` | 단계별 HTML 강의자료 + 블로그 글. 한 단계 완료 시 1개 생성 제안 |

## 작업 방식

- 산출물은 한국어로 작성하되, GMP/CSV 용어(URS, audit trail, ALCOA+ 등)는 영어 원어를 유지하고 처음 등장 시 한 줄 설명을 붙인다.
- 사용자는 **비개발자(제약 QC 실무자)**다 — 코드보다 "왜 이 설계인가"를 먼저 설명한다.
- 큰 단계는 쪼개서 한 번에 하나씩 진행하고, 코드를 대량 작성하기 전에 Cursor에서 할지 여기서 할지 확인한다.
## 문서 확정 시 자동 산출물 규칙 (필수)

어떤 GMP 문서(VP, RA, URS …)가 **확정(approved)**될 때마다, 요청 없이도 아래 2개를 함께 생성한다.

1. **HTML 변환** — 확정된 `.md`를 같은 폴더에 보기 좋은 HTML로 변환 (`<문서ID>_*.html`).
   - 디자인 언어: 다크 네이비 + 골드 (마스터 `C:\Users\forti\dev\HTML\investment_report_master.html`의 CSS 변수·섹션 스타일 차용).
   - 단일 파일, 외부 CDN 없음. 투자 전용 기능(매수/RR 등)은 제외하고 문서 렌더링용으로만.
2. **강의자료 1개** — `lectures/NN_<단계>_lecture.html` 생성.
   - 컨셉: "만들면서 가르친다" — 비개발자 대상, **핵심 의사결정 3~5개**를 "무엇을/왜" 중심으로.
   - 기존 강의 톤·구조 참고: `lectures/01_VP_lecture.html` (결정 카드 + 용어 박스 + 핵심 정리).
   - 시리즈 번호와 다음 단계 예고를 푸터에 표기.

> 확정 시 md 본문도 버전을 올리고(예: v1.0 Approved) 상태 표를 갱신한다.

## 앱 설계 시 반드시 반영할 GMP 요건 (DQ 단계에서 구체화)

아래는 검체 사진 기록 앱이 GMP를 만족하려면 코드가 갖춰야 할 핵심 — DQ/설계명세 작성 시 근거로 삼는다.

- **감사추적(audit trail):** 모든 촬영·수정·삭제 행위에 누가/언제/무엇을 기록. 사후 변경 불가(append-only).
- **데이터 무결성:** 원본 이미지는 변조 불가하게 저장(해시 등). 메타데이터와 이미지를 묶어 보관.
- **사용자 식별:** 작업자 로그인/식별 없이는 기록을 남기지 않는다 (Attributable).
- **시각 동기화:** 신뢰할 수 있는 시각 출처 사용 (Contemporaneous).
- **백업·보존:** 데이터 유실 방지 및 장기 보존 정책 (Enduring/Available).

## 아키텍처 원칙 — 엄격한 GMP 코어 + 회사별 설정 유연성 (필수)

PharmCam은 **GMP를 엄격하게 적용하되, 회사마다 기능을 커스터마이징하기 쉬운 구조**로 설계한다. 기능을 두 층으로 분리한다.

**1층 — 필수 코어 (끌 수 없음, 데이터 무결성의 근간):**
감사추적, 작업자 식별·귀속, 원본 보호(해시·읽기전용), 신뢰 시각, 필수 메타데이터 강제.
→ 설정으로 비활성화 불가. 이걸 끄면 GMP 시스템이 아니다.

**2층 — 설정 가능한 모듈 (회사별 on/off·값 조정):**
전자서명(on/off·적용 행위), 백업(내장/끄고 자체백업/경로), LIMS 연동(커넥터 on/off), 비밀번호 정책·세션 타임아웃(값), 보존기간·필수 메타데이터 항목(값).

**GMP 가드레일:**
- 설정(config) 변경 자체가 통제 대상 → 누가 무엇을 켜고/껐는지 감사추적에 기록, 권한자만 변경.
- 회사별 배포 = 하나의 **설정 명세(configuration spec)** → 그 설정 상태를 해당 회사에서 IQ/OQ로 재검증.
- 무결성 코어는 설정에서 제외 (예: "전자서명 off"는 가능, "감사추적 off"는 불가).
- 확장성: 모듈/커넥터 구조로 설계해 LIMS 등 외부 연동을 나중에 붙일 수 있게 한다.

→ URS의 각 요구사항에는 **[필수]** 또는 **[설정가능]** 태그를 붙여 이 구분을 명시한다.

## 앱 코드 구조·규약 (`app/`)

**스택:** Electron + React + TypeScript, electron-vite(번들), better-sqlite3(DB), argon2(비번 해시), Electron safeStorage=DPAPI(키 보호), Node crypto SHA-256(무결성).

**구조:** `src/main`(보안 민감 로직 — `db`/`ipc`/`services` 하위 폴더), `src/preload`(contextBridge `window.api`), `src/renderer`(React UI — `pages`/`hooks`), `src/shared`(공유 타입). 서비스: audit/integrity/time/auth/record/signature/config/backup/crypto/lims/system/export, 그리고 접근권한 제어 `rbac`.

**불변 규약 (깨면 안 됨):**
- 감사추적은 append-only — `audit_entries`에 update/delete 코드·IPC·UI 금지(DB 트리거로도 차단). 변조는 해시체인 `verifyChain()`으로 탐지.
- 데이터 변경 행위는 전부 `AuditService.append()` 경유.
- 보안 로직은 Main에만. Renderer는 `window.api`(IPC)로만 접근. `contextIsolation:true / nodeIntegration:false`.
- 시각은 `TimeService.now()` 단일 출처.
- 코어 설정(audit/integrity/auth/timestamp)은 `core_locked=1` — 변경 불가.
- 폐쇄망: 외부 네트워크 호출·자동 업데이트 금지.

## 빌드/실행 명령 (`cd app` 후)

| 명령 | 용도 |
|---|---|
| `npm install` | 의존성 설치 (네이티브 모듈 자동 재빌드) |
| `npm run dev` | 개발 실행 (기능 확인·OQ 준비는 이걸로 충분) |
| `npm run build` | electron-vite 빌드 (`out/`) |
| `npm run package` | 빌드 + electron-builder Windows 설치본 (`release/`) |
| `npm run test:*` | 모듈별 개발자 테스트 (audit/auth/record/config/sign/audit-export/m8) |

- **패키징 전제(빌드 PC 1회):** VS 2022 Build Tools(C++ 워크로드) + Python 필요 — 네이티브 모듈(argon2·better-sqlite3) 컴파일용. 운영 PC엔 불필요. (`app/README.md` 참조)
- 데이터 위치: `%APPDATA%/pharmcam/data/` (DB·이미지·암호화 키)
- 초기 계정: `admin / Admin123!` (최초 로그인 시 비밀번호 강제 변경)
- 관리자 **"환경 점검"** 탭 = IQ 자가점검(safeStorage/쓰기권한/verifyChain/코어잠금).

## Shell

- 기본 shell은 **PowerShell (Windows)**. bash 백틱 줄 이음·`!` 접두사 금지.
- Python은 `python` (not `python3`).
