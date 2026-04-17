import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Platform,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { adminGet, adminPut } from "../utils/api";

const ROLES = ["none", "product_admin", "super_admin"];

export default function UsersScreen({ navigation }) {
  const [users,     setUsers]     = useState([]);
  const [total,     setTotal]     = useState(0);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [roleModal, setRoleModal] = useState(null); // { uid, current }
  const [saving,    setSaving]    = useState(false);
  const [myRole,    setMyRole]    = useState("");

  useEffect(() => {
    AsyncStorage.getItem("admin_role").then(r => setMyRole(r || ""));
    load(1, "");
  }, []);

  async function load(p, q) {
    try {
      const params = new URLSearchParams({ page: p, limit: 20, ...(q ? { q } : {}) });
      const data = await adminGet(`/users?${params}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      if (e.status === 401) { navigation.replace("Login"); return; }
      Alert.alert("Error", e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }

  function onSearch(text) {
    setSearch(text);
    if (text.length === 0 || text.length >= 3) load(1, text);
  }

  async function setRole(uid, role) {
    setSaving(true);
    try {
      await adminPut(`/users/${uid}/role`, { role });
      setRoleModal(null);
      load(1, search);
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  }

  function renderItem({ item: user }) {
    const roleColor = user.role === "super_admin" ? "#c62828" : user.role === "product_admin" ? "#1565c0" : "#90a4ae";
    return (
      <View style={s.card}>
        <View style={s.avatar}>
          <Text style={s.avatarT}>{(user.name || user.uid || "?")[0].toUpperCase()}</Text>
        </View>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>{user.name || "—"}</Text>
          <Text style={s.phone}>{user.phone || user.uid?.slice(-12)}</Text>
        </View>
        <View style={s.right}>
          <View style={[s.roleBadge, { backgroundColor: user.role ? roleColor + "22" : "#f5f5f5" }]}>
            <Text style={[s.roleT, { color: roleColor }]}>{user.role || "user"}</Text>
          </View>
          {myRole === "super_admin" && (
            <TouchableOpacity style={s.editBtn} onPress={() => setRoleModal({ uid: user.uid, current: user.role || "none", name: user.name || user.uid })}>
              <Text style={s.editT}>Set Role</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.hdr}>
        <Text style={s.hTitle}>👥 Users</Text>
        <Text style={s.hSub}>{total} total</Text>
      </View>
      <View style={s.searchBox}>
        <TextInput style={s.searchInp} placeholder="Search by name or phone…" placeholderTextColor="#aaa"
          value={search} onChangeText={onSearch} returnKeyType="search" clearButtonMode="while-editing" />
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#1a237e" /></View>
      ) : (
        <FlatList
          data={users} keyExtractor={u => u.uid} renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1, search); }} tintColor="#1a237e" />}
          ListEmptyComponent={<Text style={s.empty}>No users found</Text>}
        />
      )}

      {/* Role Modal */}
      <Modal visible={!!roleModal} transparent animationType="slide" onRequestClose={() => setRoleModal(null)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Set Role</Text>
            <Text style={s.modalSub}>{roleModal?.name}</Text>
            {ROLES.map(role => (
              <TouchableOpacity key={role} style={[s.roleOpt, roleModal?.current === role && s.roleOptSel]}
                onPress={() => setRole(roleModal.uid, role)} disabled={saving}>
                <Text style={[s.roleOptT, roleModal?.current === role && s.roleOptTSel]}>{role}</Text>
                {roleModal?.current === role && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            ))}
            {saving && <ActivityIndicator color="#1a237e" style={{ marginTop: 10 }} />}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setRoleModal(null)} disabled={saving}>
              <Text style={s.cancelT}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex:1, backgroundColor:"#f0f2f7" },
  center:    { flex:1, justifyContent:"center", alignItems:"center" },
  hdr:       { backgroundColor:"#1a237e", paddingHorizontal:20, paddingTop: Platform.OS === "ios" ? 54 : 14, paddingBottom:16 },
  hTitle:    { color:"#fff", fontSize:18, fontWeight:"900" },
  hSub:      { color:"rgba(255,255,255,0.7)", fontSize:12, marginTop:2 },
  searchBox: { backgroundColor:"#fff", padding:10, borderBottomWidth:1, borderBottomColor:"#e0e4ed" },
  searchInp: { backgroundColor:"#f0f2f7", borderRadius:10, paddingHorizontal:14, paddingVertical:10, fontSize:14, color:"#1a2a4a" },
  list:      { padding:12, gap:8 },
  empty:     { textAlign:"center", color:"#aaa", marginTop:40 },
  card:      { backgroundColor:"#fff", borderRadius:12, padding:12, flexDirection:"row", alignItems:"center", gap:10, elevation:2, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:5, shadowOffset:{width:0,height:1} },
  avatar:    { width:40, height:40, borderRadius:20, backgroundColor:"#1a237e", justifyContent:"center", alignItems:"center" },
  avatarT:   { color:"#fff", fontWeight:"900", fontSize:16 },
  info:      { flex:1 },
  name:      { fontSize:14, fontWeight:"700", color:"#1a2a4a" },
  phone:     { fontSize:11, color:"#90a4ae", marginTop:2 },
  right:     { alignItems:"flex-end", gap:6 },
  roleBadge: { paddingHorizontal:9, paddingVertical:3, borderRadius:999 },
  roleT:     { fontSize:10, fontWeight:"800" },
  editBtn:   { backgroundColor:"#e3f2fd", paddingHorizontal:10, paddingVertical:4, borderRadius:7 },
  editT:     { fontSize:11, fontWeight:"700", color:"#1565c0" },
  overlay:   { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },
  modal:     { backgroundColor:"#fff", borderTopLeftRadius:20, borderTopRightRadius:20, padding:24 },
  modalTitle:{ fontSize:16, fontWeight:"900", color:"#1a2a4a", marginBottom:4 },
  modalSub:  { fontSize:13, color:"#8a9ab7", marginBottom:16 },
  roleOpt:   { padding:14, borderRadius:10, borderWidth:1.5, borderColor:"#e0e4ed", marginBottom:8, flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  roleOptSel:{ borderColor:"#1a237e", backgroundColor:"#e8eaf6" },
  roleOptT:  { fontSize:14, fontWeight:"700", color:"#1a2a4a" },
  roleOptTSel:{ color:"#1a237e" },
  check:     { color:"#1a237e", fontWeight:"900" },
  cancelBtn: { marginTop:8, padding:14, alignItems:"center" },
  cancelT:   { fontSize:14, fontWeight:"700", color:"#90a4ae" },
});
