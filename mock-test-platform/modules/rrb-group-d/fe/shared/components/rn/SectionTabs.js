import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";

export default function SectionTabs({ sections, activeId, onSwitch, vars }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles(vars).wrap}>
      {sections.map(s => {
        const active = s.id === activeId;
        return (
          <TouchableOpacity key={s.id} style={[styles(vars).tab, active && styles(vars).tabActive]} onPress={() => onSwitch(s.id)}>
            <Text style={[styles(vars).tabText, active && styles(vars).tabTextActive]}>
              {s.label} <Text style={styles(vars).count}>{s.answered}/{s.total}</Text>
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = (v) => StyleSheet.create({
  wrap:         { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: v.border, backgroundColor: v.surface },
  tab:          { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive:    { borderBottomColor: v.primary },
  tabText:      { fontSize: 14, fontWeight: "600", color: v.textMuted, whiteSpace: "nowrap" },
  tabTextActive:{ color: v.primary },
  count:        { fontSize: 12, fontWeight: "400", opacity: 0.7 },
});
