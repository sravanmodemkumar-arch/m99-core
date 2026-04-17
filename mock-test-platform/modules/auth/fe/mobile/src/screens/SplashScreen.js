import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Storage } from "../utils/storage.js";
import { getConfig } from "../utils/api.js";

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    (async () => {
      const cfg = await getConfig();
      const token = await Storage.get("token");
      setTimeout(() => navigation.replace(token ? "Home" : (cfg.show_welcome ? "Welcome" : "Landing")), 800);
    })();
  }, []);

  return (
    <View style={s.wrap}>
      <Text style={s.logo}>🎯</Text>
      <Text style={s.name}>Mock Test Platform</Text>
      <ActivityIndicator style={s.spinner} color="#2563EB" />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },
  logo: { fontSize: 64, marginBottom: 16 },
  name: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 32 },
  spinner: { marginTop: 8 },
});
