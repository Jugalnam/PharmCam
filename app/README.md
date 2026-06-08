# PharmCam

GMP 밸리데이션된 검체·시료 사진 기록 데스크톱 앱 (Windows / Electron).
설계·검증 문서는 상위 `../docs/`, 구현 명세는 `BUILD_SPEC.md` 참조.

## 요구 환경

- Windows 10/11
- **Node.js 22 LTS** / npm — Node 24+는 비권장(네이티브 모듈 prebuilt 미제공, 아래 *Node.js 버전* 참고)
- 폐쇄망 운영 전제 — 앱은 외부 네트워크에 연결하지 않는다.

### 빌드 전용 전제 (개발 PC 1회 설정)

`argon2`·`better-sqlite3`는 네이티브 모듈이라, 패키징 시(그리고 Node 버전이 안 맞아 prebuilt를 못 받을 때는 `npm install` 시에도) C++ 컴파일이 필요하다.

```powershell
# 관리자 PowerShell, 1회만 — VCTools 워크로드 + ClangCL 도구 집합을 함께 설치
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Llvm.ClangToolset --add Microsoft.VisualStudio.Component.VC.Llvm.Clang --includeRecommended"
# Python 미설치 시
winget install Python.Python.3.12
```

> ⚠️ **ClangCL 컴포넌트 필수.** `better-sqlite3`는 내부 SQLite를 ClangCL(LLVM) 도구 집합으로 빌드한다. VCTools 워크로드만 깔면 `MSB8020: ClangCL ... 찾을 수 없습니다` 에러가 나므로 위 명령처럼 `VC.Llvm.ClangToolset`·`VC.Llvm.Clang`을 반드시 함께 설치한다.
> 이미 Build Tools가 깔려 있는데 ClangCL만 추가하려면, winget은 동일 버전이 있으면 컴포넌트 추가를 건너뛰므로 **Visual Studio Installer → 수정 → 개별 구성 요소**에서 "Windows용 C++ Clang 컴파일러"·"LLVM(clang-cl) 도구 집합에 대한 MSBuild 지원"을 체크한다.

> 이 도구는 **빌드/패키징 PC에만** 필요하다. 완성된 설치본(.exe)을 실행하는 운영 PC에는 불필요.

### Node.js 버전 (Node 24를 쓰고 있다면 다운그레이드)

`better-sqlite3`·`argon2`는 특정 Node ABI용 **prebuilt 바이너리**를 제공한다. **Node 22 LTS**에는 prebuilt가 있어 컴파일 없이 바로 설치되지만, **Node 24+에는 (아직) prebuilt가 없어** 매번 소스 컴파일을 시도하다 위 ClangCL/`llvm-lib` 단계에서 실패할 수 있다.

```powershell
node -v                                   # 현재 버전 확인
# Node가 24 이상이면 22 라인으로 교체
#  (winget의 OpenJS.NodeJS.LTS는 시점에 따라 24를 설치하므로 .22를 명시한다)
winget list node                          # 설치된 Node 패키지 ID 확인
winget uninstall --id <위에서 확인한 ID>   # 기존 Node 제거
winget install   --id OpenJS.NodeJS.22    # 22.x LTS 설치
```

> 설치 후 **새 터미널**을 열고 `node -v`가 `v22.x`인지 확인한다(PATH 갱신 때문에 기존 터미널은 옛 버전을 가리킬 수 있다).

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

## 트러블슈팅

### `npm install` / 빌드가 실패할 때

| 증상(에러) | 원인 | 해결 |
|---|---|---|
| `gyp ERR! find VS ... Could not find any Visual Studio` | C++ 빌드 도구 없음 | 위 *빌드 전용 전제*의 VS Build Tools 설치 |
| `MSB8020: ClangCL ... 찾을 수 없습니다` | ClangCL 컴포넌트 누락 | `VC.Llvm.ClangToolset`·`VC.Llvm.Clang` 설치 |
| `llvm-lib.exe ... (코드: 1)`, `No prebuilt binaries found (target=24...)` | **Node 24+**에서 소스 컴파일 강제 | 위 *Node.js 버전*대로 **Node 22 LTS**로 교체 |
| `EBUSY: resource busy or locked` (node_modules) | 에디터·이전 Electron/Node 프로세스가 파일 점유 | 해당 프로세스·에디터 종료 → `node_modules` 삭제 → 재설치 |

### `npm run dev`에서 창이 흰 화면일 때

Vite의 HMR/Fast Refresh가 CSP(Content-Security-Policy)에 막히면 React가 초기화되지 않아 흰 화면이 된다. 개발 서버에서만 CSP를 완화하도록 이미 처리돼 있다:

- `src/main/index.ts` — `ELECTRON_RENDERER_URL`이 있을 때(dev) 헤더 CSP에 `'unsafe-inline' 'unsafe-eval'`·`ws://localhost:*` 허용
- `electron.vite.config.ts` — `relaxCspInDev` 플러그인이 dev 서버에서만 `index.html`의 메타 CSP를 완화

재발하면 위 두 곳의 dev용 CSP를 확인한다. **프로덕션(배포본) CSP는 엄격하게 유지되며, 검증(OQ/PQ) 대상은 프로덕션 쪽이다.**

## 폐쇄망 운영 주의

- 외부 네트워크 호출·자동 업데이트 없음.
- 일탈 후속조치(OS 관리자 권한 제한, OS 시간변경 제한, 백신, 백업/복구 SOP 등)는 도입 회사가 IQ 단계에서 적용·검증한다(`../docs/03_URS/URS-002` §4.3 체크리스트).
