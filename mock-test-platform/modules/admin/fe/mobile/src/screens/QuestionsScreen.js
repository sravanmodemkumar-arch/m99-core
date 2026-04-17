import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Platform,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { adminGet } from "../utils/api";

const TYPE_LABELS = { S:"MCQ", M:"Multi", N:"Numeric", T:"Text", P:"Passage", MA:"Match", AR:"Assertion", SC:"Sort", SI:"Select-Insert", FI:"Fill", SA:"Short Ans", LA:"Long Ans", DI:"Data Interp", GR:"Graph", CB:"Case-Based", CD:"Code", EX:"Expression", IM:"Image", AU:"Audio" };

export default function QuestionsScreen({ navigation }) {
  const [questions, setQuestions] = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [loadMore,  setLoadMore]  = useState(false);
  const [refreshing,setRefreshing]= useState(false);
  const LIMIT = 20;

  useEffect(() => { load(1, ""); }, []);

  async function load(p, q) {
    if (p === 1) { setLoading(true); setQuestions([]); }
    else setLoadMore(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT, ...(q ? { q } : {}) });
      const data = await adminGet(`/questions?${params}`);
      const qs = data.questions || [];
      setTotal(data.total || 0);
      setPage(p);
      setQuestions(prev => p === 1 ? qs : [...prev, ...qs]);
    } catch (e) {
      if (e.status === 401) { navigation.replace("Login"); return; }
      Alert.alert("Error", e.message);
    } finally { setLoading(false); setLoadMore(false); setRefreshing(false); }
  }

  function onSearch(text) {
    setSearch(text);
    if (text.length === 0 || text.length >= 3) load(1, text);
  }

  function renderItem({ item: q }) {
    const typeLabel = TYPE_LABELS[q.type] || q.type;
    const subjColor = q.subject ? "#1565c0" : "#90a4ae";
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.typeBadge}><Text style={s.typeT}>{typeLabel}</Text></View>
          {q.subject && <Text style={[s.subj, { color: subjColor }]} numberOfLines={1}>{q.subject}</Text>}
          {q.topic   && <Text style={s.topic} numberOfLines={1}>/ {q.topic}</Text>}
        </View>
        <Text style={s.preview} numberOfLines={2}>{q.preview || "—"}</Text>
        <View style={s.footer}>
          <Text style={s.lang}>{q.lang || "en"}</Text>
          <Text style={s.qid}>{q.qid}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.hdr}>
        <Text style={s.hTitle}>❓ Questions</Text>
        <Text style={s.hSub}>{total} total</Text>
      </View>
      <View style={s.searchBox}>
        <TextInput
          style={s.searchInp}
          placeholder="Search questions…"
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={onSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>
      ) : (
        <FlatList
          data={questions}
          keyExtractor={q => q.qid}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1, search); }} tintColor="#1a237e" />}
          onEndReached={() => { if (!loadMore && questions.length < total) load(page + 1, search); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadMore ? <ActivityIndicator color="#1a237e" style={{ margin: 16 }} /> : null}
          ListEmptyComponent={<Text style={s.empty}>No questions found</Text>}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex:1, backgroundColor:"#f0f2f7" },
  center:    { flex:1, justifyContent:"center", alignItems:"center" },
  hdr:       { backgroundColor:"#1a237e", paddingHorizontal:20, paddingTop: Platform.OS === "ios" ? 54 : 14, paddingBottom:16 },
  hTitle:    { color:"#fff", fontSize:18, fontWeight:"900" },
  hSub:      { color:"rgba(255,255,255,0.7)", fontSize:12, marginTop:2 },
  searchBox: { backgroundColor:"#fff", paddingHorizontal:14, paddingVertical:8, borderBottomWidth:1, borderBottomColor:"#e0e4ed" },
  searchInp: { backgroundColor:"#f0f2f7", borderRadius:10, paddingHorizontal:14, paddingVertical:10, fontSize:14, color:"#1a2a4a" },
  list:      { padding:12, gap:10 },
  empty:     { textAlign:"center", color:"#aaa", marginTop:40 },
  card:      { backgroundColor:"#fff", borderRadius:12, padding:14, elevation:2, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:2} },
  cardTop:   { flexDirection:"row", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" },
  typeBadge: { backgroundColor:"#e3f2fd", paddingHorizontal:9, paddingVertical:3, borderRadius:6 },
  typeT:     { fontSize:11, fontWeight:"800", color:"#1565c0" },
  subj:      { fontSize:12, fontWeight:"700" },
  topic:     { fontSize:11, color:"#90a4ae" },
  preview:   { fontSize:13, color:"#1a2a4a", lineHeight:19 },
  footer:    { flexDirection:"row", justifyContent:"space-between", marginTop:8 },
  lang:      { fontSize:10, color:"#aaa", fontWeight:"700" },
  qid:       { fontSize:10, color:"#c0c8d8" },
});
