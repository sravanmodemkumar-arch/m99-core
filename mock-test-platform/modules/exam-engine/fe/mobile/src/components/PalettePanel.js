import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";

export default function PalettePanel({ questions, responses, currentId, onJump, sectionDefs = [] }) {
  const sections = sectionDefs.length > 0
    ? sectionDefs.map(def => ({
        ...def,
        qs: questions.filter(q => q.section_id === def.id),
      }))
    : [{ id: "_all", label: "All Questions", qs: questions }];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {sections.map(sec => (
        <View key={sec.id} style={styles.section}>
          <Text style={styles.secHead}>{sec.label}</Text>
          <View style={styles.grid}>
            {sec.qs.map((q, idx) => {
              const r       = responses[q.id];
              const answered = r?.attempted && r?.chosen;
              const markedReview = r?.markedReview;
              const isCurrent = q.id === currentId;
              let bg = "#e8edf6";
              if (isCurrent) bg = "#1565c0";
              else if (markedReview && answered) bg = "#7b1fa2";
              else if (markedReview)  bg = "#ab47bc";
              else if (answered)      bg = "#2e7d32";
              return (
                <TouchableOpacity
                  key={q.id}
                  style={[styles.cell, { backgroundColor: bg }]}
                  onPress={() => onJump(q.id)}
                >
                  <Text style={[styles.cellTxt, (isCurrent || answered || markedReview) && styles.cellTxtLight]}>
                    {idx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: "#2e7d32", label: "Answered" },
          { color: "#c62828", label: "Not Answered" },
          { color: "#7b1fa2", label: "Marked + Answered" },
          { color: "#ab47bc", label: "Marked" },
          { color: "#1565c0", label: "Current" },
        ].map(({ color, label }) => (
          <View key={label} style={styles.legRow}>
            <View style={[styles.legDot, { backgroundColor: color }]} />
            <Text style={styles.legTxt}>{label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9ff" },
  section:   { padding: 14, borderBottomWidth: 1, borderBottomColor: "#e8edf6" },
  secHead:   { fontSize: 11, fontWeight: "800", color: "#1565c0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  grid:      { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cell:      { width: 34, height: 34, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  cellTxt:   { fontSize: 12, fontWeight: "700", color: "#5c6b8a" },
  cellTxtLight: { color: "#fff" },
  legend:    { padding: 14, gap: 8 },
  legRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  legDot:    { width: 12, height: 12, borderRadius: 3 },
  legTxt:    { fontSize: 11, color: "#5c6b8a", fontWeight: "600" },
});
