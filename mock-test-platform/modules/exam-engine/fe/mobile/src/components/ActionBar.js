import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function ActionBar({ onPrev, onNext, onMark, onSaveNext, isFirst, isLast, isMarked, isAnswered }) {
  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={[styles.btn, styles.navBtn, isFirst && styles.btnDisabled]}
        onPress={onPrev}
        disabled={isFirst}
      >
        <Text style={[styles.btnTxt, isFirst && styles.btnTxtDisabled]}>← Prev</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.markBtn, isMarked && styles.markBtnActive]}
        onPress={onMark}
      >
        <Text style={[styles.btnTxt, isMarked && styles.markBtnTxt]}>
          {isMarked ? "★ Marked" : "☆ Mark"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.saveBtn]}
        onPress={onSaveNext}
      >
        <Text style={[styles.btnTxt, styles.saveBtnTxt]}>
          {isAnswered ? (isLast ? "Submit" : "Save & Next") : (isLast ? "Skip & Submit" : "Skip")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.navBtn, isLast && styles.btnDisabled]}
        onPress={onNext}
        disabled={isLast}
      >
        <Text style={[styles.btnTxt, isLast && styles.btnTxtDisabled]}>Next →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:          { flexDirection: "row", gap: 8, padding: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e0e4ed" },
  btn:          { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  btnTxt:       { fontSize: 13, fontWeight: "700", color: "#1a2a4a" },
  navBtn:       { backgroundColor: "#f0f2f5", borderWidth: 1, borderColor: "#d0d9f0" },
  btnDisabled:  { opacity: 0.35 },
  btnTxtDisabled: { color: "#999" },
  markBtn:      { backgroundColor: "#f3e5f5", borderWidth: 1, borderColor: "#ce93d8" },
  markBtnActive:{ backgroundColor: "#7b1fa2", borderColor: "#7b1fa2" },
  markBtnTxt:   { color: "#fff" },
  saveBtn:      { backgroundColor: "#1565c0", flex: 1.5 },
  saveBtnTxt:   { color: "#fff", fontSize: 13, fontWeight: "800" },
});
