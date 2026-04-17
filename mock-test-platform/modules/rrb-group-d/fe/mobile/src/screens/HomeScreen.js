import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, useWindowDimensions, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../../../../auth/fe/mobile/src/hooks/useTheme.js";
import { api } from "../utils/api.js";

const DEFAULT_EXAMS = [
  { id: "rrb-gd-2024-full-1", title: "Full Mock Test 1", type: "full",    total_qs: 100, duration_s: 5400, badge: "popular" },
  { id: "rrb-gd-2024-full-2", title: "Full Mock Test 2", type: "full",    total_qs: 100, duration_s: 5400 },
  { id: "rrb-gd-2024-full-3", title: "Full Mock Test 3", type: "full",    total_qs: 100, duration_s: 5400, badge: "new" },
  { id: "rrb-gd-math-1",      title: "Mathematics Section Test", type: "section", total_qs: 25, duration_s: 1500 },
  { id: "rrb-gd-reasoning-1", title: "Reasoning Section Test",  type: "section", total_qs: 30, duration_s: 1800 },
  { id: "rrb-gd-science-1",   title: "Science Section Test",    type: "section", total_qs: 25, duration_s: 1500 },
  { id: "rrb-gd-gk-1",        title: "GK Section Test",         type: "section", total_qs: 20, duration_s: 1200 },
  { id: "rrb-gd-mini-1",      title: "Quick Mini Test (20 Qs)", type: "mini",    total_qs: 20, duration_s: 1200 },
];

export default function HomeScreen({ navigation }) {
  const { vars } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;

  const [name, setName]         = useState("");
  const [stats, setStats]       = useState(null);
  const [exams, setExams]       = useState(DEFAULT_EXAMS);
  const [history, setHistory]   = useState([]);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const s = styles(vars);

  const load = async () => {
    const n = await AsyncStorage.getItem("name");
    setName(n || "Candidate");

    const [examsRes, statsRes, histRes] = await Promise.all([
      api("/rrb/exams"),
      api("/rrb/stats"),
      api("/rrb/history?page=1&limit=5"),
    ]);
    if (examsRes.ok) setExams(examsRes.data.exams || DEFAULT_EXAMS);
    if (statsRes.ok) setStats(statsRes.data);
    if (histRes.ok)  setHistory(histRes.data.results || []);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = exams.filter(e =>
    (filter === "all" || e.type === filter) &&
    (!search || e.title.toLowerCase().includes(search.toLowerCase()))
  );

  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const STAT_ITEMS = [
    { label: "Attempts",  val: stats?.attempts     ?? "—" },
    { label: "Best",      val: stats?.best_score   != null ? stats.best_score.toFixed(1)  : "—" },
    { label: "Avg Score", val: stats?.avg_score    != null ? stats.avg_score.toFixed(1)   : "—" },
    { label: "Rank",      val: stats?.rank         != null ? `#${stats.rank}`             : "—" },
  ];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: vars.bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: vars.surface, borderBottomColor: vars.border }]}>
        <Text style={[s.headerTitle, { color: vars.primary }]}>RRB Group D</Text>
        <TouchableOpacity onPress={() => navigation.navigate("AuthHome")} style={s.homeLink}>
          <Text style={[s.homeLinkText, { color: vars.textMuted }]}>← Main Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, isTablet && s.contentTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Greeting */}
        <Text style={[s.greeting, { color: vars.text }]}>{greet}, {name}!</Text>
        <Text style={[s.greetingSub, { color: vars.textMuted }]}>Ready for today's practice?</Text>

        {/* Stats */}
        <View style={s.statsRow}>
          {STAT_ITEMS.map(st => (
            <View key={st.label} style={[s.statCard, { backgroundColor: vars.surface, borderColor: vars.border }]}>
              <Text style={[s.statVal, { color: vars.primary }]}>{st.val}</Text>
              <Text style={[s.statLbl, { color: vars.textMuted }]}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Mock tests */}
        <Text style={[s.sectionTitle, { color: vars.text }]}>Available Mock Tests</Text>

        {/* Search + filter */}
        <View style={s.searchRow}>
          <TextInput
            style={[s.searchInput, { backgroundColor: vars.surface, borderColor: vars.border, color: vars.text }]}
            placeholder="Search tests…"
            placeholderTextColor={vars.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[["all","All"],["full","Full"],["section","Section"],["mini","Mini"]].map(([key, lbl]) => (
              <TouchableOpacity key={key} style={[s.chip, filter === key && { backgroundColor: vars.primary, borderColor: vars.primary }]} onPress={() => setFilter(key)}>
                <Text style={[s.chipText, { color: filter === key ? "#fff" : vars.textMuted }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Exam cards */}
        <View style={[s.examGrid, isTablet && s.examGridTablet]}>
          {filtered.map(e => (
            <View key={e.id} style={[s.examCard, { backgroundColor: vars.surface, borderColor: vars.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <Text style={[s.examTitle, { color: vars.text }]}>{e.title}</Text>
                {e.badge && (
                  <View style={[s.badge, { backgroundColor: e.badge === "new" ? "#DCFCE7" : "#FEF3C7" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: e.badge === "new" ? "#15803D" : "#92400E" }}>
                      {e.badge === "new" ? "New" : "Popular"}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                <Text style={[s.examMeta, { color: vars.textMuted }]}>📋 {e.total_qs} Qs</Text>
                <Text style={[s.examMeta, { color: vars.textMuted }]}>⏱ {Math.floor(e.duration_s / 60)} min</Text>
              </View>
              <TouchableOpacity
                style={[s.startBtn, { backgroundColor: vars.primary }]}
                onPress={() => navigation.navigate("Exam", { examId: e.id })}
              >
                <Text style={s.startBtnText}>Start Test</Text>
              </TouchableOpacity>
            </View>
          ))}
          {filtered.length === 0 && (
            <Text style={{ color: vars.textMuted, textAlign: "center", padding: 32 }}>No tests found</Text>
          )}
        </View>

        {/* Recent history */}
        {history.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: vars.text }]}>Recent Attempts</Text>
            <View style={[s.historyCard, { backgroundColor: vars.surface, borderColor: vars.border }]}>
              {history.map((r, i) => (
                <TouchableOpacity
                  key={r.session_id}
                  style={[s.historyRow, i < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: vars.border }]}
                  onPress={() => navigation.navigate("Result", {
                    sessionId: r.session_id,
                    score: r.score, correct: r.correct, wrong: r.wrong,
                    skipped: r.skipped, total: r.total_qs, pct: r.percentage,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.historyTitle, { color: vars.text }]}>{r.exam_title || r.exam_id}</Text>
                    <Text style={[s.historyDate, { color: vars.textMuted }]}>
                      {new Date(r.submitted_at).toLocaleDateString("en-IN")}
                    </Text>
                  </View>
                  <Text style={[s.historyScore, { color: vars.primary }]}>{r.score?.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (v) => StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1 },
  headerTitle:   { fontSize: 17, fontWeight: "800" },
  homeLink:      {},
  homeLinkText:  { fontSize: 13, fontWeight: "600" },
  content:       { padding: 16, paddingBottom: 32 },
  contentTablet: { maxWidth: 800, alignSelf: "center", width: "100%" },
  greeting:      { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  greetingSub:   { fontSize: 14, marginBottom: 16 },
  statsRow:      { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard:      { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: "center" },
  statVal:       { fontSize: 20, fontWeight: "900" },
  statLbl:       { fontSize: 11, marginTop: 2 },
  sectionTitle:  { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  searchRow:     { marginBottom: 10 },
  searchInput:   { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 15 },
  chip:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: v.border, backgroundColor: v.surface },
  chipText:      { fontSize: 13, fontWeight: "600" },
  examGrid:      { gap: 12 },
  examGridTablet:{ flexDirection: "row", flexWrap: "wrap" },
  examCard:      { borderRadius: 14, borderWidth: 1, padding: 14 },
  examTitle:     { fontSize: 15, fontWeight: "700", flex: 1 },
  examMeta:      { fontSize: 13 },
  badge:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  startBtn:      { padding: 12, borderRadius: 10, alignItems: "center" },
  startBtnText:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  historyCard:   { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  historyRow:    { flexDirection: "row", alignItems: "center", padding: 14 },
  historyTitle:  { fontSize: 14, fontWeight: "600" },
  historyDate:   { fontSize: 12, marginTop: 2 },
  historyScore:  { fontSize: 18, fontWeight: "900" },
});
