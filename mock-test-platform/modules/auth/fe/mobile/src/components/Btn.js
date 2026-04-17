import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from "react-native";

export default function Btn({ label, onPress, loading = false, variant = "primary", style, disabled = false }) {
  const isDisabled = loading || disabled;
  return (
    <TouchableOpacity
      style={[s.base, s[variant], isDisabled && s.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={variant === "primary" ? "#fff" : "#2563EB"} size="small" />
        : <Text style={[s.label, s[`label_${variant}`]]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  base: { borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  primary: { backgroundColor: "#2563EB" },
  secondary: { backgroundColor: "#F1F5F9", borderWidth: 1.5, borderColor: "#E2E8F0" },
  danger: { backgroundColor: "#EF4444" },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: "700" },
  label_primary: { color: "#fff" },
  label_secondary: { color: "#334155" },
  label_danger: { color: "#fff" },
  label_ghost: { color: "#2563EB" },
});
