import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ExamTimer({ duration, elapsed: initialElapsed, onTick, onExpire, vars }) {
  const [elapsed, setElapsed] = useState(initialElapsed || 0);
  const ref = useRef(null);

  useEffect(() => {
    ref.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        onTick?.(next);
        if (next >= duration) {
          clearInterval(ref.current);
          onExpire?.();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(ref.current);
  }, []);

  const remaining = Math.max(0, duration - elapsed);
  const warn = remaining < 300;
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const label = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;

  return (
    <View style={[styles(vars).wrap, warn && styles(vars).warnWrap]}>
      <Text style={[styles(vars).text, warn && styles(vars).warnText]}>{label}</Text>
    </View>
  );
}

const styles = (v) => StyleSheet.create({
  wrap:     { backgroundColor: v.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: v.border },
  warnWrap: { borderColor: "#DC2626" },
  text:     { fontSize: 18, fontWeight: "800", color: v.text, fontVariant: ["tabular-nums"], letterSpacing: 1 },
  warnText: { color: "#DC2626" },
});
