import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Platform,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, apiPost, fmtTime } from "../utils/api";

const BLUE = "#0d47a1";

export default function HomeScreen({ navigation }) {
  const [exams,    setExams]    = useState([]);
  const [name,     setName]     = useState("");
  const [loading,  setLoading]  = useState(true);
  const [starting, setStarting] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      const n = await AsyncStorage.getItem("auth_name");
      if (n) setName(n);
      await load();
    })();
  }, []);

  async function load() {
    try {
      const data = await apiGet("/rrb-gd/exams");
      setExams(data.exams || []);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function startExam(exam) {
    setStarting(exam.id);
    try {
      navigation.navigate("Exam", {
        examId:    exam.id,
        label:     exam.title,
        backRoute: "RRBGroupDHome",
      });
    } catch (e) {
      Alert.alert("Error", e.message);
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
    const durationMin = Math.round((exam.duration_s || 5400) / 60);
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => startExam(exam)}
        disabled={!!starting}
        activeOpacity={0.85}
      >
        <View style={s.cardTop}>
          <Text style={s.cardTitle} numberOfLines={2}>{exam.title}</Text>
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{exam.type || "Full"}</Text>
          </View>
        </View>
        <View style={s.meta}>
          <MetaChip icon="📝" label={`${exam.total_qs || 0} Qs`} />
          <MetaChip icon="⏱" label={`${durationMin} min`} />
          <MetaChip icon="➕" label="+1 / −⅓" />
        </View>
        <TouchableOpacity
          style={[s.startBtn, isStarting && s.startBtnDis]}
          onPress={() => startExam(exam)}
          disabled={!!starting}
        >
          {isStarting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.startTxt}>Start Test →</Text>}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [starting]);

  return (
    <View style={s.root}>
      <View style={s.hdr}>
        <View>
          <Text style={s.hdrTitle}>🚂 RRB Group D</Text>
          {name ? <Text style={s.hdrSub}>Hi, {name}</Text> : null}
        </View>
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutTxt}>Logout</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      ) : (
        <FlatList
          data={exams}
          keyExtractor={e => e.id}
          renderItem={renderExam}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BLUE} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyIcon}>📭</Text>
              <Text style={s.emptyTitle}>No exams available</Text>
            </View>
          }
          ListHeaderComponent={
            exams.length > 0
              ? <Text style={s.listHeader}>{exams.length} exam{exams.length !== 1 ? "s" : ""} available</Text>
              : null
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

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: "#f0f4f8" },
  hdr:        { backgroundColor: BLUE, paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 54 : 14, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  hdrTitle:   { color: "#fff", fontSize: 18, fontWeight: "900" },
  hdrSub:     { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  logoutBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)" },
  logoutTxt:  { color: "#fff", fontSize: 12, fontWeight: "700" },
  center:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyIcon:  { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#1a2a4a" },
  list:       { padding: 16, gap: 14 },
  listHeader: { fontSize: 12, fontWeight: "800", color: "#8a9ab7", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, paddingHorizontal: 4 },
  card:       { backgroundColor: "#fff", borderRadius: 14, padding: 18, elevation: 3, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  cardTop:    { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  cardTitle:  { flex: 1, fontSize: 15, fontWeight: "800", color: "#1a2a4a", lineHeight: 21 },
  badge:      { backgroundColor: "#e8eaf6", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeTxt:   { fontSize: 10, fontWeight: "800", color: BLUE, textTransform: "uppercase" },
  meta:       { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14 },
  chip:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f8f9ff", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "#e0e4ed" },
  chipIcon:   { fontSize: 12 },
  chipTxt:    { fontSize: 11, fontWeight: "700", color: "#5c6b8a" },
  startBtn:   { backgroundColor: BLUE, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  startBtnDis:{ opacity: 0.6 },
  startTxt:   { color: "#fff", fontSize: 14, fontWeight: "800" },
});
