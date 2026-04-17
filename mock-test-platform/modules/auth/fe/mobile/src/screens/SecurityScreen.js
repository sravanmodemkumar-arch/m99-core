import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, StyleSheet,
} from "react-native";
import PageHeader from "../components/PageHeader.js";
import Btn from "../components/Btn.js";
import PasswordField from "../components/PasswordField.js";
import OtpInput, { emptyOtp, otpValue } from "../components/OtpInput.js";
import { api } from "../utils/api.js";

// ─── tiny Accordion wrapper ───────────────────────────────────────────────────
function Accordion({ title, open, onToggle, children }) {
  return (
    <View style={acc.wrap}>
      <TouchableOpacity style={acc.header} onPress={onToggle} activeOpacity={0.7}>
        <Text style={acc.title}>{title}</Text>
        <Text style={acc.arrow}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && <View style={acc.body}>{children}</View>}
    </View>
  );
}

const acc = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#E2E8F0",
    marginBottom: 12, overflow: "hidden",
  },
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  title: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  arrow: { fontSize: 12, color: "#94A3B8" },
  body: { padding: 16, paddingTop: 0, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
});

// ─── SECTION 1 — Change Password ─────────────────────────────────────────────
function ChangePassword() {
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (!curPw || !newPw || !confPw) { setErr("All fields required"); return; }
    if (newPw !== confPw) { setErr("New passwords do not match"); return; }
    if (newPw.length < 8) { setErr("Password must be at least 8 characters"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/password/change", {
      method: "POST",
      body: JSON.stringify({ current_password: curPw, new_password: newPw }),
    });
    setLoading(false);
    if (!ok) { setErr(data.error || "Failed to change password"); return; }
    setSuccess(true);
    setCurPw(""); setNewPw(""); setConfPw("");
  }

  return (
    <View style={{ paddingTop: 12 }}>
      {success && (
        <View style={s.successBox}>
          <Text style={s.successText}>✓ Password changed successfully</Text>
        </View>
      )}
      <PasswordField label="Current Password *" value={curPw} onChangeText={v => { setCurPw(v); setSuccess(false); }} />
      <PasswordField label="New Password *" value={newPw} onChangeText={setNewPw} showStrength placeholder="Min 8 characters" autoComplete="new-password" />
      <PasswordField label="Confirm New Password *" value={confPw} onChangeText={setConfPw} placeholder="Repeat new password" autoComplete="new-password" />
      {err ? <Text style={s.err}>{err}</Text> : null}
      <Btn label="Change Password" onPress={submit} loading={loading} />
    </View>
  );
}

// ─── SECTION 2 — Change Phone / Email ────────────────────────────────────────
function ChangeContact() {
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [step, setStep] = useState("form"); // form | otp
  const [session, setSession] = useState("");
  const [otp, setOtp] = useState(emptyOtp());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  async function submitContact() {
    if (!newPhone && !newEmail) { setErr("Enter at least one field"); return; }
    setErr(""); setLoading(true);
    const body = {};
    if (newPhone) body.phone = newPhone;
    if (newEmail) body.email = newEmail;
    const { ok, data } = await api("/auth/contact/change", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!ok) { setErr(data.error || "Request failed"); return; }
    if (data.otp_required) { setSession(data.session_token || ""); setStep("otp"); return; }
    setSuccess(true);
  }

  async function submitOtp() {
    const v = otpValue(otp);
    if (v.length !== 6) { setErr("Enter all 6 digits"); return; }
    setErr(""); setLoading(true);
    const { ok, data } = await api("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ otp: v, session_token: session }),
    });
    setLoading(false);
    if (!ok) { setErr(data.error || "Invalid OTP"); return; }
    setSuccess(true); setStep("form");
  }

  if (success) {
    return (
      <View style={{ paddingTop: 12 }}>
        <View style={s.successBox}>
          <Text style={s.successText}>✓ Contact details updated</Text>
        </View>
        <Btn label="Update Again" variant="ghost" onPress={() => { setSuccess(false); setNewPhone(""); setNewEmail(""); }} />
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 12 }}>
      {step === "form" && <>
        <Text style={s.label}>New Phone</Text>
        <TextInput
          style={s.input}
          value={newPhone}
          onChangeText={setNewPhone}
          placeholder="10-digit mobile"
          keyboardType="phone-pad"
          maxLength={10}
          placeholderTextColor="#94A3B8"
        />
        <Text style={s.label}>New Email</Text>
        <TextInput
          style={s.input}
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#94A3B8"
        />
        {err ? <Text style={s.err}>{err}</Text> : null}
        <Btn label="Request Change" onPress={submitContact} loading={loading} />
      </>}

      {step === "otp" && <>
        <Text style={s.stepDesc}>Enter the 6-digit code sent to your new contact</Text>
        <OtpInput values={otp} setValues={setOtp} />
        {err ? <Text style={s.err}>{err}</Text> : null}
        <Btn label="Verify OTP" onPress={submitOtp} loading={loading} style={{ marginTop: 16 }} />
        <Btn label="← Back" variant="ghost" onPress={() => { setStep("form"); setErr(""); }} />
      </>}
    </View>
  );
}

// ─── SECTION 3 — TOTP Setup / Disable ────────────────────────────────────────
function TotpSection({ totpEnabled: initEnabled }) {
  const [totpEnabled, setTotpEnabled] = useState(initEnabled);

  // disable flow
  const [disablePw, setDisablePw] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableErr, setDisableErr] = useState("");

  // setup flow
  const [setupStep, setSetupStep] = useState("idle"); // idle | loading | ready | confirming
  const [qrUrl, setQrUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [confirmOtp, setConfirmOtp] = useState(emptyOtp());
  const [setupErr, setSetupErr] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  async function disableTotp() {
    if (!disablePw) { setDisableErr("Password required"); return; }
    setDisableErr(""); setDisableLoading(true);
    const { ok, data } = await api("/auth/totp/disable", {
      method: "POST",
      body: JSON.stringify({ password: disablePw }),
    });
    setDisableLoading(false);
    if (!ok) { setDisableErr(data.error || "Failed to disable TOTP"); return; }
    setTotpEnabled(false); setDisablePw("");
  }

  async function startSetup() {
    setSetupStep("loading"); setSetupErr("");
    const { ok, data } = await api("/auth/totp/setup", { method: "POST" });
    if (!ok) { setSetupErr(data.error || "Failed to start setup"); setSetupStep("idle"); return; }
    setQrUrl(data.qr_code); setSecret(data.secret); setSetupStep("ready");
  }

  async function confirmTotp() {
    const v = otpValue(confirmOtp);
    if (v.length !== 6) { setSetupErr("Enter all 6 digits"); return; }
    setSetupErr(""); setSetupLoading(true);
    const { ok, data } = await api("/auth/totp/confirm", {
      method: "POST",
      body: JSON.stringify({ otp: v }),
    });
    setSetupLoading(false);
    if (!ok) { setSetupErr(data.error || "Invalid code"); return; }
    setTotpEnabled(true); setSetupStep("idle"); setConfirmOtp(emptyOtp());
  }

  if (totpEnabled) {
    return (
      <View style={{ paddingTop: 12 }}>
        <View style={s.totpBadge}>
          <Text style={s.totpBadgeText}>✓ Authenticator app is active</Text>
        </View>
        <Text style={s.hint}>Enter your password to disable two-factor authentication.</Text>
        <PasswordField label="Current Password *" value={disablePw} onChangeText={setDisablePw} />
        {disableErr ? <Text style={s.err}>{disableErr}</Text> : null}
        <Btn label="Disable TOTP" variant="danger" onPress={disableTotp} loading={disableLoading} />
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 12 }}>
      <View style={s.totpOff}>
        <Text style={s.totpOffText}>Two-factor authentication is not enabled</Text>
      </View>

      {setupStep === "idle" && (
        <Btn label="Set Up Authenticator" onPress={startSetup} />
      )}

      {setupStep === "loading" && (
        <ActivityIndicator color="#2563EB" style={{ marginVertical: 16 }} />
      )}

      {(setupStep === "ready" || setupStep === "confirming") && <>
        <Text style={s.label}>Scan QR code with your authenticator app</Text>
        {qrUrl ? (
          <Image source={{ uri: qrUrl }} style={s.qrImage} resizeMode="contain" />
        ) : null}
        <View style={s.secretBox}>
          <Text style={s.secretLabel}>Manual entry key</Text>
          <Text style={s.secretValue} selectable>{secret}</Text>
        </View>
        <Text style={s.label}>Enter the 6-digit code to confirm</Text>
        <OtpInput values={confirmOtp} setValues={setConfirmOtp} />
        {setupErr ? <Text style={s.err}>{setupErr}</Text> : null}
        <Btn label="Confirm TOTP" onPress={confirmTotp} loading={setupLoading} style={{ marginTop: 16 }} />
        <Btn label="Cancel" variant="ghost" onPress={() => { setSetupStep("idle"); setSetupErr(""); }} />
      </>}
    </View>
  );
}

// ─── SECTION 4 — Active Sessions ─────────────────────────────────────────────
function SessionsSection({ sessions: initSessions }) {
  const [sessions, setSessions] = useState(initSessions || []);
  const [ending, setEnding] = useState(null); // session_id being ended
  const [endingAll, setEndingAll] = useState(false);
  const [err, setErr] = useState("");

  function deviceIcon(type) {
    if (!type) return "🌐";
    const t = type.toLowerCase();
    if (t.includes("mobile") || t.includes("phone")) return "📱";
    if (t.includes("desktop") || t.includes("computer")) return "🖥️";
    return "🌐";
  }

  async function endSession(id) {
    setEnding(id); setErr("");
    const { ok, data } = await api("/auth/sessions/end", {
      method: "POST",
      body: JSON.stringify({ session_id: id }),
    });
    setEnding(null);
    if (!ok) { setErr(data.error || "Failed"); return; }
    setSessions(p => p.filter(s => s.session_id !== id));
  }

  async function endAll() {
    setEndingAll(true); setErr("");
    const { ok, data } = await api("/auth/sessions/end-all", { method: "POST" });
    setEndingAll(false);
    if (!ok) { setErr(data.error || "Failed"); return; }
    setSessions(p => p.filter(s => s.is_current));
  }

  if (!sessions.length) {
    return (
      <View style={{ paddingTop: 12 }}>
        <Text style={s.hint}>No other active sessions.</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 12 }}>
      {err ? <Text style={s.err}>{err}</Text> : null}
      {sessions.map(sess => (
        <View key={sess.session_id} style={s.sessionRow}>
          <Text style={s.sessionIcon}>{deviceIcon(sess.device_type)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.sessionName}>{sess.device_name || sess.device_type || "Unknown device"}</Text>
            <Text style={s.sessionMeta}>
              {sess.city ? sess.city + " · " : ""}
              Last seen {sess.last_seen ? new Date(sess.last_seen).toLocaleDateString() : "—"}
            </Text>
          </View>
          {sess.is_current ? (
            <View style={s.currentBadge}><Text style={s.currentText}>This device</Text></View>
          ) : (
            <TouchableOpacity
              style={s.endBtn}
              onPress={() => endSession(sess.session_id)}
              disabled={ending === sess.session_id}
            >
              {ending === sess.session_id
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Text style={s.endBtnText}>End</Text>}
            </TouchableOpacity>
          )}
        </View>
      ))}
      {sessions.filter(s => !s.is_current).length > 1 && (
        <Btn
          label="End All Other Sessions"
          variant="danger"
          onPress={endAll}
          loading={endingAll}
          style={{ marginTop: 8 }}
        />
      )}
    </View>
  );
}

// ─── Main SecurityScreen ──────────────────────────────────────────────────────
export default function SecurityScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [open, setOpen] = useState(null); // "pw" | "contact" | "totp" | "sessions"

  useEffect(() => {
    api("/auth/me/security").then(({ ok, data }) => {
      if (ok) setProfile(data);
      setLoadingProfile(false);
    });
  }, []);

  function toggle(key) {
    setOpen(p => (p === key ? null : key));
  }

  if (loadingProfile) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <PageHeader title="Security" onBack={() => navigation.goBack()} />

      <Accordion title="Change Password" open={open === "pw"} onToggle={() => toggle("pw")}>
        <ChangePassword />
      </Accordion>

      <Accordion title="Change Phone / Email" open={open === "contact"} onToggle={() => toggle("contact")}>
        <ChangeContact />
      </Accordion>

      <Accordion
        title={`Two-Factor Authentication${profile?.totp_enabled ? " (Active)" : ""}`}
        open={open === "totp"}
        onToggle={() => toggle("totp")}
      >
        <TotpSection totpEnabled={!!profile?.totp_enabled} />
      </Accordion>

      <Accordion
        title={`Active Sessions${profile?.sessions?.length ? ` (${profile.sessions.length})` : ""}`}
        open={open === "sessions"}
        onToggle={() => toggle("sessions")}
      >
        <SessionsSection sessions={profile?.sessions || []} />
      </Accordion>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },

  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10,
    padding: 12, fontSize: 15, color: "#0F172A",
    backgroundColor: "#F8FAFC", marginBottom: 16,
  },
  hint: { fontSize: 13, color: "#64748B", marginBottom: 12, lineHeight: 19 },
  stepDesc: { fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 16, lineHeight: 21 },

  err: { fontSize: 13, color: "#EF4444", textAlign: "center", marginBottom: 12 },
  successBox: {
    backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#86EFAC",
    borderRadius: 10, padding: 12, marginBottom: 16, alignItems: "center",
  },
  successText: { fontSize: 14, fontWeight: "600", color: "#16A34A" },

  totpBadge: {
    backgroundColor: "#DCFCE7", borderRadius: 8,
    padding: 10, marginBottom: 12, alignItems: "center",
  },
  totpBadgeText: { fontSize: 14, fontWeight: "600", color: "#16A34A" },
  totpOff: {
    backgroundColor: "#FEF3C7", borderRadius: 8,
    padding: 10, marginBottom: 12, alignItems: "center",
  },
  totpOffText: { fontSize: 13, color: "#92400E", fontWeight: "600" },
  qrImage: { width: 180, height: 180, alignSelf: "center", marginBottom: 16 },
  secretBox: {
    backgroundColor: "#F1F5F9", borderRadius: 8, padding: 12, marginBottom: 16,
  },
  secretLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 4, textTransform: "uppercase" },
  secretValue: { fontSize: 14, color: "#0F172A", fontFamily: "monospace", letterSpacing: 1 },

  sessionRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  sessionIcon: { fontSize: 24 },
  sessionName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  sessionMeta: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  currentBadge: {
    backgroundColor: "#DCFCE7", borderRadius: 99,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  currentText: { fontSize: 11, fontWeight: "700", color: "#16A34A" },
  endBtn: {
    borderWidth: 1.5, borderColor: "#FCA5A5", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: "#FEF2F2",
  },
  endBtnText: { fontSize: 13, fontWeight: "700", color: "#EF4444" },
});
