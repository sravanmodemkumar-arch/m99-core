import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import Btn from "../components/Btn.js";
import PasswordField from "../components/PasswordField.js";
import OtpInput, { emptyOtp, otpValue } from "../components/OtpInput.js";
import { api } from "../utils/api.js";

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState("id"); // id | verify | newpw | done
  const [identifier, setIdentifier] = useState("");
  const [method, setMethod] = useState(""); // otp | email
  const [otp, setOtp] = useState(emptyOtp());
  const [session, setSession] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSecs, setResendSecs] = useState(0);

  async function sendReset() {
    if (!identifier) { setErr("Enter your identifier"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ identifier }) });
    setLoading(false);
    if (!ok) { setErr(data.error || "Not found"); return; }
    setMethod(data.method); setSession(data.session_token || "");
    setStep("verify"); if (data.method === "otp") startTimer();
  }

  async function verifyOtp() {
    const v = otpValue(otp);
    if (v.length !== 6) { setErr("Enter all 6 digits"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/forgot-password/verify-otp", { method: "POST", body: JSON.stringify({ otp: v, session_token: session }) });
    setLoading(false);
    if (!ok) { setErr(data.error || "Invalid OTP"); return; }
    setSession(data.session_token); setStep("newpw");
  }

  async function setPassword() {
    if (!newPw || newPw.length < 8) { setErr("Min 8 characters"); return; }
    if (newPw !== confirmPw) { setErr("Passwords do not match"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/forgot-password/reset", { method: "POST", body: JSON.stringify({ password: newPw, session_token: session }) });
    setLoading(false);
    if (!ok) { setErr(data.error || "Failed"); return; }
    setStep("done");
  }

  function startTimer() {
    setResendSecs(30);
    const iv = setInterval(() => setResendSecs(p => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; }), 1000);
  }

  async function resend() {
    await api("/auth/forgot-password/resend", { method: "POST", body: JSON.stringify({ identifier, session_token: session }) });
    startTimer();
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>Forgot Password</Text>

      {step === "id" && <>
        <Text style={s.desc}>Enter your phone, email, or username to reset your password.</Text>
        <Text style={s.label}>Identifier</Text>
        <TextInput style={s.input} value={identifier} onChangeText={setIdentifier} placeholder="Phone / Email / Username" autoCapitalize="none" placeholderTextColor="#94A3B8" />
        {err ? <Text style={s.err}>{err}</Text> : null}
        <Btn label="Send Reset" onPress={sendReset} loading={loading} />
        <Btn label="← Back to Login" variant="ghost" onPress={() => navigation.goBack()} />
      </>}

      {step === "verify" && method === "otp" && <>
        <Text style={s.desc}>Enter the 6-digit code sent to your registered phone.</Text>
        <OtpInput values={otp} setValues={setOtp} />
        {err ? <Text style={s.err}>{err}</Text> : null}
        {resendSecs > 0 ? <Text style={s.resend}>Resend in {resendSecs}s</Text> : <Btn label="Resend OTP" variant="ghost" onPress={resend} />}
        <Btn label="Verify OTP" onPress={verifyOtp} loading={loading} style={{ marginTop: 12 }} />
      </>}

      {step === "verify" && method === "email" && <>
        <Text style={s.desc}>A password reset link has been sent to your registered email address. Check your inbox.</Text>
        <Btn label="← Back" variant="secondary" onPress={() => setStep("id")} />
      </>}

      {step === "newpw" && <>
        <Text style={s.desc}>Set your new password.</Text>
        <PasswordField label="New Password *" value={newPw} onChangeText={setNewPw} showStrength autoComplete="new-password" />
        <PasswordField label="Confirm Password *" value={confirmPw} onChangeText={setConfirmPw} placeholder="Repeat password" autoComplete="new-password" />
        {err ? <Text style={s.err}>{err}</Text> : null}
        <Btn label="Set New Password" onPress={setPassword} loading={loading} />
      </>}

      {step === "done" && <>
        <Text style={s.icon}>✅</Text>
        <Text style={s.doneTitle}>Password Updated</Text>
        <Text style={s.desc}>You can now sign in with your new password.</Text>
        <Btn label="Go to Login" onPress={() => navigation.replace("Login")} />
      </>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24, paddingTop: 48 },
  heading: { fontSize: 26, fontWeight: "900", color: "#0F172A", marginBottom: 12 },
  desc: { fontSize: 14, color: "#64748B", marginBottom: 24, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, fontSize: 15, color: "#0F172A", backgroundColor: "#fff", marginBottom: 16 },
  err: { fontSize: 13, color: "#EF4444", textAlign: "center", marginBottom: 12 },
  resend: { fontSize: 13, color: "#94A3B8", textAlign: "center", marginTop: 12 },
  icon: { fontSize: 56, textAlign: "center", marginBottom: 16 },
  doneTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", textAlign: "center", marginBottom: 12 },
});
