import React, { useRef, useState } from "react";
import { Modal, View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from "react-native";
import Btn from "./Btn.js";

const DEFAULT_SECTIONS = [
  { icon: "🤖", heading: "AI-Generated Content", body: "All questions, explanations, mock tests, and study material are generated using Artificial Intelligence for practice purposes only. This is not official exam content." },
  { icon: "⚠️", heading: "Accuracy Disclaimer", body: "AI-generated content may contain errors or inaccuracies. Always verify facts from official government sources before your exam." },
  { icon: "📋", heading: "Exam Pattern Notice", body: "Mock tests are modelled on publicly available syllabi and previous year patterns. The actual exam may differ. This platform has no relationship with official examination authorities." },
  { icon: "🔒", heading: "Your Data", body: "Your answers, scores, and usage data are stored securely and used only to generate performance reports. Not shared with third parties." },
];

export default function ConsentModal({ visible, config, onAgree }) {
  const cc = config || {};
  const sections = cc.sections?.length ? cc.sections : DEFAULT_SECTIONS;
  const [scrolled, setScrolled] = useState(false);
  const [checked, setChecked] = useState(false);

  function onScroll({ nativeEvent: e }) {
    if (!scrolled && e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 40) {
      setScrolled(true);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerRow}>
              <Text style={s.headerIcon}>{cc.icon || "📋"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{cc.title || "Content Disclosure Notice"}</Text>
                <Text style={s.subtitle}>{cc.subtitle || "AI-generated content — please read before continuing"}</Text>
              </View>
            </View>
            <View style={s.versionBadge}>
              <Text style={s.versionText}>Version {cc.version || "1.0"}</Text>
            </View>
          </View>

          {/* Body */}
          <ScrollView style={s.body} onScroll={onScroll} scrollEventThrottle={16}>
            {sections.map((sec, i) => (
              <View key={i} style={s.section}>
                <View style={s.secHeader}>
                  <Text style={s.secIcon}>{sec.icon}</Text>
                  <Text style={s.secHeading}>{sec.heading}</Text>
                </View>
                <Text style={s.secBody}>{sec.body}</Text>
              </View>
            ))}
            {cc.official_sources?.length ? (
              <View style={s.sourcesWrap}>
                <Text style={s.sourcesTitle}>Official Sources</Text>
                {cc.official_sources.map((src, i) => (
                  <TouchableOpacity key={i} style={s.sourceLink} onPress={() => Linking.openURL(src.url)}>
                    <Text style={s.sourceLinkText}>🔗 {src.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {cc.footer ? <Text style={s.footer}>{cc.footer}</Text> : null}
            {!scrolled ? <Text style={s.scrollHint}>↓ Scroll to read all before agreeing</Text> : null}
          </ScrollView>

          {/* Footer */}
          <View style={s.foot}>
            <TouchableOpacity
              style={[s.checkRow, !scrolled && s.checkDisabled]}
              onPress={() => scrolled && setChecked(p => !p)}
              activeOpacity={scrolled ? 0.7 : 1}
            >
              <View style={[s.checkbox, checked && s.checkboxChecked]}>
                {checked ? <Text style={s.checkmark}>✓</Text> : null}
              </View>
              <Text style={[s.checkLabel, !scrolled && { opacity: 0.4 }]}>
                {cc.checkbox_label || "I understand all content is AI-generated and for practice only."}
              </Text>
            </TouchableOpacity>
            <Btn label={cc.agree_label || "I Agree & Continue"} onPress={onAgree} disabled={!checked || !scrolled} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", flex: 0 },
  header: { padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerIcon: { fontSize: 28 },
  title: { fontSize: 16, fontWeight: "800", color: "#0F172A", lineHeight: 22 },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 2 },
  versionBadge: { marginTop: 10, alignSelf: "flex-start", backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  versionText: { fontSize: 10, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 },
  body: { paddingHorizontal: 20 },
  section: { marginVertical: 12, padding: 14, backgroundColor: "#F8FAFC", borderRadius: 10, borderLeftWidth: 3, borderLeftColor: "#2563EB" },
  secHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  secIcon: { fontSize: 18 },
  secHeading: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  secBody: { fontSize: 13, color: "#64748B", lineHeight: 20 },
  sourcesWrap: { marginTop: 16, marginBottom: 8 },
  sourcesTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: "#64748B", marginBottom: 8 },
  sourceLink: { padding: 12, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, marginBottom: 6 },
  sourceLinkText: { fontSize: 13, color: "#2563EB" },
  footer: { fontSize: 12, color: "#94A3B8", lineHeight: 18, padding: 14, backgroundColor: "#F8FAFC", borderRadius: 10, marginTop: 12, marginBottom: 20 },
  scrollHint: { textAlign: "center", fontSize: 12, color: "#94A3B8", paddingVertical: 16 },
  foot: { padding: 20, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  checkDisabled: { opacity: 0.5 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  checkboxChecked: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "900" },
  checkLabel: { flex: 1, fontSize: 13, color: "#334155", lineHeight: 19 },
});
