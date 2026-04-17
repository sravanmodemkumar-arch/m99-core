import React, { useState, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../../../auth/fe/mobile/src/hooks/useTheme.js";
import ResultCard from "../../shared/components/rn/ResultCard.js";
import { formatScore } from "../../shared/scoring.js";

const SECTION_DEFS = [
  { id: "math",      label: "Mathematics",          color: "#2563EB" },
  { id: "reasoning", label: "Reasoning",             color: "#7C3AED" },
  { id: "science",   label: "General Science",       color: "#16A34A" },
  { id: "gk",        label: "GK & Current Affairs",  color: "#D97706" },
];
const VERDICT_FILTERS = ["all", "correct", "wrong", "skipped"];

export default function ResultScreen({ route, navigation }) {
  const { vars } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;

  const {
    sessionId, score, correct, wrong, skipped, total, pct,
    answerKey = {}, responses = {}, sections = {}, elapsed = 0,
  } = route.params || {};

  const [filter, setFilter] = useState("all");
  const [tab, setTab]       = useState("summary");  // summary | answers | analysis

  const s = styles(vars);

  // Build answer rows
  const answerRows = useMemo(() => {
    let idx = 0;
    return Object.entries(answerKey).map(([qid, correct]) => {
      idx++;
      const r = responses[qid] || { chosen: null, attempted: false };
      let verdict = "skipped";
      if (r.attempted && r.chosen) {
        verdict = r.chosen === correct ? "correct" : "wrong";
      }
      return { idx, qid, chosen: r.chosen || "—", correct, verdict };
    });
  }, [answerKey, responses]);

  const filtered = filter === "all" ? answerRows : answerRows.filter(r => r.verdict === filter);
  const accuracy = (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: vars.bg }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Home")} style={s.backBtn}>
          <Text style={[s.backText, { color: vars.primary }]}>← Home</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: vars.text }]}>Exam Result</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: vars.surface, borderBottomColor: vars.border }]}>
        {[["summary", "Summary"], ["answers", "Answers"], ["analysis", "Analysis"]].map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && { borderBottomColor: vars.primary }]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, { color: tab === key ? vars.primary : vars.textMuted }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, isTablet && s.contentTablet]}>

        {/* SUMMARY TAB */}
        {tab === "summary" && (
          <>
            <ResultCard
              result={{ score: score || 0, correct: correct || 0, wrong: wrong || 0, skipped: skipped || 0, total: total || 100, percentage: pct || 0, sections }}
              onViewAnalysis={() => setTab("analysis")}
              onGoHome={() => navigation.navigate("Home")}
              vars={vars}
            />

            {/* Section breakdown */}
            <View style={[s.card, { backgroundColor: vars.surface, borderColor: vars.border }]}>
              <Text style={[s.cardTitle, { color: vars.text }]}>Section Breakdown</Text>
              <View style={[s.sectionHead, { backgroundColor: vars.surface2 }]}>
                <Text style={[s.sectionCell, s.sectionName, { color: vars.textMuted }]}>Section</Text>
                <Text style={[s.sectionCell, { color: vars.textMuted }]}>Correct</Text>
                <Text style={[s.sectionCell, { color: vars.textMuted }]}>Wrong</Text>
                <Text style={[s.sectionCell, { color: vars.textMuted }]}>Score</Text>
              </View>
              {SECTION_DEFS.map(sec => {
                const d = sections[sec.id] || { correct: 0, wrong: 0, skipped: 0, rawScaled: 0 };
                return (
                  <View key={sec.id} style={[s.sectionRow, { borderBottomColor: vars.border }]}>
                    <Text style={[s.sectionCell, s.sectionName, { color: vars.text }]}>{sec.label}</Text>
                    <Text style={[s.sectionCell, { color: "#16A34A", fontWeight: "700" }]}>{d.correct}</Text>
                    <Text style={[s.sectionCell, { color: "#DC2626", fontWeight: "700" }]}>{d.wrong}</Text>
                    <Text style={[s.sectionCell, { color: vars.primary, fontWeight: "800" }]}>{formatScore(d.rawScaled || 0)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ANSWERS TAB */}
        {tab === "answers" && (
          <View style={[s.card, { backgroundColor: vars.surface, borderColor: vars.border }]}>
            <Text style={[s.cardTitle, { color: vars.text }]}>Answer Review</Text>
            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {VERDICT_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.chip, filter === f && { backgroundColor: vars.primary, borderColor: vars.primary }]}
                    onPress={() => setFilter(f)}
                  >
                    <Text style={[s.chipText, { color: filter === f ? "#fff" : vars.textMuted }]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {/* Answer rows */}
            <View style={[s.answerHead, { backgroundColor: vars.surface2 }]}>
              {["#", "Yours", "Correct", "Verdict"].map(h => (
                <Text key={h} style={[s.answerCell, { color: vars.textMuted, fontWeight: "700" }]}>{h}</Text>
              ))}
            </View>
            {filtered.map(r => (
              <View key={r.qid} style={[s.answerRow, { borderBottomColor: vars.border }]}>
                <Text style={[s.answerCell, { color: vars.textMuted }]}>{r.idx}</Text>
                <Text style={[s.answerCell, { color: vars.text }]}>{r.chosen}</Text>
                <Text style={[s.answerCell, { color: "#16A34A", fontWeight: "700" }]}>{r.correct}</Text>
                <Text style={[s.answerCell, {
                  color: r.verdict === "correct" ? "#16A34A" : r.verdict === "wrong" ? "#DC2626" : vars.textMuted,
                  fontWeight: "700",
                }]}>
                  {r.verdict === "correct" ? "✓" : r.verdict === "wrong" ? "✗" : "—"}
                </Text>
              </View>
            ))}
            {filtered.length === 0 && (
              <Text style={{ color: vars.textMuted, textAlign: "center", padding: 24 }}>No questions match this filter</Text>
            )}
          </View>
        )}

        {/* ANALYSIS TAB */}
        {tab === "analysis" && (
          <View style={[s.card, { backgroundColor: vars.surface, borderColor: vars.border }]}>
            <Text style={[s.cardTitle, { color: vars.text }]}>Performance Analysis</Text>

            {/* Accuracy */}
            <Text style={{ color: vars.textMuted, fontSize: 13, marginBottom: 6 }}>
              Accuracy (correct / attempted): <Text style={{ fontWeight: "700", color: vars.text }}>{accuracy}%</Text>
            </Text>
            <View style={s.accWrap}>
              <View style={[s.accBar, { width: `${accuracy}%`, backgroundColor: vars.primary }]} />
            </View>

            {/* Section bars */}
            <Text style={[s.cardTitle, { color: vars.text, marginTop: 20 }]}>Section Accuracy</Text>
            {SECTION_DEFS.map(sec => {
              const d   = sections[sec.id] || { correct: 0, wrong: 0 };
              const acc = (d.correct + d.wrong) > 0 ? Math.round((d.correct / (d.correct + d.wrong)) * 100) : 0;
              return (
                <View key={sec.id} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: vars.text }}>{sec.label}</Text>
                    <Text style={{ fontSize: 12, color: vars.textMuted }}>{acc}%</Text>
                  </View>
                  <View style={s.accWrap}>
                    <View style={[s.accBar, { width: `${acc}%`, backgroundColor: sec.color }]} />
                  </View>
                </View>
              );
            })}

            {/* Time */}
            <Text style={[s.cardTitle, { color: vars.text, marginTop: 20 }]}>Time Analysis</Text>
            {[
              ["Total time used", `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`],
              ["Avg. time/question", total > 0 ? `${Math.round(elapsed / total)}s` : "—"],
            ].map(([l, v]) => (
              <View key={l} style={[s.timeRow, { borderBottomColor: vars.border }]}>
                <Text style={{ color: vars.text, fontSize: 14 }}>{l}</Text>
                <Text style={{ color: vars.text, fontSize: 14, fontWeight: "700" }}>{v}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (v) => StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: v.border, backgroundColor: v.surface },
  backBtn:       { width: 60 },
  backText:      { fontSize: 14, fontWeight: "600" },
  headerTitle:   { fontSize: 16, fontWeight: "800" },
  tabBar:        { flexDirection: "row", borderBottomWidth: 1 },
  tab:           { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText:       { fontSize: 14, fontWeight: "600" },
  content:       { padding: 16, gap: 12 },
  contentTablet: { maxWidth: 720, alignSelf: "center", width: "100%" },
  card:          { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  cardTitle:     { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  sectionHead:   { flexDirection: "row", padding: 8, borderRadius: 8, marginBottom: 4 },
  sectionRow:    { flexDirection: "row", padding: 8, borderBottomWidth: 1 },
  sectionCell:   { flex: 1, fontSize: 13, textAlign: "center" },
  sectionName:   { flex: 2, textAlign: "left" },
  answerHead:    { flexDirection: "row", padding: 8, borderRadius: 8, marginBottom: 4 },
  answerRow:     { flexDirection: "row", padding: 8, borderBottomWidth: 1 },
  answerCell:    { flex: 1, fontSize: 13, textAlign: "center" },
  chip:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: v.border, backgroundColor: v.surface },
  chipText:      { fontSize: 13, fontWeight: "600" },
  accWrap:       { height: 10, backgroundColor: v.surface2, borderRadius: 5, overflow: "hidden" },
  accBar:        { height: "100%", borderRadius: 5 },
  timeRow:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
});
