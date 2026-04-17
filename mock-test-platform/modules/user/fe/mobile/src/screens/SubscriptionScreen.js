import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Platform,
} from "react-native";
import { userGet, fmtDate } from "../utils/api";

export default function SubscriptionScreen({ navigation }) {
  const [sub,        setSub]        = useState(null);
  const [exams,      setExams]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const d = await userGet("/subscription");
      setSub(d.subscription);
      setExams(d.allowed_exams || []);
    } catch (e) {
      if (e.status === 401) { navigation.replace("Login"); return; }
      Alert.alert("Error", e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1a237e" />}>

      <View style={s.hdr}>
        <Text style={s.hTitle}>🎟️ My Plan</Text>
      </View>

      {!sub ? (
        <View style={s.noSub}>
          <Text style={s.noSubIcon}>🎟️</Text>
          <Text style={s.noSubTitle}>No Active Plan</Text>
          <Text style={s.noSubSub}>Contact your institute to activate a subscription.</Text>
        </View>
      ) : (
        <>
          {/* Status card */}
          <View style={[s.card, sub.active ? s.activeCard : s.expiredCard]}>
            <View style={s.cardRow}>
              <Text style={s.planIcon}>{sub.active ? "✅" : "⌛"}</Text>
              <View style={s.planInfo}>
                <Text style={s.planName}>{sub.plan || "Standard Plan"}</Text>
                <View style={[s.badge, { backgroundColor: sub.active ? "#e8f5e9" : "#fee2e2" }]}>
                  <Text style={[s.badgeTxt, { color: sub.active ? "#2e7d32" : "#c62828" }]}>
                    {sub.active ? "Active" : "Expired"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={s.detailRow}>
              <View style={s.detailItem}>
                <Text style={s.detailLbl}>Granted</Text>
                <Text style={s.detailVal}>{fmtDate(sub.granted_at)}</Text>
              </View>
              <View style={s.detailDivider} />
              <View style={s.detailItem}>
                <Text style={s.detailLbl}>Expires</Text>
                <Text style={s.detailVal}>{fmtDate(sub.expires_at)}</Text>
              </View>
              <View style={s.detailDivider} />
              <View style={s.detailItem}>
                <Text style={s.detailLbl}>Exams</Text>
                <Text style={s.detailVal}>{exams.length}</Text>
              </View>
            </View>
          </View>

          {/* Allowed exams */}
          {exams.length > 0 && (
            <>
              <Text style={s.secHd}>Included Exams</Text>
              <View style={s.examList}>
                {exams.map((id, i) => (
                  <View key={i} style={s.examRow}>
                    <Text style={s.examId} numberOfLines={1}>{id}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate("ExamHome")}
                      style={s.goBtn}>
                      <Text style={s.goTxt}>Go →</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:         { flex:1, backgroundColor:"#f0f2f7" },
  center:       { flex:1, justifyContent:"center", alignItems:"center" },
  body:         { paddingBottom:32 },
  hdr:          { backgroundColor:"#1a237e", paddingHorizontal:20, paddingTop: Platform.OS==="ios"?54:14, paddingBottom:16 },
  hTitle:       { color:"#fff", fontSize:18, fontWeight:"900" },
  noSub:        { alignItems:"center", paddingTop:60, gap:10 },
  noSubIcon:    { fontSize:52 },
  noSubTitle:   { fontSize:18, fontWeight:"900", color:"#1a2a4a" },
  noSubSub:     { fontSize:13, color:"#8a9ab7", textAlign:"center", paddingHorizontal:40 },
  card:         { margin:14, borderRadius:16, padding:18, elevation:3, shadowColor:"#000", shadowOpacity:0.08, shadowRadius:8, shadowOffset:{width:0,height:3} },
  activeCard:   { backgroundColor:"#fff" },
  expiredCard:  { backgroundColor:"#fff", borderWidth:1.5, borderColor:"#fee2e2" },
  cardRow:      { flexDirection:"row", alignItems:"center", gap:14, marginBottom:16 },
  planIcon:     { fontSize:36 },
  planInfo:     { flex:1 },
  planName:     { fontSize:18, fontWeight:"900", color:"#1a2a4a" },
  badge:        { alignSelf:"flex-start", borderRadius:6, paddingHorizontal:8, paddingVertical:2, marginTop:4 },
  badgeTxt:     { fontSize:11, fontWeight:"800" },
  detailRow:    { flexDirection:"row", borderTopWidth:1, borderTopColor:"#f0f2f7", paddingTop:14, gap:0 },
  detailItem:   { flex:1, alignItems:"center" },
  detailDivider:{ width:1, backgroundColor:"#e0e4ed" },
  detailLbl:    { fontSize:10, fontWeight:"700", color:"#8a9ab7", marginBottom:4 },
  detailVal:    { fontSize:13, fontWeight:"900", color:"#1a2a4a" },
  secHd:        { fontSize:10, fontWeight:"800", color:"#5c6b8a", textTransform:"uppercase", letterSpacing:1, paddingHorizontal:14, marginTop:4, marginBottom:8 },
  examList:     { marginHorizontal:12, gap:8 },
  examRow:      { backgroundColor:"#fff", borderRadius:12, paddingHorizontal:14, paddingVertical:12, flexDirection:"row", justifyContent:"space-between", alignItems:"center", elevation:1, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:4, shadowOffset:{width:0,height:1} },
  examId:       { flex:1, fontSize:13, fontWeight:"700", color:"#1a2a4a" },
  goBtn:        { paddingHorizontal:12, paddingVertical:5, backgroundColor:"#e8eaf6", borderRadius:8 },
  goTxt:        { fontSize:12, fontWeight:"800", color:"#1a237e" },
});
