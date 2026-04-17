import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL  = "https://api.yourdomain.com";   // same as api.js — replace per deployment
const AUTH_PFX  = "/auth";

export default function LoginScreen({ navigation }) {
  const [phone,   setPhone]   = useState("");
  const [otp,     setOtp]     = useState("");
  const [step,    setStep]    = useState("phone"); // "phone" | "otp"
  const [loading, setLoading] = useState(false);
  const otpRef = useRef(null);

  async function requestOtp() {
    const p = phone.trim();
    if (p.length < 10) { Alert.alert("Invalid phone", "Enter a valid 10-digit mobile number."); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}${AUTH_PFX}/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ phone: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 200);
    } catch (e) {
      Alert.alert("Error", e.message || "Could not send OTP. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    const p = phone.trim();
    const o = otp.trim();
    if (o.length < 4) { Alert.alert("Invalid OTP", "Enter the OTP sent to your phone."); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}${AUTH_PFX}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ phone: p, otp: o }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await AsyncStorage.setItem("auth_token", data.token);
      await AsyncStorage.setItem("auth_name",  data.name || p);
      navigation.replace("Home");
    } catch (e) {
      Alert.alert("Verification Failed", e.message || "Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={s.card}>
        {/* Logo / Brand */}
        <View style={s.brand}>
          <Text style={s.brandIcon}>📝</Text>
          <Text style={s.brandName}>Exam Engine</Text>
          <Text style={s.brandSub}>Mock Test Platform</Text>
        </View>

        {step === "phone" ? (
          <>
            <Text style={s.label}>Mobile Number</Text>
            <View style={s.inputRow}>
              <Text style={s.prefix}>+91</Text>
              <TextInput
                style={s.input}
                placeholder="10-digit mobile number"
                placeholderTextColor="#aaa"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                onSubmitEditing={requestOtp}
                returnKeyType="next"
                autoFocus
              />
            </View>
            <TouchableOpacity style={[s.btn, loading && s.btnDis]} onPress={requestOtp} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnTxt}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.label}>Enter OTP</Text>
            <Text style={s.otpHint}>Sent to +91 {phone}  <Text style={s.link} onPress={() => setStep("phone")}>Change</Text></Text>
            <TextInput
              ref={otpRef}
              style={[s.input, s.otpInput]}
              placeholder="4–6 digit OTP"
              placeholderTextColor="#aaa"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              onSubmitEditing={verifyOtp}
              returnKeyType="done"
            />
            <TouchableOpacity style={[s.btn, loading && s.btnDis]} onPress={verifyOtp} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnTxt}>Verify & Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.resendBtn} onPress={requestOtp} disabled={loading}>
              <Text style={s.resendTxt}>Resend OTP</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const BLUE = "#1565c0";
const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:"#f0f2f7", justifyContent:"center", alignItems:"center", padding:20 },
  card:       { width:"100%", maxWidth:400, backgroundColor:"#fff", borderRadius:16, padding:28, elevation:4, shadowColor:"#000", shadowOpacity:0.1, shadowRadius:12, shadowOffset:{width:0,height:4} },
  brand:      { alignItems:"center", marginBottom:28 },
  brandIcon:  { fontSize:42, marginBottom:6 },
  brandName:  { fontSize:22, fontWeight:"900", color:"#1a2a4a" },
  brandSub:   { fontSize:12, color:"#8a9ab7", marginTop:2 },
  label:      { fontSize:13, fontWeight:"800", color:"#1a2a4a", marginBottom:8 },
  inputRow:   { flexDirection:"row", alignItems:"center", borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, marginBottom:18, overflow:"hidden" },
  prefix:     { paddingHorizontal:12, fontSize:14, fontWeight:"700", color:"#5c6b8a", borderRightWidth:1, borderRightColor:"#c0c8d8", backgroundColor:"#f8f9ff", paddingVertical:13 },
  input:      { flex:1, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:"#1a2a4a" },
  otpInput:   { borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, marginBottom:18, textAlign:"center", fontSize:22, fontWeight:"900", letterSpacing:6 },
  otpHint:    { fontSize:12, color:"#8a9ab7", marginBottom:12 },
  link:       { color:BLUE, fontWeight:"700" },
  btn:        { backgroundColor:BLUE, borderRadius:10, paddingVertical:15, alignItems:"center" },
  btnDis:     { opacity:0.6 },
  btnTxt:     { color:"#fff", fontSize:15, fontWeight:"800" },
  resendBtn:  { marginTop:14, alignItems:"center" },
  resendTxt:  { color:BLUE, fontSize:13, fontWeight:"700" },
});
