import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, OPPONENTS } from "../events.js";
import { SQUAD } from "../squad.js";

const POSITIONS = ["GK", "CB", "FB", "MID", "FWD"];
const WHENS = ["any", "leading", "leading2", "trailing", "trailing2", "level"];

test("the squad is usable for every position a slot can ask for", () => {
  for (const p of POSITIONS) {
    const n = SQUAD.filter((x) => x.position === p).length;
    const maxSlots = Math.max(...EVENTS.map((e) => Object.values(e.slots).filter((s) => s === p).length));
    assert.ok(n >= maxSlots, `${p}: squad has ${n}, an event needs ${maxSlots}`);
  }
  for (const player of SQUAD) {
    assert.ok(POSITIONS.includes(player.position), `${player.name} has position "${player.position}"`);
    assert.ok(player.name && player.number && player.image_url);
  }
});

test("every event is well formed", () => {
  const ids = new Set();
  for (const e of EVENTS) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.ok(["open", "mid", "end"].includes(e.phase), `event ${e.id} phase`);
    assert.ok(WHENS.includes(e.when), `event ${e.id} when=${e.when}`);
    assert.ok(e.text.trim().length > 20, `event ${e.id} text too short`);
    assert.equal(e.choices.length, 2, `event ${e.id} must have exactly 2 choices`);
    assert.ok(e.pre && Number.isInteger(e.pre.us) && Number.isInteger(e.pre.them));
    for (const [slot, position] of Object.entries(e.slots)) {
      assert.ok(POSITIONS.includes(position), `event ${e.id} slot ${slot} position ${position}`);
    }
    for (const c of e.choices) {
      assert.ok(c.text.trim().length > 5, `event ${e.id} choice too short`);
      for (const key of ["good", "bad"]) {
        const o = c[key];
        assert.ok(o && o.text.trim().length > 15, `event ${e.id} ${key} outcome missing`);
        assert.ok(Number.isInteger(o.us) && Number.isInteger(o.them), `event ${e.id} ${key} score`);
        assert.ok(o.us >= 0 && o.them >= 0 && o.us <= 4 && o.them <= 4, `event ${e.id} ${key} score range`);
      }
    }
    assert.ok(c_goodBeatsBad(e), `event ${e.id}: the good outcome is not better than the bad one`);
  }
  function c_goodBeatsBad(e) {
    return e.choices.every((c) => c.good.us - c.good.them >= c.bad.us - c.bad.them);
  }
});

test("every slot used in a text is declared in the event", () => {
  for (const e of EVENTS) {
    const declared = new Set([...Object.keys(e.slots), "opp", "min", "n1", "n2"]);
    const texts = [e.text, ...e.choices.flatMap((c) => [c.text, c.good.text, c.bad.text])];
    for (const t of texts) {
      for (const m of t.matchAll(/\{(\w+)\}/g)) {
        assert.ok(declared.has(m[1]), `event ${e.id} uses {${m[1]}} which is not declared`);
      }
    }
  }
});

test("there are enough events, and enough per phase", () => {
  assert.ok(EVENTS.length >= 45, `only ${EVENTS.length} events`);
  const counts = { open: 0, mid: 0, end: 0 };
  for (const e of EVENTS) counts[e.phase] += 1;
  assert.ok(counts.open >= 10, `open: ${counts.open}`);
  assert.ok(counts.mid >= 12, `mid: ${counts.mid}`);
  assert.ok(counts.end >= 10, `end: ${counts.end}`);
  for (const phase of ["mid", "end"]) {
    const unconditional = EVENTS.filter((e) => e.phase === phase && e.when === "any").length;
    assert.ok(unconditional >= 6, `${phase} has only ${unconditional} unconditional events`);
  }
  assert.ok(OPPONENTS.length >= 8);
});

test("player-facing text has no leftover latin letters", () => {
  const texts = EVENTS.flatMap((e) => [e.text, ...e.choices.flatMap((c) => [c.text, c.good.text, c.bad.text])]);
  for (const t of texts) {
    const latin = t.replace(/\{\w+\}/g, "").match(/[A-Za-z]{2,}/g);
    assert.ok(!latin || latin.every((w) => w === "VAR"), `latin text found: ${latin} in "${t}"`);
  }
});
