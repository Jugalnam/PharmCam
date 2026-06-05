# PharmCam — 빌드 명세서 (Build Specification for Cursor)

> **이 문서는 무엇인가:** DQ-001(설계)을 실제 코드로 구현하기 위한 개발자/Cursor용 상세 명세다.
> CSV상 DQ(설계)와 빌드(구현) 사이의 **상세 설계 명세(Design Specification)**에 해당하며, 모든 항목은 URS/DQ로 추적된다.
> **상위 문서:** URS-001, URS-002, DQ-001 · **추적성:** `../docs/traceability_matrix.md`

---

## 0. 구현 대원칙 (먼저 읽을 것)

1. **폐쇄망 전제 — 외부 네트워크 호출 절대 금지.** 자동 업데이트·텔레메트리·분석·원격 폰트/CDN 전부 비활성. 모든 의존성은 로컬 번들.
2. **감사추적은 append-only.** 어디에도 audit 레코드를 update/delete 하는 코드·IPC·UI를 만들지 않는다.
3. **무결성 코어는 끌 수 없다.** core-locked 설정은 런타임/설정에서 변경 불가.
4. **데이터를 바꾸는 모든 행위는 단일 AuditService를 통해 감사추적을 남긴다.** (로그인·촬영·설정변경·서명·조회내보내기 등)
5. **보안 민감 로직(DB·암호·파일·시각·해시)은 전부 Main 프로세스.** Renderer는 UI만. DB 직접 접근 금지.
6. **시각은 단일 TimeService에서만** 받는다. `new Date()`를 산발적으로 쓰지 않는다.
7. **SQL은 항상 파라미터 바인딩.** 문자열 결합 쿼리 금지.

---

## 1. 기술 스택

| 항목 | 선택 | 비고 |
|---|---|---|
| 런타임 | **Electron** (최신 stable) | Windows 데스크톱 |
| 언어 | **TypeScript** (strict 모드) | 타입 안정성 = 데이터 무결성 |
| UI | **React** | 촬영 화면·목록·폼 |
| 번들러 | **electron-vite** | Main/Preload/Renderer 빌드 |
| DB | **better-sqlite3** | 동기식 임베디드 SQL, 단독 PC 적합 |
| 비밀번호 해시 | **argon2** | salted hash |
| 무결성 해시 | Node 내장 **crypto** (SHA-256) | 외부 의존 없음 |
| 키 보호 | **Electron `safeStorage`** | Windows에서 DPAPI 사용(D-4) |
| 암호화 | Node `crypto` (AES-256-GCM) | 선택 모듈 |
| 카메라 | Renderer `navigator.mediaDevices.getUserMedia` | 프레임 캡처 → Main 저장 |
| 패키징 | **electron-builder** | 단독 .exe / 인스톨러 |

## 2. 프로젝트 구조

```
app/
├─ package.json
├─ electron.vite.config.ts
├─ tsconfig.json
├─ src/
│  ├─ main/                    # Main 프로세스 (보안 민감 로직)
│  │  ├─ index.ts              # 앱 진입, 윈도우 생성, 보안 설정
│  │  ├─ db/
│  │  │  ├─ database.ts        # better-sqlite3 연결·마이그레이션
│  │  │  └─ migrations.ts      # 스키마 DDL
│  │  ├─ services/
│  │  │  ├─ audit.service.ts        # D-1 감사추적·해시체인
│  │  │  ├─ integrity.service.ts    # D-2 해시 계산·검증
│  │  │  ├─ time.service.ts         # D-3 시각·변경탐지
│  │  │  ├─ auth.service.ts         # D-5 인증·RBAC·세션
│  │  │  ├─ record.service.ts       # D-9 촬영기록 저장
│  │  │  ├─ signature.service.ts    # D-6 전자서명
│  │  │  ├─ config.service.ts       # D-7 설정·코어잠금
│  │  │  ├─ backup.service.ts       # D-8 백업(선택)
│  │  │  ├─ crypto.service.ts       # D-4 암호화(선택)
│  │  │  └─ lims.connector.ts       # D-10 커넥터 스텁(선택)
│  │  └─ ipc/
│  │     └─ handlers.ts        # ipcMain.handle 등록
│  ├─ preload/
│  │  └─ index.ts              # contextBridge로 window.api 노출
│  └─ renderer/                # React UI
│     ├─ App.tsx
│     ├─ pages/ (Login, Capture, RecordList, AuditView, Settings)
│     └─ api.ts                # window.api 타입 래퍼
└─ resources/                  # 아이콘 등
```

## 3. 보안 설정 (Main `index.ts`)

```ts
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,      // 필수
    nodeIntegration: false,      // 필수
    sandbox: true,
    preload: <preload path>,
  },
});
app.setAsDefaultProtocolClient // 사용 안 함
// autoUpdater 사용 금지, 외부 요청 금지
// CSP: default-src 'self'; connect-src 'self'; 외부 origin 차단
```

## 4. 데이터베이스 스키마 (SQLite DDL)

```sql
-- 사용자 (URS-010·014·051 / D-5)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,         -- argon2
  role TEXT NOT NULL,                  -- 'operator' | 'reviewer' | 'admin'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  fail_count INTEGER NOT NULL DEFAULT 0,
  password_changed_at TEXT,
  created_at TEXT NOT NULL,
  disabled_at TEXT
);

-- 촬영 기록 (URS-030·043·045·046 / D-9·D-2)
CREATE TABLE records (
  id INTEGER PRIMARY KEY,
  test_no TEXT NOT NULL,
  sample_id TEXT,
  operator_id INTEGER NOT NULL REFERENCES users(id),
  capture_ts TEXT NOT NULL,            -- TimeService
  image_path TEXT NOT NULL,
  image_hash TEXT NOT NULL,            -- SHA-256
  status TEXT NOT NULL DEFAULT 'final', -- 'final' | 'corrected' | 'failed'
  correction_of INTEGER REFERENCES records(id),
  meta_json TEXT,                      -- 설정가능 추가 메타데이터
  created_at TEXT NOT NULL
);

-- 감사추적 (URS-040·041 / D-1) — append-only, 해시체인
CREATE TABLE audit_entries (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,                -- 'login','capture','config_change',...
  target_type TEXT,
  target_id TEXT,
  before_value TEXT,
  after_value TEXT,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL
);
-- update/delete 트리거로 차단(아래 5.1 참조)

-- 전자서명 (URS-021~023 / D-6)
CREATE TABLE signatures (
  id INTEGER PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES records(id),
  signer_id INTEGER NOT NULL REFERENCES users(id),
  meaning TEXT NOT NULL,               -- 'author' | 'review' | 'approve'
  ts TEXT NOT NULL,
  sig_hash TEXT NOT NULL
);

-- 설정 (URS-070~073 / D-7)
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  core_locked INTEGER NOT NULL DEFAULT 0,  -- 1이면 변경 불가
  changed_by INTEGER,
  changed_ts TEXT
);

-- 백업 로그 (URS-060~062 / D-8)
CREATE TABLE backup_log (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  mode TEXT NOT NULL,                  -- 'internal'|'external'|'off'
  path TEXT,
  integrity_hash TEXT,
  result TEXT NOT NULL                 -- 'ok'|'fail'
);
```

## 5. 모듈별 구현 명세

### 5.1 AuditService — D-1 (URS-040·041·042)

- `append(action, {userId, targetType, targetId, before, after})`:
  1. `prev_hash` = 직전 엔트리의 `entry_hash` (없으면 `'0'.repeat(64)`)
  2. `ts` = TimeService.now()
  3. `entry_hash = sha256(seq후보 + ts + user_id + action + target_type + target_id + before + after + prev_hash)`
     - seq는 AUTOINCREMENT라, 트랜잭션 내에서 직전 max(seq)+1로 계산해 일관 보장
  4. INSERT
- `verifyChain()`: 전 엔트리를 순회하며 재계산, 불일치 시 깨진 seq 반환 (OQ 시험용)
- **수정·삭제 차단:** SQLite 트리거로 보장
  ```sql
  CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_entries
    BEGIN SELECT RAISE(ABORT,'audit append-only'); END;
  CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_entries
    BEGIN SELECT RAISE(ABORT,'audit append-only'); END;
  ```
- audit_entries 테이블에는 update/delete IPC·서비스 메서드를 **만들지 않는다**.

### 5.2 IntegrityService — D-2 (URS-043)

- `hashFile(path): string` — 파일 바이트 SHA-256
- 저장 후 파일을 **읽기전용**으로: Windows 읽기전용 속성 설정(`fs.chmod`/win attrib). 조회 시 `hashFile` 재계산해 저장값과 비교, 불일치면 무결성 경고 + audit 기록.

### 5.3 TimeService — D-3 (URS-044)

- `now(): string` — ISO8601 반환(단일 출처)
- 매 호출/기록 시 직전 record/audit의 ts와 비교 → 현재가 과거보다 빠르거나 비정상 점프면 `time_anomaly` audit 기록.
- `config.timestamp.source`는 core-locked. NTP는 폐쇄망 기본 off(설정 시 내부 NTP만).

### 5.4 AuthService — D-5 (URS-010~016·051)

- 로그인: argon2 검증. 실패 시 `fail_count++`, `>= login.maxFails`면 status='inactive'(잠금). 성공 시 fail_count=0, audit 'login'.
- **식별 없이 촬영 불가:** record/signature IPC는 유효 세션 필수(URS-011).
- RBAC: operator(촬영), reviewer(+서명/검토), admin(+설정/계정/삭제권한). 권한 검사는 Main에서.
- 세션 타임아웃: Renderer 무활동 감지 + Main에서 만료 세션 거부(`session.timeoutMin`).
- 계정 수명주기: 생성/비활성(admin). 비밀번호 정책값은 config.

### 5.5 RecordService — D-9 (URS-030·032·033·034·045)

- 저장 파이프라인(atomic 트랜잭션):
  1. 필수 메타데이터 검증(`metadata.requiredFields`) — 미입력 시 거부(URS-030)
  2. 이미지 파일 저장 → IntegrityService.hashFile → 읽기전용
  3. records INSERT + audit 'capture' (같은 트랜잭션)
  4. 전부 성공해야 commit, 하나라도 실패면 rollback + 사용자에 실패 명확 통지(URS-033) + audit 'capture_failed'
- 미리보기/재촬영은 저장 전 Renderer 단계. 재촬영·실패도 기록(URS-045).
- 정정: 원본 수정 금지, 새 record(status='corrected', correction_of=원본id) 생성 + audit(URS-046).

### 5.6 SignatureService — D-6 (URS-020~023)

- `config.esign.enabled`가 true이고 action이 `esign.actions`에 포함될 때 서명 요구.
- 서명 시 비밀번호 재인증(URS-023) → signatures INSERT(signer·meaning·ts·sig_hash) + audit 'signature'.
- `sig_hash = sha256(record_id + signer_id + meaning + ts + record.image_hash)` (기록과 영구 연결, URS-022).

### 5.7 ConfigService — D-7 (URS-070~073)

- `get(key)`, `set(key, value)`: set은 admin만, core_locked=1이면 거부.
- 모든 set은 audit 'config_change'(before/after).
- `getCurrentSpec()`: 현재 설정 전체를 출력(configuration spec, URS-073).
- 초기 시드(아래 6절). **core-locked 항목은 시드 후 변경 불가.**

### 5.8 BackupService — D-8 (URS-060~063) *선택 모듈*

- `backup.mode`: 'internal'(경로 복사+해시검증), 'external'(회사 자체 백업 — 앱은 미관여), 'off'.
- internal: 스케줄 복사 → backup_log + integrity_hash. 복구검증 함수 제공(URS-061).
- 저장공간 임계치 경고(URS-063).

### 5.9 CryptoService — D-4 (URS-050) *선택 모듈*

- `encryption.enabled`면 DB·이미지 AES-256-GCM 암호화. 키는 `safeStorage`(DPAPI)로 보호. 키 관리 상세는 IQ에서 회사 정책에 맞춰 확정(DEV-03).

### 5.10 LIMS Connector — D-10 (URS-080·081) *스텁*

- 인터페이스만 정의(`exportRecord(record): Promise<Result>`), 기본 비활성. 실제 어댑터는 후속 변경관리(DEV-07). 폐쇄망 내부망 한정.

## 6. 설정 시드 (config 초기값)

| key | 기본값 | core_locked | URS |
|---|---|:--:|---|
| audit.enabled | true | **1** | 042 |
| integrity.enabled | true | **1** | 043 |
| auth.required | true | **1** | 011 |
| timestamp.source | os | **1** | 044 |
| esign.enabled | false | 0 | 020 |
| esign.actions | ["approve"] | 0 | 020 |
| session.timeoutMin | 15 | 0 | 013 |
| password.minLength | 8 | 0 | 015 |
| password.expiryDays | 90 | 0 | 015 |
| login.maxFails | 5 | 0 | 016 |
| metadata.requiredFields | ["testNo","operatorId"] | 0 | 031 |
| backup.mode | off | 0 | 060 |
| backup.path | "" | 0 | 060 |
| retention.days | 3650 | 0 | 062 |
| encryption.enabled | false | 0 | 050 |
| lims.enabled | false | 0 | 080 |

## 7. IPC API (preload `window.api`)

`ipcMain.handle` / `ipcRenderer.invoke` 사용. 모든 핸들러는 세션·권한 검사 후 실행.

```ts
window.api = {
  auth:   { login(u,p), logout(), currentUser() },
  record: { save(input), list(filter), get(id), correct(id, input) },
  audit:  { list(filter), verifyChain(), export(filter) },   // 조회·검증만, 수정/삭제 없음
  sign:   { create(recordId, meaning, password) },
  config: { get(key), getSpec(), set(key, value) },           // set은 admin
  backup: { runNow(), verify(), status() },
};
```

## 8. 구현 순서 (마일스톤 — 점진적·검증 가능 단위)

| # | 마일스톤 | 내용 | 핵심 URS/D |
|---|---|---|---|
| M1 | 뼈대 | electron-vite + 보안 윈도우 + DB 연결·마이그레이션 | §3·§4 |
| M2 | 감사추적 코어 | AuditService + 해시체인 + append-only 트리거 (먼저 깔아야 이후 전부 로깅) | D-1 |
| M3 | 인증·계정·RBAC | AuthService, 로그인 화면, 세션, 잠금 (전부 audit) | D-5 |
| M4 | 촬영 파이프라인 | 카메라 미리보기→필수항목 검증→원본 해시·읽기전용→atomic 저장, TimeService | D-9·D-2·D-3 |
| M5 | 설정 서비스 | ConfigService + 코어잠금 + 설정 화면(admin) + getSpec | D-7 |
| M6 | 전자서명 | SignatureService + 재인증 서명 흐름 | D-6 |
| M7 | 조회·내보내기 | 기록 목록, 감사추적 뷰(필터), 권한 기반 내보내기, verifyChain 버튼 | URS-090·091 |
| M8 | 선택 모듈 | 암호화(D-4)·백업(D-8)·LIMS 스텁(D-10) | 050·060·080 |

각 마일스톤 종료 시: 빌드 가능 + 해당 기능 수동 확인. (이후 OQ 시험의 기반)

## 9. 코딩 표준

- TypeScript strict, 명시적 반환 타입. 데이터 모델은 공유 타입(`src/shared/types.ts`)으로.
- 에러는 사용자에게 명확히 표면화(특히 저장 실패·무결성 경고). 조용한 실패 금지.
- 불필요한 주석 금지. 단, 보안·무결성 핵심 로직엔 "왜"를 한 줄.
- 외부 네트워크 호출·원격 리소스 금지(폐쇄망).
- 모든 데이터 변경 경로는 AuditService.append 호출을 포함(누락 시 리뷰에서 반려).

## 10. 검증 연결 (Cursor가 의식할 것)

- 이 앱은 이후 **OQ에서 기능별로 시험**된다. 각 기능은 **관찰·재현 가능**해야 한다(예: 감사추적 뷰에서 행위 확인, verifyChain으로 무결성 확인).
- 구현은 `traceability_matrix.md`의 URS↔D 매핑을 깨지 않게 유지. 새 기능·변경 시 매트릭스도 갱신 대상임을 인지.
