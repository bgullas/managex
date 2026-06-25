/* Mocked bank PayNow Corporate API.
   In production, createDynamicQR() and simulateBankWebhookCall() would be replaced by
   real calls into a bank Corporate API (DBS IDEAL RAPID, OCBC Velocity API, UOB BIBPlus API)
   or a gateway SDK (HitPay, StraitsX/Xfers, 2C2P) — see server/README.md. */
const crypto = require('crypto');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || (() => {
  console.warn('[mockBank] WEBHOOK_SECRET not set — using an insecure dev default. Set WEBHOOK_SECRET in production.');
  return 'dev-only-insecure-secret-change-me';
})();

const MERCHANT_NAME = 'MANAGEX MCST';
const MERCHANT_CITY = 'SINGAPORE';

function tlv(id, value) {
  const len = String(value.length).padStart(2, '0');
  return id + len + value;
}

function crc16ccitt(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      else crc = (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/* Same EMVCo SGQR construction as assets/app-utils.js buildPayNowPayload, replicated here
   so the backend (the would-be bank API) is the actual source of truth for the QR string. */
function buildPayNowPayload(uen, amount, ref, editable) {
  const merchantAccount =
    tlv('00', 'SG.PAYNOW') +
    tlv('01', '2') +
    tlv('02', uen) +
    tlv('03', editable ? '1' : '0');
  const guiField = tlv('26', merchantAccount);

  let payload =
    tlv('00', '01') +
    tlv('01', '12') +
    guiField +
    tlv('52', '0000') +
    tlv('53', '702') +
    tlv('54', Number(amount).toFixed(2)) +
    tlv('58', 'SG') +
    tlv('59', MERCHANT_NAME) +
    tlv('60', MERCHANT_CITY) +
    tlv('62', tlv('01', ref));
  payload += '6304';
  const crc = crc16ccitt(payload);
  return payload + crc;
}

function randomSuffix() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

const DEFAULT_UEN = process.env.PAYNOW_UEN || '202411234A';
const QR_EXPIRY_MS = 15 * 60 * 1000;

/* Stands in for the bank's "create dynamic QR for this transaction" Corporate API call. */
function createDynamicQR({ uen, amount, unit, period }) {
  const unitDigits = String(unit || '').replace(/[^0-9]/g, '');
  const periodTag = String(period || '').replace(/\s+/g, '').toUpperCase();
  const reference = `RG-${unitDigits}-${periodTag}-${randomSuffix()}`;
  const transactionId = `TXN-${Date.now()}-${randomSuffix()}`;
  const qrPayload = buildPayNowPayload(uen || DEFAULT_UEN, amount, reference);
  const expiresAt = new Date(Date.now() + QR_EXPIRY_MS).toISOString();
  return { reference, qrPayload, transactionId, expiresAt };
}

function signPayload(bodyString) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(bodyString).digest('hex');
}

function verifySignature(bodyString, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = signPayload(bodyString);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* Stands in for the bank pushing a signed payment-confirmation webhook to our server after
   the payer completes the transfer in their banking app. */
function simulateBankWebhookCall(intent, webhookUrl) {
  const body = JSON.stringify({
    transactionId: intent.transactionId,
    reference: intent.reference,
    unit: intent.unit,
    period: intent.period,
    amount: intent.amount,
    status: 'paid',
    paidAt: new Date().toISOString(),
  });
  const signature = signPayload(body);
  return fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
    body,
  });
}

module.exports = {
  createDynamicQR,
  simulateBankWebhookCall,
  signPayload,
  verifySignature,
  buildPayNowPayload,
  WEBHOOK_SECRET,
};
