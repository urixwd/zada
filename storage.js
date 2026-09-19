// שכבת שמירה. הכל ב-localStorage, והכל עטוף ב-try/catch:
// אם אין אחסון (גלישה בסתר, חסימה) המשחק עדיין עובד, פשוט בלי היסטוריה.
const KEY = "zadaball.v1";
const MAX_MATCHES = 50;

const empty = () => ({ version: 1, matches: [], record: { w: 0, d: 0, l: 0 } });

export function load(store) {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.matches)) return empty();
    return { ...empty(), ...data };
  } catch {
    return empty();
  }
}

export function save(store, data) {
  try {
    store.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function addMatch(store, match) {
  const data = load(store);
  data.matches.unshift(match);
  data.matches = data.matches.slice(0, MAX_MATCHES);
  if (match.score.us > match.score.them) data.record.w += 1;
  else if (match.score.us === match.score.them) data.record.d += 1;
  else data.record.l += 1;
  save(store, data);
  return data;
}

export function clear(store) {
  try {
    store.removeItem(KEY);
  } catch {
    /* אין אחסון, אין מה לנקות */
  }
  return empty();
}
