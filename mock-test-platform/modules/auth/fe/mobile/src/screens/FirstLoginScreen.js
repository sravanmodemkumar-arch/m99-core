import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
} from "react-native";
import Btn from "../components/Btn.js";
import PasswordField from "../components/PasswordField.js";
import OtpInput, { emptyOtp, otpValue } from "../components/OtpInput.js";
import { api } from "../utils/api.js";
import { Storage } from "../utils/storage.js";

export default function FirstLoginScreen({ navigation, route }) {
  const requireOtp = !!(route?.params?.require_otp);

  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [otp, setOtp] = useState(emptyOtp());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit() {
    // validate
    if (!newPw) { setErr("Password is required"); return; }
    if (newPw.length < 8) { setErr("Password must be at least 8 characters"); return; }
    if (newPw !== confPw) { setErr("Passwords do not match"); return; }
    if (requireOtp) {
      const v = otpValue(otp);
      if (v.length !== 6) { setErr("Enter all 6 OTP digits"); return; }
    }
    setErr(""); setLoading(true);

    const body = { password: newPw };
    if (requireOtp) body.otp = otpValue(otp);

    const { ok, data } = await api("/auth/first-login/set-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!ok) { setErr(data.error || "Could not set password"); return; }

    await Storage.set("token", data.token);
    if (data.uid) await Storage.set("uid", data.uid);
    setSuccess(true);
    // brief pause so user sees success state, then navigate
    setTimeout(() => navigation.replace("Home"), 900);
  }

  if (success) {
    return (
      <View style={s.successScreen}>
        <Text style={s.successIcon}>✅</Text>
        <Text style={s.successTitle}>Password set!</Text>
        <Text style={s.successSub}>Taking you to your dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* hero */}
      <View style={s.heroWrap}>
        <Text style={s.heroIcon}>👋</Text>
        <Text style={s.heading}>Welcome!</Text>
        <Text style={s.sub}>
          Your account was created by an administrator.{"\n"}
          Set your password to get started.
        </Text>
      </View>

      {/* form card */}
      <View style={s.card}>
        <PasswordField
          label="New Password *"
          value={newPw}
          onChangeText={v => { setNewPw(v); setErr(""); }}
          showStrength
          placeholder="Min 8 characters"
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm Password *"
          value={confPw}
          onChangeText={v => { setConfPw(v); setErr(""); }}
          placeholder="Repeat your password"
          autoComplete="new-password"
        />

        {requireOtp && (
          <View style={s.otpSection}>
            <Text style={s.otpLabel}>Verification Code</Text>
            <Text style={s.otpHint}>Enter the 6-digit OTP sent to your registered phone</Text>
            <OtpInput values={otp} setValues={setOtp} />
          </View>
        )}

        {err ? <Text style={s.err}>{err}</Text> : null}

        <View style={s.rulesBox}>
          {[
            "At least 8 characters",
            "Mix of letters and numbers recommended",
            "Avoid using your name or common words",
          ].map(rule => (
            <Text key={rule} style={s.rule}>• {rule}</Text>
          ))}
        </View>

        <Btn
          label="Set Password &amp; Continue"
          onPress={submit}
          loading={loading}
          style={{ marginTop: 4 }}
        />
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24, paddingTop: 48 },

  heroWrap: { alignItems: "center", marginBottom: 28 },
  heroIcon: { fontSize: 60, marginBottom: 14 },
  heading: { fontSize: 26, fontWeight: "900", color: "#0F172A", marginBottom: 8 },
  sub: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 21 },

  card: {
    backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 1, borderColor: "#E2E8F0",
    padding: 20,
  },

  otpSection: { marginBottom: 16 },
  otpLabel: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 4 },
  otpHint: { fontSize: 12, color: "#94A3B8", marginBottom: 12 },

  rulesBox: {
    backgroundColor: "#F8FAFC", borderRadius: 8,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  rule: { fontSize: 12, color: "#64748B", lineHeight: 20 },

  err: { fontSize: 13, color: "#EF4444", textAlign: "center", marginBottom: 12 },

  successScreen: {
    flex: 1, backgroundColor: "#F8FAFC",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  successIcon: { fontSize: 72, marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: "900", color: "#0F172A", marginBottom: 8 },
  successSub: { fontSize: 15, color: "#64748B" },
});
