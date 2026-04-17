import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from "react-native";
import PageHeader from "../components/PageHeader.js";
import Btn from "../components/Btn.js";
import PasswordField from "../components/PasswordField.js";
import ReauthGate from "../components/ReauthGate.js";
import { api, getConfig } from "../utils/api.js";

const CATEGORIES = [
  "General", "OBC", "SC", "ST", "EWS", "OBC-NCL",
  "PwD", "Ex-Serviceman", "Other",
];

export default function EditProfileScreen({ navigation }) {
  // --- form state ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  // --- ui state ---
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [pinStatus, setPinStatus] = useState(""); // "loading" | "ok:…" | "err"
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showReauth, setShowReauth] = useState(false);
  const [reauthConfig, setReauthConfig] = useState({ otp: false, totp: false });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  const pinTimer = useRef(null);

  // --- load profile + config on mount ---
  useEffect(() => {
    async function load() {
      const [{ ok, data }, cfg] = await Promise.all([
        api("/auth/me/profile"),
        getConfig(),
      ]);
      if (ok) {
        const p = data.profile || data;
        setFirstName(p.first_name || "");
        setLastName(p.last_name || "");
        setPhone(p.phone || "");
        setEmail(p.email || "");
        setDob(p.dob || "");
        setGender(p.gender || "");
        setCategory(p.category || "");
        setPincode(p.pincode || "");
        setState(p.state || "");
        setCity(p.city || "");
        setAddress(p.address || "");
      }
      const reauth = cfg?.profile_edit_reauth || {};
      setReauthConfig({ otp: !!reauth.otp, totp: !!reauth.totp });
      setLoadingProfile(false);
    }
    load();
  }, []);

  // --- pincode auto-lookup ---
  function onPincodeChange(v) {
    setPincode(v);
    clearTimeout(pinTimer.current);
    setPinStatus("");
    if (v.length === 6) {
      setPinStatus("loading");
      pinTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`https://api.postalpincode.in/pincode/${v}`);
          const d = await res.json();
          if (d[0]?.Status === "Success") {
            const po = d[0].PostOffice[0];
            setState(po.State);
            setCity(po.District);
            setPinStatus("ok:" + po.Name);
          } else {
            setPinStatus("err");
          }
        } catch {
          setPinStatus("err");
        }
      }, 600);
    }
  }

  // --- save flow ---
  function onSavePress() {
    if (!firstName.trim()) { setErr("First name is required"); return; }
    setErr("");
    setShowReauth(true);
  }

  async function handleReauthSubmit(payload, setSubmitErr) {
    setSaving(true);
    const body = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone,
      email,
      dob,
      gender,
      category,
      pincode,
      state,
      city,
      address,
      ...payload,
    };
    const { ok, data } = await api("/auth/profile/update", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!ok) { setSubmitErr(data.error || "Update failed"); return; }
    setSuccess(true);
    setTimeout(() => navigation.goBack(), 1200);
  }

  if (loadingProfile) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader title="Edit Profile" onBack={() => navigation.goBack()} />

      {/* ── Personal ── */}
      <Text style={s.sectionTitle}>Personal Information</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>First Name *</Text>
            <TextInput
              style={s.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First"
              placeholderTextColor="#94A3B8"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Last Name</Text>
            <TextInput
              style={s.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        <Text style={s.label}>Phone</Text>
        <TextInput
          style={s.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit mobile"
          keyboardType="phone-pad"
          maxLength={10}
          placeholderTextColor="#94A3B8"
        />

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#94A3B8"
        />

        <Text style={s.label}>Date of Birth</Text>
        <TextInput
          style={s.input}
          value={dob}
          onChangeText={setDob}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
        />

        <Text style={s.label}>Gender</Text>
        <View style={s.genderRow}>
          {[["M", "Male"], ["F", "Female"], ["O", "Other"]].map(([v, l]) => (
            <TouchableOpacity
              key={v}
              style={[s.genderBtn, gender === v && s.genderActive]}
              onPress={() => setGender(v)}
            >
              <Text style={[s.genderLabel, gender === v && s.genderActiveLabel]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Category</Text>
        <TouchableOpacity
          style={[s.input, s.pickerBtn]}
          onPress={() => setShowCategoryPicker(p => !p)}
          activeOpacity={0.7}
        >
          <Text style={category ? s.pickerVal : s.pickerPlaceholder}>
            {category || "Select category"}
          </Text>
          <Text style={s.pickerArrow}>{showCategoryPicker ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {showCategoryPicker && (
          <View style={s.pickerDropdown}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[s.pickerItem, category === c && s.pickerItemActive]}
                onPress={() => { setCategory(c); setShowCategoryPicker(false); }}
              >
                <Text style={[s.pickerItemText, category === c && s.pickerItemActiveText]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Address ── */}
      <Text style={s.sectionTitle}>Address</Text>
      <View style={s.card}>
        <Text style={s.label}>Pincode</Text>
        <TextInput
          style={s.input}
          value={pincode}
          onChangeText={onPincodeChange}
          placeholder="6-digit pincode"
          keyboardType="number-pad"
          maxLength={6}
          placeholderTextColor="#94A3B8"
        />
        {pinStatus === "loading" && (
          <Text style={s.pinLoading}>Looking up pincode…</Text>
        )}
        {pinStatus.startsWith("ok:") && (
          <Text style={s.pinOk}>✓ {pinStatus.slice(3)}</Text>
        )}
        {pinStatus === "err" && (
          <Text style={s.pinErr}>Pincode not found — fill state & city manually</Text>
        )}

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>State</Text>
            <TextInput
              style={s.input}
              value={state}
              onChangeText={setState}
              placeholder="State"
              placeholderTextColor="#94A3B8"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>City</Text>
            <TextInput
              style={s.input}
              value={city}
              onChangeText={setCity}
              placeholder="City"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        <Text style={s.label}>Full Address</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={address}
          onChangeText={setAddress}
          placeholder="House / Street / Locality"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* ── errors / success ── */}
      {err ? <Text style={s.err}>{err}</Text> : null}
      {success && (
        <View style={s.successBox}>
          <Text style={s.successText}>✓ Profile updated successfully</Text>
        </View>
      )}

      {/* ── save button ── */}
      {!showReauth && !success && (
        <Btn label="Save Changes" onPress={onSavePress} style={{ marginHorizontal: 0, marginBottom: 8 }} />
      )}

      {/* ── inline reauth gate ── */}
      {showReauth && !success && (
        <View style={s.card}>
          <ReauthGate
            requireOtp={reauthConfig.otp}
            requireTotp={reauthConfig.totp}
            submitLabel="Confirm & Save"
            onSubmit={handleReauthSubmit}
            loading={saving}
          />
          <Btn
            label="Cancel"
            variant="ghost"
            onPress={() => setShowReauth(false)}
            style={{ marginTop: 4 }}
          />
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },

  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: "#64748B",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginTop: 16, marginBottom: 8, marginHorizontal: 4,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#E2E8F0",
    padding: 16, marginBottom: 12,
  },
  row: { flexDirection: "row", gap: 12 },

  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10,
    padding: 12, fontSize: 15, color: "#0F172A",
    backgroundColor: "#F8FAFC", marginBottom: 16,
  },
  textarea: { height: 80 },

  genderRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  genderBtn: {
    flex: 1, padding: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: "#E2E8F0",
    backgroundColor: "#fff", alignItems: "center",
  },
  genderActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  genderLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  genderActiveLabel: { color: "#2563EB" },

  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerVal: { fontSize: 15, color: "#0F172A" },
  pickerPlaceholder: { fontSize: 15, color: "#94A3B8" },
  pickerArrow: { fontSize: 12, color: "#94A3B8" },
  pickerDropdown: {
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10,
    backgroundColor: "#fff", marginTop: -12, marginBottom: 16,
    overflow: "hidden",
  },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  pickerItemActive: { backgroundColor: "#EFF6FF" },
  pickerItemText: { fontSize: 14, color: "#334155" },
  pickerItemActiveText: { color: "#2563EB", fontWeight: "700" },

  pinLoading: { fontSize: 12, color: "#64748B", marginTop: -12, marginBottom: 12 },
  pinOk: { fontSize: 12, color: "#16A34A", marginTop: -12, marginBottom: 12 },
  pinErr: { fontSize: 12, color: "#F59E0B", marginTop: -12, marginBottom: 12 },

  err: { fontSize: 13, color: "#EF4444", textAlign: "center", marginBottom: 12 },
  successBox: {
    backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#86EFAC",
    borderRadius: 10, padding: 12, marginBottom: 16, alignItems: "center",
  },
  successText: { fontSize: 14, fontWeight: "600", color: "#16A34A" },
});
