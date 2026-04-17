import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getConfig } from "../../../../../shared/config.js";

export default function RRBHomeScreen({ navigation }) {
  const [modules,    setModules]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { rrb_base } = await getConfig();
      const token = await AsyncStorage.getItem("auth_token");
      const res   = await fetch(`${rrb_base}/rrb/modules`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setModules(data.modules || []);
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }

  const MODULE_SCREENS = {
    "rrb-group-d": "RRBGroupDHome",
    "rrb-ntpc":    "RRBNTPCHome",
  };

  function openModule(m) {
    if (m.status !== "active") {
      Alert.alert("Coming Soon", `${m.name} will be available soon.`); return;
    }
    const screen = MODULE_SCREENS[m.id] || "RRBGroupDHome";
    navigation.navigate(screen);
  }

  function renderItem({ item: m }) {
    const active = m.status === "active";
    return (
      <TouchableOpacity style={[s.card, !active && s.cardDim]} onPress={() => openModule(m)} activeOpacity={0.8}>
        <View style={s.cardTop}>
          <Text style={s.icon}>{m.icon}</Text>
          <View style={s.cardInfo}>
            <Text style={s.cardName}>{m.name}</Text>
            <Text style={s.cardFull} numberOfLines={1}>{m.full_name}</Text>
            {m.vacancies && <Text style={s.vacancies}>Vacancies: {m.vacancies}</Text>}
          </View>
          <View style={[s.badge, { backgroundColor: active ? "#e8f5e9" : "#f3f4f6" }]}>
            <Text style={[s.badgeTxt, { color: active ? "#2e7d32" : "#9ca3af" }]}>
              {active ? "Active" : "Soon"}
            </Text>
          </View>
        </View>
        <View style={s.topics}>
          {(m.topics || []).map((t, i) => (
            <View key={i} style={s.topicPill}>
              <Text style={s.topicTxt}>{t}</Text>
            </View>
          ))}
        </View>
        {active && (
          <View style={s.cta}>
            <Text style={s.ctaTxt}>Start Practice →</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#0d47a1" /></View>;

  return (
    <View style={s.root}>
      <View style={s.hdr}>
        <View style={s.hdrRow}>
          <Text style={s.hdrIcon}>🚂</Text>
          <View>
            <Text style={s.hTitle}>RRB Mock Tests</Text>
            <Text style={s.hSub}>Railway Recruitment Board</Text>
          </View>
        </View>
        <View style={s.markingBadge}>
          <Text style={s.markingTxt}>+1 / -⅓</Text>
        </View>
      </View>

      <FlatList
        data={modules}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0d47a1" />}
        ListEmptyComponent={<Text style={s.empty}>No modules available</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:"#f0f4f8" },
  center:     { flex:1, justifyContent:"center", alignItems:"center" },
  hdr:        { backgroundColor:"#0d47a1", paddingHorizontal:18, paddingTop: Platform.OS==="ios"?54:14, paddingBottom:16, flexDirection:"row", justifyContent:"space-between", alignItems:"flex-end" },
  hdrRow:     { flexDirection:"row", alignItems:"center", gap:12 },
  hdrIcon:    { fontSize:28 },
  hTitle:     { color:"#fff", fontSize:18, fontWeight:"900" },
  hSub:       { color:"rgba(255,255,255,0.65)", fontSize:11, marginTop:1 },
  markingBadge: { backgroundColor:"rgba(255,255,255,0.15)", borderRadius:8, paddingHorizontal:10, paddingVertical:5 },
  markingTxt: { color:"#fff", fontSize:12, fontWeight:"800" },
  list:       { padding:12, gap:12, paddingBottom:24 },
  card:       { backgroundColor:"#fff", borderRadius:16, padding:16, elevation:2, shadowColor:"#000", shadowOpacity:0.07, shadowRadius:8, shadowOffset:{width:0,height:3} },
  cardDim:    { opacity:0.65 },
  cardTop:    { flexDirection:"row", alignItems:"flex-start", gap:12, marginBottom:10 },
  icon:       { fontSize:32, width:40 },
  cardInfo:   { flex:1 },
  cardName:   { fontSize:15, fontWeight:"900", color:"#1a2a4a" },
  cardFull:   { fontSize:11, color:"#8a9ab7", marginTop:2 },
  vacancies:  { fontSize:11, color:"#5c6b8a", fontWeight:"600", marginTop:3 },
  badge:      { borderRadius:6, paddingHorizontal:8, paddingVertical:3, alignSelf:"flex-start" },
  badgeTxt:   { fontSize:10, fontWeight:"800" },
  topics:     { flexDirection:"row", flexWrap:"wrap", gap:5, marginBottom:10 },
  topicPill:  { backgroundColor:"#e8eaf6", borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  topicTxt:   { fontSize:10, color:"#0d47a1", fontWeight:"700" },
  cta:        { backgroundColor:"#0d47a1", borderRadius:10, paddingVertical:10, alignItems:"center" },
  ctaTxt:     { color:"#fff", fontSize:13, fontWeight:"900" },
  empty:      { textAlign:"center", color:"#aaa", paddingTop:40, fontSize:14 },
});
