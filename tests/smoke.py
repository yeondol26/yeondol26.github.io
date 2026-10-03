"""화면 동작 확인: python tests/smoke.py (먼저 python build.py)"""
from pathlib import Path
from playwright.sync_api import sync_playwright
url = (Path(__file__).parent.parent/"dist/index.html").resolve().as_uri()
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
        pg.click(f"[data-act=tab][data-v={tab}]"); pg.screenshot(path=f"dist/shot_{tab}.png", full_page=True)
    b.close()
print("오류:", errs or "없음"); raise SystemExit(1 if errs else 0)
