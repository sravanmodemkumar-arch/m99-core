import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Platform,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, ScrollView,
} from "react-native";
import { adminGet, adminPost, adminDelete, fmtDate } from "../utils/api";

export default function SubscriptionsScreen({ navigation }) {
  const [subs,      setSubs]      = useState([]);
  const [exams,     setExams]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [grantModal,setGrantModal]= useState(false);
  const [form,      setForm]      = useState({ uid:"", plan:"pro", expires_days:"30", exams:[] });
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [subsRes, examsRes] = await Promise.all([
        adminGet("/subscriptions").catch(() => ({ subscriptions: [] })),
        adminGet("/exams").catch(() => ({ exams: [] })),
      ]);
      setSubs(subsRes.subscriptions || []);
      setExams((examsRes.exams || []).filter(e => e.status === "published"));
    } catch (e) {
      if (e.status === 401) { navigation.replace("Login"); return; }
      Alert.alert("Error", e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }

  async function grant() {
    if (!form.uid.trim()) { Alert.alert("UID required"); return; }
    setSaving(true);
    try {
      const expires_at = Date.now() + parseInt(form.expires_days || "30") * 86400 * 1000;
      await adminPost("/subscriptions", { uid: form.uid.trim(), plan: form.plan, expires_at, exams: form.exams });
      setGrantModal(false);
      setForm({ uid:"", plan:"pro", expires_days:"30", exams:[] });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  }

  async function revoke(uid) {
    Alert.alert("Revoke Subscription", "This will remove all exam access for this user.", [
      { text: "Cancel", style: "cancel" },
      { text: "Revoke", style: "destructive", onPress: async () => {
        try {
          await adminDelete(`/subscriptions/${uid}`);
          load();
        } catch (e) { Alert.alert("Error", e.message); }
      }},
    ]);
  }

  function toggleExam(id) {
    setForm(f => ({
      ...f,
      exams: f.exams.includes(id) ? f.exams.filter(e => e !== id) : [...f.exams, id],
    }));
  }

  function renderItem({ item: sub }) {
    const expired = sub.expires_at && sub.expires_at < Date.now();
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.uidBox}><Text style={s.uid}>{sub.uid?.slice(-12) || "—"}</Text></View>
          <View style={[s.planBadge, expired && s.expired]}>
            <Text style={[s.planT, expired && s.expiredT]}>{sub.plan || "pro"}{expired ? " (expired)" : ""}</Text>
          </View>
        </View>
        <Text style={s.expiry}>Expires: {fmtDate(sub.expires_at)}</Text>
        {sub.exams?.length > 0 && (
          <Text style={s.examsT}>{sub.exams.length} exam(s) unlocked</Text>
        )}
        <TouchableOpacity style={s.revokeBtn} onPress={() => revoke(sub.uid)}>
          <Text style={s.revokeT}>Revoke</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.hdr}>
        <Text style={s.hTitle}>🔑 Subscriptions</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setGrantModal(true)}>
          <Text style={s.addT}>+ Grant</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>
      ) : (
        <FlatList
          data={subs} keyExtractor={s => s.uid} renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1a237e" />}
          ListEmptyComponent={<Text style={s.empty}>No subscriptions yet</Text>}
        />
      )}

      {/* Grant Modal */}
      <Modal visible={grantModal} transparent animationType="slide" onRequestClose={() => setGrantModal(false)}>
        <View style={s.overlay}>
          <ScrollView style={s.modal} keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>Grant Subscription</Text>
            <Text style={s.lbl}>User UID</Text>
            <TextInput style={s.inp} placeholder="e.g. user-uid-0001" placeholderTextColor="#aaa"
              value={form.uid} onChangeText={v => setForm(f => ({ ...f, uid: v }))} autoFocus />
            <Text style={s.lbl}>Plan</Text>
            <View style={s.planRow}>
              {["free","pro","premium"].map(p => (
                <TouchableOpacity key={p} style={[s.planOpt, form.plan === p && s.planOptSel]} onPress={() => setForm(f => ({ ...f, plan: p }))}>
                  <Text style={[s.planOptT, form.plan === p && s.planOptTSel]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>Duration (days)</Text>
            <TextInput style={s.inp} keyboardType="number-pad" value={form.expires_days}
              onChangeText={v => setForm(f => ({ ...f, expires_days: v }))} />
            <Text style={s.lbl}>Exams (tap to toggle)</Text>
            {exams.map(e => (
              <TouchableOpacity key={e.id} style={[s.examOpt, form.exams.includes(e.id) && s.examOptSel]} onPress={() => toggleExam(e.id)}>
                <Text style={[s.examOptT, form.exams.includes(e.id) && s.examOptTSel]} numberOfLines={1}>{e.title}</Text>
                {form.exams.includes(e.id) && <Text style={s.checkMark}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.grantBtn, saving && s.grantBtnDis]} onPress={grant} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.grantT}>Grant Access</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setGrantModal(false)} disabled={saving}>
              <Text style={s.cancelT}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:"#f0f2f7" },
  center:      { flex:1, justifyContent:"center", alignItems:"center" },
  hdr:         { backgroundColor:"#1a237e", paddingHorizontal:20, paddingTop: Platform.OS === "ios" ? 54 : 14, paddingBottom:16, flexDirection:"row", justifyContent:"space-between", alignItems:"flex-end" },
  hTitle:      { color:"#fff", fontSize:18, fontWeight:"900" },
  addBtn:      { backgroundColor:"rgba(255,255,255,0.2)", paddingHorizontal:14, paddingVertical:7, borderRadius:8, borderWidth:1.5, borderColor:"rgba(255,255,255,0.4)" },
  addT:        { color:"#fff", fontWeight:"800", fontSize:13 },
  list:        { padding:14, gap:10 },
  empty:       { textAlign:"center", color:"#aaa", marginTop:40 },
  card:        { backgroundColor:"#fff", borderRadius:12, padding:14, elevation:2, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:2} },
  cardTop:     { flexDirection:"row", alignItems:"center", gap:8, marginBottom:8 },
  uidBox:      { backgroundColor:"#f0f2f7", paddingHorizontal:10, paddingVertical:4, borderRadius:7 },
  uid:         { fontSize:11, fontFamily:"monospace", color:"#5c6b8a" },
  planBadge:   { backgroundColor:"#e8eaf6", paddingHorizontal:10, paddingVertical:3, borderRadius:999 },
  planT:       { fontSize:11, fontWeight:"800", color:"#1a237e" },
  expired:     { backgroundColor:"#ffebee" },
  expiredT:    { color:"#c62828" },
  expiry:      { fontSize:12, color:"#8a9ab7", marginBottom:4 },
  examsT:      { fontSize:12, color:"#2e7d32", fontWeight:"700", marginBottom:8 },
  revokeBtn:   { backgroundColor:"#ffebee", borderRadius:8, paddingVertical:9, alignItems:"center" },
  revokeT:     { color:"#c62828", fontWeight:"800", fontSize:13 },
  overlay:     { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },
  modal:       { backgroundColor:"#fff", borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, maxHeight:"90%", flexGrow:0 },
  modalTitle:  { fontSize:17, fontWeight:"900", color:"#1a2a4a", marginBottom:16 },
  lbl:         { fontSize:12, fontWeight:"800", color:"#5c6b8a", marginTop:12, marginBottom:6 },
  inp:         { borderWidth:1.5, borderColor:"#c0c8d8", borderRadius:10, paddingHorizontal:14, paddingVertical:11, fontSize:14, color:"#1a2a4a", marginBottom:4 },
  planRow:     { flexDirection:"row", gap:8 },
  planOpt:     { flex:1, padding:11, borderRadius:9, borderWidth:1.5, borderColor:"#e0e4ed", alignItems:"center" },
  planOptSel:  { borderColor:"#1a237e", backgroundColor:"#e8eaf6" },
  planOptT:    { fontSize:13, fontWeight:"700", color:"#5c6b8a" },
  planOptTSel: { color:"#1a237e" },
  examOpt:     { flexDirection:"row", alignItems:"center", justifyContent:"space-between", padding:12, borderRadius:10, borderWidth:1.5, borderColor:"#e0e4ed", marginBottom:6 },
  examOptSel:  { borderColor:"#1a237e", backgroundColor:"#e8eaf6" },
  examOptT:    { flex:1, fontSize:13, fontWeight:"600", color:"#1a2a4a" },
  examOptTSel: { color:"#1a237e", fontWeight:"800" },
  checkMark:   { color:"#1a237e", fontWeight:"900", marginLeft:8 },
  grantBtn:    { backgroundColor:"#1a237e", borderRadius:10, paddingVertical:14, alignItems:"center", marginTop:16 },
  grantBtnDis: { opacity:0.6 },
  grantT:      { color:"#fff", fontWeight:"800", fontSize:14 },
  cancelBtn:   { padding:14, alignItems:"center", marginBottom:8 },
  cancelT:     { color:"#90a4ae", fontWeight:"700", fontSize:14 },
});
