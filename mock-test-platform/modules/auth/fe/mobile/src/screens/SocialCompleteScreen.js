import React, { useState } from "react";
import {
  View, Text, TextInput, ScrollView,
  TouchableOpacity, StyleSheet,
} from "react-native";
import Btn from "../components/Btn.js";
import OtpInput, { emptyOtp, otpValue } from "../components/OtpInput.js";
import { api } from "../utils/api.js";
import { Storage } from "../utils/storage.js";

export default function SocialCompleteScreen({ navigation, route }) {
  // session_token passed from OAuth redirect via route.params
  const routeSessionToken = route?.params?.session_token || "";

  const [step, setStep] = useState("phone"); // phone | otp
  const [phone, setPhone] = useState("");
  const [sessionToken, setSessionToken] = useState(routeSessionToken);
  const [otp, setOtp] = useState(emptyOtp());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ── step: phone ──────────────────────────────────────────────────────────
  async function submitPhone() {
    if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
      setErr("Enter a valid 10-digit mobile number");
      return;
    }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/social/complete", {
      method: "POST",
      body: JSON.stringify({ phone, session_token: sessionToken }),
    });
    setLoading(false);
    if (!ok) { setErr(data.error || "Could not complete sign-in"); return; }
    if (data.otp_required) {
      // api may return a new session_token for the OTP step
      if (data.session_token) setSessionToken(data.session_token);
      setStep("otp");
      return;
    }
    // no OTP needed — direct login
    await finishLogin(data);
  }

  // ── step: otp ────────────────────────────────────────────────────────────
  async function submitOtp() {
    const v = otpValue(otp);
    if (v.length !== 6) { setErr("Enter all 6 digits"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ otp: v, session_token: sessionToken }),
    });
    setLoading(false);
    if (!ok) { setErr(data.error || "Invalid OTP"); return; }
    await finishLogin(data);
  }

  async function finishLogin(data) {
    await Storage.set("token", data.token);
    if (data.uid) await Storage.set("uid", data.uid);
    navigation.replace("Home");
  }

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.heroWrap}>
        <Text style={s.heroIcon}>📱</Text>
        <Text style={s.heading}>One last step</Text>
        <Text style={s.sub}>
          {step === "phone"
            ? "We need your mobile number to keep your account secure."
            : "Enter the 6-digit code sent to your phone."}
        </Text>
      </View>

      <View style={s.card}>
        {step === "phone" && <>
          <Text style={s.label}>Mobile Number *</Text>
          <View style={s.phoneRow}>
            <View style={s.countryCode}>
              <Text style={s.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={[s.input, s.phoneInput]}
              value={phone}
              onChangeText={v => { setPhone(v.replace(/\D/g, "")); setErr(""); }}
              placeholder="10-digit number"
              keyboardType="phone-pad"
              maxLength={10}
              placeholderTextColor="#94A3B8"
              autoFocus
            />
          </View>
          <Text style={s.hint}>
            An OTP will be sent to this number for verification.
          </Text>
          {err ? <Text style={s.err}>{err}</Text> : null}
          <Btn
            label="Continue"
            onPress={submitPhone}
            loading={loading}
          />
        </>}

        {step === "otp" && <>
          <Text style={s.otpDesc}>
            Code sent to <Text style={s.otpPhone}>+91 {phone}</Text>
          </Text>
          <OtpInput values={otp} setValues={setOtp} />
          {err ? <Text style={s.err}>{err}</Text> : null}
          <Btn
            label="Verify &amp; Continue"
            onPress={submitOtp}
            loading={loading}
            style={{ marginTop: 20 }}
          />
          <TouchableOpacity
            style={s.backLink}
            onPress={() => { setStep("phone"); setOtp(emptyOtp()); setErr(""); }}
          >
            <Text style={s.backLinkText}>← Change number</Text>
          </TouchableOpacity>
        </>}
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>
          Your phone number is used only for security and will never be shared.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24, paddingTop: 48 },

  heroWrap: { alignItems: "center", marginBottom: 32 },
  heroIcon: { fontSize: 56, marginBottom: 16 },
  heading: { fontSize: 24, fontWeight: "900", color: "#0F172A", marginBottom: 8, textAlign: "center" },
  sub: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 21, paddingHorizontal: 8 },

  card: {
    backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 1, borderColor: "#E2E8F0",
    padding: 20, marginBottom: 20,
  },

  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 8 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  countryCode: {
    borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 13,
    backgroundColor: "#F1F5F9",
  },
  countryCodeText: { fontSize: 15, fontWeight: "600", color: "#334155" },
  input: {
    borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10,
    padding: 12, fontSize: 15, color: "#0F172A",
    backgroundColor: "#F8FAFC", marginBottom: 16,
  },
  phoneInput: { flex: 1, marginBottom: 0 },
  hint: { fontSize: 12, color: "#94A3B8", marginBottom: 16, lineHeight: 18 },

  otpDesc: { fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 20 },
  otpPhone: { fontWeight: "700", color: "#0F172A" },

  err: { fontSize: 13, color: "#EF4444", textAlign: "center", marginBottom: 12 },

  backLink: { alignItems: "center", paddingVertical: 10 },
  backLinkText: { fontSize: 14, color: "#2563EB" },

  footer: { paddingHorizontal: 8 },
  footerText: { fontSize: 12, color: "#94A3B8", textAlign: "center", lineHeight: 18 },
});
