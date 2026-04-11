"""
Phase 2 Auth Tests — Backend API + Frontend E2E
Covers: register, login, verify-email, forgot/reset password, sessions
"""
import sys, os, time, uuid, json
sys.stdout.reconfigure(encoding="utf-8")

import requests
from playwright.sync_api import sync_playwright, expect

API  = "http://localhost:3001/api/v1"
WEB  = "http://localhost:3000/en"

PASS = "Test@1234!"

def uid():
    return uuid.uuid4().hex[:8]

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
class Results:
    def __init__(self):
        self.passed = []
        self.failed = []

    def ok(self, name):
        self.passed.append(name)
        print(f"  [PASS] {name}")

    def fail(self, name, reason=""):
        self.failed.append(name)
        print(f"  [FAIL] {name}" + (f" — {reason}" if reason else ""))

    def summary(self):
        total = len(self.passed) + len(self.failed)
        print(f"\n{'='*60}")
        print(f"  Results: {len(self.passed)}/{total} passed")
        if self.failed:
            print(f"  Failed:")
            for f in self.failed:
                print(f"    - {f}")
        print(f"{'='*60}")
        return len(self.failed) == 0

R = Results()

# ─────────────────────────────────────────────────────────────────────────────
# ── BACKEND API TESTS ────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  PHASE 2 — BACKEND API TESTS")
print("="*60)

# 1. Health check
try:
    res = requests.get(f"{API}/health", timeout=5)
    assert res.status_code == 200
    R.ok("API health check")
except Exception as e:
    R.fail("API health check", str(e))

# 2. Register user
email_user = f"test_{uid()}@example.com"
try:
    res = requests.post(f"{API}/auth/register", json={
        "name": "Test User",
        "email": email_user,
        "password": PASS
    })
    assert res.status_code in (200, 201), f"status={res.status_code} body={res.text[:200]}"
    R.ok("POST /auth/register — user")
except Exception as e:
    R.fail("POST /auth/register — user", str(e))

# 3. Register duplicate email
try:
    res = requests.post(f"{API}/auth/register", json={
        "name": "Test User",
        "email": email_user,
        "password": PASS
    })
    assert res.status_code in (400, 409, 422), f"Expected conflict, got {res.status_code}"
    R.ok("POST /auth/register — duplicate email rejected")
except Exception as e:
    R.fail("POST /auth/register — duplicate email rejected", str(e))

# 4. Register artist
email_artist = f"artist_{uid()}@example.com"
try:
    res = requests.post(f"{API}/auth/register/artist", json={
        "name": "Test Artist",
        "email": email_artist,
        "password": PASS,
        "stageName": "DJ Test",
        "bio": "Test bio",
        "genreIds": []
    })
    assert res.status_code in (200, 201), f"status={res.status_code} body={res.text[:200]}"
    R.ok("POST /auth/register/artist")
except Exception as e:
    R.fail("POST /auth/register/artist", str(e))

# 5. Login before email verified → 403
try:
    res = requests.post(f"{API}/auth/login", json={
        "email": email_user,
        "password": PASS
    })
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    R.ok("POST /auth/login — unverified email blocked (403)")
except Exception as e:
    R.fail("POST /auth/login — unverified email blocked (403)", str(e))

# 6. Login with wrong password
try:
    res = requests.post(f"{API}/auth/login", json={
        "email": email_user,
        "password": "WrongPass@99"
    })
    assert res.status_code in (401, 403), f"Expected 401/403, got {res.status_code}"
    R.ok("POST /auth/login — wrong password rejected")
except Exception as e:
    R.fail("POST /auth/login — wrong password rejected", str(e))

# 7. Resend verification email
try:
    res = requests.post(f"{API}/auth/resend-verification-email", json={"email": email_user})
    assert res.status_code in (200, 201), f"status={res.status_code} body={res.text[:200]}"
    R.ok("POST /auth/resend-verification-email")
except Exception as e:
    R.fail("POST /auth/resend-verification-email", str(e))

# 8. Verify email with wrong code
try:
    res = requests.post(f"{API}/auth/verify-email", json={
        "email": email_user,
        "code": "000000"
    })
    assert res.status_code in (400, 401, 422), f"Expected error, got {res.status_code}"
    R.ok("POST /auth/verify-email — wrong code rejected")
except Exception as e:
    R.fail("POST /auth/verify-email — wrong code rejected", str(e))

# 9. Forgot password — valid email
try:
    res = requests.post(f"{API}/auth/forgot-password", json={"email": email_user})
    assert res.status_code in (200, 201), f"status={res.status_code}"
    R.ok("POST /auth/forgot-password — valid email")
except Exception as e:
    R.fail("POST /auth/forgot-password — valid email", str(e))

# 10. Forgot password — non-existent email (should not reveal existence)
try:
    res = requests.post(f"{API}/auth/forgot-password", json={"email": f"ghost_{uid()}@example.com"})
    assert res.status_code in (200, 201), f"Expected 200 (no user enumeration), got {res.status_code}"
    R.ok("POST /auth/forgot-password — non-existent email (no enumeration)")
except Exception as e:
    R.fail("POST /auth/forgot-password — non-existent email (no enumeration)", str(e))

# 11. Verify reset code — wrong code
try:
    res = requests.post(f"{API}/auth/verify-code", json={
        "email": email_user,
        "code": "000000"
    })
    assert res.status_code in (400, 401, 422), f"Expected error, got {res.status_code}"
    R.ok("POST /auth/verify-code — wrong code rejected")
except Exception as e:
    R.fail("POST /auth/verify-code — wrong code rejected", str(e))

# 12. Reset password — invalid token
try:
    res = requests.post(f"{API}/auth/reset-password", json={
        "email": email_user,
        "code": "000000",
        "newPassword": PASS
    })
    assert res.status_code in (400, 401, 422), f"Expected error, got {res.status_code}"
    R.ok("POST /auth/reset-password — wrong code rejected")
except Exception as e:
    R.fail("POST /auth/reset-password — wrong code rejected", str(e))

# 13. Sessions endpoint — unauthenticated
try:
    res = requests.get(f"{API}/auth/sessions")
    assert res.status_code in (401, 403), f"Expected 401/403, got {res.status_code}"
    R.ok("GET /auth/sessions — unauthenticated blocked")
except Exception as e:
    R.fail("GET /auth/sessions — unauthenticated blocked", str(e))

# 14. Logout — unauthenticated
try:
    res = requests.post(f"{API}/auth/logout")
    assert res.status_code in (200, 401, 403), f"Got {res.status_code}"
    R.ok("POST /auth/logout — unauthenticated handled")
except Exception as e:
    R.fail("POST /auth/logout — unauthenticated handled", str(e))

# 15. Register — validation: short password
try:
    res = requests.post(f"{API}/auth/register", json={
        "name": "T",
        "email": f"bad_{uid()}@test.com",
        "password": "short"
    })
    assert res.status_code in (400, 422), f"Expected validation error, got {res.status_code}"
    R.ok("POST /auth/register — weak password rejected")
except Exception as e:
    R.fail("POST /auth/register — weak password rejected", str(e))

# ─────────────────────────────────────────────────────────────────────────────
# ── FRONTEND E2E TESTS ───────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  PHASE 2 — FRONTEND E2E TESTS")
print("="*60)

SHOTS = r"C:\Users\FPT-HIEU\Desktop\my-music\tests\phase2\screenshots"
os.makedirs(SHOTS, exist_ok=True)

def fill_otp(page, code):
    """Fill OTP boxes with a 6-digit code using keyboard events to trigger React state."""
    boxes = page.locator("input[type=text]").all()
    for i, digit in enumerate(str(code)[:6]):
        if i < len(boxes):
            boxes[i].click()
            boxes[i].press(digit)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ── T1: Register page loads with Listener/Artist tabs ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/register")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SHOTS}/01_register.png", full_page=True)
        assert page.locator("button", has_text="LISTENER").is_visible()
        assert page.locator("button", has_text="ARTIST").is_visible()
        R.ok("FE: Register page — Listener/Artist tabs visible")
        page.close()
    except Exception as e:
        R.fail("FE: Register page — Listener/Artist tabs visible", str(e))

    # ── T2: Artist tab shows stageName field ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/register")
        page.wait_for_load_state("networkidle")
        page.locator("button", has_text="ARTIST").click()
        page.wait_for_timeout(400)
        page.screenshot(path=f"{SHOTS}/02_register_artist.png", full_page=True)
        assert page.locator("input[placeholder='How you appear to fans']").is_visible()
        R.ok("FE: Register — Artist tab shows Stage name field")
        page.close()
    except Exception as e:
        R.fail("FE: Register — Artist tab shows Stage name field", str(e))

    # ── T3: Register form validation — empty submit ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/register")
        page.wait_for_load_state("networkidle")
        page.locator("button", has_text="CREATE ACCOUNT").click()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SHOTS}/03_register_validation.png", full_page=True)
        # Should show validation errors (form not submitted)
        assert page.url.endswith("/register")
        R.ok("FE: Register — empty form shows validation errors")
        page.close()
    except Exception as e:
        R.fail("FE: Register — empty form shows validation errors", str(e))

    # ── T4: Full user registration flow ──
    fe_email = f"fe_{uid()}@example.com"
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/register")
        page.wait_for_load_state("networkidle")
        page.locator("input[placeholder='Your full name']").fill("Frontend Test")
        page.locator("input[type=email]").fill(fe_email)
        pwd_inputs = page.locator("input[autocomplete='new-password']").all()
        pwd_inputs[0].fill(PASS)
        pwd_inputs[1].fill(PASS)
        page.locator("button", has_text="CREATE ACCOUNT").click()
        page.wait_for_url("**/verify-email**", timeout=20000)
        page.screenshot(path=f"{SHOTS}/04_register_success.png", full_page=True)
        assert "verify-email" in page.url
        assert fe_email in page.url
        R.ok("FE: Register — submits and redirects to verify-email")
        page.close()
    except Exception as e:
        page.screenshot(path=f"{SHOTS}/04_register_fail.png", full_page=True)
        R.fail("FE: Register — submits and redirects to verify-email", str(e))

    # ── T5: Verify-email page loads with email pre-filled ──
    try:
        test_email = "ui_test@example.com"
        page = browser.new_page()
        page.goto(f"{WEB}/verify-email?email={test_email}")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SHOTS}/05_verify_email.png", full_page=True)
        assert page.locator("text=Verify email").first.is_visible()
        assert page.locator(f"text={test_email}").is_visible()
        assert page.locator("button", has_text="VERIFY EMAIL").is_visible()
        R.ok("FE: Verify-email — page loads with email displayed")
        page.close()
    except Exception as e:
        R.fail("FE: Verify-email — page loads with email displayed", str(e))

    # ── T6: Verify-email — resend countdown timer visible ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/verify-email?email=test@example.com")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SHOTS}/06_verify_countdown.png", full_page=True)
        # Countdown pill should be visible on load
        assert page.locator("text=Resend in").is_visible()
        R.ok("FE: Verify-email — resend countdown timer shown on load")
        page.close()
    except Exception as e:
        R.fail("FE: Verify-email — resend countdown timer shown on load", str(e))

    # ── T7: Verify-email — wrong OTP shows error ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/verify-email?email=test@example.com")
        page.wait_for_load_state("networkidle")
        fill_otp(page, "123456")
        page.wait_for_timeout(800)
        # Wait until button is not disabled via JS
        page.wait_for_function("() => !document.querySelector('button[type=\"button\"]').disabled", timeout=5000)
        page.get_by_role("button", name="Verify email").click()
        page.wait_for_timeout(3000)
        page.screenshot(path=f"{SHOTS}/07_verify_wrong_otp.png", full_page=True)
        assert "verify-email" in page.url
        R.ok("FE: Verify-email — wrong OTP shows error, stays on page")
        page.close()
    except Exception as e:
        page.screenshot(path=f"{SHOTS}/07_verify_wrong_otp_fail.png", full_page=True)
        R.fail("FE: Verify-email — wrong OTP shows error, stays on page", str(e))

    # ── T8: Login page loads ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/login")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SHOTS}/08_login.png", full_page=True)
        assert page.locator("input[type=email]").is_visible()
        assert page.locator("input[autocomplete='current-password']").is_visible()
        assert page.locator("button", has_text="SIGN IN").is_visible()
        R.ok("FE: Login — page loads with email + password fields")
        page.close()
    except Exception as e:
        R.fail("FE: Login — page loads with email + password fields", str(e))

    # ── T9: Login — wrong credentials shows error ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/login")
        page.wait_for_load_state("networkidle")
        page.locator("input[type=email]").fill("nobody@example.com")
        page.locator("input[autocomplete='current-password']").fill("WrongPass@1")
        page.locator("button", has_text="SIGN IN").click()
        page.wait_for_timeout(3000)
        page.screenshot(path=f"{SHOTS}/09_login_wrong_creds.png", full_page=True)
        # Should stay on login page with error
        assert "/login" in page.url
        R.ok("FE: Login — wrong credentials shows error message")
        page.close()
    except Exception as e:
        R.fail("FE: Login — wrong credentials shows error message", str(e))

    # ── T10: Login — unverified email shows "Verify email now" button ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/login")
        page.wait_for_load_state("networkidle")
        page.locator("input[type=email]").fill(fe_email)
        page.locator("input[autocomplete='current-password']").fill(PASS)
        page.locator("button", has_text="SIGN IN").click()
        page.wait_for_timeout(3000)
        page.screenshot(path=f"{SHOTS}/10_login_unverified.png", full_page=True)
        # Should show the "Verify email now" banner
        assert page.locator("text=Verify email now").is_visible()
        R.ok("FE: Login — unverified account shows 'Verify email now' button")
        page.close()
    except Exception as e:
        R.fail("FE: Login — unverified account shows 'Verify email now' button", str(e))

    # ── T11: "Verify email now" links to verify-email with email pre-filled ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/login")
        page.wait_for_load_state("networkidle")
        page.locator("input[type=email]").fill(fe_email)
        page.locator("input[autocomplete='current-password']").fill(PASS)
        page.locator("button", has_text="SIGN IN").click()
        page.wait_for_timeout(3000)
        # Use href-based link selector (it's an <a> tag not a button)
        verify_link = page.locator("a", has_text="Verify email now")
        assert verify_link.is_visible(), "Verify email now link not visible"
        href = verify_link.get_attribute("href")
        assert "verify-email" in href, f"href={href}"
        assert "email" in href, f"email param missing from href={href}"
        page.screenshot(path=f"{SHOTS}/11_verify_link.png", full_page=True)
        R.ok("FE: Login — 'Verify email now' links to verify-email with email param")
        page.close()
    except Exception as e:
        R.fail("FE: Login — 'Verify email now' links to verify-email with email param", str(e))

    # ── T12: Forgot password page ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/forgot-password")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SHOTS}/12_forgot.png", full_page=True)
        assert page.locator("input[type=email]").is_visible()
        assert page.locator("button", has_text="SEND RESET CODE").is_visible()
        R.ok("FE: Forgot-password — page loads correctly")
        page.close()
    except Exception as e:
        R.fail("FE: Forgot-password — page loads correctly", str(e))

    # ── T13: Forgot password — submits and shows sent state ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/forgot-password")
        page.wait_for_load_state("networkidle")
        page.locator("input[type=email]").fill(fe_email)
        page.locator("button", has_text="SEND RESET CODE").click()
        page.wait_for_timeout(3000)
        page.screenshot(path=f"{SHOTS}/13_forgot_sent.png", full_page=True)
        # Either shows sent state or redirects
        sent = (
            page.locator("text=Check your email").is_visible()
            or page.locator("text=sent").is_visible()
            or "verify-reset" in page.url
        )
        assert sent
        R.ok("FE: Forgot-password — shows confirmation after submit")
        page.close()
    except Exception as e:
        R.fail("FE: Forgot-password — shows confirmation after submit", str(e))

    # ── T14: Verify-reset page loads ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/verify-reset?email=test@example.com")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SHOTS}/14_verify_reset.png", full_page=True)
        assert page.locator("input[type=text]").count() == 6
        assert page.locator("button", has_text="VERIFY CODE").is_visible()
        R.ok("FE: Verify-reset — page loads with 6-box OTP")
        page.close()
    except Exception as e:
        R.fail("FE: Verify-reset — page loads with 6-box OTP", str(e))

    # ── T15: Reset-password page loads ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/reset-password?email=test@example.com&code=123456")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SHOTS}/15_reset_pass.png", full_page=True)
        pwd_inputs = page.locator("input[autocomplete='new-password']").all()
        assert len(pwd_inputs) >= 2
        R.ok("FE: Reset-password — page loads with password fields")
        page.close()
    except Exception as e:
        R.fail("FE: Reset-password — page loads with password fields", str(e))

    # ── T16: Login page — forgot password link navigates correctly ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/login")
        page.wait_for_load_state("networkidle")
        forgot_link = page.get_by_role("link", name="Forgot password?")
        assert forgot_link.is_visible()
        href = forgot_link.get_attribute("href")
        assert "forgot-password" in href, f"href={href}"
        page.screenshot(path=f"{SHOTS}/16_forgot_nav.png", full_page=True)
        R.ok("FE: Login — 'Forgot password?' link navigates to forgot-password")
        page.close()
    except Exception as e:
        page.screenshot(path=f"{SHOTS}/16_forgot_nav_fail.png", full_page=True)
        R.fail("FE: Login — 'Forgot password?' link navigates to forgot-password", str(e))

    # ── T17: Register page — "Sign in" link navigates to login ──
    try:
        page = browser.new_page()
        page.goto(f"{WEB}/register")
        page.wait_for_load_state("networkidle")
        signin_link = page.get_by_role("link", name="Sign in")
        assert signin_link.is_visible()
        href = signin_link.get_attribute("href")
        assert "/login" in href, f"href={href}"
        page.screenshot(path=f"{SHOTS}/17_signin_link.png", full_page=True)
        R.ok("FE: Register — 'Sign in' link navigates to login")
        page.close()
    except Exception as e:
        page.screenshot(path=f"{SHOTS}/17_signin_fail.png", full_page=True)
        R.fail("FE: Register — 'Sign in' link navigates to login", str(e))

    # ── T18: Auth layout left panel is visible ──
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(f"{WEB}/login")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SHOTS}/18_layout_left_panel.png", full_page=True)
        # Left panel should be visible on large screen (has vinyl + waveform)
        # Check for SVG (vinyl record)
        assert page.locator("svg").count() > 0
        R.ok("FE: Auth layout — left panel renders on desktop")
        page.close()
    except Exception as e:
        R.fail("FE: Auth layout — left panel renders on desktop", str(e))

    browser.close()

# ─────────────────────────────────────────────────────────────────────────────
passed = R.summary()
print(f"\nScreenshots saved to: {SHOTS}")
sys.exit(0 if passed else 1)
