import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Platform,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { syncNow, cacheGet } from "../utils/sync";
import { apiPost } from "../utils/api";

const CDN_MANIFEST = "https://cdn.yourplatform.com/exam-engine/manifest.json"; // matches app-config.json

export default function HomeScreen({ navigation }) {
  const [exams,     setExams]     = useState([]);
  const [name,      setName]      = useState("");
  const [syncing,   setSyncing]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [starting,  setStarting]  = useState(null); // examId being started

  useEffect(() => {
    (async () => {
      const n = await AsyncStorage.getItem("auth_name");
      if (n) setName(n);
      await loadCatalogue();
      // Sync in background — update cache then reload
      syncInBackground();
    })();
  }, []);

  async function loadCatalogue() {
    const catalogue = await cacheGet("exam_catalogue");
    if (catalogue) {
      setExams(Array.isArray(catalogue) ? catalogue : []);
    }
    setLoading(false);
  }

  async function syncInBackground() {
    setSyncing(true);
    try {
      const result = await syncNow(CDN_MANIFEST);
      if (!result.offline && result.downloaded > 0) {
        await loadCatalogue();
      }
    } catch {}
    setSyncing(false);
  }

  async function startExam(exam) {
    setStarting(exam.id);
    try {
      // Bundle might already be cached from CDN sync
      const cached = await cacheGet(`bundle:${exam.id}`);

      // API call: start session (always online — creates server-side session)
      const data = await apiPost("/session/start", { exam_id: exam.id });
      const { session_id, token: _t, bundle } = data;

      // bundle from API has answer_key; CDN bundle does not — use API bundle
      navigation.navigate("Exam", {
        session_id,
        exam_id:   exam.id,
        bundle:    bundle || cached,
        exam_title: exam.title,
      });
    } catch (e) {
      const msg = e.message?.includes("401") || e.message?.includes("403")
        ? "Session expired. Please log in again."
        : e.message?.includes("subscription")
          ? "You don't have access to this exam. Check your subscription."
          : e.message || "Could not start exam. Check your connection.";
      Alert.alert("Error", msg);
    } finally {
      setStarting(null);
    }
  }

  async function logout() {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout", style: "destructive", onPress: async () => {
          await AsyncStorage.multiRemove(["auth_token", "auth_name"]);
          navigation.replace("Login");
        },
      },
    ]);
  }

  const renderExam = useCallback(({ item: exam }) => {
    const isStarting = starting === exam.id;
    const durationMin = Math.round((exam.duration_s || 3600) / 60);
    const statusColor = exam.status === "published" ? "#2e7d32" : "#f57f17";

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => startExam(exam)}
        disabled={!!starting}
        activeOpacity={0.85}
      >
        <View style={s.cardTop}>
          <Text style={s.cardTitle} numberOfLines={2}>{exam.title}</Text>
          <View style={[s.badge, { backgroundColor: exam.status === "published" ? "#e8f5e9" : "#fff8e1" }]}>
            <Text style={[s.badgeTxt, { color: statusColor }]}>{exam.status}</Text>
          </View>
        </View>

        {/* Sections */}
        {exam.sections?.length > 0 && (
          <View style={s.sections}>
            {exam.sections.map(sec => (
              <View key={sec.id} style={s.secChip}>
                <Text style={s.secTxt} numberOfLines={1}>{sec.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Meta row */}
        <View style={s.meta}>
          <MetaChip icon="📝" label={`${exam.total_qs || 0} Qs`} />
          <MetaChip icon="⏱" label={`${durationMin} min`} />
          {exam.marks?.max != null && <MetaChip icon="🏆" label={`${exam.marks.max} marks`} />}
        </View>

        {/* Start button */}
        <TouchableOpacity
          style={[s.startBtn, isStarting && s.startBtnDis]}
          onPress={() => startExam(exam)}
          disabled={!!starting}
        >
          {isStarting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.startTxt}>Start Exam →</Text>}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [starting]);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.hdr}>
        <View>
          <Text style={s.hdrTitle}>📝 Exam Engine</Text>
          {name ? <Text style={s.hdrSub}>Hi, {name}</Text> : null}
        </View>
        <View style={s.hdrRight}>
          {syncing && <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" style={{ marginRight: 12 }} />}
          <TouchableOpacity onPress={logout} style={s.logoutBtn}>
            <Text style={s.logoutTxt}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1565c0" />
          <Text style={s.loadTxt}>Loading exams…</Text>
        </View>
      ) : exams.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyTitle}>No exams available</Text>
          <Text style={s.emptySub}>Pull down to sync from CDN</Text>
          <TouchableOpacity style={s.syncBtn} onPress={syncInBackground} disabled={syncing}>
            <Text style={s.syncTxt}>{syncing ? "Syncing…" : "Sync Now"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={exams}
          keyExtractor={e => e.id}
          renderItem={renderExam}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={syncing} onRefresh={syncInBackground} tintColor="#1565c0" />
          }
          ListHeaderComponent={
            <Text style={s.listHeader}>{exams.length} exam{exams.length !== 1 ? "s" : ""} available</Text>
          }
        />
      )}
    </View>
  );
}

function MetaChip({ icon, label }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipIcon}>{icon}</Text>
      <Text style={s.chipTxt}>{label}</Text>
    </View>
  );
}

const BLUE = "#1565c0";
const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:"#f0f2f7" },
  hdr:         { backgroundColor:BLUE, paddingHorizontal:20, paddingTop: Platform.OS === "ios" ? 54 : 14, paddingBottom:16, flexDirection:"row", justifyContent:"space-between", alignItems:"flex-end" },
  hdrTitle:    { color:"#fff", fontSize:18, fontWeight:"900" },
  hdrSub:      { color:"rgba(255,255,255,0.75)", fontSize:12, marginTop:2 },
  hdrRight:    { flexDirection:"row", alignItems:"center" },
  logoutBtn:   { paddingHorizontal:14, paddingVertical:7, borderRadius:8, borderWidth:1.5, borderColor:"rgba(255,255,255,0.5)" },
  logoutTxt:   { color:"#fff", fontSize:12, fontWeight:"700" },
  center:      { flex:1, alignItems:"center", justifyContent:"center", padding:24 },
  loadTxt:     { marginTop:12, color:"#8a9ab7", fontSize:14 },
  emptyIcon:   { fontSize:40, marginBottom:10 },
  emptyTitle:  { fontSize:16, fontWeight:"800", color:"#1a2a4a", marginBottom:4 },
  emptySub:    { fontSize:13, color:"#8a9ab7", marginBottom:20 },
  syncBtn:     { backgroundColor:BLUE, paddingHorizontal:24, paddingVertical:12, borderRadius:10 },
  syncTxt:     { color:"#fff", fontWeight:"700", fontSize:14 },
  list:        { padding:16, gap:14 },
  listHeader:  { fontSize:12, fontWeight:"800", color:"#8a9ab7", textTransform:"uppercase", letterSpacing:1, marginBottom:4, paddingHorizontal:4 },
  card:        { backgroundColor:"#fff", borderRadius:14, padding:18, elevation:3, shadowColor:"#000", shadowOpacity:0.07, shadowRadius:10, shadowOffset:{width:0,height:3} },
  cardTop:     { flexDirection:"row", alignItems:"flex-start", gap:10, marginBottom:10 },
  cardTitle:   { flex:1, fontSize:15, fontWeight:"800", color:"#1a2a4a", lineHeight:21 },
  badge:       { paddingHorizontal:10, paddingVertical:3, borderRadius:999 },
  badgeTxt:    { fontSize:10, fontWeight:"800", textTransform:"uppercase" },
  sections:    { flexDirection:"row", flexWrap:"wrap", gap:6, marginBottom:12 },
  secChip:     { backgroundColor:"#e3f2fd", paddingHorizontal:10, paddingVertical:4, borderRadius:6 },
  secTxt:      { fontSize:11, fontWeight:"700", color:BLUE },
  meta:        { flexDirection:"row", gap:8, flexWrap:"wrap", marginBottom:14 },
  chip:        { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:"#f8f9ff", paddingHorizontal:10, paddingVertical:5, borderRadius:8, borderWidth:1, borderColor:"#e0e4ed" },
  chipIcon:    { fontSize:12 },
  chipTxt:     { fontSize:11, fontWeight:"700", color:"#5c6b8a" },
  startBtn:    { backgroundColor:BLUE, borderRadius:10, paddingVertical:13, alignItems:"center" },
  startBtnDis: { opacity:0.6 },
  startTxt:    { color:"#fff", fontSize:14, fontWeight:"800" },
});

