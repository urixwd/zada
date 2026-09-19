import test from "node:test";
import assert from "node:assert/strict";
import { load, save, addMatch, clear } from "../storage.js";

const fakeStore = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
};
const throwingStore = () => ({
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); }
});

const match = (us, them) => ({ seed: 1, date: "2026-09-20", opponent: "מכבי חיפה", score: { us, them }, rounds: [] });

test("an empty store gives an empty state", () => {
  const data = load(fakeStore());
  assert.deepEqual(data.matches, []);
  assert.deepEqual(data.record, { w: 0, d: 0, l: 0 });
});

test("matches are saved, newest first, and the record adds up", () => {
  const store = fakeStore();
  addMatch(store, match(3, 1));
  addMatch(store, match(0, 0));
  addMatch(store, match(1, 4));
  const data = load(store);
  assert.equal(data.matches.length, 3);
  assert.deepEqual(data.matches[0].score, { us: 1, them: 4 });
  assert.deepEqual(data.record, { w: 1, d: 1, l: 1 });
});

test("history is capped at 50 matches", () => {
  const store = fakeStore();
  for (let i = 0; i < 60; i++) addMatch(store, match(i, 0));
  assert.equal(load(store).matches.length, 50);
});

test("corrupt data falls back to empty instead of crashing", () => {
  const store = fakeStore();
  store.setItem("zadaball.v1", "{not json");
  assert.deepEqual(load(store).matches, []);
  store.setItem("zadaball.v1", JSON.stringify({ version: 99 }));
  assert.deepEqual(load(store).matches, []);
});

test("a store that throws never breaks the game", () => {
  const store = throwingStore();
  assert.deepEqual(load(store).matches, []);
  assert.equal(save(store, { version: 1, matches: [], record: { w: 0, d: 0, l: 0 } }), false);
  assert.doesNotThrow(() => addMatch(store, match(2, 0)));
  assert.doesNotThrow(() => clear(store));
});
