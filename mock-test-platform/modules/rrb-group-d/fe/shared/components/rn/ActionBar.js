import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function ActionBar({ isLast, isMarked, hasAnswer, onClear, onMark, onSaveNext, vars }) {
  return (
    <View style={styles(vars).bar}>
      <TouchableOpacity
        style={[styles(vars).btn, styles(vars).outline, !hasAnswer && styles(vars).disabled]}
        onPress={onClear}
        disabled={!hasAnswer}
      >
        <Text style={[styles(vars).outlineText, !hasAnswer && { opacity: 0.4 }]}>Clear</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles(vars).btn, styles(vars).secondary]} onPress={onMark}>
        <Text style={styles(vars).secondaryText}>{isMarked ? "Unmark" : "Mark"}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles(vars).btn, styles(vars).primary]} onPress={onSaveNext}>
        <Text style={styles(vars).primaryText}>{isLast ? "Submit" : "Save & Next"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = (v) => StyleSheet.create({
  bar:          { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: v.border, backgroundColor: v.surface },
  btn:          { flex: 1, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  outline:      { borderWidth: 1.5, borderColor: v.border, backgroundColor: "transparent" },
  secondary:    { backgroundColor: v.surface2, borderWidth: 1.5, borderColor: v.border },
  primary:      { backgroundColor: v.primary },
  outlineText:  { fontSize: 14, fontWeight: "600", color: v.text },
  secondaryText:{ fontSize: 14, fontWeight: "600", color: v.text },
  primaryText:  { fontSize: 14, fontWeight: "700", color: "#fff" },
  disabled:     { opacity: 0.5 },
});
