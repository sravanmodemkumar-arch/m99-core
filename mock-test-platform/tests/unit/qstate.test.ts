import { describe, it, expect } from "vitest";
import {
  Q, initState, goTo, selectOption, clearOption, toggleMark,
  tick, summary, buildResponses, serialize, deserialize,
} from "../../modules/rrb-group-d/fe/shared/qstate.js";
import type { ExamState } from "../../modules/rrb-group-d/fe/shared/qstate.js";

const qs2 = [
  { id: "q1", section: "math" },
  { id: "q2", section: "math" },
];

const qs3 = [
  { id: "q1", section: "math" },
  { id: "q2", section: "math" },
  { id: "q3", section: "science" },
];

// ── initState ─────────────────────────────────────────────────────────────────

describe("initState", () => {
  it("all questions start as NOT_VISITED", () => {
    const s = initState(qs3);
    for (const q of Object.values(s.questions)) {
      expect(q.status).toBe(Q.NOT_VISITED);
    }
  });

  it("current is first question id", () => {
    expect(initState(qs3).current).toBe("q1");
  });

  it("order matches input array", () => {
    expect(initState(qs3).order).toEqual(["q1", "q2", "q3"]);
  });

  it("elapsed starts at 0", () => {
    expect(initState(qs3).elapsed).toBe(0);
  });

  it("submitted starts false", () => {
    expect(initState(qs3).submitted).toBe(false);
  });

  it("empty questions array → current is null", () => {
    const s = initState([]);
    expect(s.current).toBeNull();
    expect(s.order).toEqual([]);
  });

  it("section assignment is preserved", () => {
    const s = initState(qs3);
    expect(s.questions["q3"].section).toBe("science");
  });
});

// ── goTo ──────────────────────────────────────────────────────────────────────

describe("goTo", () => {
  it("NOT_VISITED target → ACTIVE", () => {
    const s = goTo(initState(qs3), "q2");
    expect(s.questions["q2"].status).toBe(Q.ACTIVE);
  });

  it("previous ACTIVE question → SKIPPED when leaving", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");     // q1: NOT_VISITED → ACTIVE
    s = goTo(s, "q2");     // q1: ACTIVE → SKIPPED; q2: NOT_VISITED → ACTIVE
    expect(s.questions["q1"].status).toBe(Q.SKIPPED);
    expect(s.questions["q2"].status).toBe(Q.ACTIVE);
  });

  it("previous NOT_VISITED question → stays NOT_VISITED when leaving", () => {
    const s = goTo(initState(qs2), "q2");
    // q1 was NOT_VISITED (not ACTIVE), so it stays NOT_VISITED
    expect(s.questions["q1"].status).toBe(Q.NOT_VISITED);
  });

  it("ANSWERED question stays ANSWERED when re-visited", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = selectOption(s, "q1", "A");   // q1: ANSWERED
    s = goTo(s, "q2");
    s = goTo(s, "q1");                 // revisit q1
    expect(s.questions["q1"].status).toBe(Q.ANSWERED);
  });

  it("visitCount increments on each visit", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    expect(s.questions["q1"].visitCount).toBe(1);
    s = goTo(s, "q2");
    s = goTo(s, "q1");
    expect(s.questions["q1"].visitCount).toBe(2);
  });

  it("current updates to targetId", () => {
    const s = goTo(initState(qs2), "q2");
    expect(s.current).toBe("q2");
  });

  it("goTo same question as current → no SKIPPED regression", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = goTo(s, "q1");   // go to same question
    expect(s.questions["q1"].status).toBe(Q.ACTIVE);
  });
});

// ── selectOption ──────────────────────────────────────────────────────────────

describe("selectOption", () => {
  it("sets chosen and marks ANSWERED", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = selectOption(s, "q1", "B");
    expect(s.questions["q1"].chosen).toBe("B");
    expect(s.questions["q1"].status).toBe(Q.ANSWERED);
    expect(s.questions["q1"].attempted).toBe(true);
  });

  it("MARKED_REVIEW + answer → ANSWERED_MARKED", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = toggleMark(s, "q1");        // ACTIVE → MARKED_REVIEW
    s = selectOption(s, "q1", "C");
    expect(s.questions["q1"].status).toBe(Q.ANSWERED_MARKED);
  });

  it("ANSWERED_MARKED + new option → stays ANSWERED_MARKED", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = toggleMark(s, "q1");
    s = selectOption(s, "q1", "A");  // ANSWERED_MARKED
    s = selectOption(s, "q1", "B");  // change answer
    expect(s.questions["q1"].status).toBe(Q.ANSWERED_MARKED);
    expect(s.questions["q1"].chosen).toBe("B");
  });
});

// ── clearOption ───────────────────────────────────────────────────────────────

describe("clearOption", () => {
  it("ANSWERED → ACTIVE, clears chosen + attempted", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = selectOption(s, "q1", "A");
    s = clearOption(s, "q1");
    expect(s.questions["q1"].status).toBe(Q.ACTIVE);
    expect(s.questions["q1"].chosen).toBeNull();
    expect(s.questions["q1"].attempted).toBe(false);
  });

  it("ANSWERED_MARKED → MARKED_REVIEW", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = toggleMark(s, "q1");
    s = selectOption(s, "q1", "A");  // ANSWERED_MARKED
    s = clearOption(s, "q1");
    expect(s.questions["q1"].status).toBe(Q.MARKED_REVIEW);
    expect(s.questions["q1"].chosen).toBeNull();
  });
});

// ── toggleMark ────────────────────────────────────────────────────────────────

describe("toggleMark", () => {
  it("ACTIVE → MARKED_REVIEW", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = toggleMark(s, "q1");
    expect(s.questions["q1"].status).toBe(Q.MARKED_REVIEW);
  });

  it("MARKED_REVIEW (no answer) → ACTIVE", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = toggleMark(s, "q1");
    s = toggleMark(s, "q1");
    expect(s.questions["q1"].status).toBe(Q.ACTIVE);
  });

  it("ANSWERED → ANSWERED_MARKED", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = selectOption(s, "q1", "A");
    s = toggleMark(s, "q1");
    expect(s.questions["q1"].status).toBe(Q.ANSWERED_MARKED);
  });

  it("ANSWERED_MARKED → ANSWERED", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = selectOption(s, "q1", "A");
    s = toggleMark(s, "q1");   // ANSWERED → ANSWERED_MARKED
    s = toggleMark(s, "q1");   // ANSWERED_MARKED → ANSWERED
    expect(s.questions["q1"].status).toBe(Q.ANSWERED);
  });

  it("MARKED_REVIEW with chosen answer → ANSWERED", () => {
    // Manually put question into MARKED_REVIEW with a chosen answer via state patch
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = toggleMark(s, "q1");   // ACTIVE → MARKED_REVIEW
    // Force chosen without changing status (simulate external state)
    s = { ...s, questions: { ...s.questions, q1: { ...s.questions["q1"], chosen: "A" } } };
    s = toggleMark(s, "q1");
    expect(s.questions["q1"].status).toBe(Q.ANSWERED);
  });
});

// ── tick ──────────────────────────────────────────────────────────────────────

describe("tick", () => {
  it("increments elapsed by 1", () => {
    const s = tick(initState(qs2));
    expect(s.elapsed).toBe(1);
  });

  it("increments current question timeSpent", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = tick(s);
    expect(s.questions["q1"].timeSpent).toBe(1);
    expect(s.questions["q2"].timeSpent).toBe(0);
  });

  it("5 ticks → elapsed = 5, current timeSpent = 5", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    for (let i = 0; i < 5; i++) s = tick(s);
    expect(s.elapsed).toBe(5);
    expect(s.questions["q1"].timeSpent).toBe(5);
  });

  it("null current → no crash, elapsed still increments", () => {
    const s = tick(initState([]));
    expect(s.elapsed).toBe(1);
  });

  it("timeSpent accumulates across question switches", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = tick(s); s = tick(s);       // 2s on q1
    s = goTo(s, "q2");
    s = tick(s);                     // 1s on q2
    expect(s.questions["q1"].timeSpent).toBe(2);
    expect(s.questions["q2"].timeSpent).toBe(1);
    expect(s.elapsed).toBe(3);
  });
});

// ── summary ───────────────────────────────────────────────────────────────────

describe("summary", () => {
  it("counts by status correctly across sections", () => {
    let s = initState(qs3);
    s = goTo(s, "q1");
    s = selectOption(s, "q1", "A");   // q1: ANSWERED
    s = goTo(s, "q2");                 // q2: ACTIVE
    s = toggleMark(s, "q2");          // q2: MARKED_REVIEW
    // q3: NOT_VISITED

    const c = summary(s);
    expect(c.total.answered).toBe(1);
    expect(c.total.marked).toBe(1);
    expect(c.total.not_visited).toBe(1);
    expect(c.sections["math"].answered).toBe(1);
    expect(c.sections["science"].not_visited).toBe(1);
  });

  it("ANSWERED_MARKED counts in both answered and marked", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = selectOption(s, "q1", "A");
    s = toggleMark(s, "q1");         // ANSWERED_MARKED

    const c = summary(s);
    expect(c.total.answered).toBe(1);
    expect(c.total.marked).toBe(1);
  });
});

// ── buildResponses ────────────────────────────────────────────────────────────

describe("buildResponses", () => {
  it("returns one ResponseRow per question in order", () => {
    let s = initState(qs2);
    s = goTo(s, "q1");
    s = selectOption(s, "q1", "A");
    const rows = buildResponses(s, { q1: "A", q2: "B" });
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("q1");
    expect(rows[0].chosen).toBe("A");
    expect(rows[0].correct).toBe("A");
    expect(rows[0].attempted).toBe(true);
  });

  it("unattempted question → chosen null, attempted false", () => {
    const s = initState(qs2);
    const rows = buildResponses(s, { q1: "A", q2: "B" });
    expect(rows[0].chosen).toBeNull();
    expect(rows[0].attempted).toBe(false);
  });

  it("order is preserved from state.order, not Object.keys", () => {
    const s = initState([{ id: "z", section: "s" }, { id: "a", section: "s" }]);
    const rows = buildResponses(s, { z: "A", a: "B" });
    expect(rows[0].id).toBe("z");
    expect(rows[1].id).toBe("a");
  });
});

// ── serialize / deserialize ───────────────────────────────────────────────────

describe("serialize / deserialize", () => {
  it("round-trips state losslessly", () => {
    let s = initState(qs3);
    s = goTo(s, "q1");
    s = selectOption(s, "q1", "B");
    s = goTo(s, "q3");
    s = toggleMark(s, "q3");

    const restored: ExamState = deserialize(serialize(s));
    expect(restored.questions["q1"].chosen).toBe("B");
    expect(restored.questions["q1"].status).toBe(Q.ANSWERED);
    expect(restored.questions["q3"].status).toBe(Q.MARKED_REVIEW);
    expect(restored.order).toEqual(s.order);
    expect(restored.elapsed).toBe(s.elapsed);
  });

  it("deserialize always sets submitted=false", () => {
    const s = initState(qs2);
    const restored = deserialize(serialize(s));
    expect(restored.submitted).toBe(false);
  });

  it("deserialize recalculates startedAt from elapsed", () => {
    let s = initState(qs2);
    for (let i = 0; i < 60; i++) s = tick(s);   // 60s elapsed
    const before = Date.now();
    const restored = deserialize(serialize(s));
    // startedAt should be approximately now - 60s
    expect(restored.startedAt).toBeGreaterThan(before - 65000);
    expect(restored.startedAt).toBeLessThanOrEqual(before);
  });
});
