# זדה בול (Zada Ball) — task spec

A single-page, Hebrew, RTL browser game about coaching Hapoel Jerusalem FC. Static site, no backend, deployed to GitHub Pages.

This document is the whole brief: background, product decisions, data, build plan, verification and tracker. An agent picking this up should need nothing else except the files in this directory.

---

## 1. Background

`raw.md` (in this directory) holds the original brief and the research it is based on. Short version:

- The inspiration is "ליגיונר", a viral Hebrew browser game (a footballer-career simulator) built in a week with Claude. It went viral because of sharp, local, Israeli-football humour.
- Zada Ball is deliberately **much simpler**: you are the coach of Hapoel Jerusalem for one match. Five rounds. Each round shows something that happened in the match and asks what you do. You pick one of two options, the game rolls an outcome, and after five rounds you get a final score.
- The joke of the game: for a Hapoel Jerusalem fan a match is a roulette wheel. Anything can happen at any moment, for better or worse. So the events are extreme and the outcomes are extreme.
- Tone: written for football obsessives, humorous, Israeli-football slang, not formal at all. Hebrew only.

`raw.md` also has this season's real results (2026), line-ups, scorers and notable moments. Several events reference them (Damashkan scoring after 37 seconds vs Maccabi Tel Aviv, Ziv Morgan's 90+2 equalizer for Tiberias, the disallowed penalty in Petah Tikva, home games played in Rehovot). Use it for flavour; invent freely beyond it.

---

## 2. Files in this directory

| File | What it is |
|---|---|
| `raw.md` | Original brief + 2026 season research. Background reading. |
| `events.md` | **The approved event list** — 37 events, each with 2 choices, grouped in 3 phases, plus an "all or nothing" section explaining how outcomes work. Source of truth for content. |
| `squad.json` | 24 players: `number`, `name`, `position` (`GK`/`CB`/`FB`/`MID`/`FWD`), `image_url` (wixstatic URLs, hotlinked). |
| `zada-logo.svg` | The game's logo. Has a baked-in cream background rect (`#F8F3EB`) — strip that rect so it sits on the dark theme, or keep it as a badge. |
| `TASK.md` | This file. |

---

## 3. Product decisions already made (do not re-litigate)

1. **Five rounds per match.** Round 1 from "שריקת פתיחה" (minutes 1–20), rounds 2–3 from "באמצע הבלגן" (21–70), rounds 4–5 from "דקות הכרעה" (71–90+). No event repeats within a match.
2. **Two choices per event.** Never three.
3. **Outcomes are all-or-nothing.** Each choice has one great outcome and one disastrous outcome, picked at random, ~50/50. A smart choice is not more likely to work. That unfairness is the joke — see the "⚡ איך נראות התוצאות" section at the bottom of `events.md`.
4. **Everything variable is randomized.** Player names, minutes, numbers in the text — all of it. Every name in an event is a slot by position, drawn at random from `squad.json` per event; event #25 can be any midfielder. No name, and no joke, is tied to one real player (not Damashkan's 37-second goal, not Idoko as top scorer). Within one event the draw is shared between the event text and its outcomes, and no two slots in one event resolve to the same player.
5. **All persistence is `localStorage`.** Match history, current match, W/D/L record. No backend, no accounts. Wrap every access in try/catch so the game still works with storage blocked (just without history).
6. **Branding:** Hapoel Jerusalem — red and black. Hebrew, RTL, mobile-first (most players will open it on a phone from a WhatsApp link).
7. **Content stays football-only.** Events are about what happens on the pitch: tactics, subs, cards, injuries, missed chances, the referee, the scoreline. No jokes about the club being badly run — no unpaid wages, no shady agents, no dodgy supplements, no broken floodlights. Real players are only attached to things that happen in a match.
8. **Deploy target: GitHub Pages**, repo `git@github.com:urixwd/zada.git`.
9. **Opponent is a real Ligat ha'Al club, drawn at random per match** (Maccabi Tel Aviv, Beitar, Tiberias, ...). It appears in the event text and in the final result.
10. **Scoring is goals only.** The match starts 0–0 and every outcome moves the score. No coach rating, no crowd meter, no hidden stats — what you see is what there is.
11. **Visuals: text plus a player photo.** An event card carries the photo of the player the event is about (from `squad.json`), the scoreline and the minute. Clean and fast, no heavy animation.
12. **Final screen offers both:** a copy-to-clipboard text summary for WhatsApp *and* a generated PNG result card.
13. **Target size: ~45 events.** The approved 37 in `events.md` plus about 8 more, so matches don't repeat themselves.

---

## 4. Game flow

```
Home screen  ──▶  Match (5 rounds)  ──▶  Final result  ──▶  History
   logo             event text            score + verdict     past matches
   "שחק"            2 choices             "עוד משחק"          W/D/L record
   history link     outcome + score
```

- **Score.** The match starts 0–0. Each outcome moves the score. A good outcome scores for Jerusalem or prevents a goal; a bad one concedes. Extremes are wanted — an outcome may add two or three goals at once. Outcome text and score change must agree.
- **Minute.** Each round shows a minute that advances through the match (roughly: round 1 in 1–20, rounds 2–3 in 21–70, rounds 4–5 in 71–90+), so the match reads like a match.
- **Final screen.** Final score, a humorous verdict matching the result (blowout win, last-minute collapse, and so on), the five decisions you made, replay button, and a copy-to-clipboard text summary for WhatsApp (no share link is possible — nothing is stored on a server).

---

## 5. Content work still to do

The 37 events in `events.md` are **approved by the user**. About 8 more are wanted (target ~45). The outcomes are **not written yet** — only four examples exist at the bottom of `events.md`. Someone must write, for every event × 2 choices:

- one 🎉 outcome (1–2 sentences, extreme, funny, in the same slang) with its score effect,
- one 💀 outcome, same.

Rules for outcome text: use the slots from the event so names stay consistent; keep it football-only (see 3.7); keep the extremes extreme (a 3–0 lead turning into 3–4 is exactly right). Also convert the events themselves into templates: replace each example name with a slot, using a role plus a trait where the joke depends on it, such as "the top scorer" or "the winger", rather than a specific player.

---

## 6. Technical plan

**Stack: plain HTML + hand-written CSS + vanilla JS, no framework, no build step.** GitHub Pages serves the repo root as-is. Tailwind's CDN build ships an engine to the browser and flashes unstyled content on a phone, and a prebuilt Tailwind would add a toolchain for a page this small; hand-written CSS for five screens is a few hundred lines. The one external resource is a Hebrew webfont from Google Fonts (Heebo or Assistant), because the default Hebrew font on Android is poor.

Suggested layout:

```
index.html          RTL Hebrew shell, all screens
styles.css          red/black theme, mobile-first
game.js             pure game logic, exported for tests (ESM)
events.js           the 37 event templates + outcomes (data only)
squad.json          squad (already here)
zada-logo.svg       logo (already here)
test/game.test.js   node:test unit tests
```

Requirements:

- `<html lang="he" dir="rtl">`.
- `game.js` must be **pure and injectable**: it takes the event list, the squad and a random function, and returns state. No DOM access, no `localStorage` access inside it — so Node can test it. The DOM wiring and storage live in `index.html` or a thin `ui.js`.
- **Seeded RNG.** Use a small seeded generator (e.g. mulberry32) everywhere instead of `Math.random`, so a match can be replayed from a seed and tests are deterministic. Store the seed with each saved match.
- Player photos come from `image_url` in `squad.json` (hotlinked from wixstatic). They may fail to load — always render a fallback (shirt number on a red circle).
- No external JS/CSS dependencies. Everything is local, so the game works from a `file://` open too, apart from `fetch`ing `squad.json` — if that is a problem, inline the squad into `events.js` or a `squad.js`.

**localStorage schema** (one key, versioned):

```js
localStorage["zadaball.v1"] = {
  version: 1,
  matches: [ { seed, date, score: {us, them}, rounds: [{eventId, choiceIndex, outcome: "good"|"bad"}] } ],
  record: { w: 0, d: 0, l: 0 }
}
```

Cap `matches` (keep the most recent 50) so the entry can't grow forever.

---

## 7. Verification — do this, don't skip it

The agent must be able to check its own work without asking a human.

1. **Unit tests** (`node --test`), on the pure logic:
   - a match always has exactly 5 rounds, with no repeated event;
   - phases come in the right order (1 opening, 2 middle, 2 closing);
   - the same seed reproduces the same match exactly;
   - slots resolve to players with the right position, and never the same player twice in one event;
   - every slot referenced in any text exists in that event's `slots`, and no slot is left unresolved (no stray `{...}` in rendered text) — run this over **all** events and choices and outcomes;
   - the score only ever changes as the chosen outcome declares;
   - the storage layer survives `localStorage` throwing (inject a fake that throws).
2. **Content lint** — a script asserting: 37 events, each with exactly 2 choices, each choice with a good and a bad outcome, no empty strings, no Latin characters left in player-facing Hebrew text by mistake.
3. **Manual browser check** — only at the end, and only after tests pass: run `python3 -m http.server` in the project directory, open it, play a full match, check RTL and phone width (~390px), verify the history screen persists after a reload.
4. **Deployment check** — after Pages is live, load the public URL and play one match.

---

## 8. Deployment — GitHub Pages

This directory is **not a git repository yet**. Steps:

1. `git init`, add a `.gitignore` (nothing to ignore yet), commit everything.
2. `git remote add origin git@github.com:urixwd/zada.git` (the repo already exists) and push to `main`.
3. Enable Pages: Settings → Pages → Source: "Deploy from a branch" → `main` / `/ (root)`. Or `gh api` the equivalent.
4. Because the site is served from `https://<user>.github.io/<repo>/`, **all asset paths must be relative** (`./styles.css`, not `/styles.css`).
5. Confirm the live URL works, then put it at the top of this file.

`raw.md` and `TASK.md` are committed too; they're harmless on Pages.

---

## 9. Project tracker

- [x] Collect background and this season's data (`raw.md`)
- [x] Agree the event list — 37 events, 2 choices each (`events.md`)
- [x] Squad with positions, 24 players (`squad.json`)
- [x] Logo in the project (`zada-logo.svg`)
- [x] Decide: role slots, localStorage, GitHub Pages, football-only content
- [x] **Event list approved by the user** (37 events, plus ~8 more wanted)
- [ ] Write ~8 more events, to ~45 total
- [ ] Write ~180 outcomes (45 events × 2 choices × good/bad), with score effects
- [ ] Convert events to templates with role slots → `events.js`
- [ ] `game.js` — pure logic: draw, slots, choices, scoring, seeded RNG
- [ ] Unit tests + content lint, all green
- [ ] `index.html` + `styles.css` — RTL, red/black, mobile-first, all screens
- [ ] localStorage layer: history, W/D/L record, try/catch
- [ ] Final screen: verdict + copy summary for WhatsApp + PNG result card
- [ ] Manual browser pass (full match, reload, phone width)
- [ ] git init + push to GitHub
- [ ] Enable Pages, verify the live URL, write it into this file

---

## 10. Open questions for the user

None open. Every decision above is the user's, taken 2026-09-20.
