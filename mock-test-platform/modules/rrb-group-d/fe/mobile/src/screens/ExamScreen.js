import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  useWindowDimensions, ActivityIndicator, BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useActivateKeepAwake } from "expo-keep-awake";

import { startExam, submitExam, syncCheckpoint, fetchBundle } from "../utils/api.js";
import useQstate from "../../../shared/useQstate.js";
import QuestionCard from "../../../shared/components/rn/QuestionCard.js";
import PalettePanel from "../../../shared/components/rn/PalettePanel.js";
import ExamTimer from "../../../shared/components/rn/ExamTimer.js";
import ActionBar from "../../../shared/components/rn/ActionBar.js";
import SectionTabs from "../../../shared/components/rn/SectionTabs.js";

const VARS = {
  text:      "#111827",
  textMuted: "#6B7280",
  surface:   "#FFFFFF",
  surface2:  "#F3F4F6",
  border:    "#E5E7EB",
  primary:   "#2563EB",
  bg:        "#F9FAFB",
};

const TABLET_WIDTH = 768;

export default function ExamScreen({ route, navigation }) {
  useActivateKeepAwake();

  const { examId } = route.params;
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_WIDTH;

  const [phase, setPhase]           = useState("loading"); // loading | exam | submitting | error
  const [errorMsg, setErrorMsg]     = useState("");
  const [sessionId, setSessionId]   = useState("");
  const [duration, setDuration]     = useState(5400);
  const [questions, setQuestions]   = useState([]);
  const [questionMeta, setQuestionMeta] = useState([]);
  const [showPalette, setShowPalette]   = useState(false);
  const [showSubmit, setShowSubmit]     = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const sessionRef = useRef("");

  const qstate = useQstate({
    questions: questionMeta,
    duration,
    onSync: async (serialized) => {
      const parsed = JSON.parse(serialized);
      const responses = {};
      for (const [id, q] of Object.entries(parsed.questions)) {
        responses[id] = { chosen: q.chosen, attempted: q.attempted };
      }
      await syncCheckpoint(sessionRef.current, qstate.elapsed, responses);
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const startRes = await startExam(examId);
      if (!startRes.ok) {
        if (!cancelled) { setErrorMsg("Failed to start exam"); setPhase("error"); }
        return;
      }
      const { session_id, bundle_url, duration_s } = startRes.data;
      sessionRef.current = session_id;

      const bundle = await fetchBundle(bundle_url, null);
      if (!cancelled) {
        setSessionId(session_id);
        setDuration(duration_s);
        setQuestions(bundle.questions);
        setQuestionMeta(bundle.questions.map(q => ({ id: q.id, section: q.section })));
        if (bundle.questions[0]) setActiveSection(bundle.questions[0].section);
        setPhase("exam");
      }
    })().catch(e => {
      if (!cancelled) { setErrorMsg(String(e)); setPhase("error"); }
    });
    return () => { cancelled = true; };
  }, [examId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showPalette) { setShowPalette(false); return true; }
      if (showSubmit)  { setShowSubmit(false);  return true; }
      return true;
    });
    return () => sub.remove();
  }, [showPalette, showSubmit]);

  const handleSubmit = useCallback(async () => {
    setShowSubmit(false);
    setPhase("submitting");
    const responses = {};
    for (const [id, q] of Object.entries(qstate.state.questions)) {
      responses[id] = { chosen: q.chosen, attempted: q.attempted };
    }
    const res = await submitExam(sessionId, responses, qstate.elapsed);
    if (!res.ok) { setErrorMsg("Submission failed"); setPhase("error"); return; }

    const { answer_key, result } = res.data;
    const sectionsMap = {};
    for (const bq of questions) {
      if (!sectionsMap[bq.section]) sectionsMap[bq.section] = { correct: 0, wrong: 0, skipped: 0, rawScaled: 0 };
      const sq = responses[bq.id];
      if (!sq.attempted || sq.chosen == null) { sectionsMap[bq.section].skipped++; }
      else if (sq.chosen === answer_key[bq.id]) { sectionsMap[bq.section].correct++; sectionsMap[bq.section].rawScaled += 1000; }
      else { sectionsMap[bq.section].wrong++; sectionsMap[bq.section].rawScaled -= 333; }
    }

    const pct = result.total_qs > 0
      ? Math.round((result.correct / result.total_qs) * 10000) / 100
      : 0;

    navigation.replace("Result", {
      sessionId,
      score:     result.score,
      correct:   result.correct,
      wrong:     result.wrong,
      skipped:   result.skipped,
      total:     result.total_qs,
      pct,
      answerKey: answer_key,
      responses,
      sections:  sectionsMap,
      elapsed:   qstate.elapsed,
    });
  }, [sessionId, qstate, questions, navigation]);

  const handleSaveNext = useCallback(() => {
    if (qstate.isLast) { setShowSubmit(true); return; }
    qstate.nextQ();
  }, [qstate]);

  const currentBundle = qstate.state.current
    ? questions.find(q => q.id === qstate.state.current) ?? null
    : null;

  const sectionTabs = buildSectionTabs(questions, qstate.state);
  const paletteQs   = qstate.state.order.map((id, i) => ({
    id, index: i, status: qstate.state.questions[id].status,
  }));

  if (phase === "loading") {
    return (
      <SafeAreaView style={[s.fill, s.center, { backgroundColor: VARS.bg }]}>
        <ActivityIndicator size="large" color={VARS.primary} />
        <Text style={{ color: VARS.textMuted, marginTop: 12 }}>Loading exam…</Text>
      </SafeAreaView>
    );
  }
  if (phase === "error") {
    return (
      <SafeAreaView style={[s.fill, s.center, { backgroundColor: VARS.bg }]}>
        <Text style={{ color: "#DC2626", fontSize: 16, textAlign: "center" }}>{errorMsg}</Text>
      </SafeAreaView>
    );
  }
  if (phase === "submitting") {
    return (
      <SafeAreaView style={[s.fill, s.center, { backgroundColor: VARS.bg }]}>
        <ActivityIndicator size="large" color={VARS.primary} />
        <Text style={{ color: VARS.textMuted, marginTop: 12 }}>Submitting…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: VARS.bg }]}>
      <View style={[s.header, { backgroundColor: VARS.surface, borderBottomColor: VARS.border }]}>
        <Text style={[s.headerTitle, { color: VARS.text }]} numberOfLines={1}>RRB Group D</Text>
        <ExamTimer duration={duration} elapsed={qstate.elapsed} onExpire={() => handleSubmit()} vars={VARS} />
        {!isTablet && (
          <TouchableOpacity onPress={() => setShowPalette(true)} style={[s.paletteToggle, { borderColor: VARS.border }]}>
            <Text style={{ color: VARS.primary, fontWeight: "700", fontSize: 13 }}>
              {qstate.counts.total.answered}/{qstate.state.order.length}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <SectionTabs
        sections={sectionTabs}
        activeId={activeSection}
        onSwitch={id => {
          setActiveSection(id);
          const first = questions.find(q => q.section === id);
          if (first) qstate.goTo(first.id);
        }}
        vars={VARS}
      />

      <View style={s.body}>
        <View style={[s.questionArea, isTablet && s.questionAreaTablet]}>
          {currentBundle && qstate.currentQ ? (
            <QuestionCard
              question={{
                index:   qstate.state.order.indexOf(qstate.state.current),
                total:   qstate.state.order.length,
                text:    currentBundle.text,
                image:   currentBundle.image,
                options: currentBundle.options,
              }}
              chosen={qstate.currentQ.chosen}
              onSelect={key => qstate.selectOption(qstate.state.current, key)}
              vars={VARS}
            />
          ) : null}
        </View>

        {isTablet && (
          <View style={[s.sidebar, { backgroundColor: VARS.surface, borderLeftColor: VARS.border }]}>
            <PalettePanel
              questions={paletteQs}
              currentId={qstate.state.current}
              onGoTo={qstate.goTo}
              vars={VARS}
            />
          </View>
        )}
      </View>

      <ActionBar
        isLast={qstate.isLast}
        isMarked={qstate.isMarked}
        hasAnswer={qstate.hasAnswer}
        onClear={() => qstate.state.current && qstate.clearOption(qstate.state.current)}
        onMark={() => qstate.state.current && qstate.toggleMark(qstate.state.current)}
        onSaveNext={handleSaveNext}
        vars={VARS}
      />

      {!isTablet && (
        <Modal visible={showPalette} transparent animationType="slide" onRequestClose={() => setShowPalette(false)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowPalette(false)} />
          <View style={[s.drawer, { backgroundColor: VARS.surface }]}>
            <Text style={[s.drawerTitle, { color: VARS.text, borderBottomColor: VARS.border }]}>Question Palette</Text>
            <PalettePanel
              questions={paletteQs}
              currentId={qstate.state.current}
              onGoTo={id => { qstate.goTo(id); setShowPalette(false); }}
              vars={VARS}
            />
          </View>
        </Modal>
      )}

      <Modal visible={showSubmit} transparent animationType="fade" onRequestClose={() => setShowSubmit(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.submitCard, { backgroundColor: VARS.surface, borderColor: VARS.border }]}>
            <Text style={[s.submitTitle, { color: VARS.text }]}>Submit Exam?</Text>
            <Text style={[s.submitBody, { color: VARS.textMuted }]}>
              {qstate.counts.total.answered} answered · {qstate.counts.total.skipped} skipped · {qstate.counts.total.not_visited} not visited
            </Text>
            <View style={s.submitActions}>
              <TouchableOpacity style={[s.submitBtn, { borderColor: VARS.border, borderWidth: 1.5 }]} onPress={() => setShowSubmit(false)}>
                <Text style={{ color: VARS.text, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submitBtn, { backgroundColor: VARS.primary }]} onPress={() => handleSubmit()}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function buildSectionTabs(bundleQs, state) {
  const sections = {};
  for (const q of bundleQs) {
    if (!sections[q.section]) sections[q.section] = { label: q.section, answered: 0, total: 0 };
    sections[q.section].total++;
    const sq = state.questions[q.id];
    if (sq?.status === "answered" || sq?.status === "answered_marked") sections[q.section].answered++;
  }
  return Object.entries(sections).map(([id, v]) => ({ id, ...v }));
}

const s = StyleSheet.create({
  fill:              { flex: 1 },
  center:            { alignItems: "center", justifyContent: "center" },
  header:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  headerTitle:       { flex: 1, fontSize: 16, fontWeight: "700" },
  paletteToggle:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1.5 },
  body:              { flex: 1, flexDirection: "row" },
  questionArea:      { flex: 1, padding: 12 },
  questionAreaTablet:{ flex: 2 },
  sidebar:           { flex: 1, borderLeftWidth: 1 },
  overlay:           { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  drawer:            { position: "absolute", bottom: 0, left: 0, right: 0, height: "70%", borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  drawerTitle:       { fontSize: 15, fontWeight: "700", padding: 12, borderBottomWidth: 1 },
  modalOverlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 20 },
  submitCard:        { width: "100%", borderRadius: 16, padding: 24, borderWidth: 1 },
  submitTitle:       { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  submitBody:        { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  submitActions:     { flexDirection: "row", gap: 10 },
  submitBtn:         { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
