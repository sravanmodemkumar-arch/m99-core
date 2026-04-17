import React, { useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import Btn from "../components/Btn.js";
import PasswordField from "../components/PasswordField.js";
import OtpInput, { emptyOtp, otpValue } from "../components/OtpInput.js";
import { api, getConfig, requireGuest } from "../utils/api.js";
import { Storage } from "../utils/storage.js";
import { detectIdentifier } from "../../../shared/validators.js";

export default function LoginScreen({ navigation }) {
  const [cfg, setCfg] = useState({});
  const [step, setStep] = useState("creds"); // creds | otp | totp
  const [identifier, setIdentifier] = useState("");
  const [pw, setPw] = useState("");
  const [otp, setOtp] = useState(emptyOtp());
  const [totp, setTotp] = useState(emptyOtp());
  const [session, setSession] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getConfig().then(c => { setCfg(c); requireGuest(navigation); });
  }, []);

  async function submitCreds() {
    if (!identifier || !pw) { setErr("All fields required"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password: pw, identifier_type: detectIdentifier(identifier) }) });
    setLoading(false);
    if (!ok) { setErr(data.error || "Login failed"); return; }
    if (data.next === "otp") { setSession(data.session_token); setStep("otp"); return; }
    if (data.next === "totp") { setSession(data.session_token); setStep("totp"); return; }
    await finishLogin(data);
  }

  async function submitOtp() {
    const v = otpValue(otp);
    if (v.length !== 6) { setErr("Enter all 6 digits"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/otp/verify", { method: "POST", body: JSON.stringify({ otp: v, session_token: session }) });
    setLoading(false);
    if (!ok) { setErr(data.error || "Invalid OTP"); return; }
    if (data.next === "totp") { setSession(data.session_token); setStep("totp"); return; }
    await finishLogin(data);
  }

  async function submitTotp() {
    const v = otpValue(totp);
    if (v.length !== 6) { setErr("Enter all 6 digits"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/totp/verify", { method: "POST", body: JSON.stringify({ totp: v, session_token: session }) });
    setLoading(false);
    if (!ok) { setErr(data.error || "Invalid code"); return; }
    await finishLogin(data);
  }

  async function finishLogin(data) {
    await Storage.set("token", data.token);
    await Storage.set("uid", data.uid || "");
    navigation.replace("Home");
  }

  const idLabel = cfg.identifier_label || "Phone / Email / Username";

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>Sign In</Text>

      {step === "creds" && <>
        <Text style={s.label}>{idLabel}</Text>
        <TextInput style={s.input} value={identifier} onChangeText={setIdentifier} placeholder={idLabel} autoCapitalize="none" placeholderTextColor="#94A3B8" />
        <PasswordField label="Password *" value={pw} onChangeText={setPw} />
        {err ? <Text style={s.err}>{err}</Text> : null}
        <Btn label="Sign In" onPress={submitCreds} loading={loading} />
        <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={s.link}>
          <Text style={s.linkText}>Forgot password?</Text>
        </TouchableOpacity>
        {cfg.registration?.self !== false && (
          <TouchableOpacity onPress={() => navigation.navigate("Register1")} style={s.link}>
            <Text style={s.linkText}>New here? Register free</Text>
          </TouchableOpacity>
        )}
      </>}

      {step === "otp" && <>
        <Text style={s.stepDesc}>Enter the 6-digit code sent to your phone</Text>
        <OtpInput values={otp} setValues={setOtp} />
        {err ? <Text style={s.err}>{err}</Text> : null}
        <Btn label="Verify OTP" onPress={submitOtp} loading={loading} style={{ marginTop: 20 }} />
        <Btn label="← Back" variant="ghost" onPress={() => { setStep("creds"); setErr(""); }} />
      </>}

      {step === "totp" && <>
        <Text style={s.stepDesc}>Enter the 6-digit code from your Authenticator app</Text>
        <OtpInput values={totp} setValues={setTotp} />
        {err ? <Text style={s.err}>{err}</Text> : null}
        <Btn label="Verify" onPress={submitTotp} loading={loading} style={{ marginTop: 20 }} />
        <Btn label="← Back" variant="ghost" onPress={() => { setStep("otp"); setErr(""); }} />
      </>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24, paddingTop: 48 },
  heading: { fontSize: 26, fontWeight: "900", color: "#0F172A", marginBottom: 28 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, fontSize: 15, color: "#0F172A", backgroundColor: "#fff", marginBottom: 16 },
  err: { fontSize: 13, color: "#EF4444", textAlign: "center", marginBottom: 12 },
  stepDesc: { fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 24, lineHeight: 21 },
  link: { alignItems: "center", paddingVertical: 10 },
  linkText: { fontSize: 14, color: "#2563EB" },
});
