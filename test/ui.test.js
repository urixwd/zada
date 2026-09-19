// בדיקת חיווט: מריצים את המשחק על DOM אמיתי (jsdom) בלי דפדפן.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// jsdom נותן לכל מופע localStorage משלו, אז 'טעינה מחדש' = לזרוע את מה שנשמר קודם.
async function boot(saved) {
  const dom = new JSDOM(html, { url: "https://urixwd.github.io/zada/", pretendToBeVisual: true });
  const { window } = dom;
  if (saved) window.localStorage.setItem("zadaball.v1", saved);
  const define = (key, value) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  define("window", window);
  define("document", window.document);
  define("navigator", window.navigator);
  define("location", window.location);
  define("setTimeout", window.setTimeout.bind(window));
  define("clearTimeout", window.clearTimeout.bind(window));
  await import(`../ui.js?${Math.random()}`);
  return window.document;
}

const savedState = (doc) => doc.defaultView.localStorage.getItem("zadaball.v1");

const $ = (doc, id) => doc.getElementById(id);
const visible = (doc, id) => !$(doc, id).hidden;

test("the home screen opens and the record line is filled", async () => {
  const doc = await boot();
  assert.ok(visible(doc, "screen-home"));
  assert.ok(!visible(doc, "screen-match"));
  assert.match($(doc, "home-record").textContent, /משחק|משחקים/);
});

test("a full match runs from kick-off to the final whistle", async () => {
  const doc = await boot();
  $(doc, "btn-play").click();
  assert.ok(visible(doc, "screen-match"));

  for (let round = 1; round <= 5; round++) {
    const text = $(doc, "event-text").textContent;
    assert.ok(text.length > 20, `round ${round} has no event text`);
    assert.ok(!/\{\w+\}/.test(text), `round ${round} left a placeholder: ${text}`);
    assert.match($(doc, "minute").textContent, /^דקה \d+'$/);

    const choices = doc.querySelectorAll("#choices .choice");
    assert.equal(choices.length, 2, `round ${round} has ${choices.length} choices`);
    choices[round % 2].click();

    assert.ok(visible(doc, "outcome"), `round ${round} showed no outcome`);
    assert.ok($(doc, "outcome-text").textContent.length > 15);
    assert.match($(doc, "score").textContent, /^\d+ - \d+$/);
    $(doc, "btn-next").click();
  }

  assert.ok(visible(doc, "screen-result"), "the result screen did not open");
  assert.match($(doc, "result-score").textContent, /^\d+ - \d+$/);
  assert.ok($(doc, "result-verdict").textContent.length > 5);
  assert.equal(doc.querySelectorAll("#result-log li").length, 5);
});

test("the finished match is written to history and survives a reload", async () => {
  const doc = await boot();
  $(doc, "btn-play").click();
  for (let i = 0; i < 5; i++) {
    doc.querySelector("#choices .choice").click();
    $(doc, "btn-next").click();
  }
  const finalScore = $(doc, "result-score").textContent;
  const saved = savedState(doc);
  assert.ok(saved, "nothing was written to localStorage");

  const doc2 = await boot(saved); // טעינה מחדש עם מה שנשמר
  $(doc2, "btn-history").click();
  assert.ok(visible(doc2, "screen-history"));
  const rows = doc2.querySelectorAll("#history-list li");
  assert.ok(rows.length >= 1, "history is empty after a match");
  assert.equal(rows[0].querySelector(".res").textContent, finalScore);
  assert.match($(doc2, "history-record").textContent, /ניצחונות/);
});

test("clearing history empties the list", async () => {
  const doc = await boot(JSON.stringify({
    version: 1,
    matches: [{ seed: 1, date: new Date().toISOString(), opponent: "מכבי חיפה", score: { us: 2, them: 1 }, rounds: [] }],
    record: { w: 1, d: 0, l: 0 }
  }));
  $(doc, "btn-history").click();
  assert.equal(doc.querySelectorAll("#history-list li").length, 1);
  $(doc, "btn-history").click();
  $(doc, "btn-clear").click();
  assert.equal(doc.querySelectorAll("#history-list li").length, 0);
  assert.ok(doc.querySelector("#history-list .empty"));
});

test("the event photo falls back to the shirt number when it fails to load", async () => {
  const doc = await boot();
  $(doc, "btn-play").click();
  const photo = $(doc, "event-photo");
  assert.ok(photo.hidden, "photo should stay hidden until it loads");
  assert.match($(doc, "event-number").textContent, /^\d+$/);
  assert.ok(photo.src.startsWith("https://"));
});
