import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Platform,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { adminGet, adminPost } from "../utils/api";

export default function ExamsScreen({ navigation }) {
  const [exams,     setExams]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [publishing,setPublishing]= useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await adminGet("/exams");
      setExams(data.exams || []);
    } catch (e) {
      if (e.status === 401) { navigation.replace("Login"); return; }
      Alert.alert("Error", e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }

  async function publish(examId) {
    Alert.alert("Publish Exam", "Build bank.json and make this exam live?", [
      { text: "Cancel", style: "cancel" },
      { text: "Publish", onPress: async () => {
        setPublishing(examId);
        try {
          await adminPost(`/exams/${examId}/publish`, {});
          Alert.alert("Published", "Exam is now live.");
          load();
        } catch (e) { Alert.alert("Error", e.message); }
        finally { setPublishing(null); }
      }},
    ]);
  }

  const renderExam = useCallback(({ item: exam }) => {
    const isPublishing = publishing === exam.id;
    const statusColor  = exam.status === "published" ? "#2e7d32" : exam.status === "draft" ? "#f57f17" : "#5c6b8a";
    const durationMin  = Math.round((exam.duration_s || 3600) / 60);

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.cardTitle} numberOfLines={2}>{exam.title}</Text>
          <View style={[s.badge, { backgroundColor: exam.status === "published" ? "#e8f5e9" : "#fff8e1" }]}>
            <Text style={[s.badgeTxt, { color: statusColor }]}>{exam.status}</Text>
          </View>
        </View>

        <View style={s.meta}>
          <Chip icon="❓" label={`${exam.total_qs || 0} Qs`} />
          <Chip icon="⏱" label={`${durationMin}m`} />
          {exam.marks?.max != null && <Chip icon="🏆" label={`${exam.marks.max} marks`} />}
        </View>

        {exam.sections?.length > 0 && (
          <View style={s.sections}>
            {exam.sections.map(sec => (
              <View key={sec.id} style={s.secChip}>
                <Text style={s.secTxt} numberOfLines={1}>{sec.label}</Text>
              </View>
            ))}
          </View>
        )}

        {exam.status !== "published" && (
          <TouchableOpacity
            style={[s.pubBtn, isPublishing && s.pubBtnDis]}
            onPress={() => publish(exam.id)}
            disabled={isPublishing || !!publishing}
          >
            {isPublishing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.pubTxt}>🚀 Publish</Text>}
          </TouchableOpacity>
        )}
      </View>
    );
  }, [publishing]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>;

  return (
    <View style={s.root}>
      <View style={s.hdr}>
        <Text style={s.hTitle}>📝 Exams</Text>
        <Text style={s.hSub}>{exams.length} total · {exams.filter(e => e.status === "published").length} published</Text>
      </View>
      <FlatList
        data={exams}
        keyExtractor={e => e.id}
        renderItem={renderExam}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1a237e" />}
        ListEmptyComponent={<Text style={s.empty}>No exams found</Text>}
      />
    </View>
  );
}

function Chip({ icon, label }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipI}>{icon}</Text>
      <Text style={s.chipT}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:"#f0f2f7" },
  center:     { flex:1, justifyContent:"center", alignItems:"center" },
  hdr:        { backgroundColor:"#1a237e", paddingHorizontal:20, paddingTop: Platform.OS === "ios" ? 54 : 14, paddingBottom:16 },
  hTitle:     { color:"#fff", fontSize:18, fontWeight:"900" },
  hSub:       { color:"rgba(255,255,255,0.7)", fontSize:12, marginTop:2 },
  list:       { padding:14, gap:12 },
  empty:      { textAlign:"center", color:"#aaa", marginTop:40 },
  card:       { backgroundColor:"#fff", borderRadius:14, padding:16, elevation:3, shadowColor:"#000", shadowOpacity:0.07, shadowRadius:8, shadowOffset:{width:0,height:2} },
  cardTop:    { flexDirection:"row", alignItems:"flex-start", gap:8, marginBottom:10 },
  cardTitle:  { flex:1, fontSize:14, fontWeight:"800", color:"#1a2a4a", lineHeight:20 },
  badge:      { paddingHorizontal:9, paddingVertical:3, borderRadius:999 },
  badgeTxt:   { fontSize:10, fontWeight:"800", textTransform:"uppercase" },
  meta:       { flexDirection:"row", flexWrap:"wrap", gap:7, marginBottom:10 },
  chip:       { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:"#f8f9ff", paddingHorizontal:9, paddingVertical:4, borderRadius:7, borderWidth:1, borderColor:"#e0e4ed" },
  chipI:      { fontSize:11 },
  chipT:      { fontSize:11, fontWeight:"700", color:"#5c6b8a" },
  sections:   { flexDirection:"row", flexWrap:"wrap", gap:6, marginBottom:12 },
  secChip:    { backgroundColor:"#e3f2fd", paddingHorizontal:9, paddingVertical:3, borderRadius:6 },
  secTxt:     { fontSize:11, fontWeight:"700", color:"#1565c0" },
  pubBtn:     { backgroundColor:"#1a237e", borderRadius:9, paddingVertical:11, alignItems:"center" },
  pubBtnDis:  { opacity:0.6 },
  pubTxt:     { color:"#fff", fontWeight:"800", fontSize:13 },
});
