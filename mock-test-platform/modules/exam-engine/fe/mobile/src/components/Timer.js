import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function Timer({ remaining, warning = 300 }) {
  const h   = Math.floor(remaining / 3600);
  const m   = Math.floor((remaining % 3600) / 60);
  const s   = remaining % 60;
  const str = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const isWarn = remaining <= warning;

  return (
    <View style={[styles.wrap, isWarn && styles.warnWrap]}>
      <Text style={[styles.txt, isWarn && styles.warnTxt]}>⏱ {str}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.15)" },
  warnWrap: { backgroundColor: "rgba(229,57,53,0.25)" },
  txt:      { fontSize: 14, fontWeight: "800", color: "#fff" },
  warnTxt:  { color: "#ff8a80" },
});
