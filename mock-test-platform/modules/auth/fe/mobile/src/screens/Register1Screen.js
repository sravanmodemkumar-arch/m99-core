import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import Btn from "../components/Btn.js";
import PasswordField from "../components/PasswordField.js";
import { Storage } from "../utils/storage.js";

export default function Register1Screen({ navigation }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [cpw, setCpw] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState("");

  async function next() {
    if (!first || !phone || !email || !pw) { setErr("Required fields missing"); return; }
    if (pw !== cpw) { setErr("Passwords do not match"); return; }
    if (!terms) { setErr("Accept terms to continue"); return; }
    setErr("");
    await Storage.setJson("reg_step1", { first_name: first, last_name: last, phone, email, password: pw, dob, gender });
    navigation.navigate("Register2");
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.stepRow}>
        <Text style={s.stepLabel}>Step 1 of 3</Text>
        <Text style={s.stepTitle}>Personal Info</Text>
      </View>
      <View style={s.progressRow}>
        {[1,2,3].map(i => <View key={i} style={[s.bar, i === 1 && s.barActive]} />)}
      </View>

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>First Name *</Text>
          <TextInput style={s.input} value={first} onChangeText={setFirst} placeholder="First" placeholderTextColor="#94A3B8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Last Name *</Text>
          <TextInput style={s.input} value={last} onChangeText={setLast} placeholder="Last" placeholderTextColor="#94A3B8" />
        </View>
      </View>
      <Text style={s.label}>Phone *</Text>
      <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="10-digit mobile" keyboardType="phone-pad" maxLength={10} placeholderTextColor="#94A3B8" />
      <Text style={s.label}>Email *</Text>
      <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#94A3B8" />
      <PasswordField label="Password *" value={pw} onChangeText={setPw} showStrength placeholder="Min 8 characters" autoComplete="new-password" />
      <PasswordField label="Confirm Password *" value={cpw} onChangeText={setCpw} placeholder="Repeat password" autoComplete="new-password" />
      <Text style={s.label}>Date of Birth</Text>
      <TextInput style={s.input} value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
      <Text style={s.label}>Gender</Text>
      <View style={s.genderRow}>
        {[["M","Male"],["F","Female"],["O","Other"]].map(([v,l]) => (
          <TouchableOpacity key={v} style={[s.genderBtn, gender === v && s.genderActive]} onPress={() => setGender(v)}>
            <Text style={[s.genderLabel, gender === v && s.genderActiveLabel]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={s.termsRow} onPress={() => setTerms(p => !p)}>
        <View style={[s.checkbox, terms && s.checkboxChecked]}>
          {terms ? <Text style={s.checkmark}>✓</Text> : null}
        </View>
        <Text style={s.termsText}>I accept the Terms & Privacy Policy</Text>
      </TouchableOpacity>
      {err ? <Text style={s.err}>{err}</Text> : null}
      <Btn label="Next →" onPress={next} />
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
  row: { flexDirection: "row", gap: 12 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, fontSize: 15, color: "#0F172A", backgroundColor: "#fff", marginBottom: 16 },
  genderRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  genderBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff", alignItems: "center" },
  genderActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  genderLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  genderActiveLabel: { color: "#2563EB" },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxChecked: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "900" },
  termsText: { flex: 1, fontSize: 13, color: "#334155", lineHeight: 19 },
  err: { fontSize: 13, color: "#EF4444", textAlign: "center", marginBottom: 12 },
});
