import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, TextInput,
} from "react-native";
import { userGet, fmt, fmtDate } from "../utils/api";

export default function HistoryScreen({ navigation }) {
  const [items,      setItems]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [examFilter, setExamFilter] = useState("");

  useEffect(() => { loadPage(1, true); }, [examFilter]);

  async function loadPage(p, reset = false) {
    if (p === 1) reset = true;
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const q = examFilter ? `&exam_id=${examFilter}` : "";
      const data = await userGet(`/history?page=${p}&limit=20${q}`);
      setTotal(data.total);
      setItems(prev => reset ? data.results : [...prev, ...data.results]);
      setPage(p);
    } catch (e) {
      if (e.status === 401) { navigation.replace("Login"); return; }
      Alert.alert("Error", e.message);
    } finally { setLoading(false); setLoadingMore(false); setRefreshing(false); }
  }

  const loadMore = useCallback(() => {
    if (!loadingMore && items.length < total) loadPage(page + 1);
  }, [loadingMore, items.length, total, page]);

  function renderItem({ item: h }) {
    const score = h.score ?? null;
    const color = score === null ? "#8a9ab7" : score >= 0 ? "#2e7d32" : "#c62828";
    return (
      <View style={s.row}>
        <Text style={s.icon}>{score !== null && score >= 0 ? "✅" : score !== null ? "❌" : "⏸️"}</Text>
        <View style={s.info}>
          <Text style={s.title} numberOfLines={1}>{h.exam_title || h.exam_id}</Text>
          <Text style={s.sub}>{fmtDate(h.submitted_at)} · {h.correct ?? "—"} correct · {h.wrong ?? "—"} wrong</Text>
        </View>
        <View style={s.right}>
          <Text style={[s.score, { color }]}>{fmt(score)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.hdr}>
        <Text style={s.hTitle}>📋 History</Text>
        <TextInput style={s.filter} placeholder="Filter by exam ID…" placeholderTextColor="#aaa"
          value={examFilter} onChangeText={setExamFilter} autoCorrect={false} autoCapitalize="none" />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPage(1, true); }} tintColor="#1a237e" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={s.empty}>No attempts yet</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#1a237e" style={{ marginVertical:16 }} /> : null}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex:1, backgroundColor:"#f0f2f7" },
  center:  { flex:1, justifyContent:"center", alignItems:"center" },
  hdr:     { backgroundColor:"#1a237e", paddingHorizontal:16, paddingTop:54, paddingBottom:14, gap:10 },
  hTitle:  { color:"#fff", fontSize:18, fontWeight:"900" },
  filter:  { backgroundColor:"rgba(255,255,255,0.15)", borderRadius:10, paddingHorizontal:12, paddingVertical:8, color:"#fff", fontSize:13 },
  list:    { padding:12, gap:8, paddingBottom:24 },
  row:     { backgroundColor:"#fff", borderRadius:12, padding:14, flexDirection:"row", alignItems:"center", gap:10, elevation:1, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:4, shadowOffset:{width:0,height:1} },
  icon:    { fontSize:20, width:28 },
  info:    { flex:1 },
  title:   { fontSize:13, fontWeight:"700", color:"#1a2a4a" },
  sub:     { fontSize:11, color:"#8a9ab7", marginTop:2 },
  right:   { alignItems:"flex-end" },
  score:   { fontSize:15, fontWeight:"900" },
  empty:   { textAlign:"center", color:"#aaa", marginTop:40, fontSize:14 },
});
