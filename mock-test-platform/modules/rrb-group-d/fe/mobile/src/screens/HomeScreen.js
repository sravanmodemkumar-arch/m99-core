import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { listExams } from "../utils/api.js";

const VARS = {
  text:      "#111827",
  textMuted: "#6B7280",
  surface:   "#FFFFFF",
  surface2:  "#F3F4F6",
  border:    "#E5E7EB",
  primary:   "#2563EB",
  bg:        "#F9FAFB",
};

export default function HomeScreen({ navigation }) {
  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    listExams()
      .then(res => { if (res.ok) setExams(res.data); else setError("Failed to load exams"); })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
  };

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: VARS.bg }]}>
      <View style={[s.header, { backgroundColor: VARS.surface, borderBottomColor: VARS.border }]}>
        <Text style={[s.title, { color: VARS.text }]}>RRB Group D</Text>
        <TouchableOpacity onPress={handleLogout} style={[s.logoutBtn, { borderColor: VARS.border }]}>
          <Text style={{ color: VARS.textMuted, fontSize: 13, fontWeight: "600" }}>Logout</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={VARS.primary} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={{ color: "#DC2626", fontSize: 15 }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={exams}
          keyExtractor={item => item.exam_id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.card, { backgroundColor: VARS.surface, borderColor: VARS.border }]}
              onPress={() => navigation.navigate("Exam", { examId: item.exam_id })}
              activeOpacity={0.75}
            >
              <Text style={[s.cardTitle, { color: VARS.text }]}>{item.title}</Text>
              <Text style={[s.cardMeta, { color: VARS.textMuted }]}>
                {item.total_qs} questions · {Math.round(item.duration_s / 60)} min · {item.sections.join(", ")}
              </Text>
              <View style={[s.startBtn, { backgroundColor: VARS.primary }]}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Start Exam</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={{ color: VARS.textMuted }}>No exams available</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fill:      { flex: 1 },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  header:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  title:     { flex: 1, fontSize: 20, fontWeight: "800" },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5 },
  list:      { padding: 16, gap: 12 },
  card:      { borderRadius: 14, padding: 16, borderWidth: 1, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  cardMeta:  { fontSize: 13 },
  startBtn:  { marginTop: 8, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
