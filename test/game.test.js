import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, OPPONENTS } from "../events.js";
import { SQUAD } from "../squad.js";
import { startMatch, choose, mulberry32, render, drawSlots, matchesWhen, ROUND_PHASES, verdict, shareText } from "../game.js";

const deps = { events: EVENTS, squad: SQUAD, opponents: OPPONENTS };
const playMatch = (seed, picks = null) => {
  let state = startMatch({ ...deps, seed });
  const rounds = [];
  let i = 0;
  while (!state.finished) {
    const idx = picks ? picks[i] : (i % 2);
    const res = choose(state, idx, deps);
    rounds.push(res.resolved);
    state = res.state;
    i++;
  }
  return { state, rounds };
};

test("a match is exactly 5 rounds, no event repeats", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { state, rounds } = playMatch(seed);
    assert.equal(rounds.length, 5);
    assert.equal(state.usedIds.length, new Set(state.usedIds).size);
  }
});

test("phases come in the right order", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const { rounds } = playMatch(seed);
    const phases = rounds.map((r) => EVENTS.find((e) => e.id === r.eventId).phase);
    assert.deepEqual(phases, ROUND_PHASES);
  }
});

test("minutes advance through the match", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const { rounds } = playMatch(seed);
    const mins = rounds.map((r) => r.minute);
    assert.ok(mins[0] <= 20, `round 1 minute ${mins[0]}`);
    assert.ok(mins[3] >= 72 && mins[4] >= 72);
  }
});

test("the same seed replays the same match", () => {
  const a = playMatch(4242, [0, 1, 0, 1, 0]);
  const b = playMatch(4242, [0, 1, 0, 1, 0]);
  assert.deepEqual(b.rounds, a.rounds);
  assert.equal(b.state.us, a.state.us);
  assert.equal(b.state.them, a.state.them);
  assert.equal(b.state.opponent, a.state.opponent);
});

test("different seeds give different matches", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 50; seed++) seen.add(playMatch(seed).state.usedIds.join(","));
  assert.ok(seen.size > 40, `only ${seen.size} distinct matches in 50 seeds`);
});

test("slots resolve to the right position and never repeat a player", () => {
  const rng = mulberry32(7);
  for (const event of EVENTS) {
    for (let i = 0; i < 20; i++) {
      const players = drawSlots(event.slots, SQUAD, rng);
      const numbers = Object.values(players).map((p) => p.number);
      assert.equal(numbers.length, new Set(numbers).size, `event ${event.id} drew a player twice`);
      for (const [slot, position] of Object.entries(event.slots)) {
        assert.equal(players[slot].position, position, `event ${event.id} slot ${slot}`);
      }
    }
  }
});

test("every placeholder in every text resolves", () => {
  const ctx = (event) => ({
    opponent: "היריבה",
    minute: 55,
    numbers: { n1: 4, n2: 13 },
    players: drawSlots(event.slots, SQUAD, mulberry32(1))
  });
  for (const event of EVENTS) {
    const c = ctx(event);
    const texts = [event.text];
    for (const choice of event.choices) {
      texts.push(choice.text, choice.good.text, choice.bad.text);
    }
    for (const t of texts) {
      const out = render(t, c);
      assert.ok(!/\{\w+\}/.test(out), `event ${event.id} left a placeholder: ${out}`);
    }
  }
});

test("the score only moves as the event and the chosen outcome declare", () => {
  for (let seed = 1; seed <= 100; seed++) {
    let state = startMatch({ ...deps, seed });
    let us = 0;
    let them = 0;
    while (!state.finished) {
      const event = EVENTS.find((e) => e.id === state.current.eventId);
      us += event.pre.us;
      them += event.pre.them;
      const idx = seed % 2;
      const res = choose(state, idx, deps);
      const outcome = event.choices[idx][res.resolved.outcome];
      us += outcome.us;
      them += outcome.them;
      assert.equal(res.resolved.score.us, us);
      assert.equal(res.resolved.score.them, them);
      state = res.state;
    }
  }
});

test("conditional events only appear when the score fits", () => {
  for (let seed = 1; seed <= 300; seed++) {
    let state = startMatch({ ...deps, seed });
    while (!state.finished) {
      const event = EVENTS.find((e) => e.id === state.current.eventId);
      const before = { us: state.us - event.pre.us, them: state.them - event.pre.them };
      const sameFit = EVENTS.filter(
        (e) => e.phase === event.phase && !state.usedIds.slice(0, -1).includes(e.id) && matchesWhen(e.when, before.us, before.them)
      );
      if (sameFit.length) assert.ok(matchesWhen(event.when, before.us, before.them), `event ${event.id} drawn at ${before.us}-${before.them}`);
      state = choose(state, 0, deps).state;
    }
  }
});

test("both outcomes really happen, roughly half and half", () => {
  let good = 0;
  let total = 0;
  for (let seed = 1; seed <= 300; seed++) {
    for (const r of playMatch(seed).rounds) {
      if (r.outcome === "good") good++;
      total++;
    }
  }
  const ratio = good / total;
  assert.ok(ratio > 0.4 && ratio < 0.6, `good outcome ratio ${ratio}`);
});

test("verdict and share text are produced for any score", () => {
  const { state } = playMatch(99);
  assert.ok(verdict(state.us, state.them).length > 5);
  const text = shareText(state, "https://example.com");
  assert.match(text, /זדה בול/);
  assert.equal(text.split("\n").length, 4);
});

test("choosing after the match ends throws", () => {
  const { state } = playMatch(5);
  assert.throws(() => choose(state, 0, deps));
});
