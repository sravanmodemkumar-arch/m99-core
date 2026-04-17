import React, { useState, useRef } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import Btn from "../components/Btn.js";
import { Storage } from "../utils/storage.js";

export default function Register2Screen({ navigation }) {
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [pinStatus, setPinStatus] = useState("");
  const [err, setErr] = useState("");
  const pinTimer = useRef(null);

  function onPinChange(v) {
    setPincode(v);
    clearTimeout(pinTimer.current);
    if (v.length === 6) {
      pinTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`https://api.postalpincode.in/pincode/${v}`);
          const d = await res.json();
          if (d[0]?.Status === "Success") {
            const p = d[0].PostOffice[0];
            setState(p.State); setCity(p.District); setPinStatus("✓ " + p.Name);
          }
        } catch {}
      }, 600);
    }
  }

  async function next() {
    await Storage.setJson("reg_step2", { pincode, state, city, address });
    navigation.navigate("Register3");
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.stepRow}>
        <Text style={s.stepLabel}>Step 2 of 3</Text>
        <Text style={s.stepTitle}>Address</Text>
      </View>
      <View style={s.progressRow}>
        {[1,2,3].map(i => <View key={i} style={[s.bar, i <= 2 && s.barActive]} />)}
      </View>

      <Text style={s.label}>Pincode</Text>
      <TextInput style={s.input} value={pincode} onChangeText={onPinChange} placeholder="6-digit pincode" keyboardType="number-pad" maxLength={6} placeholderTextColor="#94A3B8" />
      {pinStatus ? <Text style={s.pinStatus}>{pinStatus}</Text> : null}

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>State</Text>
          <TextInput style={s.input} value={state} onChangeText={setState} placeholder="State" placeholderTextColor="#94A3B8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>City</Text>
          <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#94A3B8" />
        </View>
      </View>

      <Text style={s.label}>Full Address</Text>
      <TextInput style={[s.input, { height: 80 }]} value={address} onChangeText={setAddress} placeholder="House / Street / Locality" multiline placeholderTextColor="#94A3B8" />

      {err ? <Text style={s.err}>{err}</Text> : null}
      <View style={s.btnRow}>
        <Btn label="← Back" variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        <Btn label="Next →" onPress={next} style={{ flex: 2 }} />
      </View>
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
  pinStatus: { fontSize: 12, color: "#16A34A", marginTop: -12, marginBottom: 12 },
  btnRow: { flexDirection: "row", gap: 10 },
  err: { fontSize: 13, color: "#EF4444", textAlign: "center", marginBottom: 12 },
});
