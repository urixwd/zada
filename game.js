// זדה בול — לוגיקת המשחק. טהורה: בלי DOM, בלי localStorage, בלי Math.random.
// כל מה שצריך מוזרק פנימה, כדי שאפשר יהיה לבדוק הכל ב-node.

export const ROUND_PHASES = ["open", "mid", "mid", "end", "end"];
const MINUTE_RANGES = { open: [3, 20], mid: [24, 68], end: [72, 90] };

/** גנרטור אקראי עם זרע — אותו זרע = אותו משחק בדיוק. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

/** האם מצב התוצאה מתאים לתנאי האירוע. */
export function matchesWhen(when, us, them) {
  const diff = us - them;
  switch (when) {
    case "leading": return diff > 0;
    case "leading2": return diff >= 2;
    case "trailing": return diff < 0;
    case "trailing2": return diff <= -2;
    case "level": return diff === 0;
    case "any":
    default: return true;
  }
}

/** בוחר אירוע לסבב: שלב נכון, תנאי תוצאה מתאים, ולא אירוע שכבר יצא. */
export function pickEvent(events, phase, us, them, usedIds, rng) {
  const inPhase = events.filter((e) => e.phase === phase && !usedIds.includes(e.id));
  const fitting = inPhase.filter((e) => matchesWhen(e.when, us, them));
  const pool = fitting.length ? fitting : inPhase.filter((e) => (e.when || "any") === "any");
  if (!pool.length) throw new Error(`no event available for phase ${phase}`);
  return pick(rng, pool);
}

/** מגריל שחקן לכל משבצת לפי עמדה, בלי לחזור על אותו שחקן באותו אירוע. */
export function drawSlots(slots, squad, rng) {
  const taken = new Set();
  const out = {};
  for (const [slot, position] of Object.entries(slots)) {
    const options = squad.filter((p) => p.position === position && !taken.has(p.number));
    if (!options.length) throw new Error(`no player left for position ${position}`);
    const player = pick(rng, options);
    taken.add(player.number);
    out[slot] = player;
  }
  return out;
}

/** מחליף {slot} בשם, {opp} ביריבה, {min} בדקה ו-{n1}/{n2} במספרים. */
export function render(text, ctx) {
  return text.replace(/\{(\w+)\}/g, (whole, key) => {
    if (key === "opp") return ctx.opponent;
    if (key === "min") return String(ctx.minute);
    if (ctx.numbers[key] !== undefined) return String(ctx.numbers[key]);
    if (ctx.players[key]) return ctx.players[key].name;
    return whole;
  });
}

function buildRound(state, events, squad, rng) {
  const phase = ROUND_PHASES[state.round];
  const event = pickEvent(events, phase, state.us, state.them, state.usedIds, rng);
  const [lo, hi] = MINUTE_RANGES[phase];
  const ctx = {
    opponent: state.opponent,
    minute: randInt(rng, lo, hi),
    numbers: { n1: randInt(rng, 3, 6), n2: randInt(rng, 11, 17) },
    players: drawSlots(event.slots, squad, rng)
  };
  if (event.text.includes("{n1}%")) ctx.numbers.n1 = randInt(rng, 62, 78);
  state.usedIds.push(event.id);
  state.us += event.pre.us;
  state.them += event.pre.them;
  state.current = {
    eventId: event.id,
    phase,
    minute: ctx.minute,
    text: render(event.text, ctx),
    choices: event.choices.map((c) => c.text),
    ctx,
    event
  };
  return state;
}

/** מתחיל משחק חדש ומכין את הסבב הראשון. */
export function startMatch({ events, squad, opponents, seed }) {
  const rng = mulberry32(seed);
  const state = {
    seed,
    rng,
    opponent: pick(rng, opponents),
    us: 0,
    them: 0,
    round: 0,
    usedIds: [],
    log: [],
    finished: false,
    current: null
  };
  return buildRound(state, events, squad, rng);
}

/** בוחר אפשרות, מגריל תוצאה (50/50 נס או אסון) ומתקדם לסבב הבא. */
export function choose(state, choiceIndex, { events, squad }) {
  if (state.finished) throw new Error("match already finished");
  const { event, ctx } = state.current;
  const choice = event.choices[choiceIndex];
  if (!choice) throw new Error(`no choice ${choiceIndex} for event ${event.id}`);

  const isGood = state.rng() < 0.5;
  const outcome = isGood ? choice.good : choice.bad;
  state.us += outcome.us;
  state.them += outcome.them;

  const resolved = {
    round: state.round + 1,
    eventId: event.id,
    minute: state.current.minute,
    eventText: state.current.text,
    choiceIndex,
    choiceText: choice.text,
    outcome: isGood ? "good" : "bad",
    outcomeText: render(outcome.text, ctx),
    score: { us: state.us, them: state.them }
  };
  state.log.push(resolved);
  state.round += 1;

  if (state.round >= ROUND_PHASES.length) {
    state.finished = true;
    state.current = null;
  } else {
    buildRound(state, events, squad, state.rng);
  }
  return { state, resolved };
}

/** שורת סיכום מצחיקה לפי התוצאה הסופית. */
export function verdict(us, them) {
  const diff = us - them;
  if (diff >= 4) return "ערב כזה קורה פעם בעונה. תשמרו את הסרטון.";
  if (diff >= 2) return "ניצחון רגוע. אף אחד לא מאמין שזה קרה בלי דרמה.";
  if (diff === 1) return "ניצחון בשער. עשר שנים ירדו לך מהחיים, אבל שלוש נקודות.";
  if (diff === 0 && us === 0) return "0-0 אמיתי. גם זה משהו, אם אוהבים סבל.";
  if (diff === 0) return "תיקו עם שערים. בדיוק כמו שחששנו, בדיוק בדקה האחרונה.";
  if (diff === -1) return "הפסד בשער אחד. היה שווה, וזה לא מנחם אף אחד.";
  if (diff >= -3) return "הפסד. היציע שר עד הסוף, וזה יותר ממה שמגיע לנו.";
  return "אסון. תתחילו לחפש את המאמן הבא, זה כבר לא ייגמר טוב.";
}

/** טקסט קצר להעתקה לוואטסאפ. */
export function shareText(state, url) {
  const line = `זדה בול ⚽ הפועל ירושלים ${state.us}-${state.them} ${state.opponent}`;
  const marks = state.log.map((r) => (r.outcome === "good" ? "🟢" : "🔴")).join("");
  return `${line}\n${marks}\n${verdict(state.us, state.them)}\n${url}`;
}
