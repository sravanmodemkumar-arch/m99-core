import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, Modal, ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getConfig, saveConfig, DEFAULTS, resetConfigCache } from "../../../../../shared/config.js";

export default function LoginScreen({ navigation }) {
  const [phone,   setPhone]   = useState("");
  const [otp,     setOtp]     = useState("");
  const [step,    setStep]    = useState("phone");
  const [loading, setLoading] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgVals, setCfgVals] = useState(null);
  const otpRef = useRef(null);

  async function openSettings() {
    const c = await getConfig();
    setCfgVals({ ...c });
    setCfgOpen(true);
  }

  async function saveSettings() {
    await saveConfig(cfgVals);
    resetConfigCache();
    setCfgOpen(false);
    Alert.alert("Saved", "Server config updated.");
  }

  async function requestOtp() {
    const p = phone.trim();
    if (p.length < 10) { Alert.alert("Invalid phone", "Enter a 10-digit number."); return; }
    setLoading(true);
    try {
      const { auth_base } = await getConfig();
      const res  = await fetch(`${auth_base}/auth/otp/request`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 200);
    } catch (e) {
      Alert.alert("Error", e.message || "Could not send OTP.");
    } finally { setLoading(false); }
  }

  async function verifyOtp() {
    const p = phone.trim(), o = otp.trim();
    if (o.length < 4) { Alert.alert("Invalid OTP"); return; }
    setLoading(true);
    try {
      const { auth_base } = await getConfig();
      const res  = await fetch(`${auth_base}/auth/otp/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p, otp: o }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await AsyncStorage.setItem("auth_token", data.token);
      await AsyncStorage.setItem("auth_name",  data.name || p);
      navigation.replace("Home");
    } catch (e) {
      Alert.alert("Failed", e.message || "Invalid OTP.");
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={s.card}>
        <TouchableOpacity style={s.gear} onPress={openSettings}>
          <Text style={s.gearTxt}>⚙</Text>
        </TouchableOpacity>

        <View style={s.brand}>
          <Text style={s.brandIcon}>📝</Text>
          <Text style={s.brandName}>Mock Tests</Text>
          <Text style={s.brandSub}>Mock Test Platform</Text>
        </View>

        {step === "phone" ? (
          <>
            <Text style={s.lbl}>Mobile Number</Text>
            <View style={s.row}>
              <Text style={s.prefix}>+91</Text>
              <TextInput style={s.inp} placeholder="10-digit number" placeholderTextColor="#aaa"
                keyboardType="phone-pad" maxLength={10} value={phone}
                onChangeText={setPhone} onSubmitEditing={requestOtp} returnKeyType="next" autoFocus />
            </View>
            <TouchableOpacity style={[s.btn, loading && s.dis]} onPress={requestOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.lbl}>Enter OTP</Text>
            <Text style={s.hint}>Sent to +91 {phone}  <Text style={s.link} onPress={() => setStep("phone")}>Change</Text></Text>
            <TextInput ref={otpRef} style={[s.inp, s.otpInp]} placeholder="OTP"
              placeholderTextColor="#aaa" keyboardType="number-pad" maxLength={6}
              value={otp} onChangeText={setOtp} onSubmitEditing={verifyOtp} returnKeyType="done" />
            <TouchableOpacity style={[s.btn, loading && s.dis]} onPress={verifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Verify & Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.resend} onPress={requestOtp} disabled={loading}>
              <Text style={s.link}>Resend OTP</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Server config modal ── */}
      <Modal visible={cfgOpen} transparent animationType="slide" onRequestClose={() => setCfgOpen(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Server Config</Text>
            <Text style={s.modalNote}>Changes saved to this device only. Edit modules/shared/config.js to update defaults.</Text>
            <ScrollView>
              {cfgVals && Object.entries(DEFAULTS).map(([key]) => (
                <View key={key} style={s.cfgRow}>
                  <Text style={s.cfgLbl}>{key}</Text>
                  <TextInput
                    style={s.cfgInp}
                    value={cfgVals[key] || ""}
                    onChangeText={v => setCfgVals(c => ({ ...c, [key]: v }))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={DEFAULTS[key]}
                    placeholderTextColor="#bbb"
                  />
                </View>
              ))}
            </ScrollView>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setCfgOpen(false)}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveSettings}>
                <Text style={s.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const BLUE = "#1565c0";
const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:"#f0f2f7", justifyContent:"center", alignItems:"center", padding:20 },
  card:       { width:"100%", maxWidth:400, backgroundColor:"#fff", borderRadius:16, padding:28, elevation:4, shadowColor:"#000", shadowOpacity:0.1, shadowRadius:12, shadowOffset:{width:0,height:4} },
  gear:       { position:"absolute", top:14, right:14, zIndex:10, padding:6 },
  gearTxt:    { fontSize:20, color:"#bbb" },
  brand:      { alignItems:"center", marginBottom:28 },
  brandIcon:  { fontSize:42, marginBottom:6 },
  brandName:  { fontSize:22, fontWeight:"900", color:"#1a2a4a" },
  brandSub:   { fontSize:12, color:"#8a9ab7", marginTop:2 },
  lbl:        { fontSize:13, fontWeight:"800", color:"#1a2a4a", marginBottom:8 },
  row:        { flexDirection:"row", alignItems:"center", borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, marginBottom:18, overflow:"hidden" },
  prefix:     { paddingHorizontal:12, fontSize:14, fontWeight:"700", color:"#5c6b8a", borderRightWidth:1, borderRightColor:"#c0c8d8", backgroundColor:"#f8f9ff", paddingVertical:13 },
  inp:        { flex:1, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:"#1a2a4a" },
  otpInp:     { borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, marginBottom:18, textAlign:"center", fontSize:22, fontWeight:"900", letterSpacing:6 },
  hint:       { fontSize:12, color:"#8a9ab7", marginBottom:12 },
  link:       { color:BLUE, fontWeight:"700" },
  btn:        { backgroundColor:BLUE, borderRadius:10, paddingVertical:15, alignItems:"center" },
  dis:        { opacity:0.6 },
  btnT:       { color:"#fff", fontSize:15, fontWeight:"800" },
  resend:     { marginTop:14, alignItems:"center" },
  overlay:    { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },
  modal:      { backgroundColor:"#fff", borderTopLeftRadius:20, borderTopRightRadius:20, padding:24, maxHeight:"80%" },
  modalTitle: { fontSize:16, fontWeight:"900", color:"#1a2a4a", marginBottom:6 },
  modalNote:  { fontSize:11, color:"#8a9ab7", marginBottom:16 },
  cfgRow:     { marginBottom:14 },
  cfgLbl:     { fontSize:11, fontWeight:"800", color:"#5c6b8a", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 },
  cfgInp:     { borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:8, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#1a2a4a", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  modalBtns:  { flexDirection:"row", gap:10, marginTop:16 },
  cancelBtn:  { flex:1, borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, paddingVertical:13, alignItems:"center" },
  cancelTxt:  { fontSize:14, fontWeight:"700", color:"#5c6b8a" },
  saveBtn:    { flex:1, backgroundColor:BLUE, borderRadius:10, paddingVertical:13, alignItems:"center" },
  saveTxt:    { fontSize:14, fontWeight:"800", color:"#fff" },
});
