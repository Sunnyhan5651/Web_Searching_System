"""실제 브라우저(Chromium) 동작시험.

실행:  python3 tests/e2e_browser.py
결과:  tests/results/e2e_report.md, tests/results/screens/*.png

확인 내용
  - 서버로 열기(http) / 파일 더블클릭으로 열기(file) 두 방식 모두 동작
  - PC(1280px)·모바일(390px) 화면, 모바일 가로 스크롤 없음
  - 추천 키워드 7개 검색 결과 수, 탭 전환, 필터, 주소 공유(#q=)
  - 데이터 파일 하나가 없어도 나머지 화면은 동작(장애 분리)
  - 화면 오류(콘솔 에러) 없음, 원문 링크는 새 창으로 열림
"""
import asyncio
import functools
import http.server
import socketserver
import threading
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = ROOT / "tests" / "results"
SHOTS = OUT / "screens"
EXPECTED = {"계약": 11, "보조금": 1, "출장": 1, "채용": 1, "공유재산": 1, "민간위탁": 0, "복무": 7}

results = []


def check(group, name, ok, detail=""):
    results.append((group, name, bool(ok), str(detail)))
    print(("PASS " if ok else "FAIL ") + f"[{group}] {name}" + ("" if ok else f"  -> {detail}"))


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    handler = functools.partial(Quiet, directory=str(DIST))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


async def summary(page):
    return (await page.inner_text("#resultSummary")).strip()


async def run_basic(browser, base, label, width, height, shots=True):
    ctx = await browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
    page = await ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    G = f"{label} {width}px"
    await page.goto(base + "index.html")
    await page.wait_for_selector(".case")
    check(G, "첫 화면에 감사사례 표시", "전체 감사사례 57건" in await summary(page), await summary(page))
    check(G, "상단 현황(사례·자료원 수)", (await page.inner_text("#statCases")) == "57건" and (await page.inner_text("#statSources")) == "76개",
          await page.inner_text(".stats"))
    if shots:
        await page.screenshot(path=str(SHOTS / f"{label}_{width}_01_첫화면.png"))

    for q, n in EXPECTED.items():
        await page.click(f'.quick button[data-query="{q}"]')
        s = await summary(page)
        check(G, f"추천 키워드 '{q}' → {n}건", f"관련 {n}건" in s, s)
        if q == "계약" and shots:
            await page.screenshot(path=str(SHOTS / f"{label}_{width}_02_계약검색.png"), full_page=width < 800)
        if q == "민간위탁":
            check(G, "결과 없음 안내 표시", await page.is_visible(".empty"), "")
            if shots:
                await page.screenshot(path=str(SHOTS / f"{label}_{width}_03_결과없음.png"))

    # 직접 입력 + 강조
    await page.fill("#searchInput", "계약 보증")
    await page.press("#searchInput", "Enter")
    check(G, "직접 입력 검색(계약 보증 → 1건)", "관련 1건" in await summary(page), await summary(page))
    check(G, "검색어 강조표시", await page.locator(".case mark").count() > 0, "")
    check(G, "주소창에 검색어 기록(#q=)", "q=" in page.url, page.url)

    # 필터
    await page.click("#resetBtn")
    await page.select_option("#typeFilter", "기관정기감사")
    check(G, "감사유형 필터(기관정기감사 13건)", "13건" in await summary(page), await summary(page))
    await page.select_option("#dispositionFilter", "변상판정")
    check(G, "필터 조합(기관정기감사+변상판정 1건)", "1건" in await summary(page), await summary(page))
    await page.click("#filterReset")
    check(G, "필터 초기화", "57건" in await summary(page), await summary(page))

    # 원문 링크
    links = page.locator(".case .source-link")
    targets = set(await links.evaluate_all("els => els.map(e => e.target + '|' + e.rel)"))
    check(G, "원문 링크는 새 창(noopener)으로 열림", targets == {"_blank|noopener noreferrer"}, targets)
    check(G, "원문 쪽수·대조일 표시", await page.locator(".case .pages").count() > 0, "")
    boards = await page.locator(".case .locator").count()
    check(G, "게시판 연결 사례에 '찾는 방법' 안내", boards >= 1, f"{boards}건")

    # 자료원 탭
    await page.click("#tab-sources")
    s = (await page.inner_text("#sourceSummary")).strip()
    check(G, "감사자료원 탭 76개", "76개" in s, s)
    await page.check("#priorityOnly")
    s = (await page.inner_text("#sourceSummary")).strip()
    check(G, "연찬 우선기관만 24개", "24개" in s, s)
    if shots:
        await page.screenshot(path=str(SHOTS / f"{label}_{width}_04_자료원.png"))
    await page.click("#tab-guide")
    check(G, "이용안내 탭 표시", await page.is_visible("#guideView") and await page.locator("#reviewDefs div").count() == 4, "")
    if shots:
        await page.screenshot(path=str(SHOTS / f"{label}_{width}_05_이용안내.png"), full_page=True)

    # 공유 주소로 바로 열기
    await page.goto(base + "index.html#q=" + "%EC%B1%84%EC%9A%A9")
    await page.reload()
    await page.wait_for_selector("#resultSummary:not(:empty)")
    check(G, "공유 주소(#q=채용)로 열면 바로 결과", "‘채용’ 관련 1건" in await summary(page), await summary(page))

    if width < 800:
        await page.click("#resetBtn")
        over = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check(G, "모바일 가로 스크롤 없음", over <= 0, f"넘침 {over}px")
    check(G, "화면 오류(콘솔 에러) 없음", not errors, errors[:3])
    await ctx.close()


async def run_failure(browser, base):
    G = "장애 분리"
    for blocked, expect in [("sources.js", "sources"), ("synonyms.js", "synonyms"), ("audit_cases.js", "cases")]:
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        await page.route(f"**/data/{blocked}", lambda r: r.abort())
        await page.route(f"**/data/{blocked.replace('.js', '.json')}", lambda r: r.abort())
        await page.goto(base + "index.html")
        await page.wait_for_timeout(400)
        if expect == "sources":
            ok_cases = "57건" in await summary(page)
            await page.click("#tab-sources")
            ok_err = "불러오지 못했습니다" in await page.inner_text("#sourceResults")
            check(G, "자료원 파일이 없어도 감사사례는 정상, 자료원 탭에 안내", ok_cases and ok_err, f"사례:{ok_cases} 안내:{ok_err}")
        elif expect == "synonyms":
            await page.fill("#searchInput", "계약")
            await page.press("#searchInput", "Enter")
            note = await page.is_visible("#dataNotice")
            check(G, "유의어 파일이 없어도 직접 일치 검색 동작 + 안내", note and "관련" in await summary(page), await summary(page))
            await page.screenshot(path=str(SHOTS / "장애_유의어없음.png"))
        else:
            err = "불러오지 못했습니다" in await page.inner_text("#results")
            await page.click("#tab-sources")
            src = "76개" in await page.inner_text("#sourceSummary")
            check(G, "사례 파일이 없어도 자료원 탭은 정상, 사례 탭에 안내", err and src, f"안내:{err} 자료원:{src}")
        await ctx.close()


async def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    httpd = serve()
    http_base = f"http://127.0.0.1:{httpd.server_address[1]}/"
    file_base = DIST.as_uri() + "/"
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        await run_basic(browser, http_base, "서버", 1280, 900)
        await run_basic(browser, http_base, "서버", 390, 844)
        await run_basic(browser, file_base, "파일", 1280, 900, shots=False)
        await run_failure(browser, http_base)
        await browser.close()
    httpd.shutdown()

    passed = sum(1 for r in results if r[2])
    lines = ["# 브라우저 동작시험 결과", "",
             f"- 실행시각: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
             "- 브라우저: Chromium (Playwright)",
             f"- 결과: **{passed} / {len(results)} 통과**", "",
             "| 결과 | 구분 | 시험항목 | 비고 |", "|---|---|---|---|"]
    for g, n, ok, d in results:
        lines.append(f"| {'통과' if ok else '**실패**'} | {g} | {n} | {d.replace('|', '/')[:120]} |")
    lines += ["", "화면 캡처: `tests/results/screens/`"]
    (OUT / "e2e_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\n{passed}/{len(results)} 통과")
    raise SystemExit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
