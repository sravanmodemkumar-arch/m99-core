import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import Btn from "../components/Btn.js";
import { getConfig } from "../utils/api.js";

const SLIDES = [
  { icon: "🎯", title: "Targeted Practice", desc: "Focus on what matters most for your exam." },
  { icon: "📊", title: "Smart Analytics", desc: "Know exactly where you stand against thousands." },
  { icon: "🏆", title: "Beat the Competition", desc: "Rank live with all-India aspirants." },
];

export default function WelcomeScreen({ navigation }) {
  const [cfg, setCfg] = useState({});
  const [slide, setSlide] = useState(0);
  useEffect(() => { getConfig().then(setCfg); const t = setInterval(() => setSlide(p => (p + 1) % SLIDES.length), 3000); return () => clearInterval(t); }, []);

  return (
    <View style={s.wrap}>
      <View style={s.slideArea}>
        <Text style={s.icon}>{SLIDES[slide].icon}</Text>
        <Text style={s.slideTitle}>{SLIDES[slide].title}</Text>
        <Text style={s.slideDesc}>{SLIDES[slide].desc}</Text>
        <View style={s.dots}>
          {SLIDES.map((_, i) => <View key={i} style={[s.dot, i === slide && s.dotActive]} />)}
        </View>
      </View>
      <View style={s.foot}>
        <Text style={s.heading}>{cfg.title || "Prepare Smarter.\nScore Higher."}</Text>
        <Text style={s.sub}>{cfg.subtitle || "AI-powered mock tests for govt exams."}</Text>
        <Btn label={cfg.login_label || "Sign In"} onPress={() => navigation.navigate("Login")} />
        <Btn label={cfg.register_label || "Register Free"} variant="secondary" onPress={() => navigation.navigate("Register1")} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  slideArea: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  icon: { fontSize: 72, marginBottom: 20 },
  slideTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", textAlign: "center", marginBottom: 10 },
  slideDesc: { fontSize: 15, color: "#64748B", textAlign: "center", lineHeight: 22 },
  dots: { flexDirection: "row", gap: 6, marginTop: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#CBD5E1" },
  dotActive: { backgroundColor: "#2563EB", width: 20 },
  foot: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E2E8F0", padding: 24 },
  heading: { fontSize: 24, fontWeight: "900", color: "#0F172A", marginBottom: 8, lineHeight: 32 },
  sub: { fontSize: 14, color: "#64748B", marginBottom: 20 },
});
