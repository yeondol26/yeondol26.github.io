"""화면 동작 확인: python tests/smoke.py        (1학기, 먼저 python build.py)
                  python tests/smoke.py sem2   (2학기)"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ed = sys.argv[1] if len(sys.argv) > 1 else ""
dist = Path(__file__).parent.parent / "dist" / ed
url = (dist / "index.html").resolve().as_uri()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 420, "height": 900})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(200)
    pg.click("[data-act=ladder]")
    for _ in range(300):
        if pg.locator(".done").count(): break
        if pg.locator("[data-act=learned]").count(): pg.click("[data-act=learned]"); continue
        pg.locator("[data-act=pick]").first.click(); pg.wait_for_timeout(210); pg.click("[data-act=next]")
    pg.click("[data-act=home]")
    for tab in ["path", "practice", "wrong", "stats", "today"]:
        pg.click(f"[data-act=tab][data-v={tab}]"); pg.screenshot(path=str(dist / f"shot_{tab}.png"), full_page=True)
    b.close()
print("오류:", errs or "없음"); raise SystemExit(1 if errs else 0)
