/**
 * OTP input state machine — platform-agnostic logic.
 * Web: wire to DOM input events.
 * Mobile: wire to RN TextInput refs via OtpInput component.
 */

export function otpFromValues(values) {
  return values.join("");
}

export function handleOtpKey(values, index, key, setValues, refs) {
  const next = [...values];
  if (key === "Backspace") {
    if (next[index]) {
      next[index] = "";
    } else if (index > 0) {
      next[index - 1] = "";
      refs[index - 1]?.focus?.();
    }
    setValues(next);
  }
}

export function handleOtpChange(values, index, text, setValues, refs) {
  const digits = text.replace(/\D/g, "");
  if (!digits) return;
  const next = [...values];
  if (digits.length === 6) {
    digits.split("").forEach((d, i) => { next[i] = d; });
    setValues(next);
    refs[5]?.blur?.();
    return;
  }
  next[index] = digits[digits.length - 1];
  setValues(next);
  if (index < 5) refs[index + 1]?.focus?.();
}
