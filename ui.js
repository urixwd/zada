// זדה בול — חיבור הלוגיקה למסך. כאן יושב כל מה שנוגע ל-DOM ול-localStorage.
import { EVENTS, OPPONENTS } from "./events.js";
import { SQUAD } from "./squad.js";
import { startMatch, choose, verdict, shareText, randomSeed } from "./game.js";
import { load, addMatch, clear } from "./storage.js";

const deps = { events: EVENTS, squad: SQUAD, opponents: OPPONENTS };
const store = (() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
})();

const $ = (id) => document.getElementById(id);
const screens = {
  home: $("screen-home"),
  match: $("screen-match"),
  result: $("screen-result"),
  history: $("screen-history")
};

let state = null;
let lastRound = null;

function show(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  window.scrollTo(0, 0);
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2200);
}

function recordLine() {
  const { record, matches } = load(store);
  if (!matches.length) return "עוד לא ניהלת משחק. מזל טוב, אתה עדיין אופטימי.";
  return `${matches.length} משחקים · ${record.w} ניצחונות · ${record.d} תיקו · ${record.l} הפסדים`;
}

// ───────── מסך המשחק ─────────

function renderScore(flash) {
  const el = $("score");
  el.textContent = `${state.us} - ${state.them}`;
  if (flash) {
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }
}

function renderPips() {
  $("pips").innerHTML = state.log
    .map((r) => `<i class="pip ${r.outcome}"></i>`)
    .concat(
      Array.from({ length: 5 - state.log.length }, (_, i) =>
        `<i class="pip ${i === 0 ? "on" : ""}"></i>`)
    )
    .join("");
}

function renderRound() {
  const { current } = state;
  const mainSlot = Object.keys(current.event.slots)[0];
  const player = current.ctx.players[mainSlot];
  const photo = $("event-photo");

  $("opponent").textContent = state.opponent;
  $("minute").textContent = `דקה ${current.minute}'`;
  $("event-text").textContent = current.text;
  $("event-number").textContent = player.number;
  photo.hidden = true;
  photo.alt = player.name;
  photo.onload = () => { photo.hidden = false; };
  photo.onerror = () => { photo.hidden = true; };
  photo.src = player.image_url;

  renderScore(false);
  renderPips();

  $("choices").hidden = false;
  $("choices").innerHTML = current.choices
    .map((text, i) => `<button class="choice" data-choice="${i}">${text}</button>`)
    .join("");
  $("outcome").hidden = true;
}

function onChoice(index) {
  const before = { us: state.us, them: state.them };
  const res = choose(state, index, deps);
  state = res.state;
  lastRound = res.resolved;

  const scored = res.resolved.score.us - before.us;
  const conceded = res.resolved.score.them - before.them;
  const parts = [];
  if (scored) parts.push(`${scored} לנו`);
  if (conceded) parts.push(`${conceded} להם`);

  $("choices").hidden = true;
  $("outcome-text").textContent = res.resolved.outcomeText;
  const scoreEl = $("outcome-score");
  scoreEl.className = `outcome-score ${res.resolved.outcome}`;
  scoreEl.textContent = parts.length ? `${parts.join(" · ")} — ${state.us} - ${state.them}` : `בלי שערים — ${state.us} - ${state.them}`;
  $("btn-next").textContent = state.finished ? "לשריקת הסיום" : "המשך";
  $("outcome").hidden = false;

  renderScore(Boolean(scored || conceded));
  renderPips();
}

function onNext() {
  if (state.finished) return finishMatch();
  renderRound();
}

// ───────── מסך הסיום ─────────

function finishMatch() {
  addMatch(store, {
    seed: state.seed,
    date: new Date().toISOString(),
    opponent: state.opponent,
    score: { us: state.us, them: state.them },
    rounds: state.log.map((r) => ({ eventId: r.eventId, choiceIndex: r.choiceIndex, outcome: r.outcome }))
  });

  $("result-score").textContent = `${state.us} - ${state.them}`;
  $("result-opponent").textContent = state.opponent;
  $("result-verdict").textContent = verdict(state.us, state.them);
  $("result-log").innerHTML = state.log
    .map((r) => `<li class="${r.outcome}"><b>${r.minute}'</b> ${r.choiceText}<br><span>${r.outcomeText}</span></li>`)
    .join("");
  show("result");
}

async function copySummary() {
  const text = shareText(state, location.href.split("#")[0]);
  try {
    await navigator.clipboard.writeText(text);
    toast("הועתק. לך תתפאר בוואטסאפ.");
  } catch {
    window.prompt("העתק את הסיכום:", text);
  }
}

function drawCard() {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, "#1a0305");
  bg.addColorStop(1, "#0b0b0c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#e50a10";
  ctx.fillRect(0, 0, size, 16);
  ctx.fillRect(0, size - 16, size, 16);

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f8f3eb";
  ctx.font = "900 78px Heebo, sans-serif";
  ctx.fillText("זדה בול", size / 2, 170);

  ctx.font = "700 40px Heebo, sans-serif";
  ctx.fillStyle = "#a09a93";
  ctx.fillText(`הפועל ירושלים מול ${state.opponent}`, size / 2, 250);

  ctx.font = "900 230px Heebo, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${state.us} - ${state.them}`, size / 2, 470);

  ctx.font = "700 42px Heebo, sans-serif";
  ctx.fillStyle = "#f8f3eb";
  wrap(ctx, verdict(state.us, state.them), size / 2, 570, size - 160, 58);

  ctx.font = "700 34px Heebo, sans-serif";
  state.log.forEach((r, i) => {
    ctx.fillStyle = r.outcome === "good" ? "#35c07a" : "#ff6a6f";
    ctx.fillText(`${r.minute}'  ${r.choiceText}`, size / 2, 730 + i * 62);
  });

  ctx.font = "400 30px Heebo, sans-serif";
  ctx.fillStyle = "#a09a93";
  ctx.fillText(location.host + location.pathname, size / 2, size - 60);
  return canvas;
}

function wrap(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let cursor = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cursor);
}

function downloadCard() {
  try {
    const canvas = drawCard();
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zada-ball-${state.us}-${state.them}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("התמונה ירדה. תשלח לקבוצה.");
    }, "image/png");
  } catch {
    toast("לא הצלחנו לייצר תמונה בדפדפן הזה.");
  }
}

// ───────── היסטוריה ─────────

function renderHistory() {
  const data = load(store);
  $("history-record").textContent = recordLine();
  $("history-list").innerHTML = data.matches.length
    ? data.matches
        .map((m) => {
          const cls = m.score.us > m.score.them ? "w" : m.score.us === m.score.them ? "d" : "l";
          const when = new Date(m.date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
          return `<li><span class="res ${cls}">${m.score.us} - ${m.score.them}</span><span>${m.opponent}</span><span class="when">${when}</span></li>`;
        })
        .join("")
    : `<p class="empty">אין עדיין משחקים. לך לנהל.</p>`;
  show("history");
}

// ───────── חיווט ─────────

function newMatch() {
  state = startMatch({ ...deps, seed: randomSeed() });
  lastRound = null;
  renderRound();
  show("match");
}

$("btn-play").addEventListener("click", newMatch);
$("btn-again").addEventListener("click", newMatch);
$("btn-history").addEventListener("click", renderHistory);
$("btn-history-back").addEventListener("click", () => {
  $("home-record").textContent = recordLine();
  show("home");
});
$("btn-home").addEventListener("click", () => {
  $("home-record").textContent = recordLine();
  show("home");
});
$("btn-clear").addEventListener("click", () => {
  clear(store);
  renderHistory();
  toast("נמחק. התחלה נקייה.");
});
$("btn-next").addEventListener("click", onNext);
$("btn-copy").addEventListener("click", copySummary);
$("btn-image").addEventListener("click", downloadCard);
$("choices").addEventListener("click", (e) => {
  const button = e.target.closest("[data-choice]");
  if (button) onChoice(Number(button.dataset.choice));
});

$("home-record").textContent = recordLine();
