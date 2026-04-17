import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";

export default function SectionTabs({ sections, activeId, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wrap} contentContainerStyle={styles.content}>
      {sections.map(sec => {
        const active = sec.id === activeId;
        return (
          <TouchableOpacity
            key={sec.id}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onSelect(sec.id)}
          >
            <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{sec.label}</Text>
            <View style={styles.counters}>
              <Text style={styles.cntTxt}>{sec.answered}/{sec.total}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap:    { backgroundColor: "#1a2e5a", flexShrink: 0 },
  content: { paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  tab:     {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center",
  },
  tabActive: { backgroundColor: "#fff" },
  tabTxt:    { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.75)" },
  tabTxtActive: { color: "#1565c0" },
  counters:  { marginTop: 2 },
  cntTxt:    { fontSize: 10, color: "rgba(255,255,255,0.5)" },
});
