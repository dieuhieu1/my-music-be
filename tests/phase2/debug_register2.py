"""Debug register in headless=True to match test conditions."""
import sys
sys.stdout.reconfigure(encoding="utf-8")
import uuid
from playwright.sync_api import sync_playwright

WEB  = "http://localhost:3000/en"
PASS = "Test@1234!"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Intercept console errors
    page.on("console", lambda msg: print(f"[console {msg.type}] {msg.text}") if msg.type == "error" else None)

    email = f"fe_{uuid.uuid4().hex[:8]}@example.com"
    print(f"Registering: {email}")

    page.goto(f"{WEB}/register")
    page.wait_for_load_state("networkidle")

    page.locator("input[placeholder='Your full name']").fill("Frontend Test")
    page.locator("input[type=email]").fill(email)

    pwd_inputs = page.locator("input[autocomplete='new-password']").all()
    print(f"Found {len(pwd_inputs)} password inputs")

    # Check their values before fill
    for i, inp in enumerate(pwd_inputs):
        print(f"  pwd[{i}] value before fill: '{inp.input_value()}'")

    pwd_inputs[0].fill(PASS)
    pwd_inputs[1].fill(PASS)

    for i, inp in enumerate(pwd_inputs):
        print(f"  pwd[{i}] value after fill: '{inp.input_value()}'")

    page.screenshot(path=r"C:\Users\FPT-HIEU\Desktop\my-music\tests\phase2\debug2_before_submit.png")

    responses = []
    page.on("response", lambda r: responses.append((r.status, r.url, r)) if "auth/register" in r.url else None)

    page.locator("button", has_text="CREATE ACCOUNT").click()
    print("Clicked submit...")

    try:
        page.wait_for_url("**/verify-email**", timeout=20000)
        print(f"SUCCESS: {page.url}")
    except Exception as e:
        print(f"TIMEOUT after 20s. Current URL: {page.url}")
        page.screenshot(path=r"C:\Users\FPT-HIEU\Desktop\my-music\tests\phase2\debug2_after_timeout.png")
        # Get all text on page
        body_text = page.locator("body").inner_text()
        print(f"Page text (first 500 chars): {body_text[:500]}")

    print(f"\nNetwork responses:")
    for status, url, _ in responses:
        print(f"  {status} {url}")

    browser.close()
