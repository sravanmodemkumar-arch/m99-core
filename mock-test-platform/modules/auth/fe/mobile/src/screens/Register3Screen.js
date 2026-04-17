import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";
import Btn from "../components/Btn.js";
import OtpInput, { emptyOtp, otpValue } from "../components/OtpInput.js";
import { api, getConfig } from "../utils/api.js";
import { Storage } from "../utils/storage.js";

export default function Register3Screen({ navigation }) {
  const [cfg, setCfg] = useState({});
  const [category, setCategory] = useState("");
  const [step, setStep] = useState("details"); // details | otp
  const [otp, setOtp] = useState(emptyOtp());
  const [session, setSession] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSecs, setResendSecs] = useState(0);

  useEffect(() => { getConfig().then(setCfg); }, []);

  async function submit() {
    if (!category) { setErr("Select category"); return; }
    setErr(""); setLoading(true);
    const s1 = await Storage.getJson("reg_step1") || {};
    const s2 = await Storage.getJson("reg_step2") || {};
    const { ok, data } = await api("/auth/register", { method: "POST", body: JSON.stringify({ ...s1, ...s2, category }) });
    setLoading(false);
    if (!ok) { setErr(data.error || "Registration failed"); return; }
    if (data.otp_required) { setSession(data.session_token); setStep("otp"); startTimer(); return; }
    await finish(data);
  }

  async function verifyOtp() {
    const v = otpValue(otp);
    if (v.length !== 6) { setErr("Enter all 6 digits"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/otp/verify", { method: "POST", body: JSON.stringify({ otp: v, session_token: session, purpose: "register" }) });
    setLoading(false);
    if (!ok) { setErr(data.error || "Invalid code"); return; }
    await finish(data);
  }

  async function finish(data) {
    await Storage.remove("reg_step1"); await Storage.remove("reg_step2");
    if (data.token) { await Storage.set("token", data.token); navigation.replace("Home"); }
    else navigation.replace("Login");
  }

  function startTimer() {
    setResendSecs(30);
    const iv = setInterval(() => setResendSecs(p => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; }), 1000);
  }

  async function resend() {
    const s1 = await Storage.getJson("reg_step1") || {};
    await api("/auth/otp/resend", { method: "POST", body: JSON.stringify({ session_token: session, phone: s1.phone }) });
    startTimer();
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.stepRow}>
        <Text style={s.stepLabel}>Step 3 of 3</Text>
        <Text style={s.stepTitle}>{step === "otp" ? "Verify Phone" : "Exam Details"}</Text>
      </View>
      <View style={s.progressRow}>
        {[1,2,3].map(i => <View key={i} style={[s.bar, s.barActive]} />)}
      </View>

      {step === "details" && <>
        <Text style={s.label}>Category *</Text>
        <View style={s.pickerWrap}>
          <Picker selectedValue={category} onValueChange={setCategory}>
            <Picker.Item label="Select category" value="" />
            {[["GEN","General (UR)"],["OBC","OBC"],["SC","SC"],["ST","ST"],["EWS","EWS"]].map(([v,l]) => <Picker.Item key={v} label={l} value={v} />)}
          </Picker>
        </View>
        {err ? <Text style={s.err}>{err}</Text> : null}
        <View style={s.btnRow}>
          <Btn label="← Back" variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
          <Btn label="Create Account" onPress={submit} loading={loading} style={{ flex: 2 }} />
        </View>
      </>}

      {step === "otp" && <>
        <Text style={s.otpDesc}>Enter the 6-digit code sent to your phone</Text>
        <OtpInput values={otp} setValues={setOtp} />
        {err ? <Text style={s.err}>{err}</Text> : null}
        <Text style={s.resend}>
          {resendSecs > 0 ? `Resend in ${resendSecs}s` : ""}
        </Text>
        {resendSecs === 0 && <Btn label="Resend OTP" variant="ghost" onPress={resend} />}
        <Btn label="Verify & Finish" onPress={verifyOtp} loading={loading} style={{ marginTop: 8 }} />
      </>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24 },
  stepRow: { marginBottom: 8 },
  stepLabel: { fontSize: 11, color: "#64748B", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  stepTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginTop: 2 },
  progressRow: { flexDirection: "row", gap: 6, marginBottom: 24 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0" },
  barActive: { backgroundColor: "#2563EB" },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  pickerWrap: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, backgroundColor: "#fff", marginBottom: 16, overflow: "hidden" },
  otpDesc: { fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 24, lineHeight: 21 },
  resend: { fontSize: 13, color: "#94A3B8", textAlign: "center", marginTop: 12 },
  btnRow: { flexDirection: "row", gap: 10 },
  err: { fontSize: 13, color: "#EF4444", textAlign: "center", marginBottom: 12 },
});
