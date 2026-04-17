import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";

export default function PageHeader({ title, onBack, onToggleMode, mode }) {
  return (
    <View style={s.wrap}>
      <TouchableOpacity style={s.backBtn} onPress={onBack}>
        <Text style={s.backIcon}>←</Text>
      </TouchableOpacity>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      <TouchableOpacity style={s.modeBtn} onPress={onToggleMode}>
        <Text style={s.modeIcon}>{mode === "dark" ? "☀️" : "🌙"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#fff" },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 20, color: "#334155" },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: "#0F172A", textAlign: "center" },
  modeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  modeIcon: { fontSize: 18 },
});
