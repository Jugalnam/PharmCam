# PharmCam

GMP 밸리데이션된 검체·시료 사진 기록 데스크톱 앱 (Windows / Electron).
설계·검증 문서는 상위 `../docs/`, 구현 명세는 `BUILD_SPEC.md` 참조.

## 요구 환경

- Windows 10/11
- Node.js 18+ / npm
- 폐쇄망 운영 전제 — 앱은 외부 네트워크에 연결하지 않는다.

### 빌드 전용 전제 (개발 PC 1회 설정)

`argon2`·`better-sqlite3`는 네이티브 모듈이라 패키징 시 C++ 컴파일이 필요하다.

```powershell
# 관리자 PowerShell, 1회만
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
# Python 미설치 시
winget install Python.Python.3.12
```

> 이 도구는 **빌드/패키징 PC에만** 필요하다. 완성된 설치본(.exe)을 실행하는 운영 PC에는 불필요.

## 설치

```powershell
cd app
npm install
```

> `argon2`, `better-sqlite3`는 네이티브 모듈이라 `postinstall`에서 Electron용으로 자동 재빌드된다(`electron-builder install-app-deps`).

## 실행 (개발)

```powershell
npm run dev
```

- 앱 창이 뜨면 초기 관리자 계정으로 로그인:
  - **아이디:** `admin` / **비밀번호:** `Admin123!`
  - 최초 로그인 시 **비밀번호 강제 변경** 화면이 뜬다(기본 비밀번호 사용 금지).

## 빌드 / 패키징

```powershell
npm run build      # electron-vite 빌드 (out/ 생성)
npm run package    # 빌드 + electron-builder로 Windows 설치본 생성
```

- 산출물: `app/release/`
  - `PharmCam-<version>.exe` — NSIS 인스톨러
  - `PharmCam-<version>.exe` (portable 타깃) — 무설치 실행본
- 자동 업데이트·텔레메트리는 비활성(폐쇄망).

## 데이터 위치

- DB·이미지·암호화 키: `%APPDATA%/pharmcam/data/`
  - `pharmcam.db` (메타데이터·감사추적·설정·서명)
  - 원본 이미지 파일(읽기전용), 암호화 시 `.enc`
  - `.data-key` (safeStorage/DPAPI로 보호된 암호화 키)

## 역할 (RBAC)

| 역할 | 권한 |
|---|---|
| operator | 촬영, 감사추적 조회 |
| reviewer | + 전자서명/검토, 내보내기 |
| admin | + 설정, 계정관리, 환경 점검 |

## 환경 점검 (IQ Self-Check)

관리자 → **환경 점검** 탭. 설치 환경 전제조건을 앱이 자동 점검한다:

- safeStorage(DPAPI) 사용 가능 여부
- 데이터 폴더 쓰기 권한
- 감사추적 무결성(verifyChain)
- 무결성 코어 설정 잠금 상태
- 현재 설정 전체(configuration spec)

결과는 JSON 파일로 내보낼 수 있으며(로컬), 실행은 감사추적에 기록된다. IQ 검증 근거자료로 사용한다.

## 개발자 테스트

```powershell
npm run test:audit         # 감사추적·해시체인·변조 탐지
npm run test:auth          # 인증·잠금
npm run test:record        # 촬영 파이프라인
npm run test:config        # 설정·코어잠금
npm run test:sign          # 전자서명
npm run test:audit-export  # 조회·내보내기
npm run test:m8            # 암호화·백업·LIMS
```

> 자동화 테스트는 `ELECTRON_RUN_AS_NODE` 환경이라 DPAPI 대신 테스트 어댑터를 쓴다. 실제 DPAPI는 `npm run dev`/패키징본에서 적용된다.

## 폐쇄망 운영 주의

- 외부 네트워크 호출·자동 업데이트 없음.
- 일탈 후속조치(OS 관리자 권한 제한, OS 시간변경 제한, 백신, 백업/복구 SOP 등)는 도입 회사가 IQ 단계에서 적용·검증한다(`../docs/03_URS/URS-002` §4.3 체크리스트).
