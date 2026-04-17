import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fmtTime } from "../utils/api";

const BLUE   = "#0d47a1";
const COLORS = ["#0d47a1","#6a1b9a","#2e7d32","#e65100","#0277bd","#ad1457","#00838f","#558b2f"];

export default function AnalysisScreen({ navigation, route }) {
  const {
    sessionId, score, correct, wrong, skipped, total,
    pct, elapsedS = 0, label = "Analysis", backRoute,
  } = route.params || {};

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(`result_${sessionId}`)
      .then(raw => { if (raw) setData(JSON.parse(raw)); })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={BLUE} />
    </SafeAreaView>
  );

  const sectionDefs = data?.section_defs || [];
  const sections    = data?.sections     || {};
  const sign        = score >= 0 ? "+" : "";
  const avgSec      = total > 0 ? Math.round(elapsedS / total) : 0;
  const earned      = correct;
  const lost        = parseFloat((wrong * 0.33).toFixed(2));
  const eff         = total > 0 ? Math.max(0, Math.round(((correct - wrong * 0.33) / total) * 100)) : 0;

  return (
    <SafeAreaView style={styles.shell}>

      <View style={styles.header}>
        <TouchableOpacity style={styles.hdrBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.hdrBtnTxt}>← Result</Text>
        </TouchableOpacity>
        <Text style={styles.hdrTitle} numberOfLines={1}>Analysis</Text>
        <TouchableOpacity style={[styles.hdrBtn, styles.hdrBtnHome]} onPress={() => navigation.replace(backRoute || "RRBGroupDHome")}>
          <Text style={styles.hdrBtnTxt}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricBand}>
        {[
          { val: `${sign}${typeof score === "number" ? score.toFixed(2) : score}`, lbl: "Score",    color: score >= 0 ? "#a5d6a7" : "#ef9a9a" },
          { val: `${pct}%`,               lbl: "Accuracy",  color: pct >= 70 ? "#a5d6a7" : pct >= 40 ? "#ffcc80" : "#ef9a9a" },
          { val: fmtTime(elapsedS),       lbl: "Time Used",  color: "#fff" },
          { val: fmtTime(avgSec),         lbl: "Avg/Q",      color: "#fff" },
          { val: `${total}`,              lbl: "Total Qs",   color: "#fff" },
        ].map(({ val, lbl, color }) => (
          <View key={lbl} style={styles.metricTile}>
            <Text style={[styles.metricVal, { color }]}>{val}</Text>
            <Text style={styles.metricLbl}>{lbl}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.bodyContent}>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Attempt Distribution</Text>
          <View style={styles.distBar}>
            {total > 0 && [
              { val: correct, bg: "#2e7d32" },
              { val: wrong,   bg: "#c62828" },
              { val: skipped, bg: "#90a4ae" },
            ].map(({ val, bg }) => (
              <View key={bg} style={[styles.distSeg, { flex: val || 0.01, backgroundColor: bg }]} />
            ))}
          </View>
          <View style={styles.distLegend}>
            {[
              { val: correct, pct: total ? Math.round((correct/total)*100) : 0, lbl: "Correct",  col: "#2e7d32" },
              { val: wrong,   pct: total ? Math.round((wrong/total)*100)   : 0, lbl: "Wrong",    col: "#c62828" },
              { val: skipped, pct: total ? Math.round((skipped/total)*100) : 0, lbl: "Skipped",  col: "#90a4ae" },
            ].map(({ val, pct: p, lbl, col }) => (
              <View key={lbl} style={styles.distLegRow}>
                <View style={[styles.distLegDot, { backgroundColor: col }]} />
                <Text style={styles.distLegLbl}>{lbl}</Text>
                <Text style={styles.distLegVal}>{val}</Text>
                <Text style={styles.distLegPct}>({p}%)</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Marks Analysis</Text>
          <View style={styles.marksGrid}>
            {[
              { val: `+${total}`,   lbl: "Max Possible", col: BLUE },
              { val: `+${earned}`,  lbl: "Earned",       col: "#2e7d32" },
              { val: `−${lost}`,    lbl: "Lost (−ve)",   col: "#c62828" },
              { val: `${skipped}`,  lbl: "Unclaimed",    col: "#90a4ae" },
            ].map(({ val, lbl, col }) => (
              <View key={lbl} style={styles.marksTile}>
                <Text style={[styles.marksTileVal, { color: col }]}>{val}</Text>
                <Text style={styles.marksTileLbl}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {sectionDefs.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Section-wise Performance</Text>
            {sectionDefs.map((def, i) => {
              const s   = sections[def.id] || { correct: 0, wrong: 0, skipped: 0, rawScaled: 0 };
              const att = s.correct + s.wrong;
              const acc = att > 0 ? Math.round((s.correct / att) * 100) : 0;
              const sc  = (s.rawScaled / 1000).toFixed(2);
              const col = COLORS[i % COLORS.length];
              return (
                <View key={def.id} style={[styles.secRow, { borderLeftColor: col }]}>
                  <View style={styles.secRowTop}>
                    <Text style={styles.secRowName}>{def.label}</Text>
                    <Text style={styles.secRowScore}>{sc >= 0 ? "+" : ""}{sc}</Text>
                  </View>
                  <View style={styles.secBarTrack}>
                    <View style={[styles.secBarFill, { width: `${acc}%`, backgroundColor: col }]} />
                  </View>
                  <View style={styles.secRowBottom}>
                    <Text style={styles.secRowAcc}>{acc}% Accuracy</Text>
                    <Text style={styles.secRowStats}>{s.correct}✓ {s.wrong}✗ {s.skipped}—</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Time Analysis</Text>
          <View style={styles.timeGrid}>
            {[
              { val: fmtTime(elapsedS), lbl: "Total Time" },
              { val: fmtTime(avgSec),   lbl: "Avg per Q" },
              { val: `${correct + wrong}/${total}`, lbl: "Attempted" },
              { val: `${eff}%`, lbl: "Efficiency", col: eff >= 60 ? "#2e7d32" : eff >= 35 ? "#f57f17" : "#c62828" },
            ].map(({ val, lbl, col }) => (
              <View key={lbl} style={styles.tstat}>
                <Text style={[styles.tstatVal, col ? { color: col } : {}]}>{val}</Text>
                <Text style={styles.tstatLbl}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.fBtn, styles.fBtnOutline]} onPress={() => navigation.goBack()}>
          <Text style={styles.fBtnTxt}>← Result</Text>
        </TouchableOpacity>
        <Text style={styles.footerMeta}>{label}</Text>
        <TouchableOpacity style={[styles.fBtn, styles.fBtnBlue]} onPress={() => navigation.replace(backRoute || "RRBGroupDHome")}>
          <Text style={[styles.fBtnTxt, { color: "#fff" }]}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell:  { flex: 1, backgroundColor: "#f0f2f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header:      { flexDirection: "row", alignItems: "center", backgroundColor: BLUE, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  hdrTitle:    { flex: 1, color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" },
  hdrBtn:      { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  hdrBtnHome:  { backgroundColor: "rgba(13,71,161,0.6)" },
  hdrBtnTxt:   { color: "#fff", fontSize: 12, fontWeight: "700" },

  metricBand: { backgroundColor: "#0d1b4b", flexDirection: "row", borderBottomWidth: 2, borderBottomColor: BLUE },
  metricTile: { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.12)" },
  metricVal:  { fontSize: 16, fontWeight: "900", color: "#fff" },
  metricLbl:  { fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 3 },

  body:        { flex: 1 },
  bodyContent: { padding: 12, gap: 12, paddingBottom: 24 },
  card:        { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e0e4ed", elevation: 2 },
  cardTitle:   { fontSize: 13, fontWeight: "800", color: "#1a2a4a", marginBottom: 14 },

  distBar:      { height: 16, borderRadius: 8, flexDirection: "row", overflow: "hidden", backgroundColor: "#f0f2f5" },
  distSeg:      { height: "100%" },
  distLegend:   { marginTop: 12, gap: 8 },
  distLegRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  distLegDot:   { width: 10, height: 10, borderRadius: 5 },
  distLegLbl:   { flex: 1, fontSize: 12, color: "#5c6b8a", fontWeight: "600" },
  distLegVal:   { fontSize: 13, fontWeight: "800", color: "#1a2a4a" },
  distLegPct:   { fontSize: 11, color: "#90a4ae", fontWeight: "600" },

  marksGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  marksTile:    { flex: 1, minWidth: "45%", backgroundColor: "#f8f9ff", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e8edf6" },
  marksTileVal: { fontSize: 18, fontWeight: "900" },
  marksTileLbl: { fontSize: 10, fontWeight: "700", color: "#8a9ab7", textTransform: "uppercase", marginTop: 4 },

  secRow:       { borderLeftWidth: 4, padding: 12, backgroundColor: "#f8f9ff", borderRadius: 8, marginBottom: 8, gap: 6 },
  secRowTop:    { flexDirection: "row", justifyContent: "space-between" },
  secRowName:   { fontSize: 13, fontWeight: "700", color: "#1a2a4a", flex: 1 },
  secRowScore:  { fontSize: 14, fontWeight: "900", color: "#1a2a4a" },
  secBarTrack:  { height: 6, backgroundColor: "#e8edf6", borderRadius: 3, overflow: "hidden" },
  secBarFill:   { height: "100%", borderRadius: 3 },
  secRowBottom: { flexDirection: "row", justifyContent: "space-between" },
  secRowAcc:    { fontSize: 12, fontWeight: "700", color: "#5c6b8a" },
  secRowStats:  { fontSize: 11, color: "#aaa", fontWeight: "600" },

  timeGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tstat:     { flex: 1, minWidth: "45%", backgroundColor: "#f8f9ff", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e8edf6" },
  tstatVal:  { fontSize: 18, fontWeight: "900", color: "#1a2a4a" },
  tstatLbl:  { fontSize: 10, fontWeight: "700", color: "#8a9ab7", textTransform: "uppercase", marginTop: 4 },

  footer:      { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e0e4ed", gap: 8 },
  fBtn:        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 7, minHeight: 40 },
  fBtnOutline: { backgroundColor: "#f0f2f5", borderWidth: 1.5, borderColor: "#c8c8c8" },
  fBtnBlue:    { backgroundColor: BLUE },
  fBtnTxt:     { fontSize: 13, fontWeight: "700", color: "#333" },
  footerMeta:  { flex: 1, fontSize: 11, color: "#aaa", textAlign: "center" },
});
