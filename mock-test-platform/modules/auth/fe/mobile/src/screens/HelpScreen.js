import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Linking, StyleSheet } from "react-native";
import PageHeader from "../components/PageHeader.js";
import { api, getConfig } from "../utils/api.js";

const DEFAULT_FAQS = [
  { q: "How do I start a test?", a: "Go to Home, tap on a test module, and press Start Test. Your progress is saved automatically." },
  { q: "Can I pause a test?", a: "Yes. Your answers and timer are saved. Open the app and tap Resume to continue." },
  { q: "How is my score calculated?", a: "Each correct answer earns full marks. Wrong answers may have negative marking (-1/3). Unattempted questions score 0." },
  { q: "I forgot my password. What do I do?", a: "Tap Forgot Password on the login screen. Enter your registered phone or email to receive a reset OTP." },
  { q: "What is the Authenticator app?", a: "TOTP adds extra security. After password, enter a 6-digit code from Google Authenticator. Enable it in Settings → Security." },
  { q: "Why was my account locked?", a: "Too many failed login attempts trigger a temporary lock (usually 1 hour). Wait or use Forgot Password." },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.faqItem}>
      <TouchableOpacity style={s.faqQ} onPress={() => setOpen(p => !p)}>
        <Text style={s.faqQText}>{q}</Text>
        <Text style={s.faqArrow}>{open ? "∨" : "›"}</Text>
      </TouchableOpacity>
      {open && <Text style={s.faqA}>{a}</Text>}
    </View>
  );
}

export default function HelpScreen({ navigation }) {
  const [faqs, setFaqs] = useState(DEFAULT_FAQS);
  const [search, setSearch] = useState("");
  const [cfg, setCfg] = useState({});

  useEffect(() => {
    getConfig().then(setCfg);
    api("/auth/faqs").then(({ ok, data }) => { if (ok && data.faqs?.length) setFaqs(data.faqs); });
  }, []);

  const filtered = search
    ? faqs.filter(f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()))
    : faqs;

  return (
    <ScrollView style={s.wrap} keyboardShouldPersistTaps="handled">
      <PageHeader title="Help & FAQ" onBack={() => navigation.goBack()} />

      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search questions…" placeholderTextColor="#94A3B8" />
      </View>

      <View style={s.faqList}>
        {filtered.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
        {filtered.length === 0 && <Text style={s.noResult}>No results found.</Text>}
      </View>

      <View style={s.contactSection}>
        <Text style={s.contactTitle}>Contact Support</Text>
        {cfg.support?.whatsapp && (
          <TouchableOpacity style={s.contactCard} onPress={() => Linking.openURL(`https://wa.me/${cfg.support.whatsapp}`)}>
            <Text style={s.contactIcon}>💬</Text>
            <View>
              <Text style={s.contactName}>WhatsApp Support</Text>
              <Text style={s.contactDesc}>Usually replies within 1 hour</Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.contactCard} onPress={() => Linking.openURL(`mailto:${cfg.support?.email || "support@example.com"}`)}>
          <Text style={s.contactIcon}>📧</Text>
          <View>
            <Text style={s.contactName}>Email Support</Text>
            <Text style={s.contactDesc}>{cfg.support?.email || "support@example.com"}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  searchWrap: { flexDirection: "row", alignItems: "center", margin: 16, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 12 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: "#0F172A" },
  faqList: { paddingHorizontal: 16 },
  faqItem: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, marginBottom: 8, overflow: "hidden" },
  faqQ: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  faqQText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0F172A", lineHeight: 20 },
  faqArrow: { fontSize: 18, color: "#94A3B8", marginLeft: 8 },
  faqA: { fontSize: 13, color: "#64748B", lineHeight: 20, padding: 14, paddingTop: 0, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  noResult: { fontSize: 14, color: "#94A3B8", textAlign: "center", paddingVertical: 24 },
  contactSection: { padding: 16, paddingTop: 24 },
  contactTitle: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  contactCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, padding: 16, marginBottom: 10 },
  contactIcon: { fontSize: 28 },
  contactName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  contactDesc: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
});
