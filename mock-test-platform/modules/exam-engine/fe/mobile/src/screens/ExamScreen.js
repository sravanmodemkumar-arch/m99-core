import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Alert, Modal, TouchableOpacity,
  SafeAreaView, Platform, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as KeepAwake from "expo-keep-awake";

import { apiGet, apiPost } from "../utils/api";
import { scoreExam } from "../utils/scoring";
import { useTimer } from "../hooks/useTimer";
import Timer from "../components/Timer";
import QuestionCard from "../components/QuestionCard";
import PalettePanel from "../components/PalettePanel";
import SectionTabs from "../components/SectionTabs";
import ActionBar from "../components/ActionBar";

const COLORS = ["#1565c0","#6a1b9a","#2e7d32","#e65100","#0277bd","#ad1457","#00838f","#558b2f"];

export default function ExamScreen({ navigation, route }) {
  const { examId, apiPrefix = "/exam", label = "Exam", backRoute } = route.params || {};

  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [bundle,       setBundle]       = useState(null);
  const [answerKey,    setAnswerKey]    = useState(null);
  const [sessionId,    setSessionId]    = useState(null);
  const [responses,    setResponses]    = useState({});   // { [qid]: { chosen, attempted, markedReview } }
  const [order,        setOrder]        = useState([]);   // qid[]
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [activeSec,    setActiveSec]    = useState(null);
  const [paletteOpen,  setPaletteOpen]  = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  const syncRef = useRef(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    KeepAwake.activateKeepAwakeAsync();
    loadExam();
    return () => {
      KeepAwake.deactivateKeepAwake();
      if (syncRef.current) clearInterval(syncRef.current);
    };
  }, []);

  async function loadExam() {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) { navigation.replace("Login"); return; }

      const data = await apiGet(`/start?exam_id=${examId}`, apiPrefix);
      setBundle(data.bundle);
      setAnswerKey(data.answer_key);
      setSessionId(data.session_id);
      setOrder(data.bundle.questions.map(q => q.id));
      setActiveSec(data.bundle.sections[0]?.id || null);

      // Restore checkpoint
      const ckp = await AsyncStorage.getItem(`checkpoint_${data.session_id}`);
      if (ckp) {
        const saved = JSON.parse(ckp);
        setResponses(saved.responses || {});
        setCurrentIdx(saved.currentIdx || 0);
      }

      setLoading(false);

      // Sync every 60s
      syncRef.current = setInterval(() => syncProgress(data.session_id), 60000);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function syncProgress(sid) {
    const token = await AsyncStorage.getItem("auth_token");
    const resp  = {};
    for (const [id, r] of Object.entries(responses))
      if (r.attempted) resp[id] = { chosen: r.chosen, attempted: true };
    await apiPost("/exam/sync", { session_id: sid, responses: resp }, apiPrefix).catch(() => {});
  }

  const saveCheckpoint = useCallback((sid, idx, resp) => {
    AsyncStorage.setItem(`checkpoint_${sid}`, JSON.stringify({ currentIdx: idx, responses: resp }));
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const duration = bundle?.duration_s || 3600;
  const { remaining, elapsed, start: startTimer } = useTimer(duration, handleTimeExpire);

  useEffect(() => {
    if (bundle && !loading) startTimer();
  }, [bundle, loading]);

  function handleTimeExpire() {
    submitExam(true);
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  const currentQid = order[currentIdx];
  const currentQ   = bundle?.questions.find(q => q.id === currentQid);
  const currentResp = responses[currentQid] || {};

  const goTo = useCallback((idx) => {
    setCurrentIdx(idx);
    if (bundle) {
      const sec = bundle.sections.find(s =>
        bundle.questions.slice(0, idx + 1).filter(q => q.section_id === s.id).length > 0
      );
      if (sec) setActiveSec(sec.id);
    }
  }, [bundle]);

  const handleAnswer = useCallback((opt) => {
    const newResp = { ...responses, [currentQid]: { chosen: opt, attempted: true, markedReview: currentResp.markedReview } };
    setResponses(newResp);
    saveCheckpoint(sessionId, currentIdx, newResp);
  }, [responses, currentQid, currentResp, sessionId, currentIdx]);

  const handleClear = useCallback(() => {
    const newResp = { ...responses, [currentQid]: { chosen: null, attempted: false, markedReview: currentResp.markedReview } };
    setResponses(newResp);
    saveCheckpoint(sessionId, currentIdx, newResp);
  }, [responses, currentQid, currentResp, sessionId, currentIdx]);

  const handleMark = useCallback(() => {
    const newResp = { ...responses, [currentQid]: { ...currentResp, markedReview: !currentResp.markedReview } };
    setResponses(newResp);
  }, [responses, currentQid, currentResp]);

  const handleSaveNext = useCallback(() => {
    if (currentIdx < order.length - 1) goTo(currentIdx + 1);
    else confirmSubmit();
  }, [currentIdx, order.length]);

  // ── Section tabs data ────────────────────────────────────────────────────
  const sectionTabs = bundle?.sections.map(s => {
    const qIds   = bundle.questions.filter(q => q.section_id === s.id).map(q => q.id);
    const answered = qIds.filter(id => responses[id]?.attempted).length;
    return { id: s.id, label: s.label, answered, total: qIds.length };
  }) || [];

  const handleSecSelect = (secId) => {
    setActiveSec(secId);
    const firstIdx = order.findIndex(id => {
      const q = bundle?.questions.find(q => q.id === id);
      return q?.section_id === secId;
    });
    if (firstIdx >= 0) setCurrentIdx(firstIdx);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  function confirmSubmit() {
    const answered = Object.values(responses).filter(r => r.attempted).length;
    const skipped  = order.length - answered;
    Alert.alert(
      "Submit Exam",
      `Answered: ${answered} | Skipped: ${skipped}\n\nAre you sure you want to submit?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Submit", style: "destructive", onPress: () => submitExam(false) },
      ]
    );
  }

  async function submitExam(autoSubmit = false) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const sectionMap = {};
      for (const sec of bundle.sections) {
        sectionMap[sec.id] = bundle.questions
          .filter(q => q.section_id === sec.id)
          .map(q => ({
            attempted: responses[q.id]?.attempted || false,
            chosen:    responses[q.id]?.chosen || null,
            correct:   answerKey[q.id],
          }));
      }
      const result      = scoreExam(sectionMap, bundle.marking);
      const sectionDefs = bundle.sections.map(s => ({ id: s.id, label: s.label }));
      const payload     = {
        answer_key:   answerKey,
        responses,
        sections:     result.sections,
        section_defs: sectionDefs,
        elapsed_s:    elapsed,
        ...result.total,
      };

      await AsyncStorage.setItem(`result_${sessionId}`, JSON.stringify(payload));
      await AsyncStorage.removeItem(`checkpoint_${sessionId}`);

      if (syncRef.current) clearInterval(syncRef.current);

      navigation.replace("Result", {
        sessionId,
        score:    result.total.score,
        correct:  result.total.correct,
        wrong:    result.total.wrong,
        skipped:  result.total.skipped,
        total:    bundle.questions.length,
        pct:      Math.round((result.total.rawScaled / 1000 / bundle.questions.length) * 100),
        elapsedS: elapsed,
        label,
        apiPrefix,
        backRoute,
      });
    } catch (e) {
      Alert.alert("Error", "Failed to submit. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color="#1565c0" />
      <Text style={styles.loadTxt}>Loading exam…</Text>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.errTxt}>Error: {error}</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backBtnTxt}>Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.shell}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.hdrBtn} onPress={confirmSubmit}>
          <Text style={styles.hdrBtnTxt}>Submit</Text>
        </TouchableOpacity>
        <Text style={styles.hdrTitle} numberOfLines={1}>{label}</Text>
        <View style={styles.hdrRight}>
          <Timer remaining={remaining} warning={300} />
          <TouchableOpacity style={styles.hdrBtn} onPress={() => setPaletteOpen(true)}>
            <Text style={styles.hdrBtnTxt}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Section tabs */}
      {sectionTabs.length > 1 && (
        <SectionTabs sections={sectionTabs} activeId={activeSec} onSelect={handleSecSelect} />
      )}

      {/* Question counter bar */}
      <View style={styles.counterBar}>
        <Text style={styles.counterTxt}>Q {currentIdx + 1} of {order.length}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((currentIdx + 1) / order.length) * 100}%` }]} />
        </View>
      </View>

      {/* Question */}
      <QuestionCard
        question={currentQ}
        index={currentIdx + 1}
        total={order.length}
        chosen={currentResp.chosen}
        onAnswer={handleAnswer}
        onClearAnswer={handleClear}
      />

      {/* Action bar */}
      <ActionBar
        onPrev={() => goTo(Math.max(0, currentIdx - 1))}
        onNext={() => goTo(Math.min(order.length - 1, currentIdx + 1))}
        onMark={handleMark}
        onSaveNext={handleSaveNext}
        isFirst={currentIdx === 0}
        isLast={currentIdx === order.length - 1}
        isMarked={!!currentResp.markedReview}
        isAnswered={!!currentResp.attempted}
      />

      {/* Palette modal */}
      <Modal visible={paletteOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.paletteModal}>
          <View style={styles.paletteHeader}>
            <Text style={styles.paletteTitle}>Question Palette</Text>
            <TouchableOpacity onPress={() => setPaletteOpen(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnTxt}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <PalettePanel
            questions={bundle?.questions || []}
            responses={responses}
            currentId={currentQid}
            sectionDefs={bundle?.sections || []}
            onJump={(id) => {
              const idx = order.indexOf(id);
              if (idx >= 0) { goTo(idx); setPaletteOpen(false); }
            }}
          />
          <TouchableOpacity style={styles.submitFromPalette} onPress={() => { setPaletteOpen(false); confirmSubmit(); }}>
            <Text style={styles.submitFromPaletteTxt}>Submit Exam</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* Submitting overlay */}
      {submitting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayTxt}>Submitting…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell:   { flex: 1, backgroundColor: "#fff" },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadTxt: { fontSize: 14, color: "#5c6b8a" },
  errTxt:  { fontSize: 14, color: "#c62828", textAlign: "center", padding: 24 },
  backBtn: { padding: 12, backgroundColor: "#1565c0", borderRadius: 8 },
  backBtnTxt: { color: "#fff", fontWeight: "700" },

  header:   { flexDirection: "row", alignItems: "center", backgroundColor: "#1565c0", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  hdrTitle: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" },
  hdrRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  hdrBtn:   { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6 },
  hdrBtnTxt:{ color: "#fff", fontSize: 13, fontWeight: "700" },

  counterBar:   { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#f8f9ff", borderBottomWidth: 1, borderBottomColor: "#e0e4ed" },
  counterTxt:   { fontSize: 12, fontWeight: "700", color: "#5c6b8a", minWidth: 70 },
  progressTrack:{ flex: 1, height: 4, backgroundColor: "#e0e4ed", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#1565c0", borderRadius: 2 },

  paletteModal:  { flex: 1, backgroundColor: "#f8f9ff" },
  paletteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#1565c0" },
  paletteTitle:  { color: "#fff", fontSize: 15, fontWeight: "800" },
  closeBtn:      { padding: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6 },
  closeBtnTxt:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  submitFromPalette: { margin: 16, padding: 15, backgroundColor: "#c62828", borderRadius: 10, alignItems: "center" },
  submitFromPaletteTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },

  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", gap: 16 },
  overlayTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
