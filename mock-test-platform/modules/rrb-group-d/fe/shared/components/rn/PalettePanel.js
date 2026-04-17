import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";

const STATUS_STYLE = {
  not_visited:     { bg: null, border: true, text: null },
  active:          { bg: null, border: true, text: null },
  answered:        { bg: "#16A34A", border: false, text: "#fff" },
  skipped:         { bg: "#DC2626", border: false, text: "#fff" },
  marked_review:   { bg: "#7C3AED", border: false, text: "#fff" },
  answered_marked: { bg: "#7C3AED", border: true, text: "#fff" },
};

function PaletteBtn({ q, current, onPress, vars }) {
  const st = STATUS_STYLE[q.status] || STATUS_STYLE.not_visited;
  return (
    <TouchableOpacity
      style={[
        styles(vars).btn,
        st.bg ? { backgroundColor: st.bg } : { backgroundColor: vars.surface2 },
        st.border && { borderWidth: 2, borderColor: q.status === "answered_marked" ? "#16A34A" : vars.primary },
        current && { shadowColor: vars.primary, shadowOpacity: 0.7, shadowRadius: 4, elevation: 4 },
      ]}
      onPress={() => onPress(q.id)}
      activeOpacity={0.75}
    >
      <Text style={[styles(vars).btnText, { color: st.text || vars.text }]}>{q.index + 1}</Text>
    </TouchableOpacity>
  );
}

export default function PalettePanel({ questions, currentId, onGoTo, vars }) {
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={styles(vars).grid}>
        {questions.map((q, i) => (
          <PaletteBtn key={q.id} q={{ ...q, index: i }} current={q.id === currentId} onPress={onGoTo} vars={vars} />
        ))}
      </View>
      {/* Legend */}
      <View style={styles(vars).legend}>
        {[
          { label: "Answered",    bg: "#16A34A" },
          { label: "Not Ans.",    bg: "#DC2626" },
          { label: "Marked",      bg: "#7C3AED" },
          { label: "Not Visited", bg: null },
        ].map(l => (
          <View key={l.label} style={styles(vars).legendRow}>
            <View style={[styles(vars).legendDot, { backgroundColor: l.bg || vars.surface2, borderWidth: l.bg ? 0 : 1, borderColor: vars.border }]} />
            <Text style={styles(vars).legendLabel}>{l.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = (v) => StyleSheet.create({
  grid:        { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 8 },
  btn:         { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  btnText:     { fontSize: 13, fontWeight: "700" },
  legend:      { padding: 8, gap: 6 },
  legendRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:   { width: 14, height: 14, borderRadius: 3 },
  legendLabel: { fontSize: 12, color: v.textMuted },
});
