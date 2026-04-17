import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, BackHandler, useWindowDimensions, SafeAreaView,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../../../../auth/fe/mobile/src/hooks/useTheme.js";
import useQstate from "../../shared/useQstate.js";
import { scoreExam, percentage } from "../../shared/scoring.js";
import QuestionCard from "../../shared/components/rn/QuestionCard.js";
import PalettePanel from "../../shared/components/rn/PalettePanel.js";
import ExamTimer from "../../shared/components/rn/ExamTimer.js";
import ActionBar from "../../shared/components/rn/ActionBar.js";
import SectionTabs from "../../shared/components/rn/SectionTabs.js";
import { startExam, syncCheckpoint, submitExam, fetchBundle } from "../utils/api.js";

export default function ExamScreen({ route, navigation }) {
  useKeepAwake();
  const { vars } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const { examId = "rrb-gd-2024-full-1" } = route.params || {};

  const [bundle, setBundle]           = useState(null);
  const [sessionId, setSessionId]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [paletteVisible, setPalette]  = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [activeSectionId, setActiveSection] = useState(null);

  const syncRef = useRef(null);
  const sid     = useRef(null);
  const qstateRef = useRef(null);

  // Initialised after bundle loads
  const [qstateReady, setQstateReady] = useState(false);
  const [initQuestions, setInitQuestions] = useState(null);
  const [initDuration, setInitDuration]   = useState(5400);
  const [initElapsed, setInitElapsed]     = useState(0);

  // ── Load exam ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await startExam(examId);
        if (!res.ok) { setError(res.data?.error || "Failed to start exam"); return; }
        const token = await AsyncStorage.getItem("token");
        const b     = await fetchBundle(res.data.bundle_url, token);
        sid.current = res.data.session_id;
        setSessionId(res.data.session_id);
        setBundle(b);
        setActiveSection(b.sections?.[0]?.id || null);
        setInitQuestions(b.questions);
        setInitDuration(b.duration_s || 5400);
        setInitElapsed(res.data.elapsed_s || 0);
        setQstateReady(true);
      } catch (e) {
        setError("Network error — check your connection");
      } finally {
        setLoading(false);
      }
    })();
    // Block Android back button during exam
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert("Exit Exam?", "Your progress will be saved. Submit before leaving.", [
        { text: "Stay", style: "cancel" },
        { text: "Exit", style: "destructive", onPress: () => navigation.goBack() },
      ]);
      return true;
    });
    return () => { handler.remove(); clearInterval(syncRef.current); };
  }, []);

  // ── qstate hook — only rendered when bundle ready ────────────────────────
  const Exam = qstateReady ? _ExamInner : null;

  if (loading) return (
    <View style={[s.center, { backgroundColor: vars?.bg || "#F8FAFC" }]}>
      <Text style={{ color: vars?.textMuted || "#64748B", fontSize: 15 }}>Loading exam…</Text>
    </View>
  );

  if (error) return (
    <View style={[s.center, { backgroundColor: vars?.bg || "#F8FAFC" }]}>
      <Text style={{ color: "#DC2626", marginBottom: 16, fontSize: 15 }}>{error}</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 12, backgroundColor: vars?.primary || "#2563EB", borderRadius: 10 }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  if (!qstateReady || !bundle) return null;

  return (
    <_ExamInner
      bundle={bundle}
      sessionId={sessionId}
      initElapsed={initElapsed}
      vars={vars}
      isTablet={isTablet}
      activeSectionId={activeSectionId}
      setActiveSection={setActiveSection}
      paletteVisible={paletteVisible}
      setPalette={setPalette}
      submitModal={submitModal}
      setSubmitModal={setSubmitModal}
      submitting={submitting}
      setSubmitting={setSubmitting}
      navigation={navigation}
    />
  );
}

// ── Inner exam component — has access to useQstate ─────────────────────────
function _ExamInner({
  bundle, sessionId, initElapsed,
  vars, isTablet,
  activeSectionId, setActiveSection,
  paletteVisible, setPalette,
  submitModal, setSubmitModal,
  submitting, setSubmitting,
  navigation,
}) {
  const syncIntervalRef = useRef(null);

  const onSync = useCallback(async (serialized) => {
    if (!sessionId) return;
    const state = JSON.parse(serialized);
    const responses = {};
    for (const [id, q] of Object.entries(state.questions || {})) {
      if (q.attempted) responses[id] = { chosen: q.chosen, attempted: true };
    }
    await syncCheckpoint(sessionId, state.elapsed || 0, responses).catch(() => {});
  }, [sessionId]);

  const {
    state, currentQ, elapsed, timeRemaining,
    counts, isLast, isMarked, hasAnswer,
    goTo, selectOption, clearOption, toggleMark,
    prevQ, nextQ, getResponses,
  } = useQstate({ questions: bundle.questions, duration: bundle.duration_s, onSync });

  const s = styles(vars);

  // Section tabs data
  const sectionTabs = bundle.sections.map(sec => ({
    id: sec.id, label: sec.label,
    answered: counts.sections?.[sec.id]?.answered || 0,
    total: sec.count,
  }));

  const handleSectionSwitch = (sectionId) => {
    setActiveSection(sectionId);
    // Navigate to first not-visited question in section
    const first = state.order.find(id => state.questions[id].section === sectionId);
    if (first) goTo(first);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const responses = {};
      for (const [id, q] of Object.entries(state.questions)) {
        responses[id] = { chosen: q.chosen, attempted: q.attempted };
      }
      const res = await submitExam(sessionId, responses, elapsed);
      if (!res.ok) { Alert.alert("Error", res.data?.error || "Submission failed"); setSubmitting(false); return; }

      // Client scoring
      const sectionMap = {};
      for (const sec of bundle.sections) {
        sectionMap[sec.id] = bundle.questions
          .filter(q => q.section === sec.id)
          .map(q => ({
            chosen:    state.questions[q.id]?.chosen || null,
            correct:   res.data.answer_key[q.id],
            attempted: state.questions[q.id]?.attempted || false,
          }));
      }
      const result = scoreExam(sectionMap);

      navigation.replace("Result", {
        sessionId,
        score:      result.total.score,
        correct:    result.total.correct,
        wrong:      result.total.wrong,
        skipped:    result.total.skipped,
        total:      bundle.questions.length,
        pct:        percentage(result.total.rawScaled, bundle.questions.length),
        answerKey:  res.data.answer_key,
        responses,
        sections:   result.sections,
        elapsed,
      });
    } catch {
      Alert.alert("Error", "Network error — please try again");
      setSubmitting(false);
    }
  };

  const onExpire = useCallback(() => {
    Alert.alert("Time Up!", "Your exam has been submitted automatically.", [
      { text: "OK", onPress: handleSubmit },
    ]);
  }, [handleSubmit]);

  const currentQuestion = bundle.questions.find(q => q.id === currentQ?.id);
  const currentIndex    = state.order.indexOf(currentQ?.id);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: vars.bg }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.examTitle} numberOfLines={1}>RRB Group D</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!isTablet && (
            <TouchableOpacity style={s.paletteToggle} onPress={() => setPalette(true)}>
              <Text style={s.paletteToggleText}>Questions</Text>
            </TouchableOpacity>
          )}
          <ExamTimer
            duration={bundle.duration_s}
            elapsed={initElapsed}
            onTick={() => {}}
            onExpire={onExpire}
            vars={vars}
          />
        </View>
      </View>

      {/* Section tabs */}
      <SectionTabs sections={sectionTabs} activeId={activeSectionId} onSwitch={handleSectionSwitch} vars={vars} />

      {/* Body: question (+ tablet sidebar) */}
      <View style={[s.body, isTablet && s.bodyTablet]}>
        {/* Question */}
        <View style={s.questionCol}>
          <ScrollView style={s.questionScroll} keyboardShouldPersistTaps="handled">
            <Text style={s.qMeta}>Question {currentIndex + 1} of {state.order.length}</Text>
            {currentQuestion && (
              <QuestionCard
                question={{
                  ...currentQuestion,
                  index: currentIndex,
                  total: state.order.length,
                }}
                chosen={currentQ?.chosen}
                onSelect={(opt) => selectOption(currentQ?.id, opt)}
                vars={vars}
              />
            )}
          </ScrollView>
          <ActionBar
            isLast={isLast}
            isMarked={isMarked}
            hasAnswer={hasAnswer}
            onClear={() => clearOption(currentQ?.id)}
            onMark={() => toggleMark(currentQ?.id)}
            onSaveNext={() => isLast ? setSubmitModal(true) : nextQ()}
            vars={vars}
          />
        </View>

        {/* Tablet sidebar */}
        {isTablet && (
          <View style={s.sidebar}>
            <ScrollView>
              <PalettePanel
                questions={state.order.map((id, i) => ({ ...state.questions[id], index: i }))}
                currentId={currentQ?.id}
                onGoTo={goTo}
                vars={vars}
              />
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: vars.primary }]}
                onPress={() => setSubmitModal(true)}
              >
                <Text style={s.submitBtnText}>Submit Exam</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Mobile palette modal */}
      <Modal visible={paletteVisible} animationType="slide" transparent onRequestClose={() => setPalette(false)}>
        <TouchableOpacity style={s.paletteBackdrop} activeOpacity={1} onPress={() => setPalette(false)} />
        <View style={s.paletteDrawer}>
          <View style={s.drawerHandle} />
          <Text style={[s.drawerTitle, { color: vars.text }]}>Questions</Text>
          <ScrollView>
            <PalettePanel
              questions={state.order.map((id, i) => ({ ...state.questions[id], index: i }))}
              currentId={currentQ?.id}
              onGoTo={(id) => { goTo(id); setPalette(false); }}
              vars={vars}
            />
          </ScrollView>
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: vars.primary, margin: 12 }]}
            onPress={() => { setPalette(false); setSubmitModal(true); }}
          >
            <Text style={s.submitBtnText}>Submit Exam</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Submit modal */}
      <Modal visible={submitModal} animationType="fade" transparent onRequestClose={() => setSubmitModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalCard, { backgroundColor: vars.surface }]}>
            <Text style={[s.modalTitle, { color: vars.text }]}>Submit Exam?</Text>
            <Text style={[s.modalSub, { color: vars.textMuted }]}>
              You cannot change answers after submission.
            </Text>
            {/* Summary counts */}
            <View style={s.summaryCounts}>
              {[
                { val: counts.total.answered, label: "Answered",   color: "#16A34A" },
                { val: counts.total.skipped,  label: "Not Answered", color: "#DC2626" },
                { val: counts.total.marked,   label: "Marked",     color: "#7C3AED" },
                { val: counts.total.not_visited, label: "Not Visited", color: vars.textMuted },
              ].map(c => (
                <View key={c.label} style={s.summaryItem}>
                  <Text style={[s.summaryVal, { color: c.color }]}>{c.val}</Text>
                  <Text style={[s.summaryLbl, { color: vars.textMuted }]}>{c.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[s.modalBtn, { borderWidth: 1.5, borderColor: vars.border }]}
                onPress={() => setSubmitModal(false)}
                disabled={submitting}
              >
                <Text style={{ color: vars.text, fontWeight: "600" }}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: vars.primary }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {submitting ? "Submitting…" : "Submit Now"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (v) => StyleSheet.create({
  root:            { flex: 1 },
  center:          { flex: 1, alignItems: "center", justifyContent: "center" },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: v?.border || "#E2E8F0", backgroundColor: v?.surface || "#fff" },
  examTitle:       { fontSize: 15, fontWeight: "800", color: v?.text || "#0F172A", flex: 1 },
  paletteToggle:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: v?.border || "#E2E8F0" },
  paletteToggleText: { fontSize: 13, fontWeight: "600", color: v?.text || "#0F172A" },
  body:            { flex: 1 },
  bodyTablet:      { flexDirection: "row" },
  questionCol:     { flex: 1, flexDirection: "column" },
  questionScroll:  { flex: 1, padding: 16 },
  qMeta:           { fontSize: 12, color: v?.textMuted || "#64748B", marginBottom: 8, fontWeight: "500" },
  sidebar:         { width: 280, borderLeftWidth: 1, borderLeftColor: v?.border || "#E2E8F0", backgroundColor: v?.surface || "#fff", padding: 8 },
  submitBtn:       { margin: 8, padding: 14, borderRadius: 10, alignItems: "center" },
  submitBtnText:   { color: "#fff", fontWeight: "700", fontSize: 14 },
  paletteBackdrop: { position: "absolute", inset: 0, flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  paletteDrawer:   { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: v?.surface || "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "75%", paddingBottom: 16 },
  drawerHandle:    { width: 40, height: 4, backgroundColor: v?.border || "#E2E8F0", borderRadius: 2, margin: "auto", marginTop: 12, marginBottom: 8, alignSelf: "center" },
  drawerTitle:     { fontSize: 15, fontWeight: "700", paddingHorizontal: 16, paddingBottom: 8 },
  modalBackdrop:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard:       { borderRadius: 16, padding: 20, width: "100%", maxWidth: 400 },
  modalTitle:      { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  modalSub:        { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  summaryCounts:   { flexDirection: "row", justifyContent: "space-around" },
  summaryItem:     { alignItems: "center", gap: 2 },
  summaryVal:      { fontSize: 22, fontWeight: "800" },
  summaryLbl:      { fontSize: 11, textAlign: "center" },
  modalBtn:        { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
