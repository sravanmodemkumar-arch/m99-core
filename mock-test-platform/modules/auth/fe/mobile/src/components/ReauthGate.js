import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import PasswordField from "./PasswordField.js";
import OtpInput, { emptyOtp, otpValue } from "./OtpInput.js";
import Btn from "./Btn.js";

export default function ReauthGate({ requireOtp = false, requireTotp = false, submitLabel = "Confirm", onSubmit, loading = false }) {
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [otp, setOtp] = useState(emptyOtp());
  const [otpErr, setOtpErr] = useState("");
  const [totp, setTotp] = useState(emptyOtp());
  const [totpErr, setTotpErr] = useState("");
  const [submitErr, setSubmitErr] = useState("");

  function submit() {
    if (!pw) { setPwErr("Required"); return; }
    setPwErr(""); setOtpErr(""); setTotpErr(""); setSubmitErr("");
    const payload = { password: pw };
    if (requireOtp) {
      const v = otpValue(otp);
      if (v.length !== 6) { setOtpErr("Enter all 6 digits"); return; }
      payload.otp = v;
    }
    if (requireTotp) {
      const v = otpValue(totp);
      if (v.length !== 6) { setTotpErr("Enter all 6 digits"); return; }
      payload.totp = v;
    }
    onSubmit?.(payload, setSubmitErr);
  }

  return (
    <View style={s.wrap}>
      <Text style={s.heading}>Confirm your identity</Text>
      <PasswordField label="Password *" value={pw} onChangeText={setPw} error={pwErr} />
      {requireOtp && (
        <View style={s.section}>
          <Text style={s.label}>OTP <Text style={s.muted}>(sent to your phone)</Text></Text>
          <OtpInput values={otp} setValues={setOtp} />
          {otpErr ? <Text style={s.error}>{otpErr}</Text> : null}
        </View>
      )}
      {requireTotp && (
        <View style={s.section}>
          <Text style={s.label}>Authenticator Code</Text>
          <OtpInput values={totp} setValues={setTotp} />
          {totpErr ? <Text style={s.error}>{totpErr}</Text> : null}
        </View>
      )}
      {submitErr ? <Text style={[s.error, { textAlign: "center" }]}>{submitErr}</Text> : null}
      <Btn label={submitLabel} onPress={submit} loading={loading} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: "#E2E8F0", marginTop: 20, paddingTop: 20 },
  heading: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 16 },
  section: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 8 },
  muted: { color: "#94A3B8", fontWeight: "400" },
  error: { fontSize: 12, color: "#EF4444", marginTop: 6 },
});
