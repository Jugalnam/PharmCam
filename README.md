# PharmCam 📷

> 제약회사 QC팀을 위한 **GMP 밸리데이션된 검체·시료 사진 기록 데스크톱 앱**
> — 그리고 "비개발자가 AI(Claude Code)로 CSV를 직접 수행한다"는 것을 보여주는 **교육 프로젝트**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)
![Electron](https://img.shields.io/badge/Electron-React%20%2B%20TypeScript-47848F.svg)

---

## 이게 뭔가요?

PharmCam은 제약 품질관리(QC) 현장에서 **검체·시료를 촬영하고, 시험번호·작업자·일시 같은 메타데이터를 자동으로 각인해 위·변조 없이 기록**하는 Windows 데스크톱 앱입니다.

단순 카메라 앱이 아니라, 규제 산업의 **데이터 무결성(Data Integrity)** 원칙인 **ALCOA+** 를 코드 레벨에서 보장하도록 설계했습니다.

- **A**ttributable — 로그인한 작업자 없이는 기록을 남기지 않음
- **L**egible / **C**ontemporaneous — 신뢰 시각(단일 출처)으로 실시간 기록
- **O**riginal / **A**ccurate — 원본 이미지는 SHA-256 해시로 변조 탐지, 읽기전용 보관
- **+** Complete·Consistent·Enduring·Available — 감사추적(audit trail) **append-only**

## 무엇이 특별한가요?

이 프로젝트는 두 개의 결과물을 **동시에** 만듭니다.

1. **실제 동작하는 GMP 앱** (`app/`)
2. **CSV 교육 콘텐츠** (`docs/`, `lectures/`) — 코드를 짜기 전에 GMP 검증 문서(V-모델)를 먼저 작성하는 전 과정을 기록

> 즉, "비개발자(제약 QC 실무자)가 AI 도구로 규제 수준의 소프트웨어를 검증 절차에 맞춰 만들 수 있는가?"를 실제로 보여주는 사례입니다.

## CSV V-모델 — 문서가 코드보다 먼저

일반 개발과 달리, 규제 산업 소프트웨어는 **CSV(Computer System Validation)** 절차를 따릅니다. 이 레포의 `docs/`는 그 산출물입니다.

```
VP  밸리데이션 계획서      docs/01_VP   ← 전체 활동의 헌법
RA  위험평가              docs/02_RA   ← 검증 노력을 어디 집중할지
URS 사용자 요구사항 명세   docs/03_URS  ──────────────┐ 검증 짝: PQ
DQ  설계 적격성 평가       docs/04_DQ   ───────┐ 검증 짝: OQ │
   ▼ ── 여기서부터 비로소 app/ 코드 작성 ──    │            │
IQ  설치 적격성 평가       docs/05_IQ   ───────┘            │
OQ  운전 적격성 평가       docs/06_OQ   ───────────────────┘
PQ  성능 적격성 평가       docs/07_PQ
```

모든 기능은 URS 항목에서 출발해 검증(OQ/PQ)까지 추적 가능합니다 → [`docs/traceability_matrix.md`](docs/traceability_matrix.md)

## 기술 스택

| 영역 | 기술 |
|---|---|
| 플랫폼 | Electron (Windows 데스크톱) |
| UI | React + TypeScript |
| 번들 | electron-vite |
| DB | better-sqlite3 |
| 보안 | argon2(비밀번호 해시), Electron safeStorage(DPAPI), Node crypto SHA-256(무결성) |

**보안 설계 원칙:** 보안 민감 로직은 Main 프로세스에만 두고, Renderer(UI)는 `contextBridge` IPC로만 접근합니다 (`contextIsolation:true`, `nodeIntegration:false`). 감사추적은 DB 트리거로도 update/delete를 차단하는 append-only 구조입니다.

## 폴더 구조

| 경로 | 역할 |
|---|---|
| [`docs/`](docs/) | GMP 검증 문서 (VP~PQ) + 추적성 매트릭스 + [운영 매뉴얼](docs/PharmCam_Operation_Manual.md) |
| [`app/`](app/) | Electron 앱 소스 — 빌드/실행은 [`app/README.md`](app/README.md) 참조 |
| [`lectures/`](lectures/) | 단계별 HTML 강의자료 ("만들면서 가르친다") |

> 📖 **운영 매뉴얼:** [`docs/PharmCam_Operation_Manual.md`](docs/PharmCam_Operation_Manual.md) (OM-001 v1.0) — 설치·로그인부터 7개 탭 사용법·운영 점검·문제 해결까지.
>
> 🖥️ **소개 슬라이드:** [`docs/PharmCam_소개.pptx`](docs/PharmCam_소개.pptx) — 실제 앱 화면 캡처를 포함한 7개 탭 소개 발표자료(PowerPoint).

## 빠른 시작 (개발자용)

```powershell
cd app
npm install        # 네이티브 모듈 자동 재빌드 (Node 22 LTS 권장)
npm run dev        # 개발 실행
npm run typecheck  # 타입 검사
npm run package    # Windows 설치본 빌드 (release/)
```

> ⚠️ 네이티브 모듈(`argon2`·`better-sqlite3`) 컴파일을 위해 빌드 PC에 **VS 2022 Build Tools(C++/ClangCL) + Python**이 1회 필요합니다. 자세한 환경 설정은 [`app/README.md`](app/README.md)를 참고하세요.

초기 계정: `admin / Admin123!` (최초 로그인 시 비밀번호 강제 변경)

## 라이선스

[MIT](LICENSE) © 2026 Jugalnam

> ⚠️ **GMP 사용 시 주의:** 이 소프트웨어는 무보증(AS-IS)으로 제공됩니다. 실제 규제 환경(GxP)에서 사용하려면, 사용 주체가 자신의 배포 환경에 대해 **IQ/OQ/PQ 검증을 직접 수행**해야 데이터 무결성이 보장됩니다.
