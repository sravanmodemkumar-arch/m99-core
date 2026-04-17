import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, Platform,
} from "react-native";
import { userGet, fmt } from "../utils/api";

export default function AnalyticsScreen({ navigation }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const d = await userGet("/analytics");
      setData(d);
    } catch (e) {
      if (e.status === 401) { navigation.replace("Login"); return; }
      Alert.alert("Error", e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>;

  const byExam = data?.by_exam || [];
  const trend  = data?.trend   || [];
  const maxAbs = byExam.length ? Math.max(...byExam.map(e => Math.abs(e.best_score ?? 0)), 1) : 1;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1a237e" />}>

      {/* Header */}
      <View style={s.hdr}>
        <Text style={s.hTitle}>📊 Analytics</Text>
      </View>

      {/* Overview */}
      <Text style={s.secHd}>Overview</Text>
      <View style={s.grid}>
        <StatCard icon="📝" label="Attempts"    value={data?.attempts ?? 0}    color="#1565c0" />
        <StatCard icon="🏆" label="Best Score"  value={fmt(data?.best_score)}  color="#2e7d32" />
        <StatCard icon="📈" label="Avg Score"   value={fmt(data?.avg_score)}   color="#6a1b9a" />
        <StatCard icon="🎯" label="Exams"        value={byExam.length}          color="#e65100" />
      </View>

      {/* Score trend */}
      {trend.length > 1 && (
        <>
          <Text style={s.secHd}>Score Trend (last 10)</Text>
          <View style={s.trendCard}>
            {trend.map((t, i) => {
              const scores = trend.map(x => x.score);
              const min = Math.min(...scores), max = Math.max(...scores);
              const range = max - min || 1;
              const h = Math.round(((t.score - min) / range) * 60) + 10;
              const color = t.score >= 0 ? "#2e7d32" : "#c62828";
              return (
                <View key={i} style={s.trendCol}>
                  <Text style={[s.trendVal, { color }]}>{fmt(t.score)}</Text>
                  <View style={[s.trendBar, { height: h, backgroundColor: color }]} />
                  <Text style={s.trendDate}>{t.date?.slice(5)}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Per-exam */}
      {byExam.length > 0 && (
        <>
          <Text style={s.secHd}>Per-Exam Performance</Text>
          <View style={s.examCard}>
            {byExam.map((e, i) => {
              const pct  = Math.round(Math.min(100, (Math.abs(e.best_score ?? 0) / maxAbs) * 100));
              const color = (e.best_score ?? 0) >= 0 ? "#2e7d32" : "#c62828";
              return (
                <View key={i} style={s.examRow}>
                  <Text style={s.examName} numberOfLines={1}>{e.exam_title}</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={[s.examBest, { color }]}>{fmt(e.best_score)}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {!data?.attempts && (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Complete some exams to see analytics</Text>
        </View>
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
  root:      { flex:1, backgroundColor:"#f0f2f7" },
  center:    { flex:1, justifyContent:"center", alignItems:"center" },
  body:      { paddingBottom:32 },
  hdr:       { backgroundColor:"#1a237e", paddingHorizontal:20, paddingTop: Platform.OS==="ios"?54:14, paddingBottom:16 },
  hTitle:    { color:"#fff", fontSize:18, fontWeight:"900" },
  secHd:     { fontSize:10, fontWeight:"800", color:"#5c6b8a", textTransform:"uppercase", letterSpacing:1, paddingHorizontal:14, marginTop:16, marginBottom:8 },
  grid:      { flexDirection:"row", flexWrap:"wrap", gap:10, paddingHorizontal:12 },
  statCard:  { flex:1, minWidth:"45%", backgroundColor:"#fff", borderRadius:12, padding:14, borderLeftWidth:4, elevation:2, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:2} },
  statIcon:  { fontSize:18, marginBottom:4 },
  statVal:   { fontSize:20, fontWeight:"900", lineHeight:24 },
  statLbl:   { fontSize:10, fontWeight:"600", color:"#8a9ab7", marginTop:2 },
  trendCard: { marginHorizontal:12, backgroundColor:"#fff", borderRadius:14, padding:16, flexDirection:"row", alignItems:"flex-end", justifyContent:"space-around", elevation:2, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:2} },
  trendCol:  { alignItems:"center", flex:1 },
  trendVal:  { fontSize:9, fontWeight:"800", marginBottom:4 },
  trendBar:  { width:8, borderRadius:4, minHeight:10 },
  trendDate: { fontSize:8, color:"#aaa", marginTop:4 },
  examCard:  { marginHorizontal:12, backgroundColor:"#fff", borderRadius:14, padding:16, elevation:2, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:2} },
  examRow:   { flexDirection:"row", alignItems:"center", gap:8, marginBottom:12 },
  examName:  { width:100, fontSize:11, fontWeight:"700", color:"#1a2a4a" },
  barTrack:  { flex:1, height:8, backgroundColor:"#e0e4ed", borderRadius:4, overflow:"hidden" },
  barFill:   { height:"100%", borderRadius:4 },
  examBest:  { width:44, fontSize:11, fontWeight:"900", textAlign:"right" },
  empty:     { flex:1, justifyContent:"center", alignItems:"center", paddingTop:60 },
  emptyTxt:  { color:"#aaa", fontSize:14 },
});
