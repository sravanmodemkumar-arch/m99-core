import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import PageHeader from "../components/PageHeader.js";
import Avatar from "../components/Avatar.js";
import { api } from "../utils/api.js";

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState({});
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    api("/auth/me/profile").then(({ ok, data }) => { if (ok) { setProfile(data.profile || data); setDevices(data.devices || []); } });
  }, []);

  const DEVICE_ICONS = { mobile: "📱", tablet: "📱", desktop: "🖥️", web: "🌐" };

  return (
    <ScrollView style={s.wrap}>
      <PageHeader title="Profile" onBack={() => navigation.goBack()} />

      <View style={s.avatarWrap}>
        <Avatar name={profile.first_name} photo={profile.photo} size="lg" />
        <Text style={s.name}>{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—"}</Text>
        {profile.category ? <View style={s.badge}><Text style={s.badgeText}>{profile.category}</Text></View> : null}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Personal</Text>
        {[["Phone", profile.phone], ["Email", profile.email], ["Date of Birth", profile.dob], ["Gender", profile.gender === "M" ? "Male" : profile.gender === "F" ? "Female" : profile.gender]].map(([l, v]) => v ? (
          <View key={l} style={s.row}><Text style={s.rowLabel}>{l}</Text><Text style={s.rowVal}>{v}</Text></View>
        ) : null)}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Address</Text>
        {[["Pincode", profile.pincode], ["State", profile.state], ["City", profile.city]].map(([l, v]) => v ? (
          <View key={l} style={s.row}><Text style={s.rowLabel}>{l}</Text><Text style={s.rowVal}>{v}</Text></View>
        ) : null)}
        {profile.address ? <Text style={s.address}>{profile.address}</Text> : null}
      </View>

      {devices.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Active Devices</Text>
          {devices.map(d => (
            <View key={d.session_id} style={s.deviceRow}>
              <Text style={s.deviceIcon}>{DEVICE_ICONS[d.device_type] || "🖥️"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.deviceName}>{d.device_name || d.device_type}</Text>
                <Text style={s.deviceMeta}>{d.city ? d.city + " · " : ""}Last seen {new Date(d.last_seen).toLocaleDateString()}</Text>
              </View>
              {d.is_current ? <View style={s.currentBadge}><Text style={s.currentText}>This device</Text></View> : null}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.editBtn} onPress={() => navigation.navigate("EditProfile")}>
        <Text style={s.editBtnText}>Edit Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  avatarWrap: { alignItems: "center", padding: 24 },
  name: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginTop: 12 },
  badge: { marginTop: 6, backgroundColor: "#EFF6FF", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  section: { backgroundColor: "#fff", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, padding: 12, paddingBottom: 6, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowLabel: { fontSize: 14, color: "#64748B" },
  rowVal: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  address: { fontSize: 13, color: "#64748B", padding: 14 },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  deviceIcon: { fontSize: 22 },
  deviceName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  deviceMeta: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  currentBadge: { backgroundColor: "#DCFCE7", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  currentText: { fontSize: 11, fontWeight: "700", color: "#16A34A" },
  editBtn: { margin: 16, padding: 14, backgroundColor: "#2563EB", borderRadius: 10, alignItems: "center" },
  editBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
