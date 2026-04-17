import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import Avatar from "../components/Avatar.js";
import { api, requireAuth } from "../utils/api.js";
import { Storage } from "../utils/storage.js";

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [modules, setModules] = useState([]);

  useEffect(() => {
    (async () => {
      if (!await requireAuth(navigation)) return;
      const { ok, data } = await api("/auth/me");
      if (ok) { setProfile(data.profile); setModules(data.modules || []); }
    })();
  }, []);

  async function logout() {
    await Storage.clear();
    navigation.replace("Login");
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hello, {profile?.first_name || "Student"} 👋</Text>
          <Text style={s.sub}>Ready to practice today?</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Avatar name={profile?.first_name} photo={profile?.photo} size="md" />
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View style={s.quickRow}>
        {[["👤","Profile","Profile"],["🔒","Security","Security"],["⚙️","Settings","Settings"],["📋","Subs","Subscriptions"]].map(([icon, label, screen]) => (
          <TouchableOpacity key={screen} style={s.quickBtn} onPress={() => navigation.navigate(screen)}>
            <Text style={s.quickIcon}>{icon}</Text>
            <Text style={s.quickLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Modules */}
      <Text style={s.sectionTitle}>My Modules</Text>
      {modules.length === 0
        ? <Text style={s.empty}>No active modules. Contact your institute.</Text>
        : modules.map(m => (
          <TouchableOpacity key={m.module_id} style={s.moduleCard}>
            <Text style={s.moduleIcon}>{m.icon || "📚"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.moduleName}>{m.name}</Text>
              <Text style={s.moduleMeta}>{m.tier || ""}</Text>
            </View>
            <Text style={s.moduleArrow}>›</Text>
          </TouchableOpacity>
        ))}

      <TouchableOpacity style={s.logoutBtn} onPress={logout}>
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingTop: 12 },
  greeting: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  quickBtn: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, alignItems: "center" },
  quickIcon: { fontSize: 20, marginBottom: 4 },
  quickLabel: { fontSize: 11, fontWeight: "600", color: "#334155" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  empty: { fontSize: 14, color: "#94A3B8", textAlign: "center", paddingVertical: 24 },
  moduleCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 16, marginBottom: 10 },
  moduleIcon: { fontSize: 28 },
  moduleName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  moduleMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  moduleArrow: { fontSize: 20, color: "#94A3B8" },
  logoutBtn: { marginTop: 32, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: "#FECACA", alignItems: "center" },
  logoutText: { fontSize: 14, fontWeight: "700", color: "#EF4444" },
});
