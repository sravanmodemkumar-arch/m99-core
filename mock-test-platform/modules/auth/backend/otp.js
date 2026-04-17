/**
 * OTP generation + verification
 * v1: stores in KV with 10-min TTL. No SMS vendor lock-in — swap _sendOtp() only.
 */

const OTP_TTL = 600; // 10 minutes

export async function requestOtp(phone, env) {
  const otp = _generate();
  await env.KV.put(`otp:${phone}`, otp, { expirationTtl: OTP_TTL });
  await _sendOtp(phone, otp, env);
  return { sent: true };
}

export async function verifyOtp(phone, otp, env) {
  // Dev bypass — set DEV_OTP_BYPASS=123456 in .dev.vars to skip KV check
  if (env.DEV_OTP_BYPASS && otp === env.DEV_OTP_BYPASS) return { valid: true };

  const stored = await env.KV.get(`otp:${phone}`);
  if (!stored || stored !== otp) return { valid: false };
  await env.KV.delete(`otp:${phone}`);
  return { valid: true };
}

function _generate() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function _sendOtp(phone, otp, env) {
  // v1: log only. Swap for MSG91/Twilio by setting SMS_PROVIDER env var.
  const provider = env.SMS_PROVIDER || "log";
  if (provider === "log") {
    console.log(`[OTP] ${phone}: ${otp}`);
    return;
  }
  if (provider === "msg91") {
    await fetch(`https://api.msg91.com/api/v5/otp?template_id=${env.MSG91_TEMPLATE}&mobile=${phone}&otp=${otp}`, {
      method: "GET",
      headers: { authkey: env.MSG91_KEY },
    });
  }
}
