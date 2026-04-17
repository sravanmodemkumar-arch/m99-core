import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from "react-native";
import { passwordStrengthScore, passwordStrengthLabel } from "../../../shared/validators.js";

const STRENGTH_COLORS = ["#E2E8F0", "#EF4444", "#F97316", "#EAB308", "#22C55E"];

export default function PasswordField({ label, value, onChangeText, error, showStrength = false, placeholder = "Password", autoComplete = "current-password" }) {
  const [show, setShow] = useState(false);
  const score = showStrength ? passwordStrengthScore(value || "") : 0;

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.inputWrap}>
        <TextInput
          style={[s.input, error ? s.inputError : null]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          placeholder={placeholder}
          autoComplete={autoComplete}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity style={s.eye} onPress={() => setShow(p => !p)}>
          <Text style={s.eyeIcon}>{show ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>
      {showStrength && value ? (
        <View style={s.strengthRow}>
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={[s.strengthBar, { backgroundColor: i < score ? STRENGTH_COLORS[score] : "#E2E8F0" }]} />
          ))}
          <Text style={[s.strengthLabel, { color: STRENGTH_COLORS[score] }]}>{passwordStrengthLabel(score)}</Text>
        </View>
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  inputWrap: { position: "relative" },
  input: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, paddingRight: 44, fontSize: 15, color: "#0F172A", backgroundColor: "#fff" },
  inputError: { borderColor: "#EF4444" },
  eye: { position: "absolute", right: 12, top: 12 },
  eyeIcon: { fontSize: 18 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: "700", marginLeft: 4, minWidth: 40 },
  error: { fontSize: 12, color: "#EF4444", marginTop: 4 },
});
