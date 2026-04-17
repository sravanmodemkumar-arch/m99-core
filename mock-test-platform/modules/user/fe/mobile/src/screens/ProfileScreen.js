import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, RefreshControl, Alert, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { userGet, userPut } from "../utils/api";

export default function ProfileScreen({ navigation }) {
  const [profile,    setProfile]    = useState(null);
  const [name,       setName]       = useState("");
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const p = await userGet("/me");
      setProfile(p);
      setName(p.display_name || "");
    } catch (e) {
      if (e.status === 401) { await AsyncStorage.multiRemove(["auth_token","auth_name"]); navigation.replace("Login"); }
      else Alert.alert("Error", e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }

  async function save() {
    const n = name.trim();
    if (!n) { Alert.alert("Name cannot be empty"); return; }
    setSaving(true);
    try {
      await userPut("/me", { display_name: n });
      setProfile(p => ({ ...p, display_name: n }));
      setEditing(false);
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  }

  async function logout() {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => {
        await AsyncStorage.multiRemove(["auth_token", "auth_name"]);
        navigation.replace("Login");
      }},
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>;

  const initial  = (profile?.display_name || profile?.phone || "?")[0].toUpperCase();
  const color    = profile?.avatar_color || "#1a237e";
  const sub      = profile?.subscription;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1a237e" />}>

      {/* Header */}
      <View style={s.hdr}>
        <View style={[s.avatar, { backgroundColor: color }]}>
          <Text style={s.avatarLetter}>{initial}</Text>
        </View>
        <View style={s.hdrInfo}>
          <Text style={s.hdrName}>{profile?.display_name || profile?.phone || "—"}</Text>
          <View style={[s.subBadge, { backgroundColor: sub?.active ? "#e8f5e9" : "#f3f4f6" }]}>
            <Text style={[s.subBadgeTxt, { color: sub?.active ? "#2e7d32" : "#9ca3af" }]}>
              {sub?.active ? (sub.plan || "Active") : "No plan"}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={s.logBtn} onPress={logout}>
          <Text style={s.logTxt}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Edit name */}
      <View style={s.card}>
        <Text style={s.sectionHd}>Display Name</Text>
        {editing ? (
          <>
            <TextInput style={s.input} value={name} onChangeText={setName} maxLength={60}
              placeholder="Your name" autoFocus returnKeyType="done" onSubmitEditing={save} />
            <View style={s.row}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setEditing(false); setName(profile?.display_name || ""); }}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && s.dis]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveTxt}>Save</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={s.editRow} onPress={() => setEditing(true)}>
            <Text style={s.editVal}>{profile?.display_name || "Tap to set name"}</Text>
            <Text style={s.editIcon}>✏️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Details */}
      <View style={s.card}>
        <Text style={s.sectionHd}>Account</Text>
        <InfoRow label="Phone"   value={profile?.phone ? `+91 ${profile.phone}` : "—"} />
        <InfoRow label="Joined"  value={profile?.joined_at ? new Date(profile.joined_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—"} />
        <InfoRow label="Plan"    value={sub?.plan || (sub ? "Active" : "None")} />
      </View>

      {/* Quick nav */}
      <View style={s.quickGrid}>
        <QuickBtn icon="📋" label="History"   onPress={() => navigation.navigate("History")} />
        <QuickBtn icon="📊" label="Analytics" onPress={() => navigation.navigate("Analytics")} />
        <QuickBtn icon="🎟️" label="My Plan"   onPress={() => navigation.navigate("Subscription")} />
      </View>

    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLbl}>{label}</Text>
      <Text style={s.infoVal}>{value}</Text>
    </View>
  );
}

function QuickBtn({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.quickBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={s.quickIcon}>{icon}</Text>
      <Text style={s.quickLbl}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:"#f0f2f7" },
  center:      { flex:1, justifyContent:"center", alignItems:"center" },
  body:        { paddingBottom:32 },
  hdr:         { backgroundColor:"#1a237e", paddingHorizontal:20, paddingTop: Platform.OS==="ios"?54:14, paddingBottom:20, flexDirection:"row", alignItems:"center", gap:14 },
  avatar:      { width:56, height:56, borderRadius:28, justifyContent:"center", alignItems:"center" },
  avatarLetter:{ color:"#fff", fontSize:22, fontWeight:"900" },
  hdrInfo:     { flex:1 },
  hdrName:     { color:"#fff", fontSize:16, fontWeight:"900" },
  subBadge:    { alignSelf:"flex-start", borderRadius:6, paddingHorizontal:8, paddingVertical:2, marginTop:4 },
  subBadgeTxt: { fontSize:10, fontWeight:"800" },
  logBtn:      { borderWidth:1.5, borderColor:"rgba(255,255,255,0.4)", borderRadius:8, paddingHorizontal:10, paddingVertical:6 },
  logTxt:      { color:"#fff", fontSize:11, fontWeight:"700" },
  card:        { margin:12, marginBottom:0, backgroundColor:"#fff", borderRadius:14, padding:16, elevation:2, shadowColor:"#000", shadowOpacity:0.06, shadowRadius:6, shadowOffset:{width:0,height:2} },
  sectionHd:   { fontSize:10, fontWeight:"800", color:"#5c6b8a", textTransform:"uppercase", letterSpacing:1, marginBottom:12 },
  input:       { borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, paddingHorizontal:14, paddingVertical:11, fontSize:15, color:"#1a2a4a", marginBottom:10 },
  row:         { flexDirection:"row", gap:8 },
  cancelBtn:   { flex:1, borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, paddingVertical:11, alignItems:"center" },
  cancelTxt:   { fontSize:13, fontWeight:"700", color:"#5c6b8a" },
  saveBtn:     { flex:1, backgroundColor:"#1a237e", borderRadius:10, paddingVertical:11, alignItems:"center" },
  saveTxt:     { color:"#fff", fontSize:13, fontWeight:"800" },
  dis:         { opacity:0.6 },
  editRow:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  editVal:     { fontSize:15, color:"#1a2a4a", fontWeight:"600" },
  editIcon:    { fontSize:16 },
  infoRow:     { flexDirection:"row", justifyContent:"space-between", paddingVertical:8, borderBottomWidth:1, borderBottomColor:"#f0f2f7" },
  infoLbl:     { fontSize:13, color:"#5c6b8a", fontWeight:"600" },
  infoVal:     { fontSize:13, color:"#1a2a4a", fontWeight:"700" },
  quickGrid:   { flexDirection:"row", flexWrap:"wrap", gap:10, padding:12, paddingTop:12 },
  quickBtn:    { flex:1, minWidth:"30%", backgroundColor:"#fff", borderRadius:12, padding:14, alignItems:"center", elevation:2, shadowColor:"#000", shadowOpacity:0.06, shadowRadius:5, shadowOffset:{width:0,height:2} },
  quickIcon:   { fontSize:24, marginBottom:6 },
  quickLbl:    { fontSize:12, fontWeight:"800", color:"#1a2a4a" },
});
