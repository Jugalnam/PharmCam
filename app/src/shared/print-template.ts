import type { ControlledPrintTemplateInput } from './print.types'

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildControlledPrintHtml(input: ControlledPrintTemplateInput): string {
  const fields = [
    ['User ID', input.userId],
    ['시험번호', input.testNo],
    ['촬영일시', input.captureTs],
    ['기록 ID', `#${input.recordId}`],
    ['파일명', input.fileName]
  ]

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>PharmCam Controlled Printout #${escapeHtml(input.recordId)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #111827;
    font-family: "Malgun Gothic", "Segoe UI", Arial, sans-serif;
    background: #fff;
    line-height: 1.45;
  }
  .print-page {
    width: 100%;
  }
  .header {
    border-bottom: 3px solid #0b1929;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .kicker {
    color: #9a7828;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.8px;
    text-transform: uppercase;
  }
  h1 {
    color: #0b1929;
    font-size: 20px;
    margin: 5px 0 0;
  }
  .content {
    display: grid;
    grid-template-columns: 1.4fr .9fr;
    gap: 14px;
    align-items: start;
  }
  .image-frame {
    border: 1px solid #cbd5e1;
    min-height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }
  .image-frame img {
    max-width: 100%;
    max-height: 650px;
    object-fit: contain;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 8px 9px;
    text-align: left;
    vertical-align: top;
  }
  th {
    width: 34%;
    background: #0b1929;
    color: #fff;
    font-weight: 700;
  }
  td {
    word-break: break-word;
  }
  .notice {
    margin-top: 14px;
    border: 1px solid #c8a847;
    background: #fffdf0;
    padding: 10px 12px;
    font-size: 11px;
  }
  .footer {
    margin-top: 12px;
    color: #475569;
    font-size: 10px;
  }
  @media screen {
    body { background: #e8edf3; padding: 18px; }
    .print-page { background: #fff; padding: 18px; box-shadow: 0 10px 30px rgba(15,23,42,.16); }
  }
  @media print {
    .print-page { box-shadow: none; }
  }
</style>
</head>
<body>
  <main class="print-page">
    <header class="header">
      <div class="kicker">PharmCam Controlled Printout</div>
      <h1>검체·시료 사진 공식 출력본</h1>
    </header>
    <section class="content">
      <div class="image-frame">
        <img src="${input.imageDataUrl}" alt="PharmCam record image">
      </div>
      <div>
        <table>
          <tbody>
            ${fields
              .map(
                ([label, value]) =>
                  `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
        <div class="notice">
          이 문서는 PharmCam 통제 인쇄 기능으로 생성된 공식 출력본입니다.
          저장 폴더의 이미지 파일을 OS 또는 외부 프로그램으로 직접 인쇄한 출력물은 공식 출력본이 아닙니다.
        </div>
        <div class="footer">
          전자기록 원본과 감사추적은 PharmCam 시스템에 보존됩니다.
        </div>
      </div>
    </section>
  </main>
</body>
</html>`
}

