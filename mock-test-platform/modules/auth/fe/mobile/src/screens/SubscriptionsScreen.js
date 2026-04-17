import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import PageHeader from "../components/PageHeader.js";
import { api } from "../utils/api.js";

function ModuleCard({ mod }) {
  const daysLeft = mod.expires_at ? Math.ceil((new Date(mod.expires_at) - Date.now()) / 86400000) : null;
  const pct = mod.started_at && mod.expires_at
    ? Math.min(100, Math.max(0, Math.round((Date.now() - new Date(mod.started_at)) / (new Date(mod.expires_at) - new Date(mod.started_at)) * 100)))
    : 0;
  const barColor = daysLeft === null ? "#2563EB" : daysLeft > 30 ? "#16A34A" : daysLeft > 7 ? "#D97706" : "#EF4444";
  const statusColor = mod.status === "active" ? "#DCFCE7" : "#F1F5F9";
  const statusText = mod.status === "active" ? "#16A34A" : "#64748B";

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardIcon}>{mod.icon || "📚"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>{mod.name}</Text>
          <Text style={s.cardMeta}>{mod.module_id}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: statusColor }]}>
          <Text style={[s.badgeText, { color: statusText }]}>{mod.status || "unknown"}</Text>
        </View>
      </View>
      {mod.started_at || mod.expires_at ? (
        <Text style={s.dates}>
          {mod.started_at ? `Started ${new Date(mod.started_at).toLocaleDateString()}` : ""}
          {mod.expires_at ? ` · Expires ${new Date(mod.expires_at).toLocaleDateString()}` : ""}
        </Text>
      ) : null}
      {daysLeft !== null && (
        <>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={[s.daysLeft, { color: barColor }]}>{daysLeft > 0 ? `${daysLeft} days left` : "Expired"}</Text>
        </>
      )}
    </View>
  );
}

export default function SubscriptionsScreen({ navigation }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/auth/me/subscriptions").then(({ ok, data }) => { if (ok) setModules(data.modules || []); setLoading(false); });
  }, []);

  const active = modules.filter(m => m.status === "active").length;
  const expired = modules.filter(m => m.status !== "active").length;

  return (
    <ScrollView style={s.wrap}>
      <PageHeader title="My Subscriptions" onBack={() => navigation.goBack()} />
      {!loading && modules.length > 0 && (
        <View style={s.summary}>
          {[["Active", active, "#DCFCE7", "#16A34A"], ["Expired", expired, "#FEE2E2", "#EF4444"], ["Total", modules.length, "#EFF6FF", "#2563EB"]].map(([l, v, bg, color]) => (
            <View key={l} style={[s.summaryItem, { backgroundColor: bg }]}>
              <Text style={[s.summaryVal, { color }]}>{v}</Text>
              <Text style={s.summaryLabel}>{l}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={s.list}>
        {loading ? <Text style={s.loading}>Loading…</Text>
          : modules.length === 0
            ? <View style={s.empty}><Text style={s.emptyIcon}>📭</Text><Text style={s.emptyTitle}>No Subscriptions</Text><Text style={s.emptyDesc}>Contact your institute to get access.</Text></View>
            : modules.map(m => <ModuleCard key={m.module_id} mod={m} />)}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  summary: { flexDirection: "row", gap: 10, padding: 16 },
  summaryItem: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  summaryVal: { fontSize: 22, fontWeight: "900" },
  summaryLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  cardIcon: { fontSize: 28 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  cardMeta: { fontSize: 12, color: "#94A3B8" },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  dates: { fontSize: 12, color: "#94A3B8", marginBottom: 10 },
  barBg: { height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  barFill: { height: "100%", borderRadius: 3 },
  daysLeft: { fontSize: 12, fontWeight: "700" },
  loading: { textAlign: "center", padding: 24, color: "#94A3B8" },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  emptyDesc: { fontSize: 14, color: "#94A3B8", marginTop: 6 },
});
