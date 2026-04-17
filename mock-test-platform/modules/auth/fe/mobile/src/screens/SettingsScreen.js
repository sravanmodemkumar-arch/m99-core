import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from "react-native";
import PageHeader from "../components/PageHeader.js";
import { api, getConfig } from "../utils/api.js";
import { Storage } from "../utils/storage.js";

export default function SettingsScreen({ navigation }) {
  const [cfg, setCfg] = useState({});
  const [mode, setMode] = useState("light");
  const [notifs, setNotifs] = useState({ push: true, sms: true, email: true, reminders: true });

  useEffect(() => {
    getConfig().then(setCfg);
    Storage.get("theme_mode").then(m => setMode(m || "light"));
    Storage.getJson("notif_prefs").then(p => { if (p) setNotifs(p); });
  }, []);

  async function toggleDark(v) {
    const next = v ? "dark" : "light";
    await Storage.set("theme_mode", next);
    setMode(next);
  }

  async function saveNotif(key, val) {
    const next = { ...notifs, [key]: val };
    setNotifs(next);
    await Storage.setJson("notif_prefs", next);
    api("/auth/notifications/prefs", { method: "POST", body: JSON.stringify(next) }).catch(() => {});
  }

  async function logout() { await Storage.clear(); navigation.replace("Login"); }

  const Row = ({ label, sub, right, onPress, danger }) => (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={!onPress}>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, danger && s.danger]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={s.wrap}>
      <PageHeader title="Settings" onBack={() => navigation.goBack()} />

      <Text style={s.groupTitle}>Appearance</Text>
      <View style={s.group}>
        <Row label="Dark Mode" sub="Switch between light and dark"
          right={<Switch value={mode === "dark"} onValueChange={toggleDark} trackColor={{ true: "#2563EB" }} disabled={cfg.mode_control === "force_light" || cfg.mode_control === "force_dark"} />} />
      </View>

      <Text style={s.groupTitle}>Notifications</Text>
      <View style={s.group}>
        {[["push","Push Notifications","Exam reminders, results"],["sms","SMS Alerts","OTP and important updates"],["email","Email Notifications","Weekly performance reports"],["reminders","Exam Reminders","Before scheduled tests"]].map(([k, l, sub]) => (
          <Row key={k} label={l} sub={sub} right={<Switch value={notifs[k] !== false} onValueChange={v => saveNotif(k, v)} trackColor={{ true: "#2563EB" }} />} />
        ))}
      </View>

      <Text style={s.groupTitle}>Account</Text>
      <View style={s.group}>
        <Row label="Profile" right={<Text style={s.arrow}>›</Text>} onPress={() => navigation.navigate("Profile")} />
        <Row label="Security" right={<Text style={s.arrow}>›</Text>} onPress={() => navigation.navigate("Security")} />
        <Row label="My Subscriptions" right={<Text style={s.arrow}>›</Text>} onPress={() => navigation.navigate("Subscriptions")} />
      </View>

      <Text style={s.groupTitle}>About</Text>
      <View style={s.group}>
        <Row label="Version" right={<Text style={s.val}>{cfg.version || "v1.0.0"}</Text>} />
        <Row label="Help & FAQ" right={<Text style={s.arrow}>›</Text>} onPress={() => navigation.navigate("Help")} />
        <Row label="Terms of Service" right={<Text style={s.arrow}>›</Text>} />
        <Row label="Privacy Policy" right={<Text style={s.arrow}>›</Text>} />
      </View>

      <Text style={s.groupTitle}>Danger Zone</Text>
      <View style={s.group}>
        <Row label="Sign Out" danger onPress={logout} />
        <Row label="Delete Account" danger onPress={() => navigation.navigate("DeleteAccount")} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  groupTitle: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  group: { backgroundColor: "#fff", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E2E8F0" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", minHeight: 56 },
  rowLabel: { fontSize: 15, fontWeight: "500", color: "#0F172A" },
  rowSub: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  arrow: { fontSize: 20, color: "#CBD5E1" },
  val: { fontSize: 14, color: "#94A3B8" },
  danger: { color: "#EF4444" },
});
