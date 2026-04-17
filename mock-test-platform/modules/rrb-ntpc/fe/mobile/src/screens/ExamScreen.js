import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Alert, Modal, TouchableOpacity,
  SafeAreaView, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as KeepAwake from "expo-keep-awake";

import { apiPost, getToken } from "../utils/api";
import { getConfig } from "../../../../../../shared/config.js";

import { useTimer }    from "../../../../../exam-engine/fe/mobile/src/hooks/useTimer";
import Timer           from "../../../../../exam-engine/fe/mobile/src/components/Timer";
import QuestionCard    from "../../../../../exam-engine/fe/mobile/src/components/QuestionCard";
import PalettePanel    from "../../../../../exam-engine/fe/mobile/src/components/PalettePanel";
import SectionTabs     from "../../../../../exam-engine/fe/mobile/src/components/SectionTabs";
import ActionBar       from "../../../../../exam-engine/fe/mobile/src/components/ActionBar";

const BLUE = "#0d47a1";

export default function ExamScreen({ navigation, route }) {
  const { examId, label = "RRB NTPC", backRoute = "RRBNTPCHome" } = route.params || {};

  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [bundle,      setBundle]      = useState(null);
  const [sessionId,   setSessionId]   = useState(null);
  const [responses,   setResponses]   = useState({});
  const [order,       setOrder]       = useState([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [activeSec,   setActiveSec]   = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  const syncRef    = useRef(null);
  const durationRef = useRef(3600);

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

      const { rrb_ntpc_base } = await getConfig();

      // Start session
      const startData = await apiPost("/rrb-ntpc/exam/start", { exam_id: examId });
      const sid = startData.session_id;
      durationRef.current = startData.duration_s || 3600;

      // Fetch bundle
      const bundleRes = await fetch(`${rrb_ntpc_base}/rrb-ntpc/bundle/${sid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!bundleRes.ok) throw new Error(`Bundle HTTP ${bundleRes.status}`);
      const bundleData = await bundleRes.json();

      setBundle(bundleData);
      setSessionId(sid);
      setOrder(bundleData.questions.map(q => q.id));
      setActiveSec(bundleData.sections[0]?.id || null);

      // Restore checkpoint if resumed
      if (startData.resumed && startData.checkpoint) {
        setResponses(startData.checkpoint);
      } else {
        const ckp = await AsyncStorage.getItem(`rrb_ntpc_ckp_${sid}`);
        if (ckp) {
          const saved = JSON.parse(ckp);
          setResponses(saved.responses || {});
          setCurrentIdx(saved.currentIdx || 0);
        }
      }

      setLoading(false);
      syncRef.current = setInterval(() => syncProgress(sid), 60000);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function syncProgress(sid) {
    const resp = {};
    for (const [id, r] of Object.entries(responses))
      if (r.attempted) resp[id] = { chosen: r.chosen, attempted: true };
    await apiPost("/rrb-ntpc/exam/sync", { session_id: sid, responses: resp, elapsed_s: elapsed }).catch(() => {});
  }

  const saveCheckpoint = useCallback((sid, idx, resp) => {
    AsyncStorage.setItem(`rrb_ntpc_ckp_${sid}`, JSON.stringify({ currentIdx: idx, responses: resp }));
  }, []);

  const duration = bundle?.duration_s || durationRef.current;
  const { remaining, elapsed, start: startTimer } = useTimer(duration, handleTimeExpire);

  useEffect(() => {
    if (bundle && !loading) startTimer();
  }, [bundle, loading]);

  function handleTimeExpire() { submitExam(true); }

  const currentQid  = order[currentIdx];
  const currentQ    = bundle?.questions.find(q => q.id === currentQid);
  const currentResp = responses[currentQid] || {};

  const goTo = useCallback((idx) => { setCurrentIdx(idx); }, []);

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

  const sectionTabs = bundle?.sections.map(s => {
    const qIds    = bundle.questions.filter(q => q.section === s.id).map(q => q.id);
    const answered = qIds.filter(id => responses[id]?.attempted).length;
    return { id: s.id, label: s.label, answered, total: qIds.length };
  }) || [];

  const handleSecSelect = (secId) => {
    setActiveSec(secId);
    const firstIdx = order.findIndex(id => bundle?.questions.find(q => q.id === id)?.section === secId);
    if (firstIdx >= 0) setCurrentIdx(firstIdx);
  };

  function confirmSubmit() {
    const answered = Object.values(responses).filter(r => r.attempted).length;
    const skipped  = order.length - answered;
    Alert.alert(
      "Submit Exam",
      `Answered: ${answered} | Skipped: ${skipped}\n\nSubmit now?`,
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
      if (syncRef.current) clearInterval(syncRef.current);

      const resp = {};
      for (const [id, r] of Object.entries(responses))
        resp[id] = { attempted: r.attempted || false, chosen: r.chosen || null };

      const data = await apiPost("/rrb-ntpc/exam/submit", {
        session_id: sessionId,
        responses:  resp,
        elapsed_s:  elapsed,
      });

      const result = data.result || {};
      const sectionDefs = bundle.sections.map(s => ({ id: s.id, label: s.label }));

      // Build section breakdown for ResultScreen/AnalysisScreen
      const sections = {};
      for (const sec of bundle.sections) {
        const qIds = bundle.questions.filter(q => q.section === sec.id).map(q => q.id);
        let c = 0, w = 0, sk = 0, raw = 0;
        for (const qid of qIds) {
          const r   = resp[qid] || {};
          const ans = (data.answer_key || {})[qid];
          if (!r.attempted) { sk++; }
          else if (r.chosen === ans) { c++; raw += 1000; }
          else { w++; raw -= 333; }
        }
        sections[sec.id] = { correct: c, wrong: w, skipped: sk, rawScaled: raw };
      }

      await AsyncStorage.setItem(`result_${sessionId}`, JSON.stringify({
        answer_key:   data.answer_key || {},
        responses:    resp,
        sections,
        section_defs: sectionDefs,
        elapsed_s:    elapsed,
      }));
      await AsyncStorage.removeItem(`rrb_ntpc_ckp_${sessionId}`);

      const pct = result.total_qs > 0
        ? Math.round(((result.correct || 0) / result.total_qs) * 100)
        : 0;

      navigation.replace("NTPCResult", {
        sessionId,
        score:    result.score,
        correct:  result.correct,
        wrong:    result.wrong,
        skipped:  result.skipped,
        total:    result.total_qs,
        pct,
        elapsedS: elapsed,
        label,
        backRoute,
      });
    } catch (e) {
      Alert.alert("Error", "Failed to submit. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={BLUE} />
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

      {sectionTabs.length > 1 && (
        <SectionTabs sections={sectionTabs} activeId={activeSec} onSelect={handleSecSelect} />
      )}

      <View style={styles.counterBar}>
        <Text style={styles.counterTxt}>Q {currentIdx + 1} of {order.length}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((currentIdx + 1) / order.length) * 100}%` }]} />
        </View>
      </View>

      <QuestionCard
        question={currentQ}
        index={currentIdx + 1}
        total={order.length}
        chosen={currentResp.chosen}
        onAnswer={handleAnswer}
        onClearAnswer={handleClear}
      />

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
  backBtn: { padding: 12, backgroundColor: BLUE, borderRadius: 8 },
  backBtnTxt: { color: "#fff", fontWeight: "700" },

  header:    { flexDirection: "row", alignItems: "center", backgroundColor: BLUE, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  hdrTitle:  { flex: 1, color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" },
  hdrRight:  { flexDirection: "row", alignItems: "center", gap: 8 },
  hdrBtn:    { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6 },
  hdrBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },

  counterBar:    { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#f8f9ff", borderBottomWidth: 1, borderBottomColor: "#e0e4ed" },
  counterTxt:    { fontSize: 12, fontWeight: "700", color: "#5c6b8a", minWidth: 70 },
  progressTrack: { flex: 1, height: 4, backgroundColor: "#e0e4ed", borderRadius: 2, overflow: "hidden" },
  progressFill:  { height: "100%", backgroundColor: BLUE, borderRadius: 2 },

  paletteModal:  { flex: 1, backgroundColor: "#f8f9ff" },
  paletteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: BLUE },
  paletteTitle:  { color: "#fff", fontSize: 15, fontWeight: "800" },
  closeBtn:      { padding: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6 },
  closeBtnTxt:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  submitFromPalette:    { margin: 16, padding: 15, backgroundColor: "#c62828", borderRadius: 10, alignItems: "center" },
  submitFromPaletteTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },

  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", gap: 16 },
  overlayTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
