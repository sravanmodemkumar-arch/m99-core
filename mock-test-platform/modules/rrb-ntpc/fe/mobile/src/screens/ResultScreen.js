import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fmtTime } from "../utils/api";

const BLUE = "#0d47a1";
const FILTERS = [
  { key: "all",     label: "All" },
  { key: "correct", label: "✓ Correct" },
  { key: "wrong",   label: "✗ Wrong" },
  { key: "skipped", label: "— Skipped" },
];

export default function ResultScreen({ navigation, route }) {
  const {
    sessionId, score, correct, wrong, skipped, total,
    pct, elapsedS = 0, label = "Result", backRoute,
  } = route.params || {};

  const [data,    setData]    = useState(null);
  const [filter,  setFilter]  = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(`result_${sessionId}`)
      .then(raw => { if (raw) setData(JSON.parse(raw)); })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const sign = score >= 0 ? "+" : "";

  const answerRows = React.useMemo(() => {
    if (!data) return [];
    const { answer_key, responses, sections, section_defs = [] } = data;
    const labels = Object.fromEntries((section_defs).map(d => [d.id, d.label]));
    let idx = 0;
    return Object.entries(answer_key || {}).map(([qid, correct]) => {
      idx++;
      const r       = (responses || {})[qid] || { chosen: null, attempted: false };
      const verdict = !r.attempted ? "skipped" : r.chosen === correct ? "correct" : "wrong";
      const marks   = verdict === "correct" ? "+1" : verdict === "wrong" ? "−0.33" : "0";
      return { idx, qid, chosen: r.chosen || "—", correct, verdict, marks };
    });
  }, [data]);

  const filtered = filter === "all" ? answerRows : answerRows.filter(r => r.verdict === filter);
  const sectionDefs = data?.section_defs || [];

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={BLUE} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.shell}>

      <View style={styles.header}>
        <TouchableOpacity style={styles.hdrBtn} onPress={() => navigation.replace(backRoute || "RRBNTPCHome")}>
          <Text style={styles.hdrBtnTxt}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.hdrTitle} numberOfLines={1}>{label}</Text>
        <TouchableOpacity style={[styles.hdrBtn, styles.hdrBtnPurple]} onPress={() => navigation.navigate("NTPCAnalysis", route.params)}>
          <Text style={styles.hdrBtnTxt}>Analysis →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scoreBand}>
        <View style={styles.scorePrimary}>
          <Text style={styles.scoreBig}>{sign}{typeof score === "number" ? score.toFixed(2) : score}</Text>
          <Text style={styles.scoreLabel}>Score</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreChips}>
          {[
            { val: correct, label: "Correct",  bg: "rgba(46,125,50,0.85)"  },
            { val: wrong,   label: "Wrong",    bg: "rgba(183,28,28,0.85)"  },
            { val: skipped, label: "Skipped",  bg: "rgba(55,71,79,0.75)"   },
            { val: total,   label: "Total",    bg: "rgba(255,255,255,0.1)" },
          ].map(({ val, label: l, bg }) => (
            <View key={l} style={[styles.chip, { backgroundColor: bg }]}>
              <Text style={styles.chipVal}>{val}</Text>
              <Text style={styles.chipLbl}>{l}</Text>
            </View>
          ))}
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scorePrimary}>
          <Text style={styles.scoreBig}>{pct}%</Text>
          <Text style={styles.scoreLabel}>Accuracy</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {sectionDefs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secHead}>Section Breakdown</Text>
            {sectionDefs.map((def, i) => {
              const s   = data?.sections?.[def.id] || { correct: 0, wrong: 0, skipped: 0, rawScaled: 0 };
              const att = s.correct + s.wrong;
              const acc = att > 0 ? Math.round((s.correct / att) * 100) : 0;
              const sc  = (s.rawScaled / 1000).toFixed(2);
              const col = COLORS[i % COLORS.length];
              return (
                <View key={def.id} style={[styles.secCard, { borderLeftColor: col }]}>
                  <View style={styles.secCardRow}>
                    <Text style={styles.secCardName}>{def.label}</Text>
                    <Text style={styles.secCardScore}>{sc >= 0 ? "+" : ""}{sc}</Text>
                  </View>
                  <View style={styles.secStats}>
                    {[["✓", s.correct, "#2e7d32"], ["✗", s.wrong, "#c62828"], ["—", s.skipped, "#90a4ae"]].map(([sym, val, c]) => (
                      <View key={sym} style={styles.sstat}>
                        <Text style={[styles.sstatV, { color: c }]}>{val}</Text>
                        <Text style={styles.sstatL}>{sym}</Text>
                      </View>
                    ))}
                    <Text style={styles.accBadge}>{acc}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.secHead}>Answer Review</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f.key} style={[styles.filterChip, filter === f.key && styles.filterChipActive]} onPress={() => setFilter(f.key)}>
                <Text style={[styles.filterChipTxt, filter === f.key && styles.filterChipTxtActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.filterCount}>{filtered.length} questions</Text>
          </ScrollView>
          {filtered.map(r => (
            <View key={r.qid} style={[styles.ansRow, styles[`ans_${r.verdict}`]]}>
              <Text style={styles.ansNum}>{r.idx}</Text>
              <View style={styles.ansVals}>
                <Text style={[styles.ansChosen, r.verdict === "wrong" && { color: "#c62828" }]}>{r.chosen}</Text>
                <Text style={styles.ansCorrect}>{r.correct}</Text>
                <Text style={[styles.ansVerdict, r.verdict === "correct" ? styles.vcCorrect : r.verdict === "wrong" ? styles.vcWrong : styles.vcSkipped]}>
                  {r.verdict === "correct" ? "✓" : r.verdict === "wrong" ? "✗" : "—"}
                </Text>
                <Text style={[styles.ansMarks, r.verdict === "correct" ? { color: "#2e7d32" } : r.verdict === "wrong" ? { color: "#c62828" } : { color: "#90a4ae" }]}>
                  {r.marks}
                </Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.fBtn, styles.fBtnOutline]} onPress={() => navigation.replace(backRoute || "RRBNTPCHome")}>
          <Text style={styles.fBtnTxt}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.footerMeta}>{fmtTime(elapsedS)} · {total} Qs</Text>
        <TouchableOpacity style={[styles.fBtn, styles.fBtnPurple]} onPress={() => navigation.navigate("NTPCAnalysis", route.params)}>
          <Text style={[styles.fBtnTxt, { color: "#fff" }]}>Analysis →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const COLORS = ["#0d47a1","#6a1b9a","#2e7d32","#e65100","#0277bd","#ad1457","#00838f","#558b2f"];

const styles = StyleSheet.create({
  shell:  { flex: 1, backgroundColor: "#f0f2f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header:       { flexDirection: "row", alignItems: "center", backgroundColor: BLUE, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  hdrTitle:     { flex: 1, color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" },
  hdrBtn:       { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  hdrBtnPurple: { backgroundColor: "rgba(106,27,154,0.7)" },
  hdrBtnTxt:    { color: "#fff", fontSize: 12, fontWeight: "700" },

  scoreBand:    { backgroundColor: "#1a237e", padding: 14, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  scorePrimary: { alignItems: "center", minWidth: 60 },
  scoreBig:     { fontSize: 28, fontWeight: "900", color: "#fff" },
  scoreLabel:   { fontSize: 10, color: "#90caf9", fontWeight: "700", textTransform: "uppercase", marginTop: 2 },
  scoreDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.2)" },
  scoreChips:   { flex: 1, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip:         { alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, minWidth: 56 },
  chipVal:      { fontSize: 18, fontWeight: "900", color: "#fff" },
  chipLbl:      { fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: "700", textTransform: "uppercase", marginTop: 2 },

  body:    { flex: 1 },
  section: { margin: 12, backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e0e4ed", elevation: 2, marginBottom: 0, gap: 10 },
  secHead: { fontSize: 12, fontWeight: "800", color: BLUE, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },

  secCard:      { borderLeftWidth: 4, padding: 12, backgroundColor: "#f8f9ff", borderRadius: 8, gap: 8 },
  secCardRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  secCardName:  { fontSize: 13, fontWeight: "700", color: "#1a2a4a", flex: 1 },
  secCardScore: { fontSize: 14, fontWeight: "900", color: "#1a2a4a" },
  secStats:     { flexDirection: "row", gap: 12, alignItems: "center" },
  sstat:        { alignItems: "center" },
  sstatV:       { fontSize: 16, fontWeight: "900" },
  sstatL:       { fontSize: 9, color: "#aaa", fontWeight: "700" },
  accBadge:     { marginLeft: "auto", fontSize: 13, fontWeight: "800", color: BLUE },

  filterRow:          { marginBottom: 8 },
  filterContent:      { gap: 8, paddingVertical: 2 },
  filterChip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "#f0f2f5", borderWidth: 1.5, borderColor: "#dde1ea" },
  filterChipActive:   { backgroundColor: BLUE, borderColor: BLUE },
  filterChipTxt:      { fontSize: 12, fontWeight: "700", color: "#5c6b8a" },
  filterChipTxtActive:{ color: "#fff" },
  filterCount:        { fontSize: 11, color: "#aaa", alignSelf: "center", marginLeft: 4 },

  ansRow:      { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e8edf6", borderLeftWidth: 4 },
  ans_correct: { borderLeftColor: "#2e7d32" },
  ans_wrong:   { borderLeftColor: "#c62828" },
  ans_skipped: { borderLeftColor: "#90a4ae" },
  ansNum:      { fontSize: 12, fontWeight: "800", color: BLUE, minWidth: 24 },
  ansVals:     { flexDirection: "row", gap: 8, alignItems: "center" },
  ansChosen:   { fontSize: 13, fontWeight: "700", color: "#1a1a1a", minWidth: 24 },
  ansCorrect:  { fontSize: 13, fontWeight: "700", color: "#2e7d32", minWidth: 24 },
  ansVerdict:  { fontSize: 13, fontWeight: "800", minWidth: 18 },
  vcCorrect:   { color: "#2e7d32" },
  vcWrong:     { color: "#c62828" },
  vcSkipped:   { color: "#90a4ae" },
  ansMarks:    { fontSize: 12, fontWeight: "800", minWidth: 42, textAlign: "right" },

  footer:      { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e0e4ed", gap: 8 },
  fBtn:        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 7, minHeight: 40 },
  fBtnOutline: { backgroundColor: "#f0f2f5", borderWidth: 1.5, borderColor: "#c8c8c8" },
  fBtnPurple:  { backgroundColor: "#6a1b9a" },
  fBtnTxt:     { fontSize: 13, fontWeight: "700", color: "#333" },
  footerMeta:  { flex: 1, fontSize: 11, color: "#aaa", textAlign: "center" },
});
