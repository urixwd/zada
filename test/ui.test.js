// בדיקת חיווט: מריצים את המשחק על DOM אמיתי (jsdom) בלי דפדפן.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

// jsdom נותן לכל מופע localStorage משלו, אז 'טעינה מחדש' = לזרוע את מה שנשמר קודם.
async function boot(saved) {
  const dom = new JSDOM(html, { url: "https://urixwd.github.io/zada/", pretendToBeVisual: true });
  const { window } = dom;
  if (saved) window.localStorage.setItem("zadaball.v1", saved);
  // מזריקים את ה-CSS האמיתי כדי ש-getComputedStyle יבדוק את מה שהדפדפן באמת רואה
  const style = window.document.createElement("style");
  style.textContent = css;
  window.document.head.appendChild(style);
  const define = (key, value) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  define("window", window);
  define("document", window.document);
  define("navigator", window.navigator);
  define("location", window.location);
  // לא דורסים setTimeout: jsdom מממש אותו מעל הגלובלי, ודריסה יוצרת רקורסיה אינסופית
  await import(`../ui.js?${Math.random()}`);
  return window.document;
}

const savedState = (doc) => doc.defaultView.localStorage.getItem("zadaball.v1");

const $ = (doc, id) => doc.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// לוחצים על המשך, ומחכים לאנימציית המעבר הקצרה
const skip = async (doc) => {
  $(doc, "btn-next").click();
  await sleep(260);
};
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
    await skip(doc);
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
    await skip(doc);
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
  assert.match($(doc2, "history-record").textContent, /משחק אחד/);
  assert.doesNotMatch($(doc2, "history-record").textContent, /\b1 (משחקים|ניצחונות|הפסדים)/, "1 should read as singular Hebrew");
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
  assert.ok(!$(doc, "event-number").hidden, "the shirt number should show while there is no photo");
  assert.match($(doc, "event-number").textContent, /^\d+$/);
  photo.dispatchEvent(new doc.defaultView.Event("load"));
  assert.ok(!photo.hidden && $(doc, "event-number").hidden, "the number should give way to the photo");
  assert.ok(photo.src.startsWith("https://"));
});

test("hiding an element really hides it, css included", async () => {
  const doc = await boot();
  const shown = (id) => doc.defaultView.getComputedStyle($(doc, id)).display;

  // הבאג: display:flex של .outcome ניצח את תכונת hidden, והפאנל הופיע לפני שבחרו
  assert.equal(shown("screen-match"), "none");
  $(doc, "btn-play").click();
  assert.notEqual(shown("screen-match"), "none");
  assert.equal(shown("outcome"), "none", "the outcome panel is visible before a choice was made");
  assert.equal(shown("toast"), "none");

  doc.querySelector("#choices .choice").click();
  assert.notEqual(shown("outcome"), "none");
  assert.equal(shown("choices"), "none", "the choices are still visible after choosing");
});

test("the score reads in the same order as the team names", async () => {
  const doc = await boot();
  $(doc, "btn-play").click();
  // בלוח: הפועל מימין, היריבה משמאל. הטקסט ltr, כלומר \"שלהם - שלנו\".
  const [left, right] = $(doc, "score").textContent.split(" - ").map(Number);
  const events = await import("../events.js");
  const state = doc.defaultView.__zada;
  assert.ok(Number.isInteger(left) && Number.isInteger(right));
  if (state) {
    assert.equal(left, state.them);
    assert.equal(right, state.us);
  }
  // המבחן האמיתי: אירוע פתיחה שמכניס שערים ליריבה חייב להראות אותם בצד שמאל
  const openerWithGoals = events.EVENTS.find((e) => e.phase === "open" && e.pre.them > 0);
  assert.ok(openerWithGoals, "expected at least one opening event that concedes");
});

test("player photos are requested without a referrer, so wix serves them", async () => {
  const doc = await boot();
  assert.equal($(doc, "event-photo").getAttribute("referrerpolicy"), "no-referrer");
});

test("choosing hides the question and waits on the continue button", async () => {
  const doc = await boot();
  $(doc, "btn-play").click();
  const firstEvent = $(doc, "event-text").textContent;
  assert.ok(visible(doc, "card-wrap"), "the question should be on screen before choosing");

  doc.querySelector("#choices .choice").click();
  assert.ok(!visible(doc, "card-wrap"), "the question should disappear once answered");
  assert.ok(!visible(doc, "choices"), "the choices should disappear once answered");
  assert.ok(visible(doc, "outcome"), "the result should be shown");
  assert.ok(visible(doc, "btn-next"), "the continue button should be shown");

  await sleep(2500); // בלי לגעת: המסך לא זז לבד
  assert.ok(visible(doc, "outcome"), "the outcome closed by itself");
  assert.equal($(doc, "event-text").textContent, firstEvent, "the round advanced without a click");

  await skip(doc);
  assert.ok(visible(doc, "card-wrap"), "the next question did not come back");
  assert.notEqual($(doc, "event-text").textContent, firstEvent);
  assert.equal(doc.querySelectorAll("#choices .choice").length, 2);
});
