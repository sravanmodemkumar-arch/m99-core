import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from "react-native";

export default function QuestionCard({ question, chosen, onSelect, vars }) {
  const s = styles(vars);
  return (
    <ScrollView style={s.card} showsVerticalScrollIndicator={false}>
      <Text style={s.meta}>Question {question.index + 1} of {question.total}</Text>
      <Text style={s.qtext}>{question.text}</Text>
      {question.image ? <Image source={{ uri: question.image }} style={s.qImage} resizeMode="contain" /> : null}
      {question.options.map(opt => {
        const selected = opt.key === chosen;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[s.optRow, selected && s.optRowSelected]}
            onPress={() => onSelect(opt.key)}
            activeOpacity={0.7}
          >
            <View style={[s.optKey, selected && s.optKeySelected]}>
              <Text style={[s.optKeyText, selected && s.optKeyTextSelected]}>{opt.key}</Text>
            </View>
            <View style={s.optBody}>
              {opt.image ? <Image source={{ uri: opt.image }} style={s.optImage} resizeMode="contain" /> : null}
              <Text style={s.optText}>{opt.text}</Text>
            </View>
            {selected && <Text style={s.optCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = (v) => StyleSheet.create({
  card:           { flex: 1 },
  meta:           { fontSize: 12, color: v.textMuted, marginBottom: 8, fontWeight: "500" },
  qtext:          { fontSize: 16, color: v.text, lineHeight: 26, fontWeight: "500", marginBottom: 12 },
  qImage:         { width: "100%", height: 160, borderRadius: 8, marginBottom: 12 },
  optRow:         { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: v.border, marginBottom: 8, backgroundColor: v.surface },
  optRowSelected: { borderColor: v.primary, backgroundColor: v.surface2 },
  optKey:         { width: 28, height: 28, borderRadius: 14, backgroundColor: v.surface2, borderWidth: 1.5, borderColor: v.border, alignItems: "center", justifyContent: "center" },
  optKeySelected: { backgroundColor: v.primary, borderColor: v.primary },
  optKeyText:     { fontSize: 12, fontWeight: "700", color: v.text },
  optKeyTextSelected: { color: "#fff" },
  optBody:        { flex: 1 },
  optImage:       { width: "100%", height: 80, borderRadius: 6, marginBottom: 4 },
  optText:        { fontSize: 15, color: v.text, lineHeight: 22 },
  optCheck:       { fontSize: 14, color: v.primary, fontWeight: "700", alignSelf: "center" },
});
