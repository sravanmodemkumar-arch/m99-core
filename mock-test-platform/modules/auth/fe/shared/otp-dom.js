/** DOM-specific OTP helpers — used by web and desktop (Electron). */

export function otpAutoAdvance(rowSelector) {
  const digits = document.querySelectorAll(`${rowSelector} input`);
  digits.forEach((input, i) => {
    input.addEventListener("input", () => {
      if (input.value && i < digits.length - 1) digits[i + 1].focus();
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !input.value && i > 0) digits[i - 1].focus();
    });
    input.addEventListener("paste", e => {
      e.preventDefault();
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, digits.length);
      [...text].forEach((c, j) => { if (digits[i + j]) digits[i + j].value = c; });
      digits[Math.min(i + text.length, digits.length - 1)].focus();
    });
  });
}

export function getOtpValue(rowSelector) {
  return [...document.querySelectorAll(`${rowSelector} input`)].map(i => i.value).join("");
}
