# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

---

## 프로젝트 정체성

**PharmCam** — 제약회사 QC팀이 쓰는 **GMP 밸리데이션된 검체·시료 사진 기록 데스크톱 앱**.

- 플랫폼: Windows, **Electron** 데스크톱 앱 (독립 실행 .exe로 배포)
- 핵심 기능: 검체/시료 촬영 → 메타데이터 자동 각인(시험번호·작업자·일시) → **감사추적(audit trail)** 기록
- 데이터 무결성 중심: ALCOA+ 원칙(Attributable, Legible, Contemporaneous, Original, Accurate +Complete/Consistent/Enduring/Available)을 코드 레벨에서 보장한다

**이 프로젝트는 두 개의 결과물을 동시에 만든다:**
1. 실제 동작하는 GMP 앱 (`app/`)
2. "비개발자가 Codex로 CSV를 직접 수행한다"는 **강의 콘텐츠** (`lectures/`)

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
[✓] RA/URS/DQ v1.2 Approved (2026-06-08)  (DAT-09/URS-093/D-12 통제 인쇄, DAT-10/URS-094·095/D-13 기록 조회 통제)
[✓] URS/DQ v1.3 Approved (2026-06-09)  (URS-035/D-14 촬영 카메라 선택·전환, RA는 기존 SW-03 사용)
[✓] RA v1.3 / URS·DQ v1.4 Approved (2026-06-09)  (SEC-06/URS-053/D-15 설치·데이터 접근통제 다층: Program Files per-machine·표준사용자·ACL·암호화·탐지·SOP. NSIS perMachine=true)
[✓] app/ 구현 완료         (M1~M8 + 배포준비) + 2026-06-08 세션 추가구현(아래)
[△] IQ-001 Draft 작성(2026-06-09, 환경점검 탭 연계) — 승인·실행 대기
[△] OQ-001 v0.2 Draft (v1.4 범위, OQ-TC-001~025, 추적성 OQ열 完) — 승인·실행 대기
[△] PQ-001 Draft 작성(2026-06-09, PQ-TC-001~010 실사용 파일럿) — 승인·실행 대기
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
- config 시드 `INSERT OR IGNORE`(멱등) → 기존 DB에도 신규키 추가. **config 18개**(2026-06-09 storage.minFreeMb 추가 → **19**, 테스트 기대값 19).

### 세션 로그 — 2026-06-08 추가 (통제 인쇄 기능)

**결정:** "인쇄물만 원본"이 아니라, **PharmCam 전자기록이 원본이고 PharmCam 통제 인쇄 기능으로 출력한 문서만 공식 출력본(controlled printout)**으로 인정하는 방향으로 정리. 저장 폴더 이미지 파일을 OS/외부 프로그램으로 직접 인쇄한 출력물은 공식 출력본이 아님.

**문서 반영(승인 전 Draft):**
- `RA-001` v1.2 Draft: `DAT-09` 비통제 이미지 직접 인쇄 위험 추가.
- `URS-001` v1.2 Draft: `URS-093` 통제 인쇄 요구사항 추가. 미리보기 필수 표시항목 = User ID, 시험번호, 촬영일시, 기록 ID, 파일명.
- `DQ-001` v1.2 Draft: `D-12 Controlled Printout` 설계 추가.
- `docs/traceability_matrix.md`: `URS-093 → DAT-09 → D-12 → _(OQ)_` 연결.
- `app/BUILD_SPEC.md`: `PrintService — D-12` 구현 명세 추가.

**구현 완료(코드 반영·typecheck 통과·dev 수동 확인):**
- `print_jobs` 테이블 추가(`schema_version=4`) — record_id, printed_by, print_ts, displayed_fields, result/error 저장.
- `PrintService` 추가 — Main 프로세스에서 원본 이미지 존재/해시 검증 후 통제 인쇄 처리.
- `buildControlledPrintHtml()` 단일 템플릿 추가 — 미리보기와 실제 인쇄가 같은 HTML/CSS 템플릿 사용.
- `record:getPrintPreview`, `record:printControlled` IPC 추가. Renderer는 미리보기 표시와 인쇄 요청만 수행.
- 기록 상세 화면에 "통제 인쇄" 섹션과 미리보기 모달 추가.
- 인쇄 성공 시 `print`, 실패/취소 시 `print_failed` 감사추적 기록.
- 최초 구현의 `webContents.print()` 방식은 Windows/Electron 환경에서 인쇄 다이얼로그가 뜨지 않아, 인쇄용 창에서 `window.print()`를 실행하는 방식으로 변경. `npm run dev` 수동 확인 결과 정상 출력됨.
- TypeScript typecheck 통과(`tsc --noEmit -p tsconfig.node.json`, `tsc --noEmit -p tsconfig.web.json`; 현재 PC에서는 `node` 직접 실행에 승인 필요).

### 세션 로그 — 2026-06-08 추가 (기록 조회 통제)

**결정:** 기록확인 탭은 기록 누적 시 검토성과 최소권한 원칙을 위해 날짜 필터와 역할별 조회 범위를 모두 적용한다.

**문서 반영(승인 전 Draft):**
- `RA-001` v1.2 Draft: `DAT-10` 기록 누적/과도조회 위험 추가.
- `URS-001` v1.2 Draft: `URS-094` 날짜/기간 필터 및 기본 오늘 조회, `URS-095` 역할별 조회 범위 통제 추가.
- `DQ-001` v1.2 Draft: `D-13 Record Query Control` 설계 추가.
- `docs/traceability_matrix.md`: `URS-094/095 → DAT-10 → D-13 → _(OQ)_` 연결.
- `app/BUILD_SPEC.md`: `Record Query Control — D-13` 구현 명세 추가.

**구현 완료(코드 반영·typecheck 통과):**
- 기록확인 탭 기본 조회 범위 = 오늘 날짜.
- 날짜/기간 필터 UI 추가.
- operator는 Main 쿼리에서 본인 기록만 조회·상세조회·통제 인쇄 가능하도록 강제.
- reviewer/admin은 전체 기록 조회 및 작업자별 필터 가능.
- `record:listUsers` IPC 추가(reviewer/admin 전용, operator는 빈 목록).
- `record:list`, `record:get`, `record:getPrintPreview`, `record:printControlled` 모두 동일한 역할별 조회 scope 적용.
- TypeScript typecheck 통과.

### 세션 로그 — 2026-06-08 추가 (감사추적 필터 UX 개선)

**구현 완료(코드 반영·typecheck 통과):**
- 감사추적 사용자 필터를 숫자 ID 직접 입력에서 사용자명 드롭다운(`admin (#1)`, `leesi (#2)` 등)으로 변경.
- `audit:listUsers` IPC 추가 — `audit.view` 권한으로 감사추적 필터용 사용자 목록 조회.
- 시작일/종료일은 달력 입력(`type=date`)을 유지하고, 조회 시 각각 해당 일자의 00:00:00~23:59:59.999 범위로 변환.
- 기존 감사추적 표시값(`username (#id)`)과 필터 선택값이 일치하도록 개선.
- TypeScript typecheck 통과.

**미완료/다음 작업(우선순위순):**
1. **문서 마무리 잔여**: URS/RA/DQ v1.1 Approved·추적성 갱신 完(2026-06-08). 남은 것 = (규칙)v1.1 변경분 **HTML 변환·강의자료 생성** + **OQ-TC** 작성 + 추적성 OQ열 + **git 커밋(이번 세션 전부 미커밋)**.
2. **A-1 카메라 선택/전환 = 2026-06-09 완료**: URS-035[설정가능]+D-14(URS/DQ v1.3 Approved). `Capture.tsx` 장치 열거+전환 버튼·드롭다운.
3. **URS-063 저장공간 경고·URS-092 인앱 도움말 = 2026-06-09 구현 완료**(storage.minFreeMb, `storage:getSpace`, `Help.tsx` 도움말 탭). 기록상세 커스텀 meta 표시 후속.
4. 통제 인쇄·기록 조회 통제 구현 완료. **v1.2 문서 Approved 확정(2026-06-08)**, 회귀 7모듈 PASS·typecheck 통과. 남은 것 = OQ-001 v1.2 확장+실행, 패키징 빌드 재생성, 인쇄 다이얼로그 GUI 최종 spot-check.

**배포(테스트용):** `npm run build` → `release/` 삭제 → `npx electron-builder --win portable`
(rcedit "Unable to commit changes"=Defender 잠금 추정 → release 정리+재시도로 해결).
산출물 `app/release/PharmCam-0.1.0-portable.exe`. **검증 전 테스트 빌드**(IQ/OQ/PQ 전).

**배포 정책 — 프로토타입 단계 결정(2026-06-09):** 정식 배포는 **NSIS per-machine 설치본**(Program Files), 테스트는 포터블. **최소 baseline만 적용**:
- 적용: per-machine 설치 + **작업자=표준 Windows 사용자** + 데이터 폴더 ACL(설치 시 수동 `icacls`) + 해시체인 탐지 + **설치본 SHA-256 체크섬·SmartScreen 통과 SOP**(코드서명 대신).
- **보류**(실운영/검증/판매 전환 시 재검토): 코드 서명 인증서, 암호화(at rest) on, 머신 공통 데이터 위치/서비스계정 분리.
- 근거: 내부 초기 프로토타입 → 과한 고도화 회피. **이 최소안도 URS-053 충족**(코드서명·암호화는 URS-053 필수 항목 아님; 잔여위험은 해시체인 탐지로 관리).

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
   - 디자인 언어: 다크 네이비 + 골드 (마스터 HTML 리포트 템플릿의 CSS 변수·섹션 스타일 차용).
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
| `npm run typecheck` | **타입 검사(main+renderer 두 tsconfig). 커밋 전 1차 검증은 이것** |
| `npm run package` | 빌드 + electron-builder Windows 설치본 (`release/`) |
| `npm run test:<모듈>` | 모듈별 개발자 테스트 (audit/auth/record/config/sign/audit-export/m8) |

- **Node PATH(이 PC):** `npm`이 PATH에 없음 → 모든 npm 명령 앞에 프리픽스 필요:
  `$env:Path="C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.22_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v22.22.3-win-x64;"+$env:Path`
- **테스트 구조:** Jest 등 프레임워크 아님. 각 `test:*`는 `app/scripts/test-*.ts`를 electron(`ELECTRON_RUN_AS_NODE`)+tsx로 실행하는 **독립 스크립트**(in-memory SQLite, PASS/FAIL 콘솔 출력). **파일 내 단일 테스트 단위 실행은 없음** — 모듈 스크립트를 통째로 돌린다. config 항목 수가 바뀌면 `test-config.ts` 기대값(현재 18)도 함께 갱신.
- **포터블 빌드 주의:** `npx electron-builder --win portable` 시 rcedit "Unable to commit changes"(Defender 잠금 추정) 발생 가능 → `release/` 삭제 후 재시도로 해결.
- **패키징 전제(빌드 PC 1회):** VS 2022 Build Tools(C++ 워크로드) + Python 필요 — 네이티브 모듈(argon2·better-sqlite3) 컴파일용. 운영 PC엔 불필요. (`app/README.md` 참조)
- 데이터 위치: `%APPDATA%/pharmcam/data/` (DB·이미지·암호화 키)
- 초기 계정: `admin / Admin123!` (최초 로그인 시 비밀번호 강제 변경)
- 관리자 **"환경 점검"** 탭 = IQ 자가점검(safeStorage/쓰기권한/verifyChain/코어잠금).

## Shell

- 기본 shell은 **PowerShell (Windows)**. bash 백틱 줄 이음·`!` 접두사 금지.
- Python은 `python` (not `python3`).
