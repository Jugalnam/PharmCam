#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PharmCam GMP 문서 .md -> .html 일괄 변환기.
디자인: 다크 네이비 + 골드(단일 파일, 외부 CDN 없음). 문서 렌더링 전용.
사용: pip install markdown  후  python scripts/md2html.py
대상: docs/ 하위 모든 *.md (각 .md 옆에 동일 이름 .html 생성/갱신).
"""
import glob
import os
import re
from datetime import date

import markdown

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")

TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — PharmCam</title>
<style>
  :root {{
    --bg: #0f172a; --panel: #15203a; --panel2: #1e293b;
    --line: #334155; --text: #e2e8f0; --muted: #94a3b8;
    --gold: #d4a853; --gold-soft: #e6c884; --accent: #38bdf8;
    --ok: #4ade80; --bad: #f87171;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--bg); color: var(--text);
    font-family: "Segoe UI", "Malgun Gothic", system-ui, sans-serif;
    line-height: 1.65; font-size: 15px;
  }}
  .topbar {{
    background: linear-gradient(90deg, #0b1326, #15203a);
    border-bottom: 2px solid var(--gold);
    padding: 14px 28px;
  }}
  .topbar .brand {{ color: var(--gold); font-weight: 700; font-size: 1.15rem; letter-spacing: .5px; }}
  .topbar .sub {{ color: var(--muted); font-size: .8rem; }}
  .wrap {{ max-width: 980px; margin: 0 auto; padding: 32px 28px 80px; }}
  h1, h2, h3, h4 {{ color: var(--gold); line-height: 1.3; }}
  h1 {{ font-size: 1.7rem; border-bottom: 2px solid var(--gold); padding-bottom: .35em; margin-top: .2em; }}
  h2 {{ font-size: 1.3rem; border-bottom: 1px solid var(--line); padding-bottom: .3em; margin-top: 2em; }}
  h3 {{ font-size: 1.08rem; color: var(--gold-soft); margin-top: 1.6em; }}
  h4 {{ font-size: .98rem; color: var(--gold-soft); margin-top: 1.3em; }}
  p {{ margin: .6em 0; }}
  a {{ color: var(--accent); }}
  strong {{ color: #fff; }}
  code {{
    background: var(--panel2); color: var(--gold-soft);
    padding: 1px 6px; border-radius: 4px; font-family: Consolas, "Courier New", monospace; font-size: .9em;
  }}
  pre {{
    background: #0b1326; border: 1px solid var(--line); border-radius: 8px;
    padding: 14px 16px; overflow-x: auto;
  }}
  pre code {{ background: none; color: var(--text); padding: 0; }}
  blockquote {{
    margin: 1em 0; padding: .6em 1em; border-left: 4px solid var(--gold);
    background: rgba(212,168,83,.08); color: var(--muted); border-radius: 0 6px 6px 0;
  }}
  blockquote strong {{ color: var(--gold-soft); }}
  hr {{ border: none; border-top: 1px solid var(--line); margin: 2em 0; }}
  ul, ol {{ padding-left: 1.4em; }}
  li {{ margin: .25em 0; }}
  table {{
    width: 100%; border-collapse: collapse; margin: 1.1em 0; font-size: .9rem;
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
  }}
  th, td {{ border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }}
  th {{ background: var(--panel2); color: var(--gold-soft); font-weight: 600; }}
  tr:nth-child(even) td {{ background: rgba(255,255,255,.02); }}
  .doc-footer {{
    max-width: 980px; margin: 0 auto; padding: 18px 28px 40px;
    color: var(--muted); font-size: .8rem; border-top: 1px solid var(--line);
  }}
</style>
</head>
<body>
  <div class="topbar">
    <div class="brand">PharmCam</div>
    <div class="sub">GMP 검체·시료 사진 기록 시스템 — CSV 산출물</div>
  </div>
  <main class="wrap">
{body}
  </main>
  <footer class="doc-footer">
    자동 생성: {gen} · 원본: <code>{src}</code> · 단일 파일(외부 CDN 없음)
  </footer>
</body>
</html>
"""


def title_of(md_text, fallback):
    for line in md_text.splitlines():
        if line.startswith("# "):
            return re.sub(r"[#*`]", "", line[2:]).strip()
    return fallback


def convert(md_path):
    with open(md_path, "r", encoding="utf-8") as f:
        text = f.read()
    html_body = markdown.markdown(
        text, extensions=["extra", "sane_lists", "nl2br"], output_format="html5"
    )
    title = title_of(text, os.path.basename(md_path))
    rel = os.path.relpath(md_path, ROOT).replace("\\", "/")
    out = TEMPLATE.format(
        title=title, body=html_body, gen=date.today().isoformat(), src=rel
    )
    html_path = os.path.splitext(md_path)[0] + ".html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(out)
    return os.path.relpath(html_path, ROOT)


def main():
    md_files = sorted(glob.glob(os.path.join(DOCS, "**", "*.md"), recursive=True))
    count = 0
    for md in md_files:
        rel = convert(md)
        print("  +", rel)
        count += 1
    print(f"\n{count}개 문서 HTML 생성 완료.")


if __name__ == "__main__":
    main()
