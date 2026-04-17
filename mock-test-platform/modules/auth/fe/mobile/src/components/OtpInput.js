import React, { useRef } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { handleOtpChange, handleOtpKey, otpFromValues } from "../../../shared/otp.js";

export default function OtpInput({ values, setValues, style }) {
  const refs = Array.from({ length: 6 }, () => useRef(null));

  return (
    <View style={[s.row, style]}>
      {values.map((v, i) => (
        <TextInput
          key={i}
          ref={refs[i]}
          style={s.box}
          value={v}
          maxLength={1}
          keyboardType="number-pad"
          textAlign="center"
          onChangeText={text => handleOtpChange(values, i, text, setValues, refs.map(r => r.current))}
          onKeyPress={({ nativeEvent }) => handleOtpKey(values, i, nativeEvent.key, setValues, refs.map(r => r.current))}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

export function emptyOtp() { return Array(6).fill(""); }
export function otpValue(values) { return otpFromValues(values); }

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, justifyContent: "center" },
  box: { width: 44, height: 52, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 8, fontSize: 20, fontWeight: "700", backgroundColor: "#fff" },
});
