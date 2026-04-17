import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";

const OPTIONS = ["A", "B", "C", "D"];

export default function QuestionCard({ question, index, total, chosen, onAnswer, onClearAnswer }) {
  if (!question) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Question number + section */}
      <View style={styles.meta}>
        <View style={styles.qnum}>
          <Text style={styles.qnumTxt}>Q {index} / {total}</Text>
        </View>
        {question.section && (
          <Text style={styles.secLabel}>{question.section}</Text>
        )}
      </View>

      {/* Question text */}
      <Text style={styles.qtext}>{question.text}</Text>

      {/* Options */}
      <View style={styles.options}>
        {OPTIONS.map((opt, i) => {
          const val     = question.options?.[i] ?? null;
          if (!val) return null;
          const selected = chosen === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.option, selected && styles.optSelected]}
              onPress={() => onAnswer(opt)}
              activeOpacity={0.75}
            >
              <View style={[styles.optBadge, selected && styles.optBadgeSelected]}>
                <Text style={[styles.optBadgeTxt, selected && styles.optBadgeTxtSelected]}>{opt}</Text>
              </View>
              <Text style={[styles.optTxt, selected && styles.optTxtSelected]}>{val}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Clear */}
      {chosen && (
        <TouchableOpacity style={styles.clearBtn} onPress={onClearAnswer}>
          <Text style={styles.clearTxt}>Clear Response</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content:   { padding: 16, paddingBottom: 32 },
  meta:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  qnum:      { backgroundColor: "#1565c0", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  qnumTxt:   { color: "#fff", fontSize: 12, fontWeight: "800" },
  secLabel:  { fontSize: 11, color: "#8a9ab7", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  qtext:     { fontSize: 15, color: "#1a1a1a", lineHeight: 24, fontWeight: "500", marginBottom: 20 },

  options:   { gap: 10 },
  option:    {
    flexDirection:  "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 10,
    backgroundColor: "#f8f9ff", borderWidth: 1.5, borderColor: "#e0e4ed",
  },
  optSelected: { backgroundColor: "#e3f2fd", borderColor: "#1565c0" },

  optBadge:         { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#e0e4ed" },
  optBadgeSelected: { backgroundColor: "#1565c0" },
  optBadgeTxt:      { fontSize: 13, fontWeight: "800", color: "#5c6b8a" },
  optBadgeTxtSelected: { color: "#fff" },

  optTxt:         { flex: 1, fontSize: 14, color: "#1a1a1a", fontWeight: "500", lineHeight: 20 },
  optTxtSelected: { color: "#1565c0", fontWeight: "700" },

  clearBtn: { alignSelf: "flex-end", marginTop: 16, padding: 8 },
  clearTxt: { fontSize: 13, color: "#c62828", fontWeight: "700" },
});
