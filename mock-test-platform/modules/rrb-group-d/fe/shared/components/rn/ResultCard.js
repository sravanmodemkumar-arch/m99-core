import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function ResultCard({ result, onViewAnalysis, onGoHome, vars }) {
  const sign = result.score >= 0 ? "+" : "";
  return (
    <View style={styles(vars).card}>
      <Text style={styles(vars).score}>{sign}{result.score.toFixed(2)}</Text>
      <Text style={styles(vars).scoreLabel}>Score</Text>

      <View style={styles(vars).grid}>
        {[
          { val: result.correct, label: "Correct",  color: "#16A34A" },
          { val: result.wrong,   label: "Wrong",    color: "#DC2626" },
          { val: result.skipped, label: "Skipped",  color: vars.textMuted },
          { val: result.total,   label: "Total",    color: vars.text },
        ].map(stat => (
          <View key={stat.label} style={styles(vars).statItem}>
            <Text style={[styles(vars).statVal, { color: stat.color }]}>{stat.val}</Text>
            <Text style={styles(vars).statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles(vars).pct}>{result.percentage}% accuracy</Text>
      {result.rank != null && <Text style={styles(vars).rank}>Rank #{result.rank}</Text>}

      {result.sections && Object.entries(result.sections).map(([id, s]) => (
        <View key={id} style={styles(vars).sectionRow}>
          <Text style={styles(vars).sectionId}>{id}</Text>
          <Text style={styles(vars).sectionScore}>{(s.rawScaled / 1000).toFixed(2)}</Text>
          <Text style={styles(vars).sectionDetail}>{s.correct}C / {s.wrong}W / {s.skipped}S</Text>
        </View>
      ))}

      <View style={styles(vars).actions}>
        <TouchableOpacity style={[styles(vars).actionBtn, styles(vars).outline]} onPress={onViewAnalysis}>
          <Text style={styles(vars).outlineText}>Analysis</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles(vars).actionBtn, styles(vars).primary]} onPress={onGoHome}>
          <Text style={styles(vars).primaryText}>Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (v) => StyleSheet.create({
  card:        { backgroundColor: v.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: v.border },
  score:       { fontSize: 40, fontWeight: "900", color: v.primary, textAlign: "center" },
  scoreLabel:  { fontSize: 13, color: v.textMuted, textAlign: "center", marginBottom: 16 },
  grid:        { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  statItem:    { alignItems: "center", gap: 2 },
  statVal:     { fontSize: 22, fontWeight: "800" },
  statLabel:   { fontSize: 12, color: v.textMuted },
  pct:         { fontSize: 15, color: v.textMuted, textAlign: "center" },
  rank:        { fontSize: 18, fontWeight: "700", color: v.primary, textAlign: "center", marginTop: 4 },
  sectionRow:  { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: v.border, marginTop: 8 },
  sectionId:   { fontSize: 13, color: v.text, fontWeight: "600", flex: 1 },
  sectionScore:{ fontSize: 13, fontWeight: "700", color: v.primary, marginHorizontal: 8 },
  sectionDetail:{ fontSize: 12, color: v.textMuted },
  actions:     { flexDirection: "row", gap: 10, marginTop: 16 },
  actionBtn:   { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  outline:     { borderWidth: 1.5, borderColor: v.border },
  primary:     { backgroundColor: v.primary },
  outlineText: { fontSize: 14, fontWeight: "600", color: v.text },
  primaryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
