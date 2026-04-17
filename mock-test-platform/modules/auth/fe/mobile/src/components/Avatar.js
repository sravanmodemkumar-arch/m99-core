import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

const SIZES = { sm: 32, md: 48, lg: 80 };

export default function Avatar({ name, photo, size = "md", style }) {
  const dim = SIZES[size] || SIZES.md;
  const initials = (name || "U")[0].toUpperCase();
  return (
    <View style={[s.base, { width: dim, height: dim, borderRadius: dim / 2 }, style]}>
      {photo
        ? <Image source={{ uri: photo }} style={{ width: dim, height: dim, borderRadius: dim / 2 }} />
        : <Text style={[s.initials, { fontSize: dim * 0.38 }]}>{initials}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  base: { backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initials: { color: "#fff", fontWeight: "700" },
});
