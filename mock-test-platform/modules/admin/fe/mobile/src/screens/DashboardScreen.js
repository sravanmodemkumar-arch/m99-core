import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Platform,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { adminGet } from "../utils/api";

export default function DashboardScreen({ navigation }) {
  const [stats,     setStats]     = useState(null);
  const [role,      setRole]      = useState("");
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  useEffect(() => {
    AsyncStorage.getItem("admin_role").then(r => setRole(r || ""));
    load();
  }, []);

  async function load() {
    try {
      const [overviewRes, examsRes] = await Promise.all([
        adminGet("/reports/overview").catch(() => null),
        adminGet("/exams").catch(() => null),
      ]);
      setStats({
        total_exams:   examsRes?.exams?.length ?? 0,
        published:     examsRes?.exams?.filter(e => e.status === "published").length ?? 0,
        total_attempts:overviewRes?.total_attempts ?? 0,
        total_users:   overviewRes?.total_users ?? 0,
        avg_score:     overviewRes?.avg_score ?? null,
        recent:        overviewRes?.recent_activity ?? [],
      });
    } catch (e) {
      if (e.status === 401) { navigation.replace("Login"); return; }
      Alert.alert("Error", e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }

  async function logout() {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => {
        await AsyncStorage.multiRemove(["admin_token","admin_role","admin_tenant"]);
        navigation.replace("Login");
      }},
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>;

  return (
    <View style={s.root}>
      <View style={s.hdr}>
        <View>
          <Text style={s.hTitle}>⚙️ Admin Panel</Text>
          <Text style={s.hSub}>{role === "super_admin" ? "Super Admin" : "Product Admin"}</Text>
        </View>
        <TouchableOpacity style={s.logBtn} onPress={logout}>
          <Text style={s.logTxt}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1a237e" />}
      >
        <Text style={s.sectionHd}>Overview</Text>
        <View style={s.grid}>
          <StatCard icon="📝" label="Total Exams"   value={stats?.total_exams ?? 0}   color="#1565c0" />
          <StatCard icon="✅" label="Published"      value={stats?.published ?? 0}      color="#2e7d32" />
          <StatCard icon="👥" label="Total Users"    value={stats?.total_users ?? 0}    color="#6a1b9a" />
          <StatCard icon="📊" label="Attempts"       value={stats?.total_attempts ?? 0} color="#e65100" />
        </View>

        {stats?.avg_score != null && (
          <View style={s.scoreCard}>
            <Text style={s.scoreVal}>{stats.avg_score >= 0 ? "+" : ""}{Number(stats.avg_score).toFixed(2)}</Text>
            <Text style={s.scoreLbl}>Platform Average Score</Text>
          </View>
        )}

        <Text style={s.sectionHd}>Quick Actions</Text>
        <View style={s.actions}>
          <ActionBtn icon="📝" label="Exams"         onPress={() => navigation.navigate("Exams")} />
          <ActionBtn icon="❓" label="Questions"      onPress={() => navigation.navigate("Questions")} />
          <ActionBtn icon="👥" label="Users"          onPress={() => navigation.navigate("Users")} />
          <ActionBtn icon="📊" label="Reports"        onPress={() => navigation.replace("Reports")} />
        </View>

        {stats?.recent?.length > 0 && (
          <>
            <Text style={s.sectionHd}>Recent Activity</Text>
            {stats.recent.slice(0, 8).map((item, i) => (
              <View key={i} style={s.actRow}>
                <Text style={s.actIcon}>{item.type === "submit" ? "📤" : item.type === "start" ? "▶️" : "ℹ️"}</Text>
                <View style={s.actBody}>
                  <Text style={s.actTitle} numberOfLines={1}>{item.label || item.exam_title || "Activity"}</Text>
                  <Text style={s.actSub}>{item.uid?.slice(-8) ?? "—"}</Text>
                </View>
                {item.score != null && (
                  <Text style={[s.actScore, { color: item.score >= 0 ? "#2e7d32" : "#c62828" }]}>
                    {item.score >= 0 ? "+" : ""}{Number(item.score).toFixed(1)}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
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

function ActionBtn({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={s.actionIcon}>{icon}</Text>
      <Text style={s.actionLbl}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root:      { flex:1, backgroundColor:"#f0f2f7" },
  center:    { flex:1, justifyContent:"center", alignItems:"center" },
  hdr:       { backgroundColor:"#1a237e", paddingHorizontal:20, paddingTop: Platform.OS === "ios" ? 54 : 14, paddingBottom:16, flexDirection:"row", justifyContent:"space-between", alignItems:"flex-end" },
  hTitle:    { color:"#fff", fontSize:18, fontWeight:"900" },
  hSub:      { color:"rgba(255,255,255,0.7)", fontSize:11, marginTop:2 },
  logBtn:    { paddingHorizontal:12, paddingVertical:6, borderRadius:7, borderWidth:1.5, borderColor:"rgba(255,255,255,0.4)" },
  logTxt:    { color:"#fff", fontSize:12, fontWeight:"700" },
  body:      { padding:16, gap:12 },
  sectionHd: { fontSize:11, fontWeight:"800", color:"#5c6b8a", textTransform:"uppercase", letterSpacing:1, marginTop:4 },
  grid:      { flexDirection:"row", flexWrap:"wrap", gap:10 },
  statCard:  { flex:1, minWidth:"45%", backgroundColor:"#fff", borderRadius:12, padding:14, borderLeftWidth:4, elevation:2, shadowColor:"#000", shadowOpacity:0.06, shadowRadius:6, shadowOffset:{width:0,height:2} },
  statIcon:  { fontSize:20, marginBottom:6 },
  statVal:   { fontSize:22, fontWeight:"900", lineHeight:26 },
  statLbl:   { fontSize:11, fontWeight:"600", color:"#8a9ab7", marginTop:2 },
  scoreCard: { backgroundColor:"#1a237e", borderRadius:12, padding:16, alignItems:"center" },
  scoreVal:  { fontSize:28, fontWeight:"900", color:"#fff" },
  scoreLbl:  { fontSize:12, color:"rgba(255,255,255,0.7)", marginTop:4 },
  actions:   { flexDirection:"row", flexWrap:"wrap", gap:10 },
  actionBtn: { flex:1, minWidth:"45%", backgroundColor:"#fff", borderRadius:12, padding:16, alignItems:"center", elevation:2, shadowColor:"#000", shadowOpacity:0.06, shadowRadius:6, shadowOffset:{width:0,height:2} },
  actionIcon:{ fontSize:26, marginBottom:6 },
  actionLbl: { fontSize:13, fontWeight:"800", color:"#1a2a4a" },
  actRow:    { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderRadius:10, padding:12, gap:10, elevation:1, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:4, shadowOffset:{width:0,height:1} },
  actIcon:   { fontSize:18, width:28 },
  actBody:   { flex:1 },
  actTitle:  { fontSize:13, fontWeight:"700", color:"#1a2a4a" },
  actSub:    { fontSize:10, color:"#aaa", marginTop:1 },
  actScore:  { fontSize:14, fontWeight:"900" },
});

