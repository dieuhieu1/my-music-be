#!/usr/bin/env node
/**
 * Simulate a successful MoMo IPN callback for local development.
 *
 * Usage:
 *   node scripts/simulate-momo-ipn.js <orderId> [resultCode]
 *
 * Arguments:
 *   orderId     UUID returned by POST /api/v1/payment/momo  (required)
 *   resultCode  0 = success (default), 1006 = cancelled, 1005 = insufficient funds
 *
 * Example:
 *   node scripts/simulate-momo-ipn.js 550e8400-e29b-41d4-a716-446655440000
 *   node scripts/simulate-momo-ipn.js 550e8400-e29b-41d4-a716-446655440000 1006
 */

const { createHmac } = require('node:crypto');
const https = require('node:https');
const http = require('node:http');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ── Read env ──────────────────────────────────────────────────────────────────

const PARTNER_CODE = process.env.MOMO_PARTNER_CODE;
const ACCESS_KEY   = process.env.MOMO_ACCESS_KEY;
const SECRET_KEY   = process.env.MOMO_SECRET_KEY;
const NOTIFY_URL   = process.env.MOMO_NOTIFY_URL;
const RETURN_URL   = process.env.MOMO_RETURN_URL;

if (!PARTNER_CODE || !ACCESS_KEY || !SECRET_KEY || !NOTIFY_URL || !RETURN_URL) {
  console.error('Missing one of: MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_NOTIFY_URL, MOMO_RETURN_URL in .env');
  process.exit(1);
}

// ── Args ──────────────────────────────────────────────────────────────────────

const orderId    = process.argv[2];
const resultCode = Number(process.argv[3] ?? '0');

if (!orderId) {
  console.error('Usage: node scripts/simulate-momo-ipn.js <orderId> [resultCode]');
  process.exit(1);
}

// ── Build signature (must match handleMomoCallback in payments.service.ts) ───
// Service hardcodes orderInfo: '' and extraData: '' when verifying the callback.

const requestId = `sim-${Date.now()}`;
const amount    = 30_000; // ONE_MONTH price; adjust if testing other tiers
const transId   = String(Date.now());

const rawSignature =
  `accessKey=${ACCESS_KEY}&amount=${amount}` +
  `&extraData=&ipnUrl=${NOTIFY_URL}` +
  `&orderId=${orderId}&orderInfo=` +
  `&partnerCode=${PARTNER_CODE}&redirectUrl=${RETURN_URL}` +
  `&requestId=${requestId}&requestType=captureWallet`;

const signature = createHmac('sha256', SECRET_KEY)
  .update(rawSignature)
  .digest('hex');

// ── POST to notify URL ────────────────────────────────────────────────────────

const payload = JSON.stringify({
  partnerCode: PARTNER_CODE,
  orderId,
  requestId,
  amount,
  resultCode,
  signature,
  transId,
});

const url     = new URL(NOTIFY_URL);
const isHttps = url.protocol === 'https:';
const lib     = isHttps ? https : http;

const options = {
  hostname: url.hostname,
  port:     url.port || (isHttps ? 443 : 80),
  path:     url.pathname + url.search,
  method:   'POST',
  headers:  {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log(`\nSending MoMo IPN to ${NOTIFY_URL}`);
console.log(`  orderId    : ${orderId}`);
console.log(`  resultCode : ${resultCode} (${resultCode === 0 ? 'SUCCESS' : 'FAILED'})`);
console.log(`  amount     : ${amount} VND`);
console.log(`  transId    : ${transId}\n`);

const req = lib.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`✓ IPN accepted (HTTP ${res.statusCode})`);
      if (resultCode === 0) {
        console.log('  → Premium should now be active for this user.');
      } else {
        console.log('  → Payment marked as FAILED.');
      }
    } else {
      console.error(`✗ IPN rejected (HTTP ${res.statusCode})`);
      console.error(`  Response: ${body}`);
    }
  });
});

req.on('error', (err) => {
  console.error(`✗ Request failed: ${err.message}`);
  process.exit(1);
});

req.write(payload);
req.end();
