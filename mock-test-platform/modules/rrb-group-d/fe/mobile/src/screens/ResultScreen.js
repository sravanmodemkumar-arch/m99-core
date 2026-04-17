import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ResultCard from "../../../shared/components/rn/ResultCard.js";

const VARS = {
  text:      "#111827",
  textMuted: "#6B7280",
  surface:   "#FFFFFF",
  surface2:  "#F3F4F6",
  border:    "#E5E7EB",
  primary:   "#2563EB",
  bg:        "#F9FAFB",
};

export default function ResultScreen({ route, navigation }) {
  const { score, correct, wrong, skipped, total, pct, sections } = route.params;

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: VARS.bg }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <ResultCard
          result={{ score, correct, wrong, skipped, total, percentage: pct, sections }}
          onViewAnalysis={() => {/* TODO: open analysis webview */}}
          onGoHome={() => navigation.popToTop()}
          vars={VARS}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fill:    { flex: 1 },
  content: { padding: 16 },
});
