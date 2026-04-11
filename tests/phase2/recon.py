"""Recon: screenshot all Phase 2 auth pages to discover selectors."""
from playwright.sync_api import sync_playwright
import os

OUT = r"C:\Users\FPT-HIEU\Desktop\my-music\tests\phase2"
os.makedirs(OUT, exist_ok=True)

BASE = "http://localhost:3000/en"
PAGES = [
    ("register",      f"{BASE}/register"),
    ("login",         f"{BASE}/login"),
    ("forgot",        f"{BASE}/forgot-password"),
    ("verify_email",  f"{BASE}/verify-email?email=test@example.com"),
    ("verify_reset",  f"{BASE}/verify-reset?email=test@example.com"),
    ("reset_pass",    f"{BASE}/reset-password?email=test@example.com&code=123456"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    for name, url in PAGES:
        page = ctx.new_page()
        page.goto(url, timeout=15000)
        page.wait_for_load_state("networkidle")
        path = os.path.join(OUT, f"{name}.png")
        page.screenshot(path=path, full_page=True)
        # Collect input/button info
        inputs = page.locator("input").all()
        buttons = page.locator("button").all()
        print(f"\n=== {name} ({url}) ===")
        for inp in inputs:
            print(f"  INPUT type={inp.get_attribute('type')} placeholder={inp.get_attribute('placeholder')} autocomplete={inp.get_attribute('autocomplete')}")
        for btn in buttons:
            print(f"  BUTTON text='{btn.inner_text().strip()[:60]}'")
        page.close()
    browser.close()
print("\nDone — screenshots saved.")
