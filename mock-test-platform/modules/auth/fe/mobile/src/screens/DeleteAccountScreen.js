import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import PageHeader from "../components/PageHeader.js";
import Btn from "../components/Btn.js";
import ReauthGate from "../components/ReauthGate.js";
import { api } from "../utils/api.js";
import { Storage } from "../utils/storage.js";

export default function DeleteAccountScreen({ navigation }) {
  const [step, setStep] = useState("confirm"); // confirm | reauth | done
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function proceed() {
    if (confirmText !== "DELETE") { setErr('Type "DELETE" exactly'); return; }
    setErr(""); setStep("reauth");
    api("/auth/otp/send-delete", { method: "POST" }).catch(() => {});
  }

  async function deleteAccount(payload, setSubmitErr) {
    setLoading(true);
    const { ok, data } = await api("/auth/delete-account", { method: "POST", body: JSON.stringify(payload) });
    setLoading(false);
    if (!ok) { setSubmitErr(data.error || "Failed"); return; }
    await Storage.clear();
    setStep("done");
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <PageHeader title="Delete Account" onBack={() => navigation.goBack()} />

      {step === "confirm" && (
        <View style={s.card}>
          <Text style={s.warnIcon}>⚠️</Text>
          <Text style={s.warnTitle}>Delete Account</Text>
          <View style={s.warnBox}>
            <Text style={s.warnHead}>This cannot be undone</Text>
            {["All your exam results will be deleted","All subscriptions will be cancelled","Your profile and data will be removed","You cannot recover this account"].map(t => (
              <Text key={t} style={s.warnItem}>• {t}</Text>
            ))}
          </View>
          <Text style={s.typeLabel}>Type <Text style={{ fontWeight: "800" }}>DELETE</Text> to confirm</Text>
          <TextInput style={s.input} value={confirmText} onChangeText={setConfirmText} placeholder="Type DELETE" autoCapitalize="characters" placeholderTextColor="#94A3B8" />
          {err ? <Text style={s.err}>{err}</Text> : null}
          <Btn label="Continue to Delete" variant="danger" onPress={proceed} />
          <Btn label="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      )}

      {step === "reauth" && (
        <View style={s.card}>
          <Text style={s.reauthTitle}>Verify your identity</Text>
          <Text style={s.reauthSub}>Confirm all factors before we delete your account</Text>
          <ReauthGate requireOtp requireTotp={false} submitLabel="Delete My Account" onSubmit={deleteAccount} loading={loading} />
          <Btn label="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
        </View>
      )}

      {step === "done" && (
        <View style={[s.card, { alignItems: "center" }]}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>👋</Text>
          <Text style={s.doneTitle}>Account Deleted</Text>
          <Text style={s.doneSub}>Your account and all data have been removed.</Text>
          <Btn label="Back to Home" variant="secondary" onPress={() => navigation.replace("Login")} />
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginTop: 8 },
  warnIcon: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  warnTitle: { fontSize: 20, fontWeight: "800", color: "#EF4444", textAlign: "center", marginBottom: 16 },
  warnBox: { backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FCA5A5", borderRadius: 10, padding: 14, marginBottom: 20 },
  warnHead: { fontSize: 14, fontWeight: "700", color: "#EF4444", marginBottom: 8 },
  warnItem: { fontSize: 13, color: "#B91C1C", lineHeight: 22 },
  typeLabel: { fontSize: 13, color: "#334155", marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, fontSize: 15, color: "#0F172A", backgroundColor: "#F8FAFC", marginBottom: 16 },
  err: { fontSize: 13, color: "#EF4444", marginBottom: 12, textAlign: "center" },
  reauthTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A", textAlign: "center", marginBottom: 4 },
  reauthSub: { fontSize: 13, color: "#64748B", textAlign: "center", marginBottom: 16 },
  doneTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  doneSub: { fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 20 },
});
