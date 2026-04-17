import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Platform,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { adminGet, fmtDate } from "../utils/api";

export default function ReportsScreen({ navigation }) {
  const [overview,  setOverview]  = useState(null);
  const [exams,     setExams]     = useState([]);
  const [examStats, setExamStats] = useState(null);
  const [selExamId, setSelExamId] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [loadingEx, setLoadingEx] = useState(false);
  const [refreshing,setRefreshing]= useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [ovRes, exRes] = await Promise.all([
        adminGet("/reports/overview").catch(() => null),
        adminGet("/exams").catch(() => ({ exams: [] })),
      ]);
      setOverview(ovRes);
      setExams((exRes.exams || []).filter(e => e.status === "published"));
    } catch (e) {
      if (e.status === 401) { navigation.replace("Login"); return; }
      Alert.alert("Error", e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }

  async function loadExamStats(examId) {
    setSelExamId(examId);
    setLoadingEx(true);
    try {
      const data = await adminGet(`/reports/exam/${examId}`);
      setExamStats(data);
    } catch (e) { Alert.alert("Error", e.message); setExamStats(null); }
    finally { setLoadingEx(false); }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1a237e" />}
    >
      {/* Header */}
      <View style={s.hdr}>
        <Text style={s.hTitle}>📊 Reports</Text>
      </View>

      {/* Overview */}
      <Text style={s.secHd}>Platform Overview</Text>
      <View style={s.grid}>
        <StatCard icon="📝" label="Exams"    value={overview?.total_exams    ?? 0} color="#1565c0" />
        <StatCard icon="👥" label="Users"    value={overview?.total_users    ?? 0} color="#6a1b9a" />
        <StatCard icon="📤" label="Attempts" value={overview?.total_attempts ?? 0} color="#e65100" />
        <StatCard icon="🎯" label="Avg Score"
          value={overview?.avg_score != null ? `${overview.avg_score >= 0 ? "+" : ""}${Number(overview.avg_score).toFixed(1)}` : "—"}
          color="#2e7d32" />
      </View>

      {/* Exam selector */}
      <Text style={s.secHd}>Per-Exam Analytics</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.examTabs}>
        {exams.map(e => (
          <TouchableOpacity key={e.id} style={[s.examTab, selExamId === e.id && s.examTabSel]} onPress={() => loadExamStats(e.id)}>
            <Text style={[s.examTabT, selExamId === e.id && s.examTabTSel]} numberOfLines={2}>{e.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Per-exam stats */}
      {loadingEx ? (
        <ActivityIndicator color="#1a237e" style={{ marginTop: 20 }} />
      ) : examStats ? (
        <>
          <View style={s.grid}>
            <StatCard icon="📤" label="Attempts" value={examStats.attempts ?? 0}   color="#1565c0" />
            <StatCard icon="✅" label="Avg Correct" value={examStats.avg_correct != null ? `${Number(examStats.avg_correct).toFixed(1)}` : "—"} color="#2e7d32" />
            <StatCard icon="❌" label="Avg Wrong"   value={examStats.avg_wrong   != null ? `${Number(examStats.avg_wrong).toFixed(1)}`   : "—"} color="#c62828" />
            <StatCard icon="🏆" label="Best Score"  value={examStats.best_score  != null ? `+${Number(examStats.best_score).toFixed(1)}`  : "—"} color="#f57f17" />
          </View>

          {examStats.section_stats?.length > 0 && (
            <>
              <Text style={s.subHd}>Section Performance</Text>
              {examStats.section_stats.map((sec, i) => {
                const acc = sec.total_att > 0 ? Math.round((sec.avg_correct / (sec.avg_correct + sec.avg_wrong)) * 100) : 0;
                return (
                  <View key={i} style={s.secRow}>
                    <Text style={s.secName} numberOfLines={1}>{sec.label || sec.section_id}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${acc}%`, backgroundColor: acc >= 70 ? "#2e7d32" : acc >= 40 ? "#f57f17" : "#c62828" }]} />
                    </View>
                    <Text style={s.barVal}>{acc}%</Text>
                  </View>
                );
              })}
            </>
          )}

          {examStats.score_distribution?.length > 0 && (
            <>
              <Text style={s.subHd}>Score Distribution</Text>
              {examStats.score_distribution.map((band, i) => (
                <View key={i} style={s.distRow}>
                  <Text style={s.distLbl}>{band.label}</Text>
                  <View style={s.distBarTrack}>
                    <View style={[s.distBarFill, { width: `${Math.min(100, band.pct || 0)}%` }]} />
                  </View>
                  <Text style={s.distPct}>{band.count} ({band.pct ?? 0}%)</Text>
                </View>
              ))}
            </>
          )}
        </>
      ) : selExamId ? (
        <Text style={s.noData}>No data for this exam yet</Text>
      ) : (
        <Text style={s.noData}>Select an exam above to view analytics</Text>
      )}
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <View style={[s.statCard, { borderLeftColor: color }]}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:"#f0f2f7" },
  center:     { flex:1, justifyContent:"center", alignItems:"center" },
  hdr:        { backgroundColor:"#1a237e", paddingHorizontal:20, paddingTop: Platform.OS === "ios" ? 54 : 14, paddingBottom:16 },
  hTitle:     { color:"#fff", fontSize:18, fontWeight:"900" },
  body:       { paddingBottom:30 },
  secHd:      { fontSize:11, fontWeight:"800", color:"#5c6b8a", textTransform:"uppercase", letterSpacing:1, paddingHorizontal:16, marginTop:16, marginBottom:8 },
  subHd:      { fontSize:12, fontWeight:"800", color:"#1a2a4a", paddingHorizontal:16, marginTop:14, marginBottom:8 },
  grid:       { flexDirection:"row", flexWrap:"wrap", gap:10, paddingHorizontal:14 },
  statCard:   { flex:1, minWidth:"45%", backgroundColor:"#fff", borderRadius:12, padding:14, borderLeftWidth:4, elevation:2, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:2} },
  statIcon:   { fontSize:18, marginBottom:4 },
  statVal:    { fontSize:20, fontWeight:"900", lineHeight:24 },
  statLbl:    { fontSize:10, fontWeight:"600", color:"#8a9ab7", marginTop:2 },
  examTabs:   { paddingHorizontal:14, gap:8 },
  examTab:    { paddingHorizontal:14, paddingVertical:9, backgroundColor:"#fff", borderRadius:10, borderWidth:1.5, borderColor:"#e0e4ed", maxWidth:180 },
  examTabSel: { borderColor:"#1a237e", backgroundColor:"#e8eaf6" },
  examTabT:   { fontSize:12, fontWeight:"700", color:"#5c6b8a", textAlign:"center" },
  examTabTSel:{ color:"#1a237e" },
  secRow:     { flexDirection:"row", alignItems:"center", gap:10, paddingHorizontal:16, marginBottom:8 },
  secName:    { flex:0, width:110, fontSize:12, fontWeight:"700", color:"#1a2a4a" },
  barTrack:   { flex:1, height:8, backgroundColor:"#e0e4ed", borderRadius:4, overflow:"hidden" },
  barFill:    { height:"100%", borderRadius:4 },
  barVal:     { width:38, fontSize:12, fontWeight:"800", textAlign:"right", color:"#5c6b8a" },
  distRow:    { flexDirection:"row", alignItems:"center", gap:8, paddingHorizontal:16, marginBottom:6 },
  distLbl:    { width:80, fontSize:11, fontWeight:"700", color:"#5c6b8a" },
  distBarTrack:{ flex:1, height:16, backgroundColor:"#e0e4ed", borderRadius:8, overflow:"hidden" },
  distBarFill: { height:"100%", borderRadius:8, backgroundColor:"#1a237e" },
  distPct:    { width:70, fontSize:11, fontWeight:"700", color:"#5c6b8a", textAlign:"right" },
  noData:     { textAlign:"center", color:"#aaa", marginTop:30, fontSize:13 },
});
