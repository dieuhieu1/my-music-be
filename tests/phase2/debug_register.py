"""Debug the register form submission."""
import sys
sys.stdout.reconfigure(encoding="utf-8")
import uuid
from playwright.sync_api import sync_playwright

WEB  = "http://localhost:3000/en"
PASS = "Test@1234!"

def uid():
    return uuid.uuid4().hex[:8]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # visible for debug
    page = browser.new_page()
    page.goto(f"{WEB}/register")
    page.wait_for_load_state("networkidle")

    email = f"fe_{uid()}@example.com"
    print(f"Registering: {email}")

    page.locator("input[placeholder='Your full name']").fill("Frontend Test")
    page.locator("input[type=email]").fill(email)

    # Try fill() directly
    pwd_inputs = page.locator("input[autocomplete='new-password']").all()
    print(f"Found {len(pwd_inputs)} password inputs")
    pwd_inputs[0].fill(PASS)
    pwd_inputs[1].fill(PASS)

    # Check button state before clicking
    btn = page.locator("button", has_text="CREATE ACCOUNT")
    print(f"Button disabled: {btn.get_attribute('disabled')}")

    # Listen for network
    responses = []
    page.on("response", lambda r: responses.append((r.url, r.status)) if "auth" in r.url else None)

    btn.click()
    print("Clicked submit, waiting...")

    try:
        page.wait_for_url("**/verify-email**", timeout=20000)
        print(f"SUCCESS - redirected to: {page.url}")
    except Exception as e:
        print(f"TIMEOUT - current URL: {page.url}")
        page.screenshot(path=r"C:\Users\FPT-HIEU\Desktop\my-music\tests\phase2\debug_register.png", full_page=True)
        # Check for errors on page
        errors = page.locator("[style*='#e07070'], [style*='rgba(201']").all()
        for err in errors:
            print(f"Error on page: {err.inner_text()}")

    print(f"\nAPI calls intercepted:")
    for url, status in responses:
        print(f"  {status} {url}")

    browser.close()
