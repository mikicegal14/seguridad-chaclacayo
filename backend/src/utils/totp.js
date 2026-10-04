const crypto = require('crypto');
require('dotenv').config();

const STEP_SECONDS = 30;
const DIGITS = 6;

// Secret key for Colaborador OTP generation. Backed by env or a fallback system secret.
const getSecret = () => {
  return process.env.OTP_MASTER_SECRET || 'CHACLACAYO_SECURE_COLABORADOR_TOTP_SECRET_2026';
};

/**
 * Generate 6-digit TOTP for a given counter value (RFC 6238 / RFC 4226)
 * @param {number} counter 
 * @param {string} secret 
 * @returns {string} 6-digit numeric OTP
 */
const generateOtpForCounter = (counter, secret) => {
  const buffer = Buffer.alloc(8);
  // Write 64-bit integer into buffer (Big-endian)
  buffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secret).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, DIGITS);
  return otp.toString().padStart(DIGITS, '0');
};

/**
 * Get current rolling OTP information
 * @returns {{ code: string, secondsRemaining: number, period: number, timestamp: number }}
 */
const getCurrentOtpInfo = () => {
  const nowMs = Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  const counter = Math.floor(nowSeconds / STEP_SECONDS);
  const secondsRemaining = STEP_SECONDS - (nowSeconds % STEP_SECONDS);

  const code = generateOtpForCounter(counter, getSecret());

  return {
    code,
    secondsRemaining,
    period: STEP_SECONDS,
    timestamp: nowMs
  };
};

/**
 * Verify provided OTP against current time window with clock drift tolerance
 * Tolerance: current window, previous window (-1), and next window (+1)
 * @param {string} inputCode 
 * @returns {boolean} true if valid
 */
const verifyOtp = (inputCode) => {
  if (!inputCode) return false;
  const cleanCode = String(inputCode).trim().replace(/\s+/g, '');
  if (cleanCode.length !== DIGITS || !/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const currentCounter = Math.floor(nowSeconds / STEP_SECONDS);
  const secret = getSecret();

  // Check window [-1, 0, 1]
  const candidateCounters = [currentCounter, currentCounter - 1, currentCounter + 1];

  for (const counter of candidateCounters) {
    const validCode = generateOtpForCounter(counter, secret);
    if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(validCode))) {
      return true;
    }
  }

  return false;
};

module.exports = {
  STEP_SECONDS,
  getCurrentOtpInfo,
  verifyOtp
};
