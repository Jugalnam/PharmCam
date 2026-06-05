# VP-001 — Validation Plan (밸리데이션 계획서)

**시스템명:** PharmCam — 검체·시료 사진 기록 시스템
**문서 ID:** VP-001
**버전:** 1.0 (Approved)
**작성일:** 2026-06-05
**확정일:** 2026-06-05

> **이 문서가 하는 일:** PharmCam을 GMP 기준으로 어떻게 검증(validation)할지를 미리 정하는 계획서.
> 이후 만들어질 모든 산출물(RA, URS, DQ, IQ, OQ, PQ)이 이 계획을 근거로 작성된다.

---

## 1. 목적 (Purpose)

PharmCam이 **의도된 용도대로 정확하고 일관되게 동작함**을, 그리고 생성된 데이터가 **데이터 무결성(data integrity)** 요건을 만족함을 문서화된 증거로 보증하기 위함이다.

- *데이터 무결성:* 데이터가 만들어진 시점부터 폐기될 때까지 변조되지 않고 신뢰할 수 있는 상태로 유지되는 것.

## 2. 범위 (Scope)

| 구분 | 내용 |
|---|---|
| 시스템 | PharmCam (Windows용 Electron 데스크톱 앱) |
| 주요 기능 | 검체/시료 촬영, 메타데이터(시험번호·작업자·일시) 자동 각인, 감사추적(audit trail) 기록 |
| 설치 환경 | QC 실험실 내 Windows 단독(standalone) PC |
| 포함 (In scope) | 앱 소프트웨어, 설치 절차, 데이터 저장·보존, 감사추적 기능 |
| 제외 (Out of scope) | PC 하드웨어/OS 자체의 적격성, 카메라 장치의 계측 검교정, 네트워크 인프라 |

- *감사추적(audit trail):* 누가·언제·무엇을 했는지를 사후 변경 불가능하게 남기는 기록.

## 3. 시스템 개요 (System Overview)

QC 작업자가 검체/시료를 촬영하면, PharmCam이 시험번호·작업자·촬영일시를 사진에 묶어 저장하고, 모든 행위를 감사추적에 남긴다. 종이 사진 기록을 대체해 ALCOA+ 원칙을 전자적으로 보장하는 것이 목적이다.

- *ALCOA+:* 데이터가 갖춰야 할 9가지 속성 — Attributable(귀속), Legible(가독), Contemporaneous(동시성), Original(원본), Accurate(정확) + Complete, Consistent, Enduring, Available.

## 4. 영향성 평가 (Impact Assessment)

> **이 절이 하는 일:** "이 시스템을 얼마나 빡세게 검증해야 하는가"를 정당화한다.
> GxP 영향이 클수록, 규정 적용을 받을수록 검증 강도가 올라간다.

### 4.1 GxP 영향성 평가 (System Impact Assessment)

시스템을 GxP에 미치는 영향에 따라 3단계로 판정한다.

- **Direct Impact (직접 영향):** GxP 기능(제품 품질·환자 안전·데이터 무결성)에 직접 영향. → **정식 검증(full validation) 필요**
- **Indirect Impact (간접 영향):** 직접 영향 항목을 보조. → 제한적 검증
- **No Impact (영향 없음):** GxP에 영향 없음. → Good Engineering Practice(GEP)로 관리, 정식 검증 불필요

**구성요소별 영향성 판정**

| 구성요소 (기능) | 영향성 | 근거 |
|---|---|---|
| 촬영·이미지 캡처 | **Direct** | GMP 품질기록(사진) 자체를 생성 |
| 메타데이터 각인 (시험번호·작업자·일시) | **Direct** | 귀속성·동시성(Attributable·Contemporaneous) 보증 |
| 감사추적 (audit trail) | **Direct** | 데이터 무결성의 핵심 증거 |
| 데이터 저장·보존 | **Direct** | 원본성·보존성(Original·Enduring) |
| 사용자 식별·접근통제 | **Direct** | 귀속성·보안 |
| 화면 테마·표시 설정 | No Impact | 품질·무결성에 영향 없음 |

→ **시스템 종합 판정: Direct Impact.** 직접 영향 기능이 핵심이므로 전체 시스템을 정식 검증 대상으로 본다.

### 4.2 규정 적용성 평가 (21 CFR Part 11 / EU Annex 11 Applicability)

PharmCam이 생성하는 사진·메타데이터·감사추적은 종이 기록을 대체하는 **전자기록(electronic record)** 이며, GMP 예측규정(predicate rule)이 요구하는 품질기록에 해당한다.

| 평가 항목 | 판정 | 비고 |
|---|---|---|
| 전자기록(e-record)을 생성·보관하는가 | 예 | → Part 11 / Annex 11 **적용 대상** |
| 전자서명(e-signature)을 사용하는가 | _(URS에서 결정)_ | 작업자 확정/승인을 전자서명으로 할지 여부 |
| 적용 규정 | **FDA 21 CFR Part 11**, **EU GMP Annex 11** | 둘 다 전자기록·데이터 무결성 요구 |

**적용에 따라 시스템이 갖춰야 할 통제 (URS/DQ로 전개):**
- 시스템 밸리데이션(본 계획)
- 감사추적 (변경 불가, 사후 추적)
- 접근통제·사용자 식별 (권한 관리)
- 정확한 사본 생성 및 백업·보존
- 신뢰할 수 있는 시각 출처

### 4.3 종합 영향성 평가 및 검증 전략 (Total Impact → Validation Strategy)

검증 전략은 **GxP 영향성 × GAMP 카테고리**로 결정한다.

- **GAMP 5 카테고리:** PharmCam은 사내 요구에 맞춰 신규 개발하는 맞춤형 소프트웨어이므로 **Category 5 (Custom application)** — 가장 높은 복잡도/검증 강도.
  - *GAMP 5:* 제약 컴퓨터 시스템 검증 국제 지침.
- **GxP 영향성:** Direct Impact (4.1) + Part 11/Annex 11 적용 (4.2).

| GxP 영향성 | GAMP 카테고리 | → 검증 전략 |
|---|---|---|
| **Direct** | **5 (Custom)** | **전 단계 정식 검증** (URS→DQ→IQ→OQ→PQ 전부 수행), RA로 검증 깊이 조절 |

## 5. 밸리데이션 접근방식 (Validation Approach) — V-모델

```
URS  ──────────────── PQ   (요구사항이 실제 운영에서 충족되는지)
  DQ ────────────── OQ      (설계·기능이 의도대로 동작하는지)
     IQ                     (올바르게 설치되었는지)
```

위험평가(RA)에 근거해 각 단계의 검증 깊이를 조절한다.

## 6. 책임과 역할 (Roles & Responsibilities)

> 본 프로젝트는 **비개발자 QC 실무자가 Claude Code를 도구로 활용**해 수행하는 교육 겸용 프로젝트다.
> 실제 사내 적용 시에는 QA의 독립적 검토·승인이 분리되어야 한다(아래 표에 표기).

| 역할 | 담당 | 책임 |
|---|---|---|
| System Owner (시스템 책임자) | QC 실무자 | 요구사항 정의, 검증 활동 주관 |
| 개발/구현 | Claude Code + Cursor | 코드 작성, 설계 문서화 |
| Tester (검증 수행) | QC 실무자 | IQ/OQ/PQ 실행 및 결과 기록 |
| QA (품질보증) | **_(별도 지정 필요)_** | 산출물 독립 검토 및 최종 승인 |

## 7. 밸리데이션 산출물 (Deliverables)

| 단계 | 문서 ID 체계 | 폴더 | 상태 |
|---|---|---|---|
| Validation Plan | VP-001 | `docs/01_VP` | **확정 (v1.0)** |
| Risk Assessment | RA-001 | `docs/02_RA` | **확정 (v1.0)** |
| User Requirement Spec | URS-001/002 | `docs/03_URS` | **확정 (v1.0)** |
| Design Qualification | DQ-001 | `docs/04_DQ` | **확정 (v1.0)** |
| Installation Qualification | IQ-xxx | `docs/05_IQ` | 예정 |
| Operational Qualification | OQ-TC-xxx | `docs/06_OQ` | 예정 |
| Performance Qualification | PQ-TC-xxx | `docs/07_PQ` | 예정 |
| Traceability Matrix | — | `docs/traceability_matrix.md` | 진행 중 |

## 8. 합격 기준 및 일탈 처리 (Acceptance Criteria & Deviation)

- 각 검증(IQ/OQ/PQ)의 모든 테스트 케이스가 **사전 정의된 예상 결과(expected result)** 와 일치하면 합격.
- 불일치 발생 시 **일탈(deviation)** 로 기록하고, 원인·영향·조치를 문서화한 뒤 재시험한다.
- 모든 미결 일탈이 종결되기 전에는 시스템을 운영에 사용하지 않는다.

## 9. 변경 관리 및 추적성 (Change Control & Traceability)

- 승인된 문서의 변경은 버전을 올리고 변경 사유를 기록한다.
- 모든 URS 항목은 설계(DQ)와 검증(OQ/PQ)까지 `docs/traceability_matrix.md`로 추적된다.

## 10. 승인 (Approval)

| 역할 | 성명 | 서명 | 일자 |
|---|---|---|---|
| System Owner | _(지정)_ | | |
| QA | _(지정)_ | | |

---

## 부록 — 약어 (Abbreviations)

VP(Validation Plan), RA(Risk Assessment), URS(User Requirement Specification),
DQ/IQ/OQ/PQ(Design/Installation/Operational/Performance Qualification),
CSV(Computer System Validation), GAMP(Good Automated Manufacturing Practice),
GxP(Good x Practice), GEP(Good Engineering Practice).
