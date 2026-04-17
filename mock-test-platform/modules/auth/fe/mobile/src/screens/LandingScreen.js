import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions,
} from "react-native";
import Btn from "../components/Btn.js";
import { getConfig } from "../utils/api.js";

const { width: SCREEN_W } = Dimensions.get("window");

const DEFAULT_STATS = [
  { value: "10K+", label: "Students" },
  { value: "500+", label: "Tests" },
  { value: "95%",  label: "Pass Rate" },
  { value: "24/7", label: "Support" },
];

const DEFAULT_FEATURES = [
  { icon: "🎯", title: "Targeted Practice", desc: "Topic-wise tests tailored to your exam pattern." },
  { icon: "📊", title: "Live Analytics",    desc: "Track your rank and progress in real time." },
  { icon: "⚡", title: "Instant Results",   desc: "Detailed solutions right after every test." },
  { icon: "🏆", title: "All-India Rank",    desc: "Compete with thousands of real aspirants." },
];

function StatCard({ value, label }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <View style={s.featureCard}>
      <Text style={s.featureIcon}>{icon}</Text>
      <Text style={s.featureTitle}>{title}</Text>
      <Text style={s.featureDesc}>{desc}</Text>
    </View>
  );
}

export default function LandingScreen({ navigation }) {
  const [cfg, setCfg] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getConfig().then(c => { setCfg(c || {}); setReady(true); });
  }, []);

  const stats = cfg.stats
    ? cfg.stats.map(item =>
        typeof item === "string"
          ? { value: item.split(" ")[0], label: item.split(" ").slice(1).join(" ") }
          : item
      )
    : DEFAULT_STATS;

  const features = cfg.features
    ? cfg.features.map((f, i) => ({
        icon: f.icon || DEFAULT_FEATURES[i % DEFAULT_FEATURES.length].icon,
        title: f.title || "",
        desc: f.desc || f.description || "",
      }))
    : DEFAULT_FEATURES;

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Announcement banner ── */}
      {!!cfg.announcement && (
        <View style={[s.banner, cfg.announcement_color ? { backgroundColor: cfg.announcement_color } : null]}>
          <Text style={s.bannerText}>{cfg.announcement}</Text>
        </View>
      )}

      {/* ── Hero ── */}
      <View style={s.hero}>
        <Text style={s.heroEmoji}>{cfg.hero_emoji || "🎯"}</Text>
        <Text style={s.heroTitle}>{cfg.title || "Prepare Smarter.\nScore Higher."}</Text>
        <Text style={s.heroSub}>
          {cfg.subtitle || "AI-powered mock tests for government exams."}
        </Text>
      </View>

      {/* ── Stats row ── */}
      <View style={s.statsRow}>
        {stats.map((stat, i) => (
          <StatCard key={i} value={stat.value} label={stat.label} />
        ))}
      </View>

      {/* ── CTA buttons ── */}
      <View style={s.ctaWrap}>
        <Btn
          label={cfg.login_label || "Sign In"}
          onPress={() => navigation.navigate("Login")}
        />
        <Btn
          label={cfg.register_label || "Register Free"}
          variant="secondary"
          onPress={() => navigation.navigate("Register1")}
        />
      </View>

      {/* ── Features grid ── */}
      {ready && (
        <>
          <Text style={s.featuresHeading}>Why students choose us</Text>
          <View style={s.featuresGrid}>
            {features.map((f, i) => (
              <FeatureCard key={i} icon={f.icon} title={f.title} desc={f.desc} />
            ))}
          </View>
        </>
      )}

      {/* ── Footer ── */}
      <View style={s.footer}>
        {cfg.footer_links && cfg.footer_links.length > 0 ? (
          <View style={s.footerLinks}>
            {cfg.footer_links.map((link, i) => (
              <TouchableOpacity key={i} style={s.footerLinkBtn}>
                <Text style={s.footerLink}>{link.label || link}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={s.footerLinks}>
            <TouchableOpacity style={s.footerLinkBtn}>
              <Text style={s.footerLink}>Terms</Text>
            </TouchableOpacity>
            <Text style={s.footerDot}>·</Text>
            <TouchableOpacity style={s.footerLinkBtn}>
              <Text style={s.footerLink}>Privacy</Text>
            </TouchableOpacity>
            <Text style={s.footerDot}>·</Text>
            <TouchableOpacity style={s.footerLinkBtn}>
              <Text style={s.footerLink}>Help</Text>
            </TouchableOpacity>
          </View>
        )}
        {cfg.version ? (
          <Text style={s.version}>{cfg.version}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const CARD_W = (SCREEN_W - 48) / 2; // 2 columns with 16px padding each side + 16px gap

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { paddingBottom: 40 },

  // announcement banner
  banner: {
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  bannerText: {
    color: "#fff", fontSize: 13, fontWeight: "600",
    textAlign: "center", lineHeight: 18,
  },

  // hero
  hero: {
    alignItems: "center",
    paddingTop: 48, paddingBottom: 28,
    paddingHorizontal: 24,
  },
  heroEmoji: { fontSize: 72, marginBottom: 20 },
  heroTitle: {
    fontSize: 28, fontWeight: "900", color: "#0F172A",
    textAlign: "center", lineHeight: 36, marginBottom: 10,
  },
  heroSub: {
    fontSize: 15, color: "#64748B",
    textAlign: "center", lineHeight: 22, paddingHorizontal: 8,
  },

  // stats
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  statCard: {
    flex: 1, alignItems: "center",
    paddingVertical: 16,
    borderRightWidth: 1, borderRightColor: "#F1F5F9",
  },
  statValue: { fontSize: 18, fontWeight: "900", color: "#2563EB" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "500" },

  // CTAs
  ctaWrap: { paddingHorizontal: 16, marginBottom: 32 },

  // features
  featuresHeading: {
    fontSize: 17, fontWeight: "800", color: "#0F172A",
    paddingHorizontal: 16, marginBottom: 12,
  },
  featuresGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 16, gap: 12,
    marginBottom: 32,
  },
  featureCard: {
    width: CARD_W,
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#E2E8F0",
    padding: 14,
  },
  featureIcon: { fontSize: 28, marginBottom: 8 },
  featureTitle: { fontSize: 13, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  featureDesc: { fontSize: 12, color: "#64748B", lineHeight: 17 },

  // footer
  footer: { alignItems: "center", paddingHorizontal: 16 },
  footerLinks: {
    flexDirection: "row", alignItems: "center",
    flexWrap: "wrap", justifyContent: "center", gap: 4,
    marginBottom: 8,
  },
  footerLinkBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  footerLink: { fontSize: 12, color: "#2563EB" },
  footerDot: { fontSize: 12, color: "#CBD5E1" },
  version: { fontSize: 11, color: "#CBD5E1" },
});
