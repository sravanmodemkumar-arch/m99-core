import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "https://api.yourplatform.com";

export default function LoginScreen({ navigation }) {
  const [phone,   setPhone]   = useState("");
  const [otp,     setOtp]     = useState("");
  const [step,    setStep]    = useState("phone");
  const [loading, setLoading] = useState(false);
  const otpRef = useRef(null);

  async function requestOtp() {
    const p = phone.trim();
    if (p.length < 10) { Alert.alert("Invalid phone", "Enter a 10-digit mobile number."); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/auth/otp/request`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 200);
    } catch (e) { Alert.alert("Error", e.message || "Could not send OTP."); }
    finally { setLoading(false); }
  }

  async function verifyOtp() {
    const p = phone.trim(), o = otp.trim();
    if (o.length < 4) { Alert.alert("Invalid OTP"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/auth/otp/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p, otp: o }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      // Verify admin role via /admin/me
      const meRes = await fetch(`${BASE_URL}/admin/me`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (!meRes.ok) { Alert.alert("Access Denied", "You do not have admin access."); return; }
      const me = await meRes.json();

      await AsyncStorage.setItem("admin_token", data.token);
      await AsyncStorage.setItem("admin_role",  me.role);
      await AsyncStorage.setItem("admin_tenant", me.tenant_id);
      navigation.replace("Main");
    } catch (e) { Alert.alert("Failed", e.message || "Invalid OTP."); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={s.card}>
        <View style={s.brand}>
          <Text style={s.icon}>⚙️</Text>
          <Text style={s.title}>Admin Panel</Text>
          <Text style={s.sub}>Mock Test Platform</Text>
        </View>

        {step === "phone" ? (
          <>
            <Text style={s.lbl}>Mobile Number</Text>
            <View style={s.row}>
              <Text style={s.prefix}>+91</Text>
              <TextInput style={s.inp} placeholder="10-digit number" placeholderTextColor="#aaa"
                keyboardType="phone-pad" maxLength={10} value={phone} onChangeText={setPhone}
                onSubmitEditing={requestOtp} returnKeyType="next" autoFocus />
            </View>
            <TouchableOpacity style={[s.btn, loading && s.dis]} onPress={requestOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.lbl}>OTP</Text>
            <Text style={s.hint}>Sent to +91 {phone}  <Text style={s.link} onPress={() => setStep("phone")}>Change</Text></Text>
            <TextInput ref={otpRef} style={[s.inp, s.otpInp]} placeholder="Enter OTP"
              placeholderTextColor="#aaa" keyboardType="number-pad" maxLength={6}
              value={otp} onChangeText={setOtp} onSubmitEditing={verifyOtp} />
            <TouchableOpacity style={[s.btn, loading && s.dis]} onPress={verifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Verify & Enter</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.resend} onPress={requestOtp} disabled={loading}>
              <Text style={s.link}>Resend OTP</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex:1, backgroundColor:"#1a237e", justifyContent:"center", alignItems:"center", padding:20 },
  card:   { width:"100%", maxWidth:400, backgroundColor:"#fff", borderRadius:16, padding:28, elevation:8 },
  brand:  { alignItems:"center", marginBottom:24 },
  icon:   { fontSize:44, marginBottom:6 },
  title:  { fontSize:22, fontWeight:"900", color:"#1a237e" },
  sub:    { fontSize:12, color:"#8a9ab7", marginTop:2 },
  lbl:    { fontSize:13, fontWeight:"800", color:"#1a2a4a", marginBottom:8 },
  row:    { flexDirection:"row", alignItems:"center", borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, marginBottom:16, overflow:"hidden" },
  prefix: { paddingHorizontal:12, fontSize:14, fontWeight:"700", color:"#5c6b8a", borderRightWidth:1, borderRightColor:"#c0c8d8", backgroundColor:"#f8f9ff", paddingVertical:13 },
  inp:    { flex:1, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:"#1a2a4a" },
  otpInp: { borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, marginBottom:16, textAlign:"center", fontSize:22, fontWeight:"900", letterSpacing:6 },
  hint:   { fontSize:12, color:"#8a9ab7", marginBottom:12 },
  link:   { color:"#1565c0", fontWeight:"700" },
  btn:    { backgroundColor:"#1a237e", borderRadius:10, paddingVertical:15, alignItems:"center" },
  dis:    { opacity:0.6 },
  btnT:   { color:"#fff", fontSize:15, fontWeight:"800" },
  resend: { marginTop:14, alignItems:"center" },
});
